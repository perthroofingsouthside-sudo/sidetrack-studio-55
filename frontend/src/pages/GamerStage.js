/* GamerStage — Active Battle Stage performance view.
   Mirrors Stadium Record layout: lyrics rail (left) · dynamic avatar (centre)
   · Guitar Hero falling-notes highway (right) · BPM/Key/progress (bottom). */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Mic, Guitar, Headphones, X, VolumeX, Volume2, Flame, Heart, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import GamerAvatar, { DEFAULT_GAMER_AVATAR } from "@/components/GamerAvatar";

const PERFORMANCE_MODES = [
  { key: "sing",   label: "Sing",   inst: "mic",    face: "smile", Icon: Mic },
  { key: "guitar", label: "Guitar", inst: "guitar", face: "cool",  Icon: Guitar },
  { key: "both",   label: "Both",   inst: "mic",    face: "wow",   Icon: Music },   // mic primary + guitar arm overlay
  { key: "rap",    label: "Rap",    inst: "dj",     face: "cool",  Icon: Headphones },
];

// Guitar Hero lane palette — kid-friendly neon
const LANE_COLORS = ["#FF6B00", "#00E0FF", "#FF4FB1", "#FFEB3B"]; // orange, cyan, magenta, yellow

// Bezier light-trail background (SVG)
function LightTrails() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="trail1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B00" stopOpacity="0" />
          <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trail2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00E0FF" stopOpacity="0" />
          <stop offset="50%" stopColor="#00E0FF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#00E0FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trail3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF4FB1" stopOpacity="0" />
          <stop offset="50%" stopColor="#FF4FB1" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF4FB1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trail4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B57BFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#B57BFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#B57BFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M 0 10 Q 30 0 50 30 T 100 20"   stroke="url(#trail1)" strokeWidth="0.6" fill="none">
        <animate attributeName="d" dur="14s" repeatCount="indefinite"
          values="M 0 10 Q 30 0 50 30 T 100 20; M 0 14 Q 35 8 55 26 T 100 18; M 0 10 Q 30 0 50 30 T 100 20" />
      </path>
      <path d="M 0 40 Q 25 60 55 50 T 100 55"  stroke="url(#trail2)" strokeWidth="0.6" fill="none">
        <animate attributeName="d" dur="18s" repeatCount="indefinite"
          values="M 0 40 Q 25 60 55 50 T 100 55; M 0 38 Q 28 56 52 48 T 100 58; M 0 40 Q 25 60 55 50 T 100 55" />
      </path>
      <path d="M 0 75 Q 40 88 60 70 T 100 85" stroke="url(#trail3)" strokeWidth="0.6" fill="none">
        <animate attributeName="d" dur="16s" repeatCount="indefinite"
          values="M 0 75 Q 40 88 60 70 T 100 85; M 0 80 Q 35 92 65 73 T 100 88; M 0 75 Q 40 88 60 70 T 100 85" />
      </path>
      <path d="M 0 95 Q 30 75 55 92 T 100 78" stroke="url(#trail4)" strokeWidth="0.6" fill="none">
        <animate attributeName="d" dur="20s" repeatCount="indefinite"
          values="M 0 95 Q 30 75 55 92 T 100 78; M 0 92 Q 35 78 60 90 T 100 82; M 0 95 Q 30 75 55 92 T 100 78" />
      </path>
    </svg>
  );
}

