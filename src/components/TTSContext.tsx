import { createContext, useContext } from "react";
import type { RefObject } from "react";
import type { TextToAudioPipeline } from "@huggingface/transformers";

export interface TTSContextType {
  pipelineReady: boolean;
  downloadProgress: number;
  tts: RefObject<TextToAudioPipeline | null>;
  speakerEmbeddings: RefObject<Record<string, Float32Array> | null>;
}

export const TTSContext = createContext<TTSContextType | undefined>(undefined);

export const useTTS = () => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error("useTTS must be used within a TTSProvider");
  }
  return context;
};
