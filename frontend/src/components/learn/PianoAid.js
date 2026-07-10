/* PianoAid — interactive keyboard visual aid. Renders the octave span of
   the lesson; target key glows; tapping a key also counts as playing it. */
import { NOTE_NAMES, noteName } from "@/services/PitchDetector";

const isBlack = (midi) => NOTE_NAMES[midi % 12].includes("#");

export default function PianoAid({ targetMidi, rangeMin = 60, rangeMax = 72, onPlayNote }) {
  const lo = Math.min(rangeMin, targetMidi) - 0;
  const hi = Math.max(rangeMax, targetMidi);
  // Snap to white keys at the edges
  let start = lo; while (isBlack(start)) start--;
  let end = hi; while (isBlack(end)) end++;

  const whites = [];
  for (let m = start; m <= end; m++) if (!isBlack(m)) whites.push(m);
  const whiteW = 100 / whites.length;

  return (
    <div className="w-full" data-testid="piano-aid">
      <div className="relative h-28 rounded-xl overflow-hidden border border-[#39FF14]/20"
        style={{ background: "#0A0A0F" }}>
        {/* White keys */}
        <div className="absolute inset-0 flex">
          {whites.map((m) => {
            const isTarget = m === targetMidi;
            return (
              <button key={m} onClick={() => onPlayNote(m)} data-testid={`piano-key-${m}`}
                className="relative flex-1 border-r border-black/40 flex items-end justify-center pb-1 transition-colors"
                style={{
                  background: isTarget ? "#39FF14" : "linear-gradient(180deg, #E8E8EC, #C9C9D2)",
                  boxShadow: isTarget ? "0 0 18px #39FF14 inset" : "none",
                }}>
                <span className={`text-[8px] font-black ${isTarget ? "text-[#05050A]" : "text-[#666]"}`}>
                  {noteName(m)}
                </span>
                {isTarget && <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#05050A] animate-pulse" />}
              </button>
            );
          })}
        </div>
        {/* Black keys */}
        {whites.map((m, wi) => {
          const black = m + 1;
          if (black > end || !isBlack(black)) return null;
          const isTarget = black === targetMidi;
          return (
            <button key={`b-${black}`} onClick={() => onPlayNote(black)} data-testid={`piano-key-${black}`}
              className="absolute top-0 h-[58%] z-10 rounded-b-sm"
              style={{
                left: `${(wi + 1) * whiteW - whiteW * 0.28}%`,
                width: `${whiteW * 0.56}%`,
                background: isTarget ? "#39FF14" : "linear-gradient(180deg, #1A1A22, #05050A)",
                boxShadow: isTarget ? "0 0 14px #39FF14" : "0 2px 4px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
              }} />
          );
        })}
      </div>
      <p className="text-center text-[9px] uppercase tracking-[0.25em] font-black text-[#39FF14] mt-2" data-testid="piano-position-hint">
        Play {noteName(targetMidi)}
      </p>
    </div>
  );
}
