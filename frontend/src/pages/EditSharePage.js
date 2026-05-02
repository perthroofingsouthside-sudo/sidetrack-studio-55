import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Scissors, Share2, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export default function EditSharePage({ recording, song, onBack }) {
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
    a.download = `sidetrack-${recording.type}-${Date.now()}.${recording.type === "video" ? "webm" : "webm"}`;
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
          title: `My cover of ${song?.title || "a song"} | SIDETRACK`,
          text: `Check out my cover on SIDETRACK!`,
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
          <Button data-testid="go-back-btn" onClick={onBack} className="mt-4 bg-[#FF6B00]">
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
            <Scissors className="w-4 h-4 text-[#FF6B00]" />
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
                    key={i}
                    className={`flex-1 rounded-full transition-colors ${
                      inRange ? "bg-[#FF6B00]" : "bg-white/10"
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
              className="flex-1 bg-[#12121A] border border-white/10 hover:border-[#FF6B00]/40 text-white"
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

      {/* Download */}
      <div className="px-4 py-2">
        <Button
          data-testid="download-btn"
          onClick={handleDownload}
          className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold rounded-2xl glow-orange transition-all hover:-translate-y-0.5"
        >
          <Download className="w-5 h-5 mr-2" />
          Download Recording
        </Button>
      </div>

      {/* Social Share */}
      <div className="px-4 py-4" data-testid="social-share-section">
        <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Share to Social
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Instagram", color: "bg-gradient-to-br from-[#833AB4] to-[#E1306C]" },
            { name: "TikTok", color: "bg-[#12121A] border border-white/10" },
            { name: "Twitter / X", color: "bg-[#12121A] border border-white/10" },
            { name: "YouTube", color: "bg-[#FF0000]/20 border border-[#FF0000]/30" },
          ].map((platform) => (
            <Button
              key={platform.name}
              data-testid={`share-${platform.name.toLowerCase().replace(/[\s\/]/g, "-")}-btn`}
              onClick={() => handleShare(platform.name)}
              className={`h-12 rounded-2xl text-white font-medium transition-all hover:-translate-y-0.5 ${platform.color}`}
            >
              {platform.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
