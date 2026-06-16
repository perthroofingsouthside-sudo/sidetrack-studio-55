/* BattleStageBackdrop — Theater-style stage decoration for the Gamer "Battle Stage" page.
   Renders curtains, spotlights, stage floor and a scattered scenery of album covers
   pulled from active battles + leaderboard so the page feels alive and exciting. */
import { useMemo } from "react";
import { Music2 } from "lucide-react";

export default function BattleStageBackdrop({ covers = [] }) {
  // De-duplicate by cover URL, fall back to seeded positions so the scenery is
  // visually full even when there are few battles.
  const scenery = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const c of covers) {
      if (!c) continue;
      const url = c.song_cover_url || c.cover_url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      items.push(url);
      if (items.length >= 14) break;
    }
    // Fixed scatter positions — top half of the backdrop (above the front-row cards).
    // Each entry: {x%, y%, size px, rotate deg, opacity, z}
    const slots = [
      { x: 6,  y: 8,  size: 64, rot: -8,  o: 0.55, z: 1 },
      { x: 18, y: 22, size: 80, rot: 6,   o: 0.45, z: 2 },
      { x: 32, y: 6,  size: 56, rot: -4,  o: 0.40, z: 1 },
      { x: 48, y: 18, size: 92, rot: 3,   o: 0.55, z: 3 },
      { x: 62, y: 9,  size: 60, rot: -6,  o: 0.45, z: 1 },
      { x: 78, y: 20, size: 76, rot: 8,   o: 0.50, z: 2 },
      { x: 90, y: 6,  size: 48, rot: -10, o: 0.35, z: 1 },
      { x: 10, y: 36, size: 52, rot: 5,   o: 0.30, z: 1 },
      { x: 28, y: 38, size: 44, rot: -7,  o: 0.30, z: 1 },
      { x: 50, y: 36, size: 48, rot: 4,   o: 0.32, z: 1 },
      { x: 72, y: 36, size: 52, rot: -3,  o: 0.34, z: 1 },
      { x: 88, y: 38, size: 44, rot: 9,   o: 0.30, z: 1 },
      { x: 22, y: 50, size: 40, rot: -5,  o: 0.22, z: 1 },
      { x: 68, y: 50, size: 40, rot: 6,   o: 0.22, z: 1 },
    ];
    return slots.map((slot, i) => ({ ...slot, url: items[i % Math.max(items.length, 1)] || null }));
  }, [covers]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" data-testid="battle-stage-backdrop" aria-hidden>
      {/* Stage floor — perspective horizon at the bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, #1a0500 30%, #2a0d00 60%, #050202 100%)",
        }}
      />
      {/* Floor perspective lines */}
      <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-30" preserveAspectRatio="none" viewBox="0 0 100 30">
        {[10, 25, 40, 60, 75, 90].map((x, i) => (
          <line key={`p-${i}`} x1="50" y1="0" x2={x} y2="30" stroke="#FF6B00" strokeWidth="0.15" />
        ))}
        {[5, 12, 22].map((y, i) => (
          <line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} stroke="#FF6B00" strokeWidth="0.08" />
        ))}
      </svg>

      {/* Side curtains — left */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[12%] sm:w-[10%]"
        style={{
          background:
            "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 12px, #4a0000 24px, #2a0000 36px), linear-gradient(180deg, #6b0000, #2a0000)",
          backgroundBlendMode: "multiply",
          boxShadow: "inset -20px 0 40px rgba(0,0,0,0.7)",
          opacity: 0.85,
        }}
      />
      <div
        className="absolute top-0 left-[12%] sm:left-[10%] bottom-0 w-[3%]"
        style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.5), transparent)" }}
      />
      {/* Side curtains — right */}
      <div
        className="absolute top-0 right-0 bottom-0 w-[12%] sm:w-[10%]"
        style={{
          background:
            "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 12px, #4a0000 24px, #2a0000 36px), linear-gradient(180deg, #6b0000, #2a0000)",
          backgroundBlendMode: "multiply",
          boxShadow: "inset 20px 0 40px rgba(0,0,0,0.7)",
          opacity: 0.85,
        }}
      />
      <div
        className="absolute top-0 right-[12%] sm:right-[10%] bottom-0 w-[3%]"
        style={{ background: "linear-gradient(270deg, rgba(0,0,0,0.5), transparent)" }}
      />
      {/* Top valance */}
      <div
        className="absolute top-0 left-0 right-0 h-6 sm:h-8"
        style={{
          background:
            "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 10px, #4a0000 20px, #2a0000 30px)",
          boxShadow: "inset 0 -12px 24px rgba(0,0,0,0.6)",
        }}
      />

      {/* Spotlight cones from above */}
      <div
        className="absolute top-0 left-1/4 w-[40%] h-[60%] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse at top, rgba(255,107,0,0.18) 0%, transparent 60%)",
          filter: "blur(8px)",
        }}
      />
      <div
        className="absolute top-0 right-1/4 w-[40%] h-[60%] translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse at top, rgba(57,255,20,0.15) 0%, transparent 60%)",
          filter: "blur(8px)",
        }}
      />
      <div
        className="absolute top-0 left-1/2 w-[32%] h-[55%] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse at top, rgba(255,255,255,0.06) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />

      {/* Scattered album-cover scenery (upstage props) */}
      <div className="absolute inset-x-0 top-0 h-[60%]">
        {scenery.map((s, i) => (
          <div
            key={`scenery-${i}`}
            className="absolute rounded-md overflow-hidden border border-white/10 transition-opacity"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              transform: `translate(-50%, 0) rotate(${s.rot}deg)`,
              opacity: s.o,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 18px rgba(255,107,0,0.12)",
              zIndex: s.z,
            }}
          >
            {s.url ? (
              <img
                src={s.url}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: "saturate(0.75) brightness(0.85)" }}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#FF6B00]/15 to-[#39FF14]/10 flex items-center justify-center">
                <Music2 className="w-1/2 h-1/2 text-[#FF6B00]/30" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating stage dust / sparkles */}
      <div className="absolute inset-0">
        {Array.from({ length: 24 }).map((_, i) => {
          const left = (i * 53) % 100;
          const top = (i * 31) % 80;
          const size = 1 + (i % 3);
          const delay = (i * 0.3).toFixed(2);
          return (
            <span
              key={`dust-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                background: i % 2 === 0 ? "#FF6B00" : "#39FF14",
                boxShadow: i % 2 === 0 ? "0 0 6px #FF6B00" : "0 0 6px #39FF14",
                opacity: 0.6,
                animation: `stageDust 6s ease-in-out ${delay}s infinite alternate`,
              }}
            />
          );
        })}
      </div>

      {/* Subtle dark vignette to keep card content readable */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(5,5,10,0.55) 80%)" }}
      />
    </div>
  );
}
