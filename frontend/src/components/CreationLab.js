/* CreationLab — Bitmoji-style avatar builder modal for the Gamer-lane Profile. */
import { useState, useMemo } from "react";
import { X, Palette, Shirt, Music, User as UserIcon, Smile, Wand2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import GamerAvatar, {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, TOP_STYLES, TOP_COLORS,
  CAPS, CAP_COLORS, INSTRUMENTS, FACES, DEFAULT_GAMER_AVATAR,
} from "./GamerAvatar";

const TABS = [
  { key: "skin", label: "Skin",  Icon: UserIcon },
  { key: "hair", label: "Hair",  Icon: Wand2 },
  { key: "face", label: "Face",  Icon: Smile },
  { key: "cap",  label: "Cap",   Icon: Palette },
  { key: "top",  label: "Top",   Icon: Shirt },
  { key: "inst", label: "Sound", Icon: Music },
];

function Swatch({ color, selected, onClick, label, testId }) {
  return (
    <button onClick={onClick} data-testid={testId}
      className={`relative aspect-square rounded-xl border-2 transition-all ${
        selected ? "border-[#39FF14] scale-105 shadow-[0_0_14px_rgba(57,255,20,0.45)]" : "border-white/15 hover:border-white/35"
      }`}
      style={{ background: color }}
      title={label}
    >
      {selected && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#39FF14] flex items-center justify-center">
          <Check className="w-3 h-3 text-[#05050A]" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function Choice({ active, onClick, children, testId }) {
  return (
    <button onClick={onClick} data-testid={testId}
      className={`px-3 h-9 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${
        active
          ? "bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/50 shadow-[0_0_12px_rgba(57,255,20,0.3)]"
          : "bg-white/4 text-[#A0A0B0] border-white/10 hover:text-white"
      }`}>
      {children}
    </button>
  );
}

export default function CreationLab({ open, avatar, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_GAMER_AVATAR, ...(avatar || {}) }));
  const [tab, setTab] = useState("skin");

  // Live preview glow follows the chosen top color (kid-pleasing instant feedback)
  const glowColor = useMemo(() => draft.topColor || "#FF6B00", [draft.topColor]);

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const reset = () => setDraft({ ...DEFAULT_GAMER_AVATAR });
  const save = () => {
    onSave(draft);
    toast.success("Avatar saved to your locker", { className: "neon-toast" });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3" data-testid="creation-lab">
      <div className="w-full max-w-2xl rounded-2xl border border-[#39FF14]/30 bg-[#0A0A0F] flex flex-col max-h-[92vh]"
        style={{ boxShadow: "0 0 60px rgba(57,255,20,0.18)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#39FF14]" />
            <div>
              <h3 className="font-['Outfit'] text-lg font-black text-white leading-none">Creation Lab</h3>
              <p className="text-[9px] text-[#5C5C6B] uppercase tracking-[0.3em] font-bold mt-0.5">Build your gamer</p>
            </div>
          </div>
          <Button onClick={onClose} data-testid="creation-lab-close" variant="ghost"
            className="w-8 h-8 p-0 text-[#5C5C6B] hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5">
            {/* PREVIEW */}
            <div className="flex flex-col items-center">
              <div className="relative rounded-2xl overflow-hidden border border-[#39FF14]/30 bg-gradient-to-b from-[#0F0F16] to-[#05050A]"
                   data-testid="creation-lab-preview"
                   style={{ boxShadow: `0 0 32px ${glowColor}33` }}>
                <GamerAvatar avatar={draft} size={200} glowColor={glowColor} />
              </div>
              <Button onClick={reset} data-testid="creation-lab-reset" variant="ghost"
                className="mt-3 h-8 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] border border-white/10">
                Reset
              </Button>
            </div>

            {/* EDITOR */}
            <div>
              {/* Category tabs */}
              <div className="flex gap-1 mb-3 overflow-x-auto pb-1" data-testid="creation-lab-tabs">
                {TABS.map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => setTab(key)} data-testid={`lab-tab-${key}`}
                    className={`flex-shrink-0 px-3 h-9 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      tab === key
                        ? "bg-[#FF6B00] text-white shadow-[0_0_14px_rgba(255,107,0,0.45)]"
                        : "bg-white/4 text-[#A0A0B0] hover:text-white"
                    }`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab panels */}
              {tab === "skin" && (
                <div className="space-y-3" data-testid="lab-panel-skin">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold">Skin Tone</p>
                  <div className="grid grid-cols-5 gap-2">
                    {SKIN_TONES.map((s) => (
                      <Swatch key={s.key} color={s.fill} label={s.name}
                        selected={draft.skin === s.key}
                        onClick={() => patch({ skin: s.key })}
                        testId={`skin-${s.key}`} />
                    ))}
                  </div>
                </div>
              )}

              {tab === "hair" && (
                <div className="space-y-3" data-testid="lab-panel-hair">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold mb-2">Style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {HAIR_STYLES.map((h) => (
                        <Choice key={h} active={draft.hair === h} testId={`hair-${h}`}
                          onClick={() => patch({ hair: h })}>{h}</Choice>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold mb-2">Color</p>
                    <div className="grid grid-cols-6 gap-2">
                      {HAIR_COLORS.map((c) => (
                        <Swatch key={c} color={c} selected={draft.hairColor === c}
                          onClick={() => patch({ hairColor: c })}
                          testId={`hair-color-${c.replace("#","")}`} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "face" && (
                <div className="space-y-3" data-testid="lab-panel-face">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold">Expression</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FACES.map((f) => (
                      <Choice key={f} active={draft.face === f} testId={`face-${f}`}
                        onClick={() => patch({ face: f })}>{f}</Choice>
                    ))}
                  </div>
                </div>
              )}

              {tab === "cap" && (
                <div className="space-y-3" data-testid="lab-panel-cap">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold mb-2">Headwear</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CAPS.map((c) => (
                        <Choice key={c.key} active={draft.cap === c.key} testId={`cap-${c.key}`}
                          onClick={() => patch({ cap: c.key })}>{c.name}</Choice>
                      ))}
                    </div>
                  </div>
                  {draft.cap !== "none" && (
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold mb-2">Color</p>
                      <div className="grid grid-cols-4 gap-2">
                        {CAP_COLORS.map((c) => (
                          <Swatch key={c} color={c} selected={draft.capColor === c}
                            onClick={() => patch({ capColor: c })}
                            testId={`cap-color-${c.replace("#","")}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "top" && (
                <div className="space-y-3" data-testid="lab-panel-top">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold mb-2">Style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TOP_STYLES.map((s) => (
                        <Choice key={s.key} active={draft.top === s.key} testId={`top-${s.key}`}
                          onClick={() => patch({ top: s.key })}>{s.name}</Choice>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold mb-2">Color</p>
                    <div className="grid grid-cols-6 gap-2">
                      {TOP_COLORS.map((c) => (
                        <Swatch key={c} color={c} selected={draft.topColor === c}
                          onClick={() => patch({ topColor: c })}
                          testId={`top-color-${c.replace("#","")}`} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "inst" && (
                <div className="space-y-3" data-testid="lab-panel-inst">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-bold">Signature Instrument</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {INSTRUMENTS.map((i) => (
                      <Choice key={i.key} active={draft.instrument === i.key} testId={`inst-${i.key}`}
                        onClick={() => patch({ instrument: i.key })}>{i.name}</Choice>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer save */}
        <div className="px-5 py-3 border-t border-white/5 flex gap-2">
          <Button onClick={onClose} data-testid="creation-lab-cancel" variant="ghost"
            className="h-10 px-4 rounded-xl border border-white/10 text-[#A0A0B0] text-xs font-bold">
            Cancel
          </Button>
          <Button onClick={save} data-testid="creation-lab-save"
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#39FF14] text-[#05050A] font-black text-sm uppercase tracking-wider"
            style={{ boxShadow: "0 0 22px rgba(57,255,20,0.45)" }}>
            <Check className="w-4 h-4 mr-1.5" />
            Save Avatar
          </Button>
        </div>
      </div>
    </div>
  );
}
