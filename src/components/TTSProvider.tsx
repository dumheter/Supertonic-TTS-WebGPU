import { useState, useEffect, useRef } from "react";
import { loadPipeline, loadEmbeddings } from "../tts";
import { TTSContext } from "./TTSContext";

import type { ReactNode } from "react";
import type { TextToAudioPipeline } from "@huggingface/transformers";

export const TTSProvider = ({ children }: { children: ReactNode }) => {
  const [pipelineReady, setPipelineReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const tts = useRef<TextToAudioPipeline | null>(null);
  const speakerEmbeddings = useRef<Record<string, Float32Array> | null>(null);

  useEffect(() => {
    if (pipelineReady) return;

    const progressMap = new Map<string, number>();
    const onProgress = (info: any) => {
      if (info.status === "progress" && info.file.endsWith(".onnx_data")) {
        progressMap.set(info.file, info.loaded / info.total);
        const total = Array.from(progressMap.values()).reduce((a, b) => a + b, 0);
        setDownloadProgress((total / 3) * 100); // 3 model files to download
      }
    };

    Promise.all([loadPipeline(onProgress), loadEmbeddings()]).then(([pipeline, embeddings]) => {
      tts.current = pipeline;
      speakerEmbeddings.current = embeddings;
      setPipelineReady(true);
    });
  }, [pipelineReady]);

  return (
    <TTSContext.Provider
      value={{
        pipelineReady,
        downloadProgress,
        tts,
        speakerEmbeddings,
      }}
    >
      {children}
    </TTSContext.Provider>
  );
};
