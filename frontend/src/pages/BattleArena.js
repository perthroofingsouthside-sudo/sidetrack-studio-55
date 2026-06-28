import { useState, useEffect, useRef, useCallback } from "react";
import { Swords, Trophy, Play, Pause, ThumbsUp, Plus, Mic, Square, ArrowLeft, Users, Flame, Star, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import BattleStageBackdrop, { SKIN_KEYS, SKIN_LABELS } from "@/components/BattleStageBackdrop";
import GamerStage from "@/pages/GamerStage";

export default function BattleArena({ currentSong, pendingBattleSong, onPendingBattleConsumed, onStartDuet }) {
  const [view, setView] = useState("list"); // list | detail | submit | leaderboard
  const [battles, setBattles] = useState([]);
  const [selectedBattle, setSelectedBattle] = useState(null);
  const [covers, setCovers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playingCoverId, setPlayingCoverId] = useState(null);
  const [voterId] = useState(() => {
    let id = localStorage.getItem("sidetrack_voter_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); }
    return id;
  });
  const [stageSkin, setStageSkin] = useState(() => localStorage.getItem("pp_stage_skin") || "theater");
  const [skinPickerOpen, setSkinPickerOpen] = useState(false);
  const changeSkin = (k) => {
    setStageSkin(k);
    localStorage.setItem("pp_stage_skin", k);
    setSkinPickerOpen(false);
    toast.success(`Stage skin: ${SKIN_LABELS[k]?.label || k}`);
  };

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadBattles();
    loadLeaderboard();
  }, []);

  const loadBattles = async () => {
    try {
      const res = await axios.get(`${API}/battles?status=active&limit=20`);
      if (res.data.success) setBattles(res.data.battles);
    } catch (err) { console.error("[Battle] load battles failed:", err); }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await axios.get(`${API}/battles/leaderboard/top?limit=10`);
      if (res.data.success) setLeaderboard(res.data.leaderboard);
    } catch (err) { console.error("[Battle] load leaderboard failed:", err); }
  };

  const openBattle = async (battle) => {
    setSelectedBattle(battle);
    // Per user spec: clicking a battle goes STRAIGHT to the active Stage.
    setView("stage");
    try {
      const res = await axios.get(`${API}/battles/${battle.id}`);
      if (res.data.success) {
        setSelectedBattle(res.data.battle);
        setCovers(res.data.covers);
      }
    } catch (err) { toast.error("Failed to load battle"); }
  };

  // Original detail/voting view is still reachable via "Vote" CTA
  const openBattleDetail = (battle) => {
    setSelectedBattle(battle);
    setView("detail");
  };

  const createBattle = async (override) => {
    const songToUse = override || currentSong;
    if (!songToUse) {
      toast.info("Select a song from Stream or Discover first!");
      return;
    }
    try {
      const res = await axios.post(`${API}/battles`, {
        song_title: songToUse.title,
        song_artist: songToUse.artist,
        song_cover_url: songToUse.cover_url || "",
        challenge_text: `Cover "${songToUse.title}" by ${songToUse.artist}!`,
      });
      if (res.data.success) {
        toast.success("Battle created!");
        loadBattles();
        openBattle(res.data.battle);
      }
    } catch (err) { toast.error("Failed to create battle"); }
  };

  // Auto-create + enter Stage when arriving from Tracks tab with a pending song
  useEffect(() => {
    if (pendingBattleSong) {
      createBattle(pendingBattleSong);
      if (onPendingBattleConsumed) onPendingBattleConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBattleSong]);

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setRecordedBlob(null);
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } catch (err) { toast.error("Microphone access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const submitCover = async () => {
    if (!recordedBlob || !username.trim()) {
      toast.error("Record your cover and enter a username first!");
      return;
    }
    localStorage.setItem("sidetrack_username", username);
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("title", `${username}'s Cover`);
      formData.append("file", recordedBlob, "cover.webm");
      const res = await axios.post(`${API}/battles/${selectedBattle.id}/submit`, formData);
      if (res.data.success) {
        toast.success("Cover submitted!");
        setRecordedBlob(null);
        setView("detail");
        openBattle(selectedBattle);
      }
    } catch (err) { toast.error("Submission failed"); }
  };

  const voteCover = async (coverId) => {
    try {
      const formData = new FormData();
      formData.append("voter_id", voterId);
      const res = await axios.post(`${API}/battles/${selectedBattle.id}/vote/${coverId}`, formData);
      if (res.data.success) {
        setCovers((prev) => prev.map((c) => c.id === coverId ? { ...c, votes: res.data.cover.votes } : c));
        toast.success("Voted!");
      }
    } catch (err) {
      if (err.response?.status === 400) toast.info("Already voted!");
      else toast.error("Vote failed");
    }
  };

  const playCoverAudio = async (cover) => {
    if (playingCoverId === cover.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingCoverId(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/battles/${selectedBattle.id}/cover/${cover.id}/audio`);
      if (res.data.success && res.data.audio_data) {
        const byteString = atob(res.data.audio_data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(url);
        audio.play();
        audioRef.current = audio;
        setPlayingCoverId(cover.id);
        audio.onended = () => setPlayingCoverId(null);
      }
    } catch (err) { toast.error("Playback failed"); }
  };

  const fmtDur = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // --- VIEWS ---
  if (view === "stage" && selectedBattle) {
    return <GamerStage battle={selectedBattle} onExit={() => setView("list")} />;
  }

  if (view === "submit" && selectedBattle) {
    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="battle-submit">
        <div className="glass-heavy px-4 py-3 flex items-center gap-3">
          <Button data-testid="submit-back-btn" variant="ghost" size="icon" onClick={() => setView("detail")} className="text-[#A0A0B0]"><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="font-['Outfit'] text-lg font-bold">Record Your Cover</h2>
            <p className="text-xs text-[#A0A0B0]">{selectedBattle.song_title} - {selectedBattle.song_artist}</p>
          </div>
        </div>
        <div className="px-4 py-6 flex flex-col items-center gap-6">
          <Input data-testid="username-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username..." className="max-w-sm h-11 bg-[#12121A] border-white/10 text-white rounded-2xl text-center" />
          <div className="relative">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center border transition-all ${isRecording ? "bg-red-500/20 border-red-500/50 animate-rec-pulse" : "bg-[#12121A] border-white/10"}`}>
              <Mic className={`w-12 h-12 ${isRecording ? "text-red-400" : "text-[#FF6B00]"}`} />
            </div>
            {isRecording && <div className="absolute inset-0 w-32 h-32 rounded-full border border-red-500/30 animate-pulse-ring" />}
          </div>
          <span className="text-2xl font-mono font-bold" data-testid="rec-duration">{fmtDur(duration)}</span>
          {isRecording && <div className="flex items-center gap-[2px] h-8">{Array.from({ length: 25 }).map((_, i) => (<div key={`wave-${i}`} className="w-[3px] bg-red-500 rounded-full" style={{ animation: "waveform 0.6s ease-in-out infinite", animationDelay: `${i * 0.04}s`, height: "4px" }} />))}</div>}
          <Button data-testid="rec-toggle-btn" onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-[#FF6B00] hover:bg-[#FF8533] glow-orange"}`}>
            {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
          </Button>
          {recordedBlob && (
            <Button data-testid="submit-cover-btn" onClick={submitCover} className="w-full max-w-sm h-12 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-bold rounded-2xl glow-cyan">
              <Swords className="w-5 h-5 mr-2" /> Submit Cover
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedBattle) {
    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="battle-detail">
        <div className="glass-heavy px-4 py-3 flex items-center gap-3">
          <Button data-testid="detail-back-btn" variant="ghost" size="icon" onClick={() => { setView("list"); setCovers([]); }} className="text-[#A0A0B0]"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold truncate">{selectedBattle.song_title}</h2>
            <p className="text-xs text-[#A0A0B0] truncate">{selectedBattle.song_artist}</p>
          </div>
          <Button data-testid="enter-battle-btn" onClick={() => setView("submit")} className="h-9 px-4 bg-[#FF6B00] hover:bg-[#FF8533] rounded-2xl text-sm font-bold gap-1.5">
            <Mic className="w-3.5 h-3.5" /> Enter
          </Button>
        </div>
        {/* Battle header */}
        <div className="px-4 py-4">
          <div className="surface-card p-4 flex items-center gap-4">
            {selectedBattle.song_cover_url && (
              <img src={selectedBattle.song_cover_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
            )}
            <div>
              <p className="text-sm text-[#A0A0B0]">{selectedBattle.challenge_text || "Record your best cover!"}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-[#FF6B00] flex items-center gap-1"><Users className="w-3 h-3" />{selectedBattle.cover_count || 0} covers</span>
                <span className="text-xs text-[#606070]">{selectedBattle.status}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Covers list */}
        <div className="px-4">
          <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FF6B00]" /> Covers
          </h3>
          {covers.length === 0 && (
            <div className="surface-card p-8 text-center">
              <Swords className="w-10 h-10 text-[#FF6B00]/30 mx-auto mb-3" />
              <p className="text-sm text-[#606070]">No covers yet. Be the first!</p>
            </div>
          )}
          <div className="space-y-2 pb-24">
            {covers.map((cover, idx) => (
              <div key={cover.id} className={`surface-card p-3 flex items-center gap-3 ${idx === 0 && cover.votes > 0 ? "border-[#FF6B00]/30" : ""}`} data-testid={`cover-${idx}`}>
                <div className="w-8 text-center flex-shrink-0">
                  {idx === 0 && cover.votes > 0 ? <Trophy className="w-5 h-5 text-[#FF6B00] mx-auto" /> : <span className="text-sm text-[#606070] font-bold">{idx + 1}</span>}
                </div>
                <Button data-testid={`play-cover-${idx}`} variant="ghost" size="icon" onClick={() => playCoverAudio(cover)} className="flex-shrink-0 text-[#FF6B00]">
                  {playingCoverId === cover.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="#FF6B00" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{cover.title}</p>
                  <p className="text-xs text-[#606070]">by {cover.username}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-bold text-[#39FF14]">{cover.votes}</span>
                  <Button data-testid={`vote-cover-${idx}`} onClick={() => voteCover(cover.id)} variant="ghost" size="icon" className="text-[#A0A0B0] hover:text-[#39FF14] hover:bg-[#39FF14]/10 rounded-full">
                    <ThumbsUp className="w-4 h-4" />
                  </Button>
                  <Button data-testid={`duet-cover-${idx}`} onClick={() => onStartDuet && onStartDuet(selectedBattle, cover)} variant="ghost" size="icon" className="text-[#A0A0B0] hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded-full" title="Duet with this cover">
                    <Users className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List + Leaderboard view — the THEATRICAL Battle Stage
  const allSceneryCovers = [...battles, ...leaderboard];
  // Unique artist list for the scrolling marquee strip
  const marqueeArtists = (() => {
    const seen = new Set();
    const out = [];
    [...battles, ...leaderboard].forEach((b) => {
      const a = (b?.song_artist || b?.artist || "").trim();
      if (a && !seen.has(a.toLowerCase())) { seen.add(a.toLowerCase()); out.push(a); }
    });
    return out.length ? out : ["Pocket Products", "Live Tonight", "Take The Mic", "Karaoke Stars"];
  })();
  return (
    <div className="min-h-screen relative bg-[#05050A] overflow-x-hidden" data-testid="battle-arena">
      {/* Theater backdrop: curtains, spotlights, scattered album-cover scenery */}
      <BattleStageBackdrop covers={allSceneryCovers} skin={stageSkin} />

      {/* Stage skin picker — floating top-left */}
      <button
        onClick={() => setSkinPickerOpen((v) => !v)}
        data-testid="stage-skin-toggle"
        className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 h-8 rounded-full border border-white/15 backdrop-blur-md text-[10px] uppercase tracking-wider font-black text-white"
        style={{ background: "rgba(10,10,15,0.7)", boxShadow: "0 0 12px rgba(255,255,255,0.08)" }}
      >
        <Palette className="w-3 h-3 text-[#39FF14]" />
        {SKIN_LABELS[stageSkin]?.label || "Stage"}
      </button>
      {skinPickerOpen && (
        <div
          data-testid="stage-skin-picker"
          className="absolute top-12 left-3 z-30 rounded-2xl border border-white/15 backdrop-blur-md p-1.5 space-y-1"
          style={{ background: "rgba(10,10,15,0.92)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
        >
          {SKIN_KEYS.map((k) => (
            <button
              key={k}
              data-testid={`stage-skin-${k}`}
              onClick={() => changeSkin(k)}
              className={`w-full flex items-center gap-2 px-3 h-8 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                stageSkin === k ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40" : "text-[#A0A0B0] hover:text-white hover:bg-white/5"
              }`}
            >
              {SKIN_LABELS[k]?.label || k}
              {stageSkin === k && <span className="ml-auto text-[#39FF14]">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Foreground content */}
      <div className="relative z-10">
        {/* Marquee header */}
        <div className="px-4 pt-8 pb-3 flex flex-col items-center text-center" data-testid="battle-stage-header">
          {/* "ON STAGE TONIGHT" mini-marquee */}
          <div className="flex items-center gap-1.5 px-3 h-7 rounded-full border border-[#39FF14]/40 mb-3"
               style={{ background: "rgba(57,255,20,0.06)", boxShadow: "0 0 18px rgba(57,255,20,0.18)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">On Stage Tonight</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
          </div>
          {/* Big marquee title */}
          <h1 className="font-['Outfit'] font-black uppercase leading-none tracking-tight"
              style={{ textShadow: "0 0 22px rgba(255,107,0,0.55), 0 0 48px rgba(255,107,0,0.25)" }}>
            <span className="block text-4xl sm:text-5xl text-white">Battle</span>
            <span className="block text-5xl sm:text-6xl text-[#FF6B00]">Stage</span>
          </h1>
          {/* Twinkling stars around title */}
          <div className="flex items-center gap-2 mt-2 mb-3">
            <Star className="w-3 h-3 text-[#39FF14] fill-[#39FF14] animate-pulse" />
            <p className="text-[11px] text-[#A0A0B0] font-bold tracking-wider uppercase">Record · Compete · Win The Spotlight</p>
            <Star className="w-3 h-3 text-[#39FF14] fill-[#39FF14] animate-pulse" />
          </div>
          {/* New Battle CTA */}
          <Button data-testid="create-battle-btn" onClick={createBattle}
            className="h-11 px-6 rounded-full text-sm font-black uppercase tracking-wider gap-2 bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white hover:scale-105 transition-transform"
            style={{ boxShadow: "0 0 24px rgba(255,107,0,0.55), 0 8px 20px rgba(0,0,0,0.4)" }}>
            <Plus className="w-4 h-4" /> Take The Stage
          </Button>
        </div>

        {/* Scrolling artist marquee */}
        <div className="relative mx-3 my-3 h-8 overflow-hidden rounded-full border border-white/8" data-testid="artist-marquee"
             style={{ background: "rgba(10,10,15,0.55)", backdropFilter: "blur(6px)" }}>
          <div className="absolute inset-y-0 left-0 w-12 z-10 pointer-events-none"
               style={{ background: "linear-gradient(90deg, rgba(5,5,10,0.95), transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-12 z-10 pointer-events-none"
               style={{ background: "linear-gradient(270deg, rgba(5,5,10,0.95), transparent)" }} />
          <div className="flex items-center gap-6 h-full whitespace-nowrap will-change-transform"
               style={{ animation: "marqueeScroll 28s linear infinite" }}>
            {/* Duplicate so the loop is seamless */}
            {[...marqueeArtists, ...marqueeArtists].map((a, i) => (
              <span key={`mq-${i}`} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em]">
                <Star className="w-2.5 h-2.5 text-[#FF6B00] fill-[#FF6B00]" />
                <span className="text-white">{a}</span>
                <span className="text-[#39FF14]">·</span>
              </span>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="px-4 space-y-6 pb-28">
            {/* Hall of Fame */}
            {leaderboard.length > 0 && (
              <section data-testid="leaderboard-section">
                <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.3em] font-black text-[#39FF14] mb-3 flex items-center gap-2 justify-center">
                  <Trophy className="w-4 h-4" /> Hall of Fame
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {leaderboard.slice(0, 5).map((cover, idx) => (
                    <div key={cover.id} data-testid={`leaderboard-${idx}`}
                      className="flex-shrink-0 w-44 rounded-2xl p-3 relative border"
                      style={{
                        background: "rgba(15,15,22,0.85)",
                        borderColor: idx === 0 ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)",
                        boxShadow: idx === 0 ? "0 0 24px rgba(255,107,0,0.35)" : "0 4px 14px rgba(0,0,0,0.4)",
                      }}>
                      {idx === 0 && (
                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B00] to-[#FF8533] flex items-center justify-center"
                             style={{ boxShadow: "0 0 14px rgba(255,107,0,0.7)" }}>
                          <Trophy className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      {cover.song_cover_url && <img src={cover.song_cover_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2" />}
                      <p className="text-xs font-bold text-white truncate">{cover.title}</p>
                      <p className="text-[10px] text-[#A0A0B0] truncate">{cover.song_title}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <ThumbsUp className="w-3 h-3 text-[#39FF14]" />
                        <span className="text-xs font-black text-[#39FF14]">{cover.votes}</span>
                        <span className="text-[9px] text-[#5C5C6B] ml-auto uppercase tracking-wider font-bold">#{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tonight's Battles */}
            <section data-testid="active-battles">
              <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.3em] font-black text-[#FF6B00] mb-3 flex items-center gap-2 justify-center">
                <Flame className="w-4 h-4" /> Tonight's Battles
              </h3>
              {battles.length === 0 && (
                <div className="rounded-2xl p-8 text-center border border-[#FF6B00]/20"
                     style={{ background: "rgba(255,107,0,0.04)" }}
                     data-testid="empty-battles">
                  <Swords className="w-14 h-14 text-[#FF6B00]/30 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-white font-bold mb-1">The stage is empty…</p>
                  <p className="text-xs text-[#A0A0B0] mb-3">Be the first to grab the mic tonight!</p>
                  <p className="text-[10px] text-[#FF6B00] uppercase tracking-wider font-black">Pick a song & tap "Take The Stage"</p>
                </div>
              )}
              <div className="space-y-2.5">
                {battles.map((battle) => (
                  <div key={battle.id}
                    onClick={() => openBattle(battle)}
                    className="rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer transition-all border group hover:scale-[1.01]"
                    style={{
                      background: "rgba(15,15,22,0.85)",
                      borderColor: "rgba(255,107,0,0.18)",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
                    }}
                    data-testid={`battle-card-${battle.id}`}>
                    {battle.song_cover_url ? (
                      <div className="relative flex-shrink-0">
                        <img src={battle.song_cover_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF6B00] flex items-center justify-center"
                             style={{ boxShadow: "0 0 10px rgba(255,107,0,0.6)" }}>
                          <Swords className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FF6B00]/20 to-[#39FF14]/15 flex items-center justify-center flex-shrink-0">
                        <Swords className="w-6 h-6 text-[#FF6B00]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate group-hover:text-[#FF6B00] transition-colors">{battle.song_title}</p>
                      <p className="text-[11px] text-[#A0A0B0] truncate">{battle.song_artist}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-[#FF6B00] flex items-center gap-1 font-bold uppercase tracking-wider">
                          <Users className="w-3 h-3" />{battle.cover_count || 0} on stage
                        </span>
                        <span className="text-[10px] text-[#39FF14] flex items-center gap-1 font-bold uppercase tracking-wider">
                          <Flame className="w-3 h-3" />Live
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <span className="text-[8px] uppercase tracking-wider text-[#FF6B00] font-black">Enter</span>
                      <Swords className="w-5 h-5 text-[#FF6B00] group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
