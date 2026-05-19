/**
 * CalligraphyLyrics — Right-side overlay showing the current and upcoming
 * lyric lines in bold neon-green calligraphy. Designed for singing AND study.
 * Designed to overlay a portrait video frame on the right edge.
 */
export default function CalligraphyLyrics({ lyrics, activeIdx }) {
  if (!lyrics?.lyrics) {
    return (
      <div className="absolute top-0 right-0 bottom-0 w-[40%] max-w-[220px] pointer-events-none z-30 flex items-center justify-center px-3"
           data-testid="calligraphy-lyrics-empty">
        <p className="font-['Outfit'] italic text-xs text-[#39FF14]/30 text-right leading-snug">
          Lyrics will appear here…
        </p>
      </div>
    );
  }
  const lines = lyrics.lyrics.filter(l => l.type === "line");
  const window_ = lines.slice(Math.max(0, activeIdx - 1), activeIdx + 4);
  return (
    <div className="absolute top-0 right-0 bottom-0 w-[44%] max-w-[260px] pointer-events-none z-30 flex flex-col justify-center gap-3 px-3 py-12"
         data-testid="calligraphy-lyrics">
      {window_.map((line, i) => {
        const isActive = i === 1 || (activeIdx === 0 && i === 0);
        const isPast = i < 1 && activeIdx > 0;
        return (
          <p key={`cl-${line.time}-${i}`}
            data-testid={isActive ? "calligraphy-active-line" : undefined}
            className={`transition-all duration-700 font-['Outfit'] italic text-right leading-tight ${
              isActive
                ? "text-[#39FF14] text-2xl font-black"
                : isPast
                  ? "text-[#39FF14]/25 text-sm font-semibold"
                  : "text-[#39FF14]/55 text-base font-bold"
            }`}
            style={isActive ? { textShadow: "0 0 22px rgba(57,255,20,0.65), 0 0 44px rgba(57,255,20,0.25)" } : undefined}>
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
