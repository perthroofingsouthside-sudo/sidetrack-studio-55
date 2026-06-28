/* BackstageCinema — cinematic playback experience for a kept Gamer performance.

   Sequence (auto-advances; user can skip to playback):
     1. backstage_pov     — dark curtain, "Crowd Roar" SFX rises
     2. handoff           — friendly avatar walks through curtain, line: "Your set killed it for us."
     3. stage_walk        — 1st-person POV walks through the curtain (curtain opens, lights up)
     4. crowd_reveal      — wide stadium crowd silhouette + cheer peak
     5. zoom_avatar       — camera zooms in on the user's own avatar
     6. playback          — actual recording UI (controls + meta)
*/
import { useEffect, useRef, useState } from "react";
import { X, Heart, Eye, Share2, Lock, Mic, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import { API } from "@/App";
import GamerAvatar, { DEFAULT_GAMER_AVATAR } from "@/components/GamerAvatar";

const PHASES = ["backstage_pov", "handoff", "stage_walk", "crowd_reveal", "zoom_avatar", "playback"];
const PHASE_DURATIONS = { backstage_pov: 1600, handoff: 2400, stage_walk: 1800, crowd_reveal: 1800, zoom_avatar: 1600 };

// Synthesised "Crowd Roar" — brown noise + slow filter sweep via WebAudio. No audio file required.
function useCrowdRoar(active) {
  const ctxRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    let ctx; let src; let filter; let gain;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const bufLen = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;     // crude brown noise
        data[i] = last * 3.5;
      }
      src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 600; filter.Q.value = 0.6;
      gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 1.5);
      gain.gain.linearRampToValueAtTime(0.4,  ctx.currentTime + 6);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 10);
      filter.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 6);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch (e) { /* WebAudio blocked; silently skip SFX */ }
    return () => {
      try { src?.stop(); ctx?.close(); } catch {}
    };
  }, [active]);
}