// Falling-notes canvas — 4-lane fretboard highway with vanishing-point perspective
function FallingNotesHighway({ active, bpm = 128 }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const notesRef = useRef([]);   // { lane, t (0..1 from spawn to strike) }
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let t0 = performance.now();
    const draw = (now) => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);

      // Vanishing-point lane geometry
      const VP_X = W / 2, VP_Y = H * 0.05;        // vanishing point near top
      const STRIKE_Y = H * 0.85;                  // hit line near bottom
      const FAR_LANE_W = W * 0.12;
      const NEAR_LANE_W = W * 0.95;

      // Draw lane separators (perspective lines)
      const sepXs = [-2, -1, 0, 1, 2];
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      sepXs.forEach((i) => {
        const farX = VP_X + (FAR_LANE_W / 4) * i * 0.6;
        const nearX = VP_X + (NEAR_LANE_W / 4) * i;
        ctx.beginPath(); ctx.moveTo(farX, VP_Y); ctx.lineTo(nearX, H); ctx.stroke();
      });

      // Horizontal "frets" running across the highway (depth lines)
      for (let f = 0; f <= 8; f++) {
        const yy = VP_Y + (STRIKE_Y - VP_Y) * Math.pow(f / 8, 2.2);
        const widthPct = FAR_LANE_W + (NEAR_LANE_W - FAR_LANE_W) * Math.pow(f / 8, 2.2);
        ctx.strokeStyle = `rgba(57,255,20,${0.05 + (f / 8) * 0.13})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(VP_X - widthPct / 2, yy); ctx.lineTo(VP_X + widthPct / 2, yy); ctx.stroke();
      }

      // Strike line (hit zone) — glowing horizontal bar
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(VP_X - NEAR_LANE_W / 2, STRIKE_Y - 4, NEAR_LANE_W, 8);
      ctx.fillStyle = "rgba(255,107,0,0.55)";
      ctx.fillRect(VP_X - NEAR_LANE_W / 2, STRIKE_Y - 2, NEAR_LANE_W, 4);

      // Spawn notes synced to BPM (one note every 1/2 beat)
      const interval = 60000 / bpm / 2;
      if (active && now - lastSpawnRef.current > interval) {
        lastSpawnRef.current = now;
        const lane = Math.floor(Math.random() * 4);
        notesRef.current.push({ lane, spawn: now });
      }

      // Animate notes
      const NOTE_TRAVEL_MS = 2400; // top-to-strike duration
      notesRef.current = notesRef.current.filter((n) => {
        const elapsed = now - n.spawn;
        const t = elapsed / NOTE_TRAVEL_MS;  // 0 → 1
        if (t > 1.05) return false;

        // Lane center perspective interpolation
        const laneOffset = (n.lane - 1.5);    // -1.5 .. +1.5
        const farX = VP_X + (FAR_LANE_W / 4) * laneOffset * 0.5;
        const nearX = VP_X + (NEAR_LANE_W / 4) * laneOffset;
        const px = farX + (nearX - farX) * Math.pow(t, 2.2);
        const py = VP_Y + (STRIKE_Y - VP_Y) * Math.pow(t, 2.2);
        const radius = 4 + 18 * Math.pow(t, 2.2);
        const color = LANE_COLORS[n.lane];

        // Trailing streak (Bezier-curve glow back to spawn)
        ctx.beginPath();
        ctx.moveTo(px, py);
        const cpX = (px + VP_X) / 2;
        const cpY = py - 60;
        ctx.quadraticCurveTo(cpX, cpY, VP_X + (n.lane - 1.5) * (FAR_LANE_W / 4), VP_Y + 4);
        const trailGrad = ctx.createLinearGradient(px, py, VP_X, VP_Y);
        trailGrad.addColorStop(0, color);
        trailGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = Math.max(0.5, radius * 0.18);
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Glow halo
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Inner highlight
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(px - radius * 0.25, py - radius * 0.25, radius * 0.35, 0, Math.PI * 2); ctx.fill();

        return true;
      });

      // Hit-line burst when a note crosses
      notesRef.current.forEach((n) => {
        const elapsed = now - n.spawn;
        const t = elapsed / NOTE_TRAVEL_MS;
        if (t > 0.95 && t < 1.05) {
          const laneOffset = (n.lane - 1.5);
          const nearX = VP_X + (NEAR_LANE_W / 4) * laneOffset;
          ctx.fillStyle = LANE_COLORS[n.lane];
          ctx.globalAlpha = 1 - Math.abs(t - 1) * 20;
          ctx.beginPath(); ctx.arc(nearX, STRIKE_Y, 30, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Continue
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active, bpm]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" data-testid="falling-notes-canvas" />;
}

// Synced lyrics rail — neon-green calligraphy style
function LyricsRail({ lines, currentIdx }) {
  return (
    <div className="space-y-3 px-3 py-2" data-testid="lyrics-rail">
      {lines.map((l, i) => {
        const dist = Math.abs(i - currentIdx);
        const isActive = i === currentIdx;
        const opacity = isActive ? 1 : Math.max(0.2, 1 - dist * 0.25);
        const scale = isActive ? 1.08 : 1;
        return (
          <p
            key={l.id || `lyric-${i}`}
            data-testid={`lyric-line-${i}`}
            className={`font-['Outfit'] font-black leading-tight transition-all duration-300 ${isActive ? "text-[#39FF14]" : "text-white/60"}`}
            style={{
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: "left",
              textShadow: isActive ? "0 0 14px #39FF14, 0 0 28px rgba(57,255,20,0.35)" : "none",
              fontSize: isActive ? "16px" : "13px",
            }}
          >
            {l.text}
          </p>
        );
      })}
    </div>
  );
}

// Demo lyrics — replace with real synced data when a track is loaded
const DEMO_LYRICS = [
  "Bring the fire inside",
  "Hands up, no time to hide",
  "Stage lights pull us in",
  "This is where the night begins",
  "Lights up, we rise above",
  "Sing it loud, sing it strong",
  "Voices ring all night long",
  "Take the mic, take the stage",
];

export default function GamerStage({ battle, onExit }) {
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");

  // Avatar from Creation Lab
  const avatar = useMemo(() => {
    try {
      return { ...DEFAULT_GAMER_AVATAR, ...(JSON.parse(localStorage.getItem("pp_gamer_avatar") || "null") || {}) };
    } catch {
      return DEFAULT_GAMER_AVATAR;
    }
  }, []);

  const [modeKey, setModeKey] = useState("sing");
  const mode = PERFORMANCE_MODES.find((m) => m.key === modeKey) || PERFORMANCE_MODES[0];
  const [vocalDropped, setVocalDropped] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentLyric, setCurrentLyric] = useState(0);
  const [fireCount, setFireCount] = useState(0);
  const [heartCount, setHeartCount] = useState(0);

  // Avatar-with-instrument override per mode
  const stageAvatar = useMemo(() => ({ ...avatar, instrument: mode.inst, face: mode.face }), [avatar, mode]);

  // Performance clock
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setProgress((p) => (p + 0.4) % 100);
    }, 200);
    return () => clearInterval(id);
  }, [isLive]);

  // Lyrics auto-advance every ~4s while live
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setCurrentLyric((i) => (i + 1) % DEMO_LYRICS.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isLive]);

  const lyrics = DEMO_LYRICS.map((text, i) => ({ id: `l-${i}`, text }));

  const songTitle = (battle?.song_title || "Fire Inside").toUpperCase();
  const songArtist = battle?.song_artist || "Pocket Products";
  const bpm = 128;
  const keyName = "E MIN";
  const totalSec = 220;
  const elapsedSec = (progress / 100) * totalSec;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[55] bg-[#05050A] overflow-hidden flex flex-col" data-testid="gamer-stage">
      {/* Bezier light-trail backdrop */}
      <LightTrails />

      {/* Header */}
      <header className="relative z-10 px-3 sm:px-5 pt-3 pb-2 flex items-center gap-2 border-b border-white/5"
        style={{ background: "rgba(5,5,10,0.6)", backdropFilter: "blur(12px)" }} data-testid="gamer-stage-header">
        <Button onClick={onExit} data-testid="gamer-stage-exit" variant="ghost"
          className="w-8 h-8 p-0 rounded-full text-[#5C5C6B] hover:text-white">
          <X className="w-4 h-4" />
        </Button>
        {isLive && (
          <span className="px-2 h-6 rounded-full flex items-center gap-1.5"
            style={{ background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,80,80,0.5)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] uppercase tracking-[0.3em] font-black text-red-400">Live</span>
          </span>
        )}
        <div className="flex-1 text-center min-w-0">
          <h1 className="font-['Outfit'] font-black text-white truncate text-lg sm:text-2xl leading-none"
            style={{ textShadow: "0 0 14px rgba(255,107,0,0.45)" }} data-testid="stage-song-title">{songTitle}</h1>
          <p className="text-[10px] text-[#A0A0B0] truncate mt-0.5">{songArtist}</p>
        </div>
        <button onClick={() => setFireCount((c) => c + 1)} data-testid="stage-fire"
          className="flex items-center gap-1 px-2 h-7 rounded-full border border-[#FF6B00]/40 bg-[#FF6B00]/8">
          <Flame className="w-3 h-3 text-[#FF6B00]" />
          <span className="text-[10px] font-black text-white">{fireCount}</span>
        </button>
        <button onClick={() => setHeartCount((c) => c + 1)} data-testid="stage-heart"
          className="flex items-center gap-1 px-2 h-7 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/8">
          <Heart className="w-3 h-3 text-[#39FF14]" />
          <span className="text-[10px] font-black text-white">{heartCount}</span>
        </button>
      </header>

      {/* Mode + stem-remover bar */}
      <div className="relative z-10 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/5" data-testid="stage-controls-bar">
        <div className="flex gap-1.5" data-testid="mode-picker">
          {PERFORMANCE_MODES.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setModeKey(key)} data-testid={`mode-${key}`}
              className={`px-3 h-8 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                modeKey === key
                  ? "bg-[#FF6B00] text-white shadow-[0_0_14px_rgba(255,107,0,0.55)]"
                  : "border border-white/10 text-[#A0A0B0] hover:text-white"
              }`}>
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
        {(modeKey === "sing" || modeKey === "both") && (
          <button
            onClick={() => { setVocalDropped((v) => !v); toast.success(vocalDropped ? "Vocals back on" : "Vocals dropped — your turn!"); }}
            data-testid="stem-remover-toggle"
            className={`px-3 h-8 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
              vocalDropped
                ? "bg-[#39FF14] text-[#05050A] border-[#39FF14] shadow-[0_0_14px_rgba(57,255,20,0.55)]"
                : "border-[#39FF14]/40 text-[#39FF14] bg-[#39FF14]/5 hover:bg-[#39FF14]/15"
            }`}>
            {vocalDropped ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            {vocalDropped ? "Vocals OFF" : "Drop Vocals"}
          </button>
        )}
      </div>

      {/* Main 3-pane */}
      <div className="relative z-10 flex-1 grid gap-2 p-2 min-h-0 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)_280px]">
        {/* LEFT — Lyrics rail */}
        <aside data-testid="lyrics-pane" className="hidden md:flex relative rounded-2xl border border-[#39FF14]/20 overflow-hidden flex-col"
          style={{ background: "linear-gradient(180deg, rgba(15,22,15,0.85), rgba(5,10,5,0.85))" }}>
          <div className="px-3 pt-3 pb-2 border-b border-[#39FF14]/15">
            <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#39FF14]">Lyrics</p>
          </div>
          <div className="flex-1 overflow-y-auto"><LyricsRail lines={lyrics} currentIdx={currentLyric} /></div>
        </aside>

        {/* CENTER — Dynamic avatar */}
        <section data-testid="stage-avatar-pane" className="relative rounded-2xl border border-white/8 overflow-hidden flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,107,0,0.12), transparent 70%), #05050A" }}>
          {/* Spotlight halo behind avatar */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[280px] h-[280px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,107,0,0.3) 0%, transparent 70%)",
                boxShadow: "0 0 80px rgba(255,107,0,0.4)",
              }} />
          </div>
          <div className="relative" data-testid="stage-avatar">
            <GamerAvatar avatar={stageAvatar} size={300} glowColor={modeKey === "rap" ? "#39FF14" : "#FF6B00"} />
            {/* For "both" mode, draw a small mic icon next to the guitar avatar */}
            {modeKey === "both" && (
              <div className="absolute -bottom-2 right-2 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#39FF14", boxShadow: "0 0 14px #39FF14" }}>
                <Mic className="w-5 h-5 text-[#05050A]" />
              </div>
            )}
          </div>
          {/* Mode caption */}
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.35em] font-black text-white/70" data-testid="stage-mode-caption">
            Performing · <span className="text-[#FF6B00]">{mode.label}</span>
            {vocalDropped && <span className="text-[#39FF14] ml-2">· Acapella Mode</span>}
          </p>
        </section>

        {/* RIGHT — Guitar Hero falling notes */}
        <aside data-testid="notes-pane" className="relative rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: "linear-gradient(180deg, #0a0a18, #050508)" }}>
          <div className="px-3 pt-3 pb-2 border-b border-white/10 flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#00E0FF]">Notes</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">{bpm} BPM</p>
          </div>
          <div className="absolute inset-0 top-9">
            <FallingNotesHighway active={isLive} bpm={bpm} />
          </div>
        </aside>
      </div>

      {/* BOTTOM — progress + BPM + KEY */}
      <footer className="relative z-10 px-3 sm:px-5 py-2 border-t border-white/5"
        style={{ background: "linear-gradient(180deg, rgba(10,10,16,0.6), rgba(5,5,10,0.95))", backdropFilter: "blur(10px)" }} data-testid="stage-progress-bar">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#A0A0B0]" data-testid="stage-elapsed">{fmt(elapsedSec)}</span>
          <div className="relative flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
            <div className="absolute inset-y-0 left-0 transition-[width]"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #FF6B00, #39FF14)", boxShadow: "0 0 10px rgba(255,107,0,0.55)" }} />
          </div>
          <span className="text-[10px] font-mono text-[#A0A0B0]">{fmt(totalSec)}</span>
          <span className="inline-flex items-center px-2 h-6 rounded-full border border-[#FF6B00]/40 bg-[#FF6B00]/8 text-[#FF6B00] text-[10px] font-black tracking-wider" data-testid="stage-bpm">
            BPM <span className="ml-1 text-white">{bpm}</span>
          </span>
          <span className="inline-flex items-center px-2 h-6 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/8 text-[#39FF14] text-[10px] font-black tracking-wider" data-testid="stage-key">
            KEY <span className="ml-1 text-white">{keyName}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
