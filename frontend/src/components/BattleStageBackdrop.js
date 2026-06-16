/* BattleStageBackdrop — Theater-style stage decoration for the Gamer "Battle Stage" page.
   Supports 4 skins (theater, arena, space, ocean), each with its own curtain/floor/spotlight
   palette and a scattered scenery of album covers pulled from active battles + leaderboard. */
import { useMemo } from "react";
import { Music2 } from "lucide-react";

const SKINS = {
  theater: {
    label: "Theater",
    floorTop: "#1a0500", floorMid: "#2a0d00", floorBottom: "#050202",
    floorLine: "#FF6B00",
    curtainStripes:
      "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 12px, #4a0000 24px, #2a0000 36px), linear-gradient(180deg, #6b0000, #2a0000)",
    valanceStripes:
      "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 10px, #4a0000 20px, #2a0000 30px)",
    leftSpotlight: "rgba(255,107,0,0.18)",
    rightSpotlight: "rgba(57,255,20,0.15)",
    centerSpotlight: "rgba(255,255,255,0.06)",
    dustA: "#FF6B00",
    dustB: "#39FF14",
    sceneryFilter: "saturate(0.75) brightness(0.85)",
  },
  arena: {
    label: "Rock Arena",
    floorTop: "#0a0014", floorMid: "#1a0030", floorBottom: "#02000a",
    floorLine: "#A855F7",
    curtainStripes:
      "repeating-linear-gradient(90deg, #1a0033 0px, #4c1d95 10px, #1a0033 20px, #0d0021 30px), linear-gradient(180deg, #4c1d95, #1a0033)",
    valanceStripes:
      "repeating-linear-gradient(90deg, #1a0033 0px, #4c1d95 8px, #1a0033 16px, #0d0021 24px)",
    leftSpotlight: "rgba(168,85,247,0.22)",
    rightSpotlight: "rgba(236,72,153,0.22)",
    centerSpotlight: "rgba(57,255,20,0.10)",
    dustA: "#A855F7",
    dustB: "#EC4899",
    sceneryFilter: "saturate(1.1) brightness(0.75) hue-rotate(280deg)",
  },
  space: {
    label: "Outer Space",
    floorTop: "#000018", floorMid: "#0a0a2e", floorBottom: "#000005",
    floorLine: "#39FF14",
    curtainStripes:
      "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.4), transparent 60%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.3), transparent 60%), linear-gradient(180deg, #1e1b4b, #020014)",
    valanceStripes:
      "linear-gradient(90deg, #020014, #1e1b4b, #4c1d95, #1e1b4b, #020014)",
    leftSpotlight: "rgba(99,102,241,0.25)",
    rightSpotlight: "rgba(56,189,248,0.25)",
    centerSpotlight: "rgba(255,255,255,0.10)",
    dustA: "#38BDF8",
    dustB: "#FFFFFF",
    sceneryFilter: "saturate(0.6) brightness(0.7) hue-rotate(200deg)",
  },
  ocean: {
    label: "Underwater",
    floorTop: "#001a26", floorMid: "#003352", floorBottom: "#000a14",
    floorLine: "#38BDF8",
    curtainStripes:
      "repeating-linear-gradient(180deg, #003352 0px, #006699 30px, #003352 60px), linear-gradient(180deg, #0891b2, #003352)",
    valanceStripes:
      "linear-gradient(90deg, #003352, #0891b2, #003352, #0891b2, #003352)",
    leftSpotlight: "rgba(34,211,238,0.25)",
    rightSpotlight: "rgba(57,255,20,0.18)",
    centerSpotlight: "rgba(255,255,255,0.08)",
    dustA: "#22D3EE",
    dustB: "#34D399",
    sceneryFilter: "saturate(0.7) brightness(0.85) hue-rotate(170deg)",
  },
};

export const SKIN_KEYS = Object.keys(SKINS);
export const SKIN_LABELS = SKINS;

