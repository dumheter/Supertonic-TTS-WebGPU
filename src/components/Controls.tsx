import { Zap, Square } from "lucide-react";

interface ControlsProps {
  quality: number;
  setQuality: (value: number) => void;
  speed: number;
  setSpeed: (value: number) => void;
  voice: string;
  setVoice: (value: string) => void;
  onGenerate: () => void;
  onStop: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  pipelineReady: boolean;
  progress?: number;
  loadingProgress: number;
}

export const Controls = ({
  quality,
  setQuality,
  speed,
  setSpeed,
  voice,
  setVoice,
  onGenerate,
  onStop,
  isGenerating,
  canGenerate,
  pipelineReady,
  progress,
  loadingProgress,
}: ControlsProps) => {
  return (
    <div className="w-full md:w-1/2 p-8 bg-[#F9FAFB] flex flex-col gap-8 border-t md:border-t-0">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-900">Voice:</span>
        <div className="flex gap-4 text-sm">
          {["Female1", "Female2", "Male1", "Male2"].map((v) => (
            <button
              key={v}
              onClick={() => setVoice(v)}
              className={`pb-1 transition-all font-medium border-b-2 ${
                voice === v ? "text-blue-600 border-blue-600" : "text-gray-400 hover:text-gray-600 border-transparent"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-3 items-end">
          <span className="font-semibold text-gray-900 text-sm">
            Quality (Steps): <span className="text-base">{quality}</span>
          </span>
          <span className="text-gray-400 text-xs italic">Higher = Better quality but slower</span>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={quality}
          onChange={(e) => setQuality(parseInt(e.target.value))}
          className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-gray-900 hover:accent-blue-600"
        />
        <div className="w-full flex justify-center mt-1">
          <div className="w-0.5 h-1 bg-gray-300"></div>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-3 items-end">
          <span className="font-semibold text-gray-900 text-sm">
            Speed: <span className="text-base">{speed.toFixed(2)}x</span>
          </span>
          <span className="text-gray-400 text-xs italic">Higher = faster speech</span>
        </div>
        <input
          type="range"
          min="0.8"
          max="1.2"
          step="0.01"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-gray-900 hover:accent-blue-600"
        />
        <div className="w-full flex justify-center mt-1">
          <div className="w-0.5 h-1 bg-gray-300"></div>
        </div>
      </div>

      <div className="mt-auto pt-4 flex gap-2">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !canGenerate}
          className={`
            flex-1 py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 shadow-sm transition-all
            ${
              isGenerating || !canGenerate
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-yellow-400 text-gray-900 hover:bg-yellow-300 active:scale-[0.99]"
            }
          `}
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              <span>
                Generating... {progress !== undefined && <span className="font-mono">({Math.round(progress)}%)</span>}
              </span>
            </>
          ) : (
            <>
              <Zap size={20} className={!canGenerate ? "fill-gray-400" : "fill-black"} />
              {pipelineReady ? (
                "Generate Speech"
              ) : (
                <span>
                  Loading Model...
                  {loadingProgress > 0 && <span className="font-mono"> ({Math.round(loadingProgress)}%)</span>}
                </span>
              )}
            </>
          )}
        </button>
        {isGenerating && (
          <button
            onClick={onStop}
            className="px-6 rounded-lg font-bold text-lg flex items-center justify-center shadow-sm transition-all bg-red-100 text-red-600 hover:bg-red-200 active:scale-[0.99]"
          >
            <Square size={20} fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  );
};
