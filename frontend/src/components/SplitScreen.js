import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SplitScreen({ lyrics, currentTime }) {
  const currentChord = useMemo(() => {
    if (!lyrics?.chords) return null;
    const chords = lyrics.chords;
    for (let i = chords.length - 1; i >= 0; i--) {
      if (currentTime >= chords[i].time) return chords[i];
    }
    return chords[0] || null;
  }, [lyrics?.chords, currentTime]);

  const nextChords = useMemo(() => {
    if (!lyrics?.chords) return [];
    const idx = lyrics.chords.findIndex((c) => c.time > currentTime);
    if (idx === -1) return [];
    return lyrics.chords.slice(idx, idx + 4);
  }, [lyrics?.chords, currentTime]);

  const activeLyricIdx = useMemo(() => {
    if (!lyrics?.lyrics) return -1;
    for (let i = lyrics.lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics.lyrics[i].time) return i;
    }
    return 0;
  }, [lyrics?.lyrics, currentTime]);

  if (!lyrics) {
    return (
      <div className="surface-card p-6 text-center" data-testid="split-screen-loading">
        <p className="text-[#606070] text-sm">Loading chords & lyrics...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="split-screen">
      {/* Left: Guitar Chords */}
      <div className="surface-card p-4 flex flex-col" data-testid="chords-panel">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#FF6B00] mb-3">
          Guitar Chords
        </span>

        {/* Current chord - large */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px]">
          {currentChord && (
            <div className="text-center animate-fade-in">
              <div className="chord-active font-['Outfit']">
                {currentChord.chord}
              </div>
              <ChordDiagram chord={currentChord.chord} />
            </div>
          )}
        </div>

        {/* Upcoming chords */}
        <div className="flex gap-2 mt-3 justify-center">
          {nextChords.map((c, i) => (
            <span
              key={`${c.time}-${i}`}
              className="text-sm font-['Outfit'] font-bold px-2 py-1 rounded-lg bg-[#FF6B00]/10 text-[#FF6B00]/60"
            >
              {c.chord}
            </span>
          ))}
        </div>
      </div>

      {/* Right: Lyrics */}
      <div className="surface-card p-4" data-testid="lyrics-panel">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#39FF14] mb-3 block">
          Lyrics
        </span>
        <ScrollArea className="h-[250px]">
          <div className="space-y-2 pr-2">
            {lyrics.lyrics.map((line, i) => {
              if (line.type === "section") {
                return (
                  <p
                    key={i}
                    className={`text-xs uppercase tracking-[0.15em] font-bold mt-3 ${
                      i === activeLyricIdx ? "text-[#39FF14]" : "text-[#606070]"
                    }`}
                  >
                    {line.text}
                  </p>
                );
              }
              if (line.type === "break") return <div key={i} className="h-2" />;
              return (
                <p
                  key={i}
                  className={`text-sm leading-relaxed transition-all duration-300 ${
                    i === activeLyricIdx
                      ? "lyric-active"
                      : i < activeLyricIdx
                      ? "lyric-inactive"
                      : "text-[#A0A0B0]"
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// Simple chord diagram component
function ChordDiagram({ chord }) {
  const chordShapes = {
    Am: [[0,0,2,2,1,0], "x02210"],
    C: [[0,3,2,0,1,0], "x32010"],
    G: [[3,2,0,0,0,3], "320003"],
    F: [[1,3,3,2,1,1], "133211"],
    Dm: [[0,0,0,2,3,1], "xx0231"],
    Em: [[0,2,2,0,0,0], "022000"],
  };

  const shape = chordShapes[chord];
  if (!shape) return null;

  const frets = shape[0];

  return (
    <div className="mt-2 flex justify-center">
      <div className="grid grid-cols-6 gap-[3px]">
        {frets.map((fret, i) => (
          <div key={i} className="flex flex-col items-center gap-[2px]">
            {[1, 2, 3].map((f) => (
              <div
                key={f}
                className={`w-3 h-3 rounded-full border ${
                  fret === f
                    ? "bg-[#FF6B00] border-[#FF6B00]"
                    : "border-white/10 bg-transparent"
                }`}
              />
            ))}
            <span className="text-[8px] text-[#606070]">
              {fret === 0 ? "o" : fret > 3 ? "x" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
