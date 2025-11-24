import { useState, useEffect, useRef } from "react";
import { Zap, AlignLeft, Quote, Type, FileText, Check, X, Dices } from "lucide-react";
import { useTTS } from "./components/TTSContext";
import { TTSProvider } from "./components/TTSProvider";
import { streamTTS, createAudioBlob } from "./tts";
import { SAMPLE_RATE, EXAMPLE_SENTENCES } from "./constants";
import { AudioResult } from "./components/AudioResult";
import { Controls } from "./components/Controls";

const AppContent = () => {
  const [text, setText] = useState(
    "Introducing Supertonic WebGPU: blazingly fast text-to-speech running 100% locally in your browser.",
  );
  const [activeTab, setActiveTab] = useState<string | null>("Freeform");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quality, setQuality] = useState(5);
  const [speed, setSpeed] = useState(1.0);
  const [voice, setVoice] = useState("Female");

  const { pipelineReady, tts, speakerEmbeddings, downloadProgress } = useTTS();

  const [stats, setStats] = useState({
    firstLatency: null as number | null,
    processingTime: 0,
    charsPerSec: 0,
    rtf: 0,
    totalDuration: 0,
    currentDuration: 0,
  });
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const fullAudioBufferRef = useRef<Float32Array[]>([]);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackAnimationFrameRef = useRef<number>(0);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const isPlaybackInterruptedRef = useRef(false);
  const stopGenerationRef = useRef(false);

  const [exampleTexts, setExampleTexts] = useState<Record<string, string | string[]>>(EXAMPLE_SENTENCES);

  useEffect(() => {
    fetch("/the-great-gatsby.txt")
      .then((res) => res.text())
      .then((text) => {
        setExampleTexts((prev) => ({ ...prev, "Full story": text }));
      })
      .catch((e) => console.error("Failed to load story", e));
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      cancelAnimationFrame(playbackAnimationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const updatePlaybackUI = () => {
      if (isPlaying && audioContextRef.current) {
        const ctx = audioContextRef.current;
        const elapsed = ctx.currentTime - playbackStartTimeRef.current;

        // If reached end of current known duration
        if (elapsed >= stats.totalDuration && !isGenerating && stats.totalDuration > 0) {
          setIsPlaying(false);
          setStats((prev) => ({
            ...prev,
            currentDuration: prev.totalDuration,
          })); // Snap to end
          return;
        }

        setStats((prev) => ({
          ...prev,
          currentDuration: Math.min(elapsed, prev.totalDuration),
        }));

        playbackAnimationFrameRef.current = requestAnimationFrame(updatePlaybackUI);
      }
    };

    if (isPlaying) {
      playbackAnimationFrameRef.current = requestAnimationFrame(updatePlaybackUI);
    } else {
      cancelAnimationFrame(playbackAnimationFrameRef.current);
    }
  }, [isPlaying, isGenerating, stats.totalDuration]);

  const handleExampleClick = (type: string) => {
    setActiveTab(type);
    let selection = exampleTexts[type];
    if (Array.isArray(selection)) {
      setText(selection[Math.floor(Math.random() * selection.length)]);
      return;
    }
    setText(selection);
  };

  const stopAllAudio = () => {
    activeSourceNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch (e) {}
    });
    activeSourceNodesRef.current = [];
  };

  const handleStop = () => {
    stopGenerationRef.current = true;
  };

  const handleGenerate = async () => {
    if (isGenerating) return;

    stopAllAudio();

    setShowResults(true);
    setIsGenerating(true);
    setGenerationProgress(0);
    stopGenerationRef.current = false;
    setStats({
      firstLatency: null,
      processingTime: 0,
      charsPerSec: 0,
      rtf: 0,
      totalDuration: 0,
      currentDuration: 0,
    });
    fullAudioBufferRef.current = [];
    isPlaybackInterruptedRef.current = false;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    nextPlayTimeRef.current = ctx.currentTime + 0.1;
    playbackStartTimeRef.current = nextPlayTimeRef.current;
    setIsPlaying(true);

    const startTime = performance.now();
    let processedChars = 0;
    let generatedAudioSeconds = 0;

    try {
      if (!tts.current || !speakerEmbeddings.current) throw new Error("TTS pipeline not ready");
      const selectedEmbedding = speakerEmbeddings.current[voice];

      for await (const result of streamTTS(text, tts.current, selectedEmbedding, quality, speed)) {
        if (stopGenerationRef.current) {
          break;
        }

        const now = performance.now();
        const elapsedSec = (now - startTime) / 1000;

        setStats((prev) => ({
          ...prev,
          firstLatency: prev.firstLatency === null ? elapsedSec : prev.firstLatency,
          processingTime: elapsedSec,
        }));

        const chunkDuration = result.audio.audio.length / result.audio.sampling_rate;
        generatedAudioSeconds += chunkDuration;

        fullAudioBufferRef.current.push(result.audio.audio);

        // Only schedule streaming playback if user hasn't interrupted
        if (!isPlaybackInterruptedRef.current) {
          const buffer = ctx.createBuffer(1, result.audio.audio.length, result.audio.sampling_rate);
          buffer.copyToChannel(result.audio.audio as any, 0);

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(nextPlayTimeRef.current);

          activeSourceNodesRef.current.push(source);
          source.onended = () => {
            const idx = activeSourceNodesRef.current.indexOf(source);
            if (idx > -1) activeSourceNodesRef.current.splice(idx, 1);
          };

          nextPlayTimeRef.current += buffer.duration;
        }

        processedChars += result.text.length;
        const currentRtf = elapsedSec / generatedAudioSeconds;
        const currentCharsPerSec = processedChars / elapsedSec;

        setStats((prev) => ({
          ...prev,
          charsPerSec: currentCharsPerSec,
          rtf: currentRtf,
          totalDuration: generatedAudioSeconds,
        }));

        setGenerationProgress((result.index / result.total) * 100);
      }
    } catch (e) {
      console.error("Generation failed", e);
    } finally {
      setIsGenerating(false);
      isPlaybackInterruptedRef.current = false; // Reset after completion
    }
  };

  const handleSeek = (percentage: number) => {
    if (!audioContextRef.current || fullAudioBufferRef.current.length === 0) return;

    const ctx = audioContextRef.current;

    isPlaybackInterruptedRef.current = true;
    stopAllAudio();

    const seekTime = stats.totalDuration * percentage;

    let currentTimeInAudio = 0;
    let nextPlayTime = ctx.currentTime;

    // Reset startTime such that (currentTime - startTime) = seekTime
    playbackStartTimeRef.current = ctx.currentTime - seekTime;

    for (const chunk of fullAudioBufferRef.current) {
      const chunkDuration = chunk.length / SAMPLE_RATE;
      const chunkEndTime = currentTimeInAudio + chunkDuration;

      if (chunkEndTime > seekTime) {
        // This chunk needs to be played
        const offsetInChunk = Math.max(0, seekTime - currentTimeInAudio);
        const durationToPlay = chunkDuration - offsetInChunk;

        const buffer = ctx.createBuffer(1, chunk.length, SAMPLE_RATE);
        buffer.copyToChannel(chunk as any, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        source.start(nextPlayTime, offsetInChunk);

        activeSourceNodesRef.current.push(source);
        source.onended = () => {
          const idx = activeSourceNodesRef.current.indexOf(source);
          if (idx > -1) activeSourceNodesRef.current.splice(idx, 1);
        };

        nextPlayTime += durationToPlay;
      }

      currentTimeInAudio += chunkDuration;
    }

    if (ctx.state === "suspended") ctx.resume();
    setIsPlaying(true);
  };

  const handleDownload = () => {
    if (fullAudioBufferRef.current.length === 0) return;
    const blob = createAudioBlob(fullAudioBufferRef.current, SAMPLE_RATE);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audio.wav";
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePlay = async () => {
    if (!audioContextRef.current) return;

    if (isPlaying) {
      setIsPlaying(false);
      audioContextRef.current.suspend();
    } else {
      setIsPlaying(true);
      audioContextRef.current.resume();

      // If we finished playing and hit play again, replay from start
      if (!isGenerating && stats.currentDuration >= stats.totalDuration) {
        handleSeek(0);
      } else if (!isGenerating && fullAudioBufferRef.current.length > 0 && activeSourceNodesRef.current.length === 0) {
        // This handles the case where we paused/stopped but haven't technically reached "end" OR we are resuming replay
        const currentProgress = stats.totalDuration > 0 ? stats.currentDuration / stats.totalDuration : 0;
        handleSeek(currentProgress);
      }
    }
  };

  const canGenerate = text.length >= 10 && pipelineReady;

  return (
    <div className="min-h-screen bg-[#F2F2F2] font-sans text-gray-900 selection:bg-yellow-200 flex items-center justify-center py-10">
      <div className="w-full max-w-7xl px-4 md:px-6">
        <div className="text-center mb-10">
          <h3 className="text-4xl md:text-6xl font-medium text-gray-900 tracking-tight">Supertonic WebGPU</h3>
          <h4 className="text-gray-600 mt-3 text-2xl md:text-3xl font-light">
            Generate speech directly in your browser
          </h4>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 max-w-7xl mx-auto p-2">
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 border-b border-gray-100 bg-white relative rounded-t-xl">
            <div className="px-8 py-6 flex items-center justify-center">
              <div className="text-3xl font-normal text-gray-800">Text</div>
            </div>

            <div className="px-8 py-6 flex flex-col items-center justify-center relative bg-gray-50/30 md:bg-white">
              <div className="text-3xl font-normal text-gray-800 mb-2">Speech</div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-full z-10 shadow-sm border border-gray-50">
              <Zap className="text-yellow-400 fill-yellow-400 drop-shadow-sm" size={32} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row min-h-[450px]">
            <div className="w-full md:w-1/2 p-8 border-r border-gray-100 flex flex-col bg-white relative">
              <textarea
                className="w-full flex-grow text-xl md:text-2xl text-gray-800 placeholder-gray-300 outline-none resize-none font-light leading-relaxed bg-transparent"
                placeholder="This text-to-speech system runs entirely in your browser, providing fast and private operation without sending any data to external servers."
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setActiveTab("Freeform");
                }}
                spellCheck={false}
              />

              <div className="mt-auto w-full">
                <div className="flex justify-end mb-2">
                  <div className="flex items-center gap-2 text-xs md:text-sm font-mono text-gray-400">
                    {text.length > 0 ? text.length : 0} chars
                    {text.length >= 10 ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <X size={14} className="text-red-500" />
                    )}
                  </div>
                </div>

                <div className="pt-6 flex flex-wrap items-center border-t border-gray-100 text-gray-500">
                  <div className="flex gap-3 md:gap-5 text-sm md:text-base overflow-x-auto pb-2 md:pb-0 w-full">
                    {Object.keys(exampleTexts).map((key) => (
                      <button
                        key={key}
                        onClick={() => handleExampleClick(key)}
                        className={`flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === key ? "text-blue-600 font-semibold border-b-2 border-blue-500 pb-0.5" : "hover:text-gray-900"}`}
                      >
                        {key === "Quote" && <Quote size={16} />}
                        {key === "Paragraph" && <AlignLeft size={16} />}
                        {key === "Full story" && <FileText size={16} />}
                        {key === "Random" && <Dices size={16} />}
                        {key === "Freeform" && <Type size={16} />}
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Controls
              quality={quality}
              setQuality={setQuality}
              speed={speed}
              setSpeed={setSpeed}
              voice={voice}
              setVoice={setVoice}
              onGenerate={handleGenerate}
              onStop={handleStop}
              isGenerating={isGenerating}
              canGenerate={canGenerate}
              pipelineReady={pipelineReady}
              progress={generationProgress}
              loadingProgress={downloadProgress}
            />
          </div>

          {showResults && (
            <div className="px-4 pb-4">
              <AudioResult
                stats={stats}
                progressPercentage={generationProgress}
                isGenerating={isGenerating}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onDownload={handleDownload}
                onSeek={handleSeek}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <TTSProvider>
      <AppContent />
    </TTSProvider>
  );
};

export default App;
