import { pipeline, TextToAudioPipeline } from "@huggingface/transformers";
import { split } from "./splitter";
import type { RawAudio } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Supertonic-TTS-ONNX";
const VOICES_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/voices/`;

let pipelinePromise: Promise<TextToAudioPipeline> | null = null;
let embeddingsPromise: Promise<Record<string, Float32Array>> | null = null;

export async function loadPipeline(progressCallback: (info: any) => void) {
  return pipelinePromise ??= (async () => {
    // @ts-ignore
    const tts = (await pipeline("text-to-speech", MODEL_ID, {
      device: "webgpu",
      progress_callback: progressCallback,
    })) as TextToAudioPipeline;

    // Warm up the model to compile shaders
    await tts("Hello", {
      speaker_embeddings: new Float32Array(1 * 101 * 128), // Dummy embedding
      num_inference_steps: 1,
      speed: 1.0,
    });

    return tts;
  })();
}

export async function loadEmbeddings() {
  return (embeddingsPromise ??= (async () => {
    const [female, male] = await Promise.all([
      fetch(`${VOICES_URL}F1.bin`).then((r) => r.arrayBuffer()),
      fetch(`${VOICES_URL}M1.bin`).then((r) => r.arrayBuffer()),
    ]);
    return {
      Female: new Float32Array(female),
      Male: new Float32Array(male),
    };
  })());
}

export interface StreamResult {
  time: number;
  audio: RawAudio;
  text: string;
  index: number;
  total: number;
}

function splitWithConstraints(text: string, { minCharacters = 1, maxCharacters = Infinity } = {}): string[] {
  if (!text) return [];
  const rawLines = split(text);
  const result: string[] = [];
  let currentBuffer = "";

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length > maxCharacters) {
      throw new Error(`A single segment exceeds the maximum character limit of ${maxCharacters} characters.`);
    }

    if (currentBuffer) currentBuffer += " ";
    currentBuffer += line;

    while (currentBuffer.length > maxCharacters) {
      result.push(currentBuffer.slice(0, maxCharacters));
      currentBuffer = currentBuffer.slice(maxCharacters);
    }
    if (currentBuffer.length >= minCharacters) {
      result.push(currentBuffer);
      currentBuffer = "";
    }
  }
  if (currentBuffer) result.push(currentBuffer);
  return result;
}

export async function* streamTTS(
  text: string,
  tts: TextToAudioPipeline,
  speaker_embeddings: Float32Array,
  quality: number,
  speed: number,
): AsyncGenerator<StreamResult> {
  const chunks = splitWithConstraints(text, {
    minCharacters: 100,
    maxCharacters: 1000,
  });

  if (chunks.length === 0) chunks.push(text);

  for (let i = 0; i < chunks.length; ++i) {
    const chunk = chunks[i];
    if (!chunk.trim()) continue;

    const output = (await tts(chunk, {
      speaker_embeddings,
      num_inference_steps: quality,
      speed,
    })) as RawAudio;

    if (i < chunks.length - 1) {
      // Add 0.5s silence between chunks for more natural flow
      const silenceSamples = Math.floor(0.5 * output.sampling_rate);
      const padded = new Float32Array(output.audio.length + silenceSamples);
      padded.set(output.audio);
      output.audio = padded;
    }
    yield {
      time: performance.now(),
      audio: output,
      text: chunk,
      index: i + 1,
      total: chunks.length,
    };
  }
}

export function createAudioBlob(chunks: Float32Array[], sampling_rate: number): Blob {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);

  // Create WAV header
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + totalLength * 4, true); // ChunkSize
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 3, true); // AudioFormat (3 = IEEE Float)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampling_rate, true); // SampleRate
  view.setUint32(28, sampling_rate * 4, true); // ByteRate
  view.setUint16(32, 4, true); // BlockAlign
  view.setUint16(34, 32, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, totalLength * 4, true); // Subchunk2Size

  return new Blob([buffer, ...chunks as any], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