export default function BackstageCinema({ recording, currentUserId, onClose }) {
  const [phase, setPhase] = useState("backstage_pov");
  const [likes, setLikes] = useState(recording?.likes || 0);
  const [views, setViews] = useState(recording?.views || 0);
  const [liked, setLiked] = useState((recording?.likers || []).includes(currentUserId));
  const [showBoth, setShowBoth] = useState(!!recording?.show_on_both);
  const audioRef = useRef(null);

  const userAvatar = (() => {
    try { return { ...DEFAULT_GAMER_AVATAR, ...(JSON.parse(localStorage.getItem("pp_gamer_avatar") || "null") || {}) }; }
    catch { return DEFAULT_GAMER_AVATAR; }
  })();
  // Friendly stagehand avatar — different from user's
  const stagehand = { ...DEFAULT_GAMER_AVATAR, skin: "tan", hair: "curly", hairColor: "#1A1A1A", face: "smile", cap: "none", top: "tee", topColor: "#39FF14", instrument: "mic" };

  useCrowdRoar(phase !== "playback");

  // Phase auto-advance + view registration
  useEffect(() => {
    if (phase === "playback") {
      // Register view once we reach playback
      axios.post(`${API}/gamer/recordings/${recording.id}/view`).then((r) => {
        if (r.data?.views != null) setViews(r.data.views);
      }).catch(() => {});
      // Try to autoplay the recording audio
      if (recording.blob_url || recording.url) {
        const a = new Audio(recording.blob_url || recording.url);
        audioRef.current = a;
        a.play().catch(() => {});
      }
      return;
    }
    const dur = PHASE_DURATIONS[phase] || 1500;
    const idx = PHASES.indexOf(phase);
    const id = setTimeout(() => setPhase(PHASES[Math.min(idx + 1, PHASES.length - 1)]), dur);
    return () => clearTimeout(id);
  }, [phase, recording]);

  // Cleanup audio on unmount
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }, []);

  const skipIntro = () => setPhase("playback");

  const toggleLike = async () => {
    try {
      const r = await axios.post(`${API}/gamer/recordings/${recording.id}/like`, { user_id: currentUserId });
      if (r.data?.success) { setLikes(r.data.likes); setLiked(r.data.liked); }
    } catch { toast.error("Like failed"); }
  };

  const toggleShowBoth = async () => {
    try {
      const next = !showBoth;
      await axios.post(`${API}/gamer/recordings/${recording.id}/share-scope`, { user_id: currentUserId, show_on_both: next });
      setShowBoth(next);
      toast.success(next ? "Mirrored to your Creator profile" : "Gamer profile only");
    } catch { toast.error("Couldn't update visibility"); }
  };

  const attemptExternalShare = () => {
    toast.error("External streaming is locked. Internal share only.", { duration: 4500 });
  };

  // ───── Phase renderers ─────
  return (
    <div className="fixed inset-0 z-[75] bg-black overflow-hidden" data-testid="backstage-cinema" data-phase={phase}>
      {/* Skip / close */}
      <div className="absolute top-3 right-3 z-[80] flex gap-2">
        {phase !== "playback" && (
          <Button onClick={skipIntro} data-testid="cinema-skip-btn"
            className="h-8 px-3 rounded-full bg-white/8 border border-white/20 text-white text-[10px] font-black uppercase tracking-wider">
            <SkipForward className="w-3 h-3 mr-1" /> Skip Intro
          </Button>
        )}
        <Button onClick={onClose} data-testid="cinema-close-btn"
          className="w-8 h-8 p-0 rounded-full bg-white/8 border border-white/20 text-white">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 1. Backstage POV — dark, curtain crack */}
      {phase === "backstage_pov" && (
        <div className="absolute inset-0 flex items-center justify-center" data-testid="phase-backstage-pov">
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, #1a0500 0%, #000 70%)" }} />
          <div className="absolute inset-y-0 left-0 w-1/2"
            style={{ background: "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 12px, #2a0000 24px)" }} />
          <div className="absolute inset-y-0 right-0 w-1/2"
            style={{ background: "repeating-linear-gradient(90deg, #2a0000 0px, #6b0000 12px, #4a0000 24px)" }} />
          {/* Curtain crack revealing distant stage light */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 bg-gradient-to-b from-[#FF6B00] via-[#FFEB3B] to-[#FF6B00]"
            style={{ boxShadow: "0 0 60px #FF6B00, 0 0 120px rgba(255,107,0,0.4)" }} />
          <p className="relative z-10 text-[10px] uppercase tracking-[0.4em] font-black text-white/40">Backstage</p>
        </div>
      )}

      {/* 2. Handoff — stagehand walks through, delivers line */}
      {phase === "handoff" && (
        <div className="absolute inset-0 flex items-center justify-center" data-testid="phase-handoff">
          <div className="absolute inset-0"
            style={{ background: "repeating-linear-gradient(90deg, #2a0000 0px, #4a0000 12px, #1a0000 24px)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(255,235,59,0.18), transparent 60%)" }} />
          <div className="relative animate-[handoffWalk_2.4s_ease-out_both]">
            <GamerAvatar avatar={stagehand} size={240} glowColor="#39FF14" />
          </div>
          <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 max-w-md text-center px-6">
            <div className="inline-block px-5 py-3 rounded-2xl border border-[#39FF14]/40 backdrop-blur-md"
              style={{ background: "rgba(15,15,22,0.85)", boxShadow: "0 0 22px rgba(57,255,20,0.3)" }}>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-1">Stagehand</p>
              <p className="font-['Outfit'] text-lg sm:text-xl font-black text-white">"Your set killed it for us."</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Stage walk — curtains open, hot white light blooms toward camera */}
      {phase === "stage_walk" && (
        <div className="absolute inset-0" data-testid="phase-stage-walk">
          <div className="absolute inset-y-0 left-0 origin-left animate-[curtainOpenL_1.8s_ease-in_both]"
            style={{ width: "50%", background: "repeating-linear-gradient(90deg, #4a0000 0px, #6b0000 12px, #2a0000 24px)" }} />
          <div className="absolute inset-y-0 right-0 origin-right animate-[curtainOpenR_1.8s_ease-in_both]"
            style={{ width: "50%", background: "repeating-linear-gradient(90deg, #2a0000 0px, #6b0000 12px, #4a0000 24px)" }} />
          <div className="absolute inset-0 animate-[whitewash_1.8s_ease-in_both]"
            style={{ background: "radial-gradient(circle at center, #FFEB3B 0%, #FF6B00 30%, transparent 70%)" }} />
        </div>
      )}

      {/* 4. Crowd reveal — wide stadium silhouette */}
      {phase === "crowd_reveal" && (
        <div className="absolute inset-0 flex flex-col" data-testid="phase-crowd-reveal">
          {/* Sky / stage lights */}
          <div className="h-1/2 relative"
            style={{ background: "linear-gradient(180deg, #0a0a14 0%, #1a0a22 60%, #2a0d30 100%)" }}>
            {/* Spotlights */}
            {[20, 35, 50, 65, 80].map((x) => (
              <div key={`sl-${x}`} className="absolute top-0 w-32 h-full"
                style={{
                  left: `${x}%`, transform: "translateX(-50%)",
                  background: "linear-gradient(180deg, rgba(255,107,0,0.3), transparent 80%)",
                  filter: "blur(8px)",
                }} />
            ))}
          </div>
          {/* Crowd silhouettes */}
          <div className="h-1/2 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #2a0d30, #050208)" }}>
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 400">
              {Array.from({ length: 80 }).map((_, i) => {
                const x = (i * 53) % 1200;
                const y = 80 + ((i * 31) % 200);
                const r = 12 + (i % 5) * 3;
                return <circle key={`head-${i}`} cx={x} cy={y} r={r} fill="#000" opacity="0.85" />;
              })}
              {Array.from({ length: 80 }).map((_, i) => {
                const x = (i * 53) % 1200;
                const y = 80 + ((i * 31) % 200) + 14;
                return <rect key={`body-${i}`} x={x - 14} y={y} width="28" height="80" fill="#000" opacity="0.85" />;
              })}
              {/* Hands in the air w/ neon glow tips */}
              {Array.from({ length: 24 }).map((_, i) => {
                const x = (i * 49) % 1200;
                const y = 50 + (i % 3) * 14;
                return <circle key={`hand-${i}`} cx={x} cy={y} r="4" fill={i % 2 === 0 ? "#FF6B00" : "#39FF14"}
                  opacity="0.85" filter="url(#glow)" />;
              })}
              <defs><filter id="glow"><feGaussianBlur stdDeviation="2" /></filter></defs>
            </svg>
          </div>
          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] font-black text-[#FF6B00]"
            style={{ textShadow: "0 0 16px #FF6B00" }}>The Crowd Goes Wild</p>
        </div>
      )}

      {/* 5. Zoom to avatar */}
      {phase === "zoom_avatar" && (
        <div className="absolute inset-0 flex items-center justify-center" data-testid="phase-zoom-avatar"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,107,0,0.3), #000 70%)" }}>
          <div className="animate-[zoomIn_1.6s_ease-out_both]">
            <GamerAvatar avatar={userAvatar} size={420} glowColor="#FF6B00" />
          </div>
          <p className="absolute bottom-12 text-[10px] uppercase tracking-[0.45em] font-black text-white/80">Your Performance</p>
        </div>
      )}

      {/* 6. Playback */}
      {phase === "playback" && (
        <div className="absolute inset-0 flex flex-col" data-testid="phase-playback">
          {/* Hero header */}
          <div className="relative flex-1 flex flex-col items-center justify-center"
            style={{ background: "radial-gradient(ellipse at top, rgba(255,107,0,0.18), #05050A 70%)" }}>
            <div className="absolute top-0 left-0 right-0 h-1/3"
              style={{ background: "radial-gradient(ellipse at center top, rgba(255,235,59,0.18), transparent 70%)", filter: "blur(8px)" }} />
            <div className="relative scale-90">
              <GamerAvatar avatar={userAvatar} size={260} glowColor="#FF6B00" />
            </div>
            <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white text-center mt-4 px-4"
              style={{ textShadow: "0 0 18px rgba(255,107,0,0.55)" }} data-testid="cinema-song-title">
              {(recording.song_title || recording.title || "Untitled Set").toUpperCase()}
            </h2>
            <p className="text-xs text-[#A0A0B0] mt-1">{recording.artist || "You"}</p>
          </div>

          {/* Controls + stats footer */}
          <footer className="px-4 py-3 border-t border-white/10"
            style={{ background: "linear-gradient(180deg, rgba(10,10,16,0.6), rgba(5,5,10,0.95))", backdropFilter: "blur(10px)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1.5 px-2 h-7 rounded-full border border-white/10" data-testid="cinema-views">
                <Eye className="w-3 h-3 text-[#A0A0B0]" />
                <span className="text-[11px] font-black text-white">{views.toLocaleString()}</span>
                <span className="text-[9px] text-[#5C5C6B] uppercase tracking-wider">views</span>
              </div>
              <button onClick={toggleLike} data-testid="cinema-like-btn"
                className={`flex items-center gap-1.5 px-2 h-7 rounded-full border transition-all ${
                  liked ? "bg-[#FF4FB1]/15 border-[#FF4FB1]/50 text-[#FF4FB1]" : "border-white/10 text-white hover:border-[#FF4FB1]/40"
                }`}>
                <Heart className="w-3 h-3" fill={liked ? "currentColor" : "none"} />
                <span className="text-[11px] font-black">{likes.toLocaleString()}</span>
              </button>
              <button onClick={attemptExternalShare} data-testid="cinema-share-locked"
                className="flex items-center gap-1.5 px-2 h-7 rounded-full border border-white/10 text-[#5C5C6B]" title="External streaming is licence-locked">
                <Lock className="w-3 h-3" />
                <span className="text-[9px] uppercase tracking-wider font-bold">Internal only</span>
              </button>
            </div>
            <button onClick={toggleShowBoth} data-testid="cinema-show-both-toggle"
              className={`w-full h-9 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                showBoth
                  ? "bg-gradient-to-r from-[#FF6B00] to-[#39FF14] text-[#05050A]"
                  : "border border-white/15 text-[#A0A0B0] hover:text-white"
              }`}>
              <Share2 className="w-3 h-3" />
              {showBoth ? "Mirrored to Creator profile · tap to remove" : "Show on Both Profiles"}
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