export default function BattleStageBackdrop({ covers = [], skin = "theater" }) {
  const s = SKINS[skin] || SKINS.theater;

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

  // Skin-specific extra layer for visual richness
  const extraLayer = skin === "space" ? (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 60 }).map((_, i) => {
        const left = (i * 67) % 100;
        const top = (i * 41) % 90;
        const size = 1 + (i % 2);
        return (
          <span
            key={`star-${i}`}
            className="absolute rounded-full bg-white"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              opacity: 0.3 + (i % 5) * 0.12,
              boxShadow: `0 0 ${size * 2}px white`,
            }}
          />
        );
      })}
    </div>
  ) : skin === "ocean" ? (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 18 }).map((_, i) => {
        const left = (i * 53) % 95;
        const startTop = 30 + (i * 17) % 60;
        const size = 4 + (i % 4) * 2;
        const delay = (i * 0.4).toFixed(2);
        return (
          <span
            key={`bubble-${i}`}
            className="absolute rounded-full border border-[#67E8F9]/50"
            style={{
              left: `${left}%`,
              top: `${startTop}%`,
              width: size,
              height: size,
              opacity: 0.55,
              boxShadow: "inset 0 0 4px rgba(255,255,255,0.4), 0 0 6px rgba(34,211,238,0.4)",
              animation: `oceanBubble 5s ease-in ${delay}s infinite`,
            }}
          />
        );
      })}
    </div>
  ) : skin === "arena" ? (
    <div className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none">
      {/* Laser beams */}
      {[
        { x1: 50, y1: 0, x2: 10, y2: 60, c: "#A855F7" },
        { x1: 50, y1: 0, x2: 30, y2: 60, c: "#EC4899" },
        { x1: 50, y1: 0, x2: 70, y2: 60, c: "#A855F7" },
        { x1: 50, y1: 0, x2: 90, y2: 60, c: "#EC4899" },
      ].map((b, i) => (
        <svg key={`laser-${i}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 60">
          <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={b.c} strokeWidth="0.25" opacity="0.6"
            style={{ filter: `drop-shadow(0 0 4px ${b.c})` }} />
        </svg>
      ))}
    </div>
  ) : null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" data-testid="battle-stage-backdrop" data-skin={skin} aria-hidden>
      {/* Stage floor */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{ background: `linear-gradient(180deg, transparent 0%, ${s.floorTop} 30%, ${s.floorMid} 60%, ${s.floorBottom} 100%)` }}
      />
      {/* Floor perspective lines */}
      <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-30" preserveAspectRatio="none" viewBox="0 0 100 30">
        {[10, 25, 40, 60, 75, 90].map((x, i) => (
          <line key={`p-${i}`} x1="50" y1="0" x2={x} y2="30" stroke={s.floorLine} strokeWidth="0.15" />
        ))}
        {[5, 12, 22].map((y, i) => (
          <line key={`h-${i}`} x1="0" y1={y} x2="100" y2={y} stroke={s.floorLine} strokeWidth="0.08" />
        ))}
      </svg>

      {/* Pulsing footlights along the front edge of the stage */}
      <div className="absolute bottom-0 left-0 right-0 h-2 flex pointer-events-none" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={`footlight-${i}`}
            className="flex-1"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${i % 2 === 0 ? s.dustA : s.dustB} 0%, transparent 70%)`,
              animation: `footlightPulse 1.6s ease-in-out ${(i * 0.13).toFixed(2)}s infinite alternate`,
              filter: "blur(2px)",
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      {/* Side curtains */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[12%] sm:w-[10%]"
        style={{
          background: s.curtainStripes,
          backgroundBlendMode: "multiply",
          boxShadow: "inset -20px 0 40px rgba(0,0,0,0.7)",
          opacity: 0.88,
        }}
      />
      <div className="absolute top-0 left-[12%] sm:left-[10%] bottom-0 w-[3%]"
        style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.5), transparent)" }} />
      <div
        className="absolute top-0 right-0 bottom-0 w-[12%] sm:w-[10%]"
        style={{
          background: s.curtainStripes,
          backgroundBlendMode: "multiply",
          boxShadow: "inset 20px 0 40px rgba(0,0,0,0.7)",
          opacity: 0.88,
        }}
      />
      <div className="absolute top-0 right-[12%] sm:right-[10%] bottom-0 w-[3%]"
        style={{ background: "linear-gradient(270deg, rgba(0,0,0,0.5), transparent)" }} />
      {/* Top valance */}
      <div
        className="absolute top-0 left-0 right-0 h-6 sm:h-8"
        style={{ background: s.valanceStripes, boxShadow: "inset 0 -12px 24px rgba(0,0,0,0.6)" }}
      />

      {/* Spotlight cones */}
      <div className="absolute top-0 left-1/4 w-[40%] h-[60%] -translate-x-1/2"
        style={{ background: `radial-gradient(ellipse at top, ${s.leftSpotlight} 0%, transparent 60%)`, filter: "blur(8px)" }} />
      <div className="absolute top-0 right-1/4 w-[40%] h-[60%] translate-x-1/2"
        style={{ background: `radial-gradient(ellipse at top, ${s.rightSpotlight} 0%, transparent 60%)`, filter: "blur(8px)" }} />
      <div className="absolute top-0 left-1/2 w-[32%] h-[55%] -translate-x-1/2"
        style={{ background: `radial-gradient(ellipse at top, ${s.centerSpotlight} 0%, transparent 65%)`, filter: "blur(10px)" }} />

      {/* Skin-specific extras */}
      {extraLayer}

      {/* Album-cover scenery (upstage props) */}
      <div className="absolute inset-x-0 top-0 h-[60%]">
        {scenery.map((sl, i) => (
          <div
            key={`scenery-${i}`}
            className="absolute rounded-md overflow-hidden border border-white/10"
            style={{
              left: `${sl.x}%`, top: `${sl.y}%`, width: sl.size, height: sl.size,
              transform: `translate(-50%, 0) rotate(${sl.rot}deg)`,
              opacity: sl.o,
              boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 18px ${s.dustA}33`,
              zIndex: sl.z,
            }}
          >
            {sl.url ? (
              <img src={sl.url} alt="" className="w-full h-full object-cover" style={{ filter: s.sceneryFilter }} loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${s.dustA}26, ${s.dustB}1a)` }}>
                <Music2 className="w-1/2 h-1/2" style={{ color: `${s.dustA}55` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating sparkle dust */}
      <div className="absolute inset-0 pointer-events-none">
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
                left: `${left}%`, top: `${top}%`, width: size, height: size,
                background: i % 2 === 0 ? s.dustA : s.dustB,
                boxShadow: i % 2 === 0 ? `0 0 6px ${s.dustA}` : `0 0 6px ${s.dustB}`,
                opacity: 0.6,
                animation: `stageDust 6s ease-in-out ${delay}s infinite alternate`,
              }}
            />
          );
        })}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(5,5,10,0.55) 80%)" }} />
    </div>
  );
}
