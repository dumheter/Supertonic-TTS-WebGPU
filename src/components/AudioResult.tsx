import React, { useRef } from "react";
import { Play, Pause, Download } from "lucide-react";

interface AudioResultProps {
  stats: {
    firstLatency: number | null;
    processingTime: number;
    charsPerSec: number;
    rtf: number;
    totalDuration: number;
    currentDuration: number;
  };
  progressPercentage: number;
  isGenerating: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDownload: () => void;
  onSeek: (percentage: number) => void;
}

export const AudioResult = ({
  stats,
  progressPercentage,
  isGenerating,
  isPlaying,
  onTogglePlay,
  onDownload,
  onSeek,
}: AudioResultProps) => {
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = (secs % 60).toFixed(2);
    return `${minutes}:${seconds.padStart(5, "0")}`;
  };

  const playbackProgress =
    stats.totalDuration > 0 ? Math.min(100, (stats.currentDuration / stats.totalDuration) * 100) : 0;

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      onSeek(percentage);
    }
  };

  return (
    <div className="mt-8 relative rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 border border-gray-200">
      <div
        className="absolute top-0 left-0 bottom-0 bg-[#E5E7EB] transition-all duration-500 ease-out -z-10"
        style={{ width: `${progressPercentage}%` }}
      />
      <div className="absolute top-0 left-0 w-full h-full bg-gray-50 -z-20" />

      <div className="p-4 flex flex-col md:flex-row items-center gap-6 relative z-10">
        <div className="flex flex-col min-w-[80px]">
          <span className="text-blue-600 font-semibold text-lg leading-tight">Supertonic</span>
          <span className="text-gray-600 text-sm font-medium">On-Device</span>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-x-8 gap-y-1 text-center border-l border-r border-gray-300 px-4 md:px-8">
          <div className="flex flex-col items-center">
            <div className="font-mono text-gray-900 text-lg tracking-tight">
              {stats.firstLatency !== null ? (
                <>
                  <span className="text-[10px] text-gray-500 font-sans font-bold uppercase mr-1 align-middle">
                    First
                  </span>
                  {stats.firstLatency.toFixed(2)}
                  <span className="text-sm text-gray-500">s</span>
                  <span className="mx-1 text-gray-400">/</span>
                </>
              ) : null}
              {stats.processingTime.toFixed(2)}
              <span className="text-sm text-gray-500">s</span>
            </div>
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-1">Processing Time ↓</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-mono text-gray-900 text-lg tracking-tight">
              {stats.charsPerSec > 0 ? stats.charsPerSec.toFixed(1) : "-"}
            </div>
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-1">Chars/sec ↑</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="font-mono text-gray-900 text-lg tracking-tight">
              {stats.rtf > 0 ? stats.rtf.toFixed(3) : "-"}
              <span className="text-sm text-gray-500">x</span>
            </div>
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-1">RTF ↓</div>
          </div>
        </div>

        <div className="flex items-center gap-4 min-w-[300px] w-full md:w-auto">
          <button
            onClick={onTogglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 text-gray-800 bg-white hover:bg-gray-100 shadow-sm`}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <span className="font-mono text-xs text-gray-600 w-[50px] text-right">
            {formatTime(stats.currentDuration)}
          </span>

          <div
            ref={progressBarRef}
            className="relative flex-1 h-1.5 bg-gray-300 rounded-full overflow-hidden min-w-[100px] cursor-pointer hover:h-2 transition-all group"
            onClick={handleSeekClick}
          >
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 rounded-full group-hover:bg-blue-600"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>

          <span className="font-mono text-xs text-gray-600 w-[50px]">{formatTime(stats.totalDuration)}</span>

          <button
            onClick={onDownload}
            disabled={isGenerating}
            className={`p-2 rounded-full text-gray-700 transition-colors ${isGenerating ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"}`}
          >
            <Download size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
