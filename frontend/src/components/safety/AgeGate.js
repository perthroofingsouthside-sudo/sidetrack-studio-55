/* AgeGate — first-launch age selection. Grommets (<18) are locked to the
   Gamer lane with identity protection; 18+ get the full ecosystem. */
import { useState } from "react";
import { Gamepad2, Music2, ShieldCheck } from "lucide-react";

export default function AgeGate({ onSelect }) {
  const [busy, setBusy] = useState(false);

  const pick = async (mode) => {
    if (busy) return;
    setBusy(true);
    await onSelect(mode);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(4,4,6,0.92)", backdropFilter: "blur(14px)" }} data-testid="age-gate">
      <div className="skeu-panel w-full max-w-md p-6 rounded-3xl relative">
        <span className="skeu-screw top-2.5 left-2.5" />
        <span className="skeu-screw top-2.5 right-2.5" />
        <span className="skeu-screw bottom-2.5 left-2.5" />
        <span className="skeu-screw bottom-2.5 right-2.5" />

        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "rgba(57,255,20,0.12)", boxShadow: "0 0 22px rgba(57,255,20,0.25)" }}>
            <ShieldCheck className="w-6 h-6 text-[#39FF14]" />
          </div>
          <h2 className="font-['Outfit'] text-2xl font-black text-white">Who&rsquo;s playing?</h2>
          <p className="text-[11px] text-[#A0A0B0] mt-1.5 leading-snug">
            Pocket Products keeps younger artists safe. Pick your mode to set up the right experience.
          </p>
        </div>

        <div className="space-y-3">
          <button onClick={() => pick("grommet")} disabled={busy} data-testid="age-gate-grommet"
            className="skeu-btn w-full rounded-2xl p-4 flex items-center gap-4 text-left">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(57,255,20,0.12)", boxShadow: "0 0 16px rgba(57,255,20,0.25)" }}>
              <Gamepad2 className="w-5 h-5 text-[#39FF14]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">I&rsquo;m under 18 <span className="text-[#39FF14]">· Grommet</span></p>
              <p className="text-[10px] text-[#5C5C6B] leading-snug mt-0.5">
                Gamer mode: play, learn & practice. 3D avatar identity — no real faces or names. AI grades your skills.
              </p>
            </div>
          </button>

          <button onClick={() => pick("adult")} disabled={busy} data-testid="age-gate-adult"
            className="skeu-btn w-full rounded-2xl p-4 flex items-center gap-4 text-left">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,95,31,0.12)", boxShadow: "0 0 16px rgba(255,95,31,0.25)" }}>
              <Music2 className="w-5 h-5 text-[#FF5F1F]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">I&rsquo;m 18 or over <span className="text-[#FF5F1F]">· Creator</span></p>
              <p className="text-[10px] text-[#5C5C6B] leading-snug mt-0.5">
                Full ecosystem: Creator studio, rap battles, social posting, jam rooms & peer ratings.
              </p>
            </div>
          </button>
        </div>

        <p className="text-[9px] text-[#5C5C6B] text-center mt-4 uppercase tracking-[0.2em] font-bold">
          Grommets can graduate later with a guardian
        </p>
      </div>
    </div>
  );
}
