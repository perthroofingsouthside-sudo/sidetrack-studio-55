import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";

const STEMS = [
  { key: "vocals", label: "VOX", color: "#39FF14", bgClass: "bg-[#39FF14]" },
  { key: "guitar", label: "GTR", color: "#FF6B00", bgClass: "bg-[#FF6B00]" },
  { key: "bass", label: "BAS", color: "#FF3B30", bgClass: "bg-[#FF3B30]" },
  { key: "drums", label: "DRM", color: "#FF6B00", bgClass: "bg-[#FF6B00]" },
];

export default function StemMixer({ volumes, muted, onVolumeChange, onMuteToggle }) {
  return (
    <div className="surface-card p-4" data-testid="stem-mixer">
      <div className="grid grid-cols-4 gap-4">
        {STEMS.map((stem) => (
          <div key={stem.key} className="flex flex-col items-center gap-3">
            {/* Volume value */}
            <span className="text-xs font-mono" style={{ color: stem.color }}>
              {muted[stem.key] ? "0" : volumes[stem.key]}
            </span>

            {/* Vertical slider container */}
            <div className="h-32 flex items-center justify-center">
              <Slider
                data-testid={`stem-${stem.key}-slider`}
                orientation="vertical"
                value={[muted[stem.key] ? 0 : volumes[stem.key]]}
                onValueChange={([v]) => onVolumeChange(stem.key, v)}
                max={100}
                step={1}
                className={`h-full slider-${stem.key}`}
              />
            </div>

            {/* Mute button */}
            <Button
              data-testid={`stem-${stem.key}-mute`}
              onClick={() => onMuteToggle(stem.key)}
              variant="ghost"
              size="icon"
              className={`w-10 h-10 rounded-full transition-all ${
                muted[stem.key]
                  ? "bg-white/5 text-[#606070]"
                  : "text-white"
              }`}
              style={{
                backgroundColor: muted[stem.key] ? undefined : `${stem.color}20`,
                borderColor: muted[stem.key] ? "transparent" : stem.color,
                borderWidth: "1px",
              }}
            >
              {muted[stem.key] ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>

            {/* Label */}
            <span
              className="text-[10px] uppercase tracking-[0.15em] font-bold"
              style={{ color: muted[stem.key] ? "#606070" : stem.color }}
            >
              {stem.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
