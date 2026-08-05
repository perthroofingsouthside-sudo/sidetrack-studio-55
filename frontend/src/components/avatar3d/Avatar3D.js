/* Avatar3D — foundation for the high-quality 3D avatar system.
   Cinematic-lit, Pixar-proportioned preset characters (stage outfits).
   Selection persists to localStorage `pp_avatar3d`. */
import { useState } from "react";
import { Check } from "lucide-react";

export const AVATAR3D_PRESETS = [
  { key: "vocalist", label: "Vocalist", src: "/avatars/vocalist.jpg", accent: "#FF5F1F" },
  { key: "rapper", label: "Rapper", src: "/avatars/rapper.jpg", accent: "#39FF14" },
  { key: "guitarist", label: "Guitarist", src: "/avatars/guitarist.jpg", accent: "#FF5F1F" },
  { key: "dj", label: "DJ", src: "/avatars/dj.jpg", accent: "#39FF14" },
];

export function getAvatar3D() {
  const key = localStorage.getItem("pp_avatar3d") || "rapper";
  return AVATAR3D_PRESETS.find((p) => p.key === key) || AVATAR3D_PRESETS[1];
}

export function Avatar3DPortrait({ preset, size = 80, glow = true }) {
  const p = preset || getAvatar3D();
  return (
    <div className="relative rounded-2xl overflow-hidden shrink-0"
      style={{
        width: size, height: size,
        border: `2px solid ${p.accent}66`,
        boxShadow: glow ? `0 0 ${Math.round(size / 3)}px ${p.accent}55, inset 0 -2px 8px rgba(0,0,0,0.6)` : "none",
      }}
      data-testid="avatar3d-portrait">
      <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
    </div>
  );
}

export default function Avatar3DPicker({ onChange }) {
  const [selected, setSelected] = useState(() => localStorage.getItem("pp_avatar3d") || "rapper");

  const pick = (key) => {
    setSelected(key);
    localStorage.setItem("pp_avatar3d", key);
    onChange && onChange(AVATAR3D_PRESETS.find((p) => p.key === key));
  };

  return (
    <div data-testid="avatar3d-picker">
      <div className="grid grid-cols-4 gap-2">
        {AVATAR3D_PRESETS.map((p) => {
          const isSel = selected === p.key;
          return (
            <button key={p.key} onClick={() => pick(p.key)} data-testid={`avatar3d-${p.key}`}
              className="relative rounded-xl overflow-hidden aspect-square transition-transform hover:scale-[1.04]"
              style={{
                border: isSel ? `2px solid ${p.accent}` : "2px solid rgba(255,255,255,0.08)",
                boxShadow: isSel ? `0 0 18px ${p.accent}66` : "0 3px 8px rgba(0,0,0,0.5)",
              }}>
              <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[8px] font-black uppercase tracking-wider text-white"
                style={{ background: "rgba(0,0,0,0.65)" }}>{p.label}</span>
              {isSel && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: p.accent }}>
                  <Check className="w-2.5 h-2.5 text-[#05050A]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[9px] text-[#5C5C6B] mt-2 text-center uppercase tracking-[0.2em] font-bold">
        Cinematic 3D stage avatars · identity protected
      </p>
    </div>
  );
}
