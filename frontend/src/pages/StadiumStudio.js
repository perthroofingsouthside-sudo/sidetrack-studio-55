/* PersonalStudio — Creator-lane personal recording space.
   3-pane layout:
     LEFT  : vertical stem mixer (Drums / Bass / Keys / Master) with dB meters + Solo/Mute
     CENTER: cover/halo + neon waveform + record button
     RIGHT : Studio Tools — Stem Upload Queue + AI Beat Maker + Sing-to-Stems
   BOTTOM: synced progress bar, BPM, Key. Strictly local; no chat/social. */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Square, Sliders, ChevronLeft, Layers, Clock, Upload, Sparkles, Music2,
  Loader2, Play, Pause, Trash2, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { putStem, listStems, removeStem as dbRemoveStem, dataUrlToBlob } from "@/services/stemStore";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const STEMS = [
  { key: "drums",  label: "Drums",  color: "#39FF14" },
  { key: "bass",   label: "Bass",   color: "#39FF14" },
  { key: "keys",   label: "Keys",   color: "#39FF14" },
  { key: "master", label: "Master", color: "#FF6B00" },
];

// dB meter — animated vertical bars driven by a per-stem level state
function DbMeter({ level, color }) {
  // Render 16 segments; lit count based on level (0-100)
  const segs = 16;
  const lit = Math.round((level / 100) * segs);
  return (
    <div className="flex flex-col gap-0.5 w-1.5 h-32" aria-hidden>
      {Array.from({ length: segs }).map((_, i) => {
        const idx = segs - 1 - i; // top down
        const on = idx < lit;
        const isPeak = idx >= 13;
        const segColor = isPeak && on ? "#FF6B00" : on ? color : "rgba(255,255,255,0.06)";
        return (
          <div
            key={`seg-${idx}`}
            className="flex-1 rounded-sm transition-colors"
            style={{
              background: segColor,
              boxShadow: on ? `0 0 4px ${segColor}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function StemRow({ stem, value, muted, soloed, onVolume, onMute, onSolo, level }) {
  return (
    <div className="flex flex-col items-center gap-2" data-testid={`stem-${stem.key}`}>
      <p className="text-[9px] uppercase tracking-[0.2em] font-black text-white">{stem.label}</p>
      <div className="flex items-center gap-1.5">
        {/* dB meter */}
        <DbMeter level={muted ? 0 : level} color={stem.color} />
        {/* Vertical slider */}
        <div className="flex flex-col items-center justify-center h-32 px-1">
          <Slider
            orientation="vertical"
            value={[value]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onVolume(v)}
            data-testid={`stem-${stem.key}-slider`}
            className="h-32"
          />
        </div>
      </div>
      <p className="text-[8px] font-mono text-[#A0A0B0]" data-testid={`stem-${stem.key}-db`}>
        {muted ? "—∞" : `${value === 0 ? "-∞" : ((value - 100) / 2).toFixed(1)} dB`}
      </p>
      {/* Solo + Mute */}
      <div className="flex gap-1">
        <button
          onClick={onSolo}
          data-testid={`stem-${stem.key}-solo`}
          className={`w-7 h-5 rounded text-[8px] font-black uppercase tracking-wider border transition-all ${
            soloed
              ? "bg-[#39FF14] text-[#05050A] border-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.55)]"
              : "bg-transparent text-[#39FF14]/60 border-[#39FF14]/30 hover:text-[#39FF14]"
          }`}
        >
          S
        </button>
        <button
          onClick={onMute}
          data-testid={`stem-${stem.key}-mute`}
          className={`w-7 h-5 rounded text-[8px] font-black uppercase tracking-wider border transition-all ${
            muted
              ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-[0_0_8px_rgba(255,107,0,0.55)]"
              : "bg-transparent text-[#FF6B00]/60 border-[#FF6B00]/30 hover:text-[#FF6B00]"
          }`}
        >
          M
        </button>
      </div>
    </div>
  );
}

// Animated neon-orange waveform across the bottom of the centre frame
function NeonWaveform({ active, height = 96 }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    let t = 0;
    const tick = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // 2 overlapping waves
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(255,107,0,0.0)");
      grad.addColorStop(0.5, "#FF6B00");
      grad.addColorStop(1, "rgba(255,107,0,0.0)");
      const drawWave = (amp, freq, offset, alpha) => {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const noise = active ? Math.sin(x * 0.011 + t * 0.0017) * 0.5 : 0;
          const y = h / 2 + Math.sin(x * freq + t * offset) * amp * (active ? 1 : 0.25) + noise * amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = grad;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#FF6B00";
        ctx.stroke();
      };
      drawWave(h * 0.32, 0.024, 0.04, 0.85);
      drawWave(h * 0.20, 0.038, -0.06, 0.55);
      ctx.globalAlpha = 1;
      t += 16;
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("resize", resize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active]);
  return <canvas ref={ref} style={{ width: "100%", height }} data-testid="stadium-waveform" />;
}

export default function StadiumStudio({ song, onSwitchClassic }) {
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");

  // ── State ──
  const [volumes, setVolumes] = useState({ drums: 80, bass: 78, keys: 65, master: 88 });
  const [muted, setMuted] = useState({});
  const [soloed, setSoloed] = useState({});
  const [levels, setLevels] = useState({ drums: 40, bass: 32, keys: 28, master: 60 });
  const [isPerforming, setIsPerforming] = useState(false);
  const [progress, setProgress] = useState(0);  // 0..100
  const [mobileTab, setMobileTab] = useState("mixer"); // mixer | tools

  // Stem upload queue (WAV/MP3 audio files the user drops in)
  const [stems, setStems] = useState([]);                 // {id, name, url, duration, blob}
  const [activeStemId, setActiveStemId] = useState(null); // stem currently playing as backing track
  const [stemPlaying, setStemPlaying] = useState(false);
  const stemAudioRef = useRef(null);
  const fileInputRef = useRef(null);

  // AI beat prompt (genre keys map to backend ALLOWED_GENRES catalogue)
  const [beatPrompt, setBeatPrompt] = useState("");
  const [beatBpm, setBeatBpm] = useState(96);
  const [beatGenre, setBeatGenre] = useState("hip_hop_top200");
  const [beatBars, setBeatBars] = useState(8);
  const [beatGenerating, setBeatGenerating] = useState(false);

  // Mic recording (sing-to-stems)
  const [recording, setRecording] = useState(false);
  const [lastTakeUrl, setLastTakeUrl] = useState(null);
  const recRef = useRef({ stream: null, rec: null, chunks: [] });

  // Song defaults
  const songTitle = (song?.title || "Fire Inside").toUpperCase();
  const songArtist = song?.artist || "You · Original";
  const songCover = song?.cover_url || "";

  // ── Animate dB meters when performing ──
  useEffect(() => {
    if (!isPerforming) return;
    const id = setInterval(() => {
      setLevels((prev) => {
        const next = { ...prev };
        for (const s of STEMS) {
          const v = volumes[s.key] || 0;
          const target = (v / 100) * (70 + Math.random() * 25);
          next[s.key] = Math.max(8, Math.round(target));
        }
        return next;
      });
      setProgress((p) => (p + 0.5) % 100);
    }, 180);
    return () => clearInterval(id);
  }, [isPerforming, volumes]);

  const togglePerform = useCallback(() => {
    setIsPerforming((p) => !p);
    if (!isPerforming) {
      setProgress(0);
      toast.success("Live · Stage lights on", { className: "neon-toast" });
    }
  }, [isPerforming]);

  const setVol = (key, v) => setVolumes((prev) => ({ ...prev, [key]: v }));
  const toggleMute = (key) => setMuted((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleSolo = (key) => setSoloed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Stem Upload ──
  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith("audio/")) { toast.error(`${file.name}: not an audio file`); continue; }
      const url = URL.createObjectURL(file);
      const entry = {
        id: `stem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name, url, blob: file, duration: 0, kind: "upload",
      };
      try {
        const a = new Audio(url);
        await new Promise((res) => {
          a.onloadedmetadata = () => { entry.duration = a.duration || 0; res(); };
          a.onerror = res;
        });
      } catch { /* noop */ }
      setStems((prev) => [...prev, entry]);
      // Persist (blob + metadata) — file is itself a Blob so no conversion needed
      putStem({ id: entry.id, name: entry.name, blob: file, duration: entry.duration, kind: "upload" })
        .catch((err) => console.warn("[stems] persist failed:", err));
    }
    if (e.target) e.target.value = "";
    if (files.length) toast.success(`${files.length} stem${files.length === 1 ? "" : "s"} added`);
  };

  const removeStem = (id) => {
    setStems((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.url) { try { URL.revokeObjectURL(target.url); } catch { /* noop */ } }
      return prev.filter((s) => s.id !== id);
    });
    if (activeStemId === id) { stemAudioRef.current?.pause(); setStemPlaying(false); setActiveStemId(null); }
    dbRemoveStem(id).catch(() => { /* noop */ });
  };

  const playStem = (stem) => {
    if (stemAudioRef.current) { stemAudioRef.current.pause(); stemAudioRef.current = null; }
    if (activeStemId === stem.id && stemPlaying) {
      setStemPlaying(false); setActiveStemId(null); return;
    }
    const a = new Audio(stem.url);
    a.onended = () => { setStemPlaying(false); setActiveStemId(null); };
    a.onerror = () => { toast.error("Couldn't play stem"); setStemPlaying(false); };
    a.play().then(() => { stemAudioRef.current = a; setActiveStemId(stem.id); setStemPlaying(true); })
      .catch(() => toast.error("Playback blocked"));
  };

  // ── AI Beat ──
  const generateBeat = async () => {
    setBeatGenerating(true);
    try {
      const res = await axios.post(`${API}/studio/beat/generate`, {
        genre: beatGenre,
        bpm: beatBpm,
        bars: beatBars,
        key: "C",
        user_id: userId.current,
      });
      const url = res.data?.beat?.preview_url || res.data?.beat?.audio_url || res.data?.audio_url;
      const labelBase = beatPrompt.trim() || `AI Beat · ${beatGenre.replace(/_/g, " ")}`;
      if (url) {
        const entry = { id: `beat-${Date.now()}`, name: labelBase, url, blob: null, duration: 0, kind: "beat" };
        setStems((prev) => [entry, ...prev]);
        toast.success("AI beat ready · added to stems");
        // Convert data: URL to a Blob and persist
        dataUrlToBlob(url).then((blob) => {
          if (blob) putStem({ id: entry.id, name: entry.name, blob, duration: 0, kind: "beat" })
            .catch((err) => console.warn("[stems] beat persist failed:", err));
        });
      } else {
        toast.message("Beat generated (preview unavailable)");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Beat generator unavailable";
      toast.error(typeof msg === "string" ? msg : "Beat generator unavailable");
    } finally { setBeatGenerating(false); }
  };

  // ── Mic record (sing over the active stem) ──
  const toggleRecord = async () => {
    if (recording) {
      recRef.current.rec?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recRef.current = { stream, rec, chunks: [] };
      rec.ondataavailable = (e) => { if (e.data.size > 0) recRef.current.chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(recRef.current.chunks, { type: mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setLastTakeUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        toast.success("Take saved · listen back");
      };
      rec.start();
      setRecording(true);
      // Optionally start the active stem when recording starts
      const stem = stems.find((s) => s.id === activeStemId);
      if (stem && !stemPlaying) playStem(stem);
    } catch {
      toast.error("Mic permission denied");
    }
  };

  useEffect(() => () => {
    if (stemAudioRef.current) stemAudioRef.current.pause();
    if (recRef.current.stream) recRef.current.stream.getTracks().forEach((t) => t.stop());
    stems.forEach((s) => { try { URL.revokeObjectURL(s.url); } catch { /* noop */ } });
    if (lastTakeUrl) try { URL.revokeObjectURL(lastTakeUrl); } catch { /* noop */ }
  }, []);

  // Hydrate persisted stems from IndexedDB on first mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await listStems();
        if (cancelled || !saved.length) return;
        const hydrated = saved
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          .map((s) => ({
            id: s.id,
            name: s.name,
            blob: s.blob,
            url: URL.createObjectURL(s.blob),
            duration: s.duration || 0,
            kind: s.kind || "upload",
          }));
        setStems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...hydrated.filter((h) => !seen.has(h.id)), ...prev];
        });
      } catch (err) { console.warn("[stems] hydrate failed:", err); }
    })();
    return () => { cancelled = true; };
  }, []);

  const bpm = 128;
  const keyName = "E MIN";
  // Live elapsed time, derived from progress (~3:40 reference track)
  const totalSec = 220;
  const elapsedSec = (progress / 100) * totalSec;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="min-h-screen relative bg-[#05050A] overflow-hidden flex flex-col pb-[88px] lg:pb-[80px]" data-testid="stadium-studio">
      {/* Ambient stage glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[60%] h-[60%] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse at top, rgba(255,107,0,0.16) 0%, transparent 65%)", filter: "blur(8px)" }} />
        <div className="absolute top-0 right-1/4 w-[60%] h-[60%] translate-x-1/2"
          style={{ background: "radial-gradient(ellipse at top, rgba(57,255,20,0.13) 0%, transparent 65%)", filter: "blur(8px)" }} />
      </div>

      {/* Top header: date chip + classic toggle + song title + counters */}
      <header className="relative z-10 px-3 sm:px-6 pt-3 pb-2 flex items-center gap-3" data-testid="stadium-header">
        <div className="flex items-center gap-2">
          {/* Punk date chip */}
          <span data-testid="date-chip" className="px-2.5 h-7 rounded-full flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.25em]"
            style={{
              background: "rgba(255,107,0,0.06)",
              border: "1px solid rgba(255,107,0,0.6)",
              color: "#FF6B00",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 14px rgba(255,107,0,0.25), inset 0 0 6px rgba(255,107,0,0.15)",
            }}>
            <Clock className="w-2.5 h-2.5" />
            Yesterday
          </span>
          <button
            onClick={onSwitchClassic}
            data-testid="switch-classic-btn"
            className="inline-flex px-2.5 h-7 rounded-full items-center gap-1 text-[9px] font-black uppercase tracking-[0.25em] border border-white/15 bg-white/5 text-white/70 hover:text-white"
          >
            <ChevronLeft className="w-2.5 h-2.5" /> Classic
          </button>
        </div>
        <div className="flex-1 text-center min-w-0">
          <h1 className="font-['Outfit'] font-black text-white leading-none tracking-tight truncate text-xl sm:text-3xl"
            style={{ textShadow: "0 0 18px rgba(255,107,0,0.45), 0 0 36px rgba(255,107,0,0.2)" }}
            data-testid="stadium-song-title">{songTitle}</h1>
          <p className="text-[10px] sm:text-xs text-[#A0A0B0] font-bold mt-0.5 truncate" data-testid="stadium-song-artist">{songArtist}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {recording && (
            <span className="flex items-center gap-1.5 px-2 h-7 rounded-full border border-red-500/40 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wider" data-testid="personal-rec-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Rec
            </span>
          )}
        </div>
      </header>

      {/* Mobile-only tab switcher between mixer / tools */}
      <div className="lg:hidden px-3 pb-2 flex gap-1.5" data-testid="mobile-tabs">
        <button onClick={() => setMobileTab("mixer")} data-testid="mobile-tab-mixer"
          className={`flex-1 h-8 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 ${
            mobileTab === "mixer" ? "bg-[#39FF14] text-[#05050A]" : "border border-white/10 text-[#A0A0B0]"
          }`}>
          <Sliders className="w-3 h-3" /> Mixer
        </button>
        <button onClick={() => setMobileTab("tools")} data-testid="mobile-tab-tools"
          className={`flex-1 h-8 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 ${
            mobileTab === "tools" ? "bg-[#FF6B00] text-white" : "border border-white/10 text-[#A0A0B0]"
          }`}>
          <Wand2 className="w-3 h-3" /> Tools
        </button>
      </div>

      {/* Main 3-pane grid */}
      <div className="relative z-10 flex-1 px-3 sm:px-6 grid gap-3 pb-2"
        style={{ gridTemplateColumns: "1fr" }}
      >
        <div className="grid gap-3 h-full"
          style={{ gridTemplateColumns: "minmax(0,1fr)", gridTemplateRows: "minmax(0,1fr)" }}>
          <div className="grid gap-3 h-full lg:grid-cols-[220px_minmax(0,1fr)_280px]">
            {/* ── LEFT: Stem Mixer ── */}
            <aside data-testid="stem-mixer"
              className={`relative rounded-2xl border border-white/8 backdrop-blur-md p-3 ${mobileTab === "mixer" ? "block" : "hidden"} lg:block`}
              style={{ background: "linear-gradient(180deg, rgba(15,15,22,0.85), rgba(5,5,10,0.85))" }}>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#39FF14] mb-3 flex items-center gap-1">
                <Layers className="w-3 h-3" /> Stems
              </p>
              <div className="grid grid-cols-4 gap-2">
                {STEMS.map((s) => (
                  <StemRow
                    key={s.key}
                    stem={s}
                    value={volumes[s.key]}
                    muted={!!muted[s.key]}
                    soloed={!!soloed[s.key]}
                    level={levels[s.key] || 0}
                    onVolume={(v) => setVol(s.key, v)}
                    onMute={() => toggleMute(s.key)}
                    onSolo={() => toggleSolo(s.key)}
                  />
                ))}
              </div>

              {/* Master gain meta */}
              <div className="mt-3 pt-3 border-t border-white/5 text-center">
                <p className="text-[8px] uppercase tracking-wider text-[#5C5C6B] font-bold">Master</p>
                <p className="text-base font-['Outfit'] font-black text-[#FF6B00]" data-testid="master-db">
                  {muted.master ? "—∞" : `${((volumes.master - 100) / 2).toFixed(1)} dB`}
                </p>
              </div>
            </aside>

            {/* ── CENTER: Performance area ── */}
            <section data-testid="performance-area" className="relative rounded-2xl overflow-hidden border border-white/8"
              style={{ background: "linear-gradient(180deg, #0a0a14, #050508)" }}>
              {/* Video / cover-art frame */}
              <div className="absolute inset-0">
                {songCover ? (
                  <>
                    <img src={songCover} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 opacity-25"
                      style={{ filter: "blur(20px) saturate(1.3)" }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#05050A]/40 to-[#05050A]" />
                  </>
                ) : (
                  <div className="absolute inset-0"
                    style={{ background: "radial-gradient(ellipse at center, rgba(255,107,0,0.12), transparent 70%)" }} />
                )}
                {/* Big "neon halo" focus */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-full"
                    style={{
                      background: isPerforming
                        ? "radial-gradient(circle, rgba(255,107,0,0.35) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(255,107,0,0.18) 0%, transparent 70%)",
                      boxShadow: isPerforming ? "0 0 60px rgba(255,107,0,0.4)" : "none",
                    }}>
                    {songCover ? (
                      <img src={songCover} alt="" className="absolute inset-4 rounded-full object-cover border border-white/10"
                        style={{ boxShadow: isPerforming ? "0 0 32px rgba(255,107,0,0.55)" : "0 0 12px rgba(0,0,0,0.5)" }} />
                    ) : (
                      <div className="absolute inset-4 rounded-full flex items-center justify-center"
                        style={{
                          background: "radial-gradient(circle, rgba(255,107,0,0.2), rgba(57,255,20,0.05))",
                          border: "1px solid rgba(255,107,0,0.3)",
                        }}>
                        <Mic className="w-16 h-16 text-[#FF6B00]/70" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Live tag */}
                {isPerforming && (
                  <div className="absolute top-3 left-3 px-2 h-6 rounded-full flex items-center gap-1.5"
                    style={{ background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,80,80,0.5)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] uppercase tracking-[0.3em] font-black text-red-400">Live</span>
                  </div>
                )}
              </div>

              {/* Big neon-orange waveform pinned to bottom of centre frame */}
              <div className="absolute left-0 right-0 bottom-0 px-4 pb-3"
                style={{ background: "linear-gradient(180deg, transparent, rgba(5,5,10,0.85))" }}>
                <NeonWaveform active={isPerforming} height={96} />
              </div>

              {/* Centred perform button */}
              <div className="absolute bottom-[88px] left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button
                  onClick={togglePerform}
                  data-testid="stadium-perform-btn"
                  className={`w-14 h-14 rounded-full ${
                    isPerforming
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-gradient-to-br from-[#FF6B00] to-[#FF8533]"
                  } text-white`}
                  style={{
                    boxShadow: isPerforming
                      ? "0 0 28px rgba(255,0,0,0.55)"
                      : "0 0 28px rgba(255,107,0,0.6)",
                  }}
                >
                  {isPerforming ? <Square className="w-6 h-6" fill="white" /> : <Mic className="w-6 h-6" />}
                </Button>
              </div>
            </section>

            {/* ── RIGHT: Studio Tools — Stem Upload + AI Beat + Sing-to-Stems ── */}
            <aside data-testid="studio-tools-panel"
              className={`relative rounded-2xl border border-white/8 backdrop-blur-md p-3 flex flex-col gap-3 ${mobileTab === "tools" ? "flex" : "hidden"} lg:flex`}
              style={{ background: "linear-gradient(180deg, rgba(15,15,22,0.85), rgba(5,5,10,0.85))" }}>

              {/* Section 1 — Stem upload queue */}
              <div data-testid="stem-upload-section">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#39FF14] flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Stems
                  </p>
                  <button onClick={onPickFile} data-testid="stem-upload-btn"
                    className="h-7 px-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-[#39FF14]/40 text-[#39FF14] hover:bg-[#39FF14]/10">
                    Upload
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="audio/*" multiple onChange={onFileChange}
                  data-testid="stem-file-input" className="hidden" />
                {stems.length === 0 ? (
                  <button onClick={onPickFile} data-testid="stem-empty"
                    className="w-full rounded-xl border border-dashed border-white/10 p-3 flex items-center gap-2 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all text-left">
                    <Music2 className="w-6 h-6 text-[#39FF14]/40 flex-shrink-0" />
                    <p className="text-[10px] text-[#A0A0B0]">Drop a WAV / MP3 backing track here</p>
                  </button>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto" data-testid="stem-list">
                    {stems.map((s) => {
                      const isActive = activeStemId === s.id && stemPlaying;
                      return (
                        <div key={s.id} data-testid={`stem-${s.id}`}
                          className={`flex items-center gap-2 p-2 rounded-xl border ${isActive ? "border-[#39FF14]/50 bg-[#39FF14]/8" : "border-white/5"}`}>
                          <button onClick={() => playStem(s)} data-testid={`stem-play-${s.id}`}
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "bg-[#39FF14] text-[#05050A]" : "bg-[#39FF14]/15 text-[#39FF14]"}`}>
                            {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-white truncate">{s.name}</p>
                            {s.duration > 0 && <p className="text-[9px] text-[#5C5C6B]">{Math.round(s.duration)}s</p>}
                          </div>
                          <button onClick={() => removeStem(s.id)} data-testid={`stem-remove-${s.id}`}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[#5C5C6B] hover:text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2 — AI Beat Maker prompt */}
              <div data-testid="ai-beat-section" className="pt-3 border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FF6B00] mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Beat Maker
                </p>
                <Input value={beatPrompt} onChange={(e) => setBeatPrompt(e.target.value)}
                  placeholder="(Optional) name this beat"
                  data-testid="ai-beat-prompt"
                  className="h-9 bg-[#0F0F16] border-white/10 text-white text-xs rounded-lg" />
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <Input type="number" value={beatBpm}
                    onChange={(e) => setBeatBpm(Math.max(60, Math.min(200, +e.target.value || 96)))}
                    placeholder="BPM"
                    data-testid="ai-beat-bpm"
                    className="h-8 bg-[#0F0F16] border-white/10 text-white text-xs rounded-lg" />
                  <select value={beatBars} onChange={(e) => setBeatBars(+e.target.value)}
                    data-testid="ai-beat-bars"
                    className="h-8 bg-[#0F0F16] border border-white/10 text-white text-xs rounded-lg px-2">
                    {[4, 8, 16, 32].map((b) => <option key={b} value={b}>{b} bars</option>)}
                  </select>
                  <select value={beatGenre} onChange={(e) => setBeatGenre(e.target.value)}
                    data-testid="ai-beat-genre"
                    className="h-8 bg-[#0F0F16] border border-white/10 text-white text-xs rounded-lg px-2">
                    <option value="hip_hop_top200">Hip-Hop</option>
                    <option value="mtv_classic">MTV Classic</option>
                    <option value="ministry_of_sound">House</option>
                    <option value="alt_rock">Alt-Rock</option>
                  </select>
                </div>
                <Button onClick={generateBeat} disabled={beatGenerating}
                  data-testid="ai-beat-generate"
                  className="w-full mt-1.5 h-9 rounded-lg bg-[#FF6B00] hover:bg-[#FF8533] text-white text-[10px] font-black uppercase tracking-wider gap-1.5">
                  {beatGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {beatGenerating ? "Generating…" : "Generate Beat"}
                </Button>
              </div>

              {/* Section 3 — Sing-to-Stems controls (Record) */}
              <div data-testid="record-section" className="pt-3 border-t border-white/5 mt-auto">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#39FF14] mb-2 flex items-center gap-1">
                  <Mic className="w-3 h-3" /> Sing to Stems
                </p>
                <Button onClick={toggleRecord} data-testid="personal-record-btn"
                  className={`w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-wider gap-1.5 ${
                    recording
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-[#39FF14] hover:bg-[#39FF14]/85 text-[#05050A]"
                  }`}
                  style={!recording ? { boxShadow: "0 0 18px rgba(57,255,20,0.4)" } : undefined}>
                  {recording ? <><Square className="w-3 h-3" /> Stop Take</> : <><Mic className="w-3 h-3" /> Record Take</>}
                </Button>
                <p className="text-[9px] text-[#5C5C6B] mt-1 text-center">
                  {activeStemId
                    ? "Hits record · plays the selected stem"
                    : "Pick a stem above first (or just record dry)"}
                </p>
                {lastTakeUrl && (
                  <audio src={lastTakeUrl} controls className="mt-2 w-full"
                    data-testid="last-take-player"
                    style={{ filter: "invert(0.85) hue-rotate(180deg)" }} />
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Bottom synced progress bar with BPM + KEY — positioned ABOVE the global BottomNav */}
      <footer data-testid="stadium-progress-bar"
        className="fixed left-0 right-0 z-10 px-3 sm:px-6 py-2 border-t border-white/5"
        style={{ bottom: "84px", background: "linear-gradient(180deg, rgba(10,10,16,0.6), rgba(5,5,10,0.95))", backdropFilter: "blur(10px)" }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#A0A0B0]" data-testid="elapsed">{fmt(elapsedSec)}</span>
          <div className="relative flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
            <div className="absolute inset-y-0 left-0 transition-[width]"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #FF6B00, #39FF14)",
                boxShadow: "0 0 10px rgba(255,107,0,0.55)",
              }} />
          </div>
          <span className="text-[10px] font-mono text-[#A0A0B0]">{fmt(totalSec)}</span>
          <span className="hidden sm:inline-flex items-center px-2 h-6 rounded-full border border-[#FF6B00]/40 bg-[#FF6B00]/8 text-[#FF6B00] text-[10px] font-black tracking-wider" data-testid="bpm-pill">
            BPM <span className="ml-1 text-white">{bpm}</span>
          </span>
          <span className="hidden sm:inline-flex items-center px-2 h-6 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/8 text-[#39FF14] text-[10px] font-black tracking-wider" data-testid="key-pill">
            KEY <span className="ml-1 text-white">{keyName}</span>
          </span>
        </div>
        {/* Compact mobile-only BPM + KEY row */}
        <div className="sm:hidden flex items-center justify-center gap-2 mt-1.5">
          <span className="inline-flex items-center px-2 h-5 rounded-full border border-[#FF6B00]/40 bg-[#FF6B00]/8 text-[#FF6B00] text-[9px] font-black tracking-wider">
            BPM <span className="ml-1 text-white">{bpm}</span>
          </span>
          <span className="inline-flex items-center px-2 h-5 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/8 text-[#39FF14] text-[9px] font-black tracking-wider">
            KEY <span className="ml-1 text-white">{keyName}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
