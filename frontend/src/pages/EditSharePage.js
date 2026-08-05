import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Scissors, Share2, Download, RotateCcw, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import PublishPanel from "@/components/PublishPanel";

export default function EditSharePage({ recording, song, onBack, onOpenInStudio }) {
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (recording?.url) {
      if (recording.type === "video" && videoRef.current) {
        videoRef.current.src = recording.url;
      } else if (audioRef.current) {
        audioRef.current.src = recording.url;
      }
    }
  }, [recording]);

  const handlePlayPreview = () => {
    const el = recording?.type === "video" ? videoRef.current : audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      const dur = recording?.duration || 30;
      el.currentTime = (trimStart / 100) * dur;
      el.play();
      setIsPlaying(true);

      const checkEnd = setInterval(() => {
        if (el.currentTime >= (trimEnd / 100) * dur) {
          el.pause();
          setIsPlaying(false);
          clearInterval(checkEnd);
        }
      }, 100);
    }
  };

  const handleDownload = () => {
    if (!recording?.url) return;
    const a = document.createElement("a");
    a.href = recording.url;
    a.download = `pocket-products-${recording.type}-${Date.now()}.${recording.type === "video" ? "webm" : "webm"}`;
    a.click();
    toast.success("Download started!");
  };

  const handleShare = async (platform) => {
    if (navigator.share && recording?.blob) {
      try {
        const file = new File([recording.blob], `aurasplit-recording.webm`, {
          type: recording.blob.type,
        });
        await navigator.share({
          title: `My cover of ${song?.title || "a song"} | Pocket Products`,
          text: `Check out my cover on Pocket Products!`,
          files: [file],
        });
        toast.success("Shared successfully!");
      } catch (err) {
        if (err.name !== "AbortError") {
          toast.info(`Share to ${platform} - copied to clipboard!`);
        }
      }
    } else {
      toast.info(`Share to ${platform} - Use download to save first!`);
    }
  };

  if (!recording) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#A0A0B0]">No recording to edit</p>
          <Button data-testid="go-back-btn" onClick={onBack} className="mt-4 bg-[#FF5F1F]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const waveformBars = Array.from({ length: 60 }, () => Math.random() * 80 + 20);

  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="edit-share-page">
      {/* Header */}
      <div className="glass-heavy px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Button
          data-testid="edit-back-btn"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-[#A0A0B0] hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-['Outfit'] text-lg font-bold">Edit & Share</h2>
          <p className="text-xs text-[#A0A0B0]">
            {song?.title || "Recording"} - {recording.type === "video" ? "Video" : "Audio"}
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="px-4 py-4">
        {recording.type === "video" ? (
          <div className="w-full rounded-2xl overflow-hidden border border-white/10 bg-[#12121A]">
            <video
              ref={videoRef}
              controls
              playsInline
              className="w-full max-h-[300px] object-contain bg-black"
              data-testid="edit-video-preview"
            />
          </div>
        ) : (
          <audio ref={audioRef} className="hidden" />
        )}
      </div>

      {/* Waveform Editor */}
      <div className="px-4 py-4" data-testid="waveform-editor">
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scissors className="w-4 h-4 text-[#FF5F1F]" />
            <span className="text-sm font-['Outfit'] font-bold text-white">Trim</span>
          </div>

          {/* Waveform visualization */}
          <div className="relative h-20 mb-4 bg-[#05050A] rounded-xl overflow-hidden px-2">
            <div className="flex items-end h-full gap-[1px] py-2">
              {waveformBars.map((h, i) => {
                const pct = (i / waveformBars.length) * 100;
                const inRange = pct >= trimStart && pct <= trimEnd;
                return (
                  <div
                    key={`bar-${i}`}
                    className={`flex-1 rounded-full transition-colors ${
                      inRange ? "bg-[#FF5F1F]" : "bg-white/10"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
            {/* Trim overlay left */}
            <div
              className="absolute top-0 left-0 h-full bg-[#05050A]/70"
              style={{ width: `${trimStart}%` }}
            />
            {/* Trim overlay right */}
            <div
              className="absolute top-0 right-0 h-full bg-[#05050A]/70"
              style={{ width: `${100 - trimEnd}%` }}
            />
          </div>

          {/* Trim sliders */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#A0A0B0] w-12">Start</span>
              <Slider
                data-testid="trim-start-slider"
                value={[trimStart]}
                onValueChange={([v]) => setTrimStart(Math.min(v, trimEnd - 5))}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-[#A0A0B0] w-10 text-right">{trimStart}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#A0A0B0] w-12">End</span>
              <Slider
                data-testid="trim-end-slider"
                value={[trimEnd]}
                onValueChange={([v]) => setTrimEnd(Math.max(v, trimStart + 5))}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-[#A0A0B0] w-10 text-right">{trimEnd}%</span>
            </div>
          </div>

          {/* Preview + Reset */}
          <div className="flex gap-3 mt-4">
            <Button
              data-testid="preview-trim-btn"
              onClick={handlePlayPreview}
              className="flex-1 bg-[#12121A] border border-white/10 hover:border-[#FF5F1F]/40 text-white"
            >
              {isPlaying ? "Stop Preview" : "Preview Trim"}
            </Button>
            <Button
              data-testid="reset-trim-btn"
              variant="ghost"
              size="icon"
              onClick={() => { setTrimStart(0); setTrimEnd(100); }}
              className="text-[#A0A0B0] hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Take to Studio + Download */}
      <div className="px-4 py-2 space-y-2">
        <Button
          data-testid="open-in-studio-btn"
          onClick={() => onOpenInStudio && onOpenInStudio(recording)}
          className="w-full h-12 bg-gradient-to-r from-[#FF5F1F] to-[#39FF14] hover:opacity-90 text-[#05050A] font-black rounded-2xl transition-all hover:-translate-y-0.5"
          style={{ boxShadow: "0 0 24px rgba(255,95,31,0.35)" }}
        >
          <Music2 className="w-5 h-5 mr-2" />
          Open in Studio · Remix & Separate Stems
        </Button>
        <Button
          data-testid="download-btn"
          onClick={handleDownload}
          variant="ghost"
          className="w-full h-11 border border-[#FF5F1F]/30 text-[#FF5F1F] font-bold rounded-2xl hover:bg-[#FF5F1F]/10 transition-all"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Recording
        </Button>
      </div>

      {/* Publish & Stream */}
      <div className="px-4 py-4">
        <PublishPanel recording={recording} song={song} />
      </div>
    </div>
  );
}
