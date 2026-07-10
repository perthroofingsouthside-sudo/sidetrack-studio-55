/* GuitarAid — interactive fretboard visual aid. Standard tuning, 8 frets.
   Target note glows; tapping a position also counts as playing it. */
import { noteName } from "@/services/PitchDetector";

const STRING_MIDI = [64, 59, 55, 50, 45, 40]; // high E → low E (top to bottom)
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"];
const FRETS = 8;

export function guitarPosition(midi) {
  for (let s = STRING_MIDI.length - 1; s >= 0; s--) {
    const fret = midi - STRING_MIDI[s];
    if (fret >= 0 && fret <= FRETS) return { string: s, fret };
  }
  return null;
}

export default function GuitarAid({ targetMidi, onPlayNote }) {
  const target = guitarPosition(targetMidi);

  return (
    <div className="w-full overflow-x-auto" data-testid="guitar-aid">
      <div className="min-w-[420px] rounded-xl border border-[#FF6B00]/20 p-3"
        style={{ background: "linear-gradient(180deg, rgba(30,18,8,0.9), rgba(10,6,3,0.95))" }}>
        <div className="grid" style={{ gridTemplateColumns: `24px repeat(${FRETS + 1}, 1fr)` }}>
          {/* Fret numbers */}
          <div />
          {Array.from({ length: FRETS + 1 }, (_, f) => (
            <div key={`fn-${f}`} className="text-center text-[8px] font-black text-[#5C5C6B] pb-1">{f}</div>
          ))}
          {STRING_MIDI.map((sm, s) => (
            <div key={`row-${s}`} className="contents">
              <div className="flex items-center justify-center text-[10px] font-black text-[#FF6B00]">{STRING_LABELS[s]}</div>
              {Array.from({ length: FRETS + 1 }, (_, f) => {
                const midi = sm + f;
                const isTarget = target && target.string === s && target.fret === f;
                return (
                  <button
                    key={`c-${s}-${f}`}
                    data-testid={`guitar-cell-${s}-${f}`}
                    onClick={() => onPlayNote(midi)}
                    className="relative h-8 flex items-center justify-center"
                    style={{ borderLeft: f === 1 ? "3px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {/* String line */}
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: 1 + (5 - s) * 0.35, background: "rgba(200,200,210,0.35)" }} />
                    {isTarget && (
                      <span className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-[#05050A] animate-pulse"
                        style={{ background: "#39FF14", boxShadow: "0 0 16px #39FF14" }}
                        data-testid="guitar-target-dot">
                        {noteName(midi).replace(/\d/, "")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {target && (
          <p className="text-center text-[9px] uppercase tracking-[0.25em] font-black text-[#39FF14] mt-2" data-testid="guitar-position-hint">
            {target.fret === 0 ? `Open ${STRING_LABELS[target.string]} string` : `String ${STRING_LABELS[target.string]} · Fret ${target.fret}`}
          </p>
        )}
      </div>
    </div>
  );
}
