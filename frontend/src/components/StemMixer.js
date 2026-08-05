import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Headphones, UserCheck } from "lucide-react";
import { API } from "@/App";
import axios from "axios";
import log from "@/utils/log";

// Fire-and-forget Vibe-Match behavior log
const emitMix = (event, stem, value) => {
  try {
    const uid = localStorage.getItem("sidetrack_voter_id") || "anon";
    axios.post(`${API}/discover/mix-behavior`, { user_id: uid, event, stem, value })
      .catch((err) => log.debug("[Vibe] mix-behavior post failed:", err?.message));
  } catch (err) {
    log.debug("[Vibe] emitMix failed:", err?.message);
  }
};

const STEMS = [
  { key: "vocals", label: "VOX", color: "#39FF14" },
  { key: "guitar", label: "GTR", color: "#FF5F1F" },
  { key: "bass", label: "BAS", color: "#FF3B30" },
  { key: "drums", label: "DRM", color: "#FF5F1F" },
];

const ARTIST_PRESETS = {
  "Vocal Focus": { vocals: 100, guitar: 30, bass: 30, drums: 30 },
  "Band Only": { vocals: 0, guitar: 80, bass: 80, drums: 80 },
  "Full Mix": { vocals: 80, guitar: 80, bass: 80, drums: 80 },
  "Drums & Bass": { vocals: 0, guitar: 0, bass: 90, drums: 90 },
};

export default function StemMixer({ volumes, muted, onVolumeChange, onMuteToggle, onSolo }) {
  const [soloStem, setSoloStem] = useState(null);
  const [followArtist, setFollowArtist] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  const handleSolo = (key) => {
    emitMix("solo", key, null);
    if (soloStem === key) {
      // Un-solo: unmute all
      setSoloStem(null);
      STEMS.forEach((s) => { if (muted[s.key]) onMuteToggle(s.key); });
    } else {
      setSoloStem(key);
      STEMS.forEach((s) => {
        if (s.key === key && muted[s.key]) onMuteToggle(s.key);
        else if (s.key !== key && !muted[s.key]) onMuteToggle(s.key);
      });
    }
    if (onSolo) onSolo(key);
  };

  const applyPreset = (name) => {
    const preset = ARTIST_PRESETS[name];
    if (!preset) return;
    setActivePreset(name);
    setFollowArtist(true);
    setSoloStem(null);
    Object.entries(preset).forEach(([stem, val]) => {
      onVolumeChange(stem, val);
      if (val === 0 && !muted[stem]) onMuteToggle(stem);
      else if (val > 0 && muted[stem]) onMuteToggle(stem);
    });
  };

  return (
    <div className="surface-card p-4 space-y-4" data-testid="stem-mixer">
      {/* Artist Mix Presets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide" data-testid="artist-presets">
        <span className="text-[9px] uppercase tracking-wider font-bold text-[#5C5C6B] shrink-0 flex items-center gap-1">
          <UserCheck className="w-3 h-3" /> Mix:
        </span>
        {Object.keys(ARTIST_PRESETS).map((name) => (
          <Button
            key={name}
            data-testid={`preset-${name.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => applyPreset(name)}
            className={`h-6 px-2.5 rounded-full text-[9px] font-bold shrink-0 transition-all ${
              activePreset === name
                ? "bg-[#FF5F1F] text-white shadow-[0_0_12px_rgba(255,95,31,0.4)]"
                : "bg-white/5 text-[#5C5C6B] border border-white/5 hover:border-[#FF5F1F]/30"
            }`}
          >
            {name}
          </Button>
        ))}
      </div>

      {/* Stem channels */}
      <div className="grid grid-cols-4 gap-4">
        {STEMS.map((stem) => {
          const isSolo = soloStem === stem.key;
          return (
            <div key={stem.key} className="flex flex-col items-center gap-3">
              <span className="text-xs font-mono" style={{ color: stem.color }}>
                {muted[stem.key] ? "0" : volumes[stem.key]}
              </span>
              <div className="h-32 flex items-center justify-center">
                <Slider
                  data-testid={`stem-${stem.key}-slider`}
                  orientation="vertical"
                  value={[muted[stem.key] ? 0 : volumes[stem.key]]}
                  onValueChange={([v]) => { onVolumeChange(stem.key, v); setActivePreset(null); }}
                  max={100}
                  step={1}
                  className={`h-full slider-${stem.key}`}
                />
              </div>

              {/* Mute + Solo buttons */}
              <div className="flex gap-1">
                <Button
                  data-testid={`stem-${stem.key}-mute`}
                  onClick={() => { emitMix("mute", stem.key, null); onMuteToggle(stem.key); setSoloStem(null); setActivePreset(null); }}
                  variant="ghost"
                  size="icon"
                  className={`w-8 h-8 rounded-full transition-all ${
                    muted[stem.key] ? "bg-white/5 text-[#606070]" : "text-white"
                  }`}
                  style={{
                    backgroundColor: muted[stem.key] ? undefined : `${stem.color}20`,
                    borderColor: muted[stem.key] ? "transparent" : stem.color,
                    borderWidth: "1px",
                  }}
                >
                  {muted[stem.key] ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  data-testid={`stem-${stem.key}-solo`}
                  onClick={() => handleSolo(stem.key)}
                  variant="ghost"
                  size="icon"
                  className={`w-8 h-8 rounded-full transition-all text-[10px] font-black ${
                    isSolo
                      ? "text-[#05050A]"
                      : "bg-white/5 text-[#606070] border border-white/5"
                  }`}
                  style={isSolo ? { backgroundColor: stem.color, boxShadow: `0 0 12px ${stem.color}60` } : undefined}
                >
                  <Headphones className="w-3.5 h-3.5" />
                </Button>
              </div>

              <span className="text-[10px] uppercase tracking-[0.15em] font-bold"
                style={{ color: muted[stem.key] ? "#606070" : stem.color }}>
                {stem.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
