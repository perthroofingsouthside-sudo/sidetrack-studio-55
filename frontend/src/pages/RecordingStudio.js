import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Mic, Video, Square, ArrowLeft, Camera, SplitSquareVertical, Type, Guitar, ExternalLink, MessageCircle, Scissors, Share2, Music2, Sparkles, Users, Wand2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import LiveChat from "@/components/LiveChat";
import AvatarRing, { useAudioActivity } from "@/components/AvatarRing";
import FloatingComments from "@/components/FloatingComments";
import CalligraphyLyrics from "@/components/CalligraphyLyrics";
import SyncHUD from "@/components/SyncHUD";
import JamRoomPanel from "@/components/JamRoomPanel";
import TrimModal from "@/components/recording/TrimModal";
import RecordSearchScreen from "@/components/recording/RecordSearchScreen";
import GuitarDiagram from "@/components/recording/GuitarDiagram";

const STAGE_BG = "https://images.unsplash.com/photo-1773769234826-65edeac80f99?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHw0fHxjb25jZXJ0JTIwc3RhZ2UlMjBsaWdodGluZyUyMGRhcmt8ZW58MHx8fHwxNzc3Njk1MTcwfDA&ixlib=rb-4.1.0&q=85&w=800";

const LAYOUTS = [
  { key: "stadium", label: "Stadium", icon: Camera, desc: "Performer 1+4 band view" },
  { key: "viewer", label: "Viewer", icon: Eye, desc: "Fan arena — cinematic master feed" },
  { key: "split", label: "Split", icon: SplitSquareVertical, desc: "Camera + Lyrics" },
  { key: "lyrics", label: "Lyrics", icon: Type, desc: "Full lyrics view" },
  { key: "guitar", label: "Guitar", icon: Guitar, desc: "Full guitar tabs" },
];

const SOCIAL_LINKS = [
  { key: "tiktok", label: "TikTok Live", color: "#00F2EA", url: "https://www.tiktok.com/live", icon: "M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" },
  { key: "instagram", label: "IG Live", color: "#E1306C", url: "https://www.instagram.com/", icon: "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3Z" },
  { key: "youtube", label: "YT Live", color: "#FF0000", url: "https://studio.youtube.com/channel/UC/livestreaming", icon: "m10 15 5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73Z" },
];

export default function RecordingStudio({ song, onSongSelect, onRecordingComplete, onBack }) {
  const [mode, setMode] = useState("audio");
  const [layout, setLayout] = useState("stadium");
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [trimming, setTrimming] = useState(false);
  const [aiBgRemoval, setAiBgRemoval] = useState(false);
  const [liveCleanup, setLiveCleanup] = useState(false);
  const [liveStream, setLiveStream] = useState(null);
  const { intensity, isActive } = useAudioActivity(liveStream);
  const lane = (typeof window !== "undefined" && localStorage.getItem("pp_lane")) || "creator";
  const [collabSlots] = useState([
    { id: 1, label: "Guitar", occupied: false },
    { id: 2, label: "Bass", occupied: false },
    { id: 3, label: "Drums", occupied: false },
    { id: 4, label: "Keys", occupied: false },
  ]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (song?.id) fetchLyrics();
    return () => { stopAllStreams(); if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);

  const fetchLyrics = async () => {
    try {
      const res = await axios.get(`${API}/songs/${song.id}/lyrics`);
      if (res.data.success) setLyrics(res.data);
    } catch (err) { console.error("Recording lyrics fetch failed:", err); }
  };

  const stopAllStreams = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setLiveStream(null);
  };

  const startRecording = async () => {
    try {
      const needsVideo = mode === "video" || (layout !== "lyrics" && layout !== "guitar");
      const constraints = needsVideo
        ? { audio: true, video: { facingMode: "user", width: 1280, height: 720 } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setLiveStream(stream);
      if (needsVideo && videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      const mimeType = needsVideo ? "video/webm" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        stopAllStreams();
        onRecordingComplete({
          id: crypto.randomUUID(), songId: song?.id, songTitle: song?.title || "Unknown",
          type: needsVideo ? "video" : "audio", blob, url, duration, createdAt: new Date().toISOString(),
        });
      };
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setCurrentTime(0);
      timerRef.current = setInterval(() => {
        setDuration((p) => p + 1);
        setCurrentTime((p) => p + 1);
      }, 1000);
    } catch { toast.error("Camera/microphone access denied"); }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  }, []);

  const fmtDur = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const currentChord = useMemo(() => {
    if (!lyrics?.chords) return null;
    for (let i = lyrics.chords.length - 1; i >= 0; i--) { if (currentTime >= lyrics.chords[i].time) return lyrics.chords[i]; }
    return lyrics.chords[0] || null;
  }, [lyrics?.chords, currentTime]);

  const activeLyricIdx = useMemo(() => {
    if (!lyrics?.lyrics) return 0;
    for (let i = lyrics.lyrics.length - 1; i >= 0; i--) { if (currentTime >= lyrics.lyrics[i].time) return i; }
    return 0;
  }, [lyrics?.lyrics, currentTime]);

  const showCamera = layout === "stadium" || layout === "split";
  const showLyrics = layout === "lyrics" || layout === "split";
  const showGuitar = layout === "guitar";
  const isStadium = layout === "stadium";

  if (!song) return <RecordSearchScreen onSongSelect={onSongSelect} />;

  return (
    <div className="bg-[#05050A] flex flex-row max-w-full overflow-x-hidden stage-ambient" style={{ height: "calc(100vh - 4rem)" }} data-testid="recording-studio">
      {/* ── LEFT SIDEBAR — Pocket Products + Layout tabs + Toggles + Chat ── */}
      <aside className="w-[140px] sm:w-[160px] flex-shrink-0 crystal-glass border-r border-white/5 flex flex-col z-20 overflow-y-auto scrollbar-hide" data-testid="stage-sidebar">
        {/* Brand */}
        <div className="px-2.5 pt-2.5 pb-2 flex items-start gap-2 border-b border-white/5">
          <Button data-testid="back-btn" variant="ghost" size="icon" onClick={onBack}
            className="text-[#8F8F9D] hover:text-white w-7 h-7 flex-shrink-0 -ml-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="font-['Outfit'] text-[13px] font-black tracking-tight leading-tight">
              <span className="text-white">Pocket</span>{" "}
              <span className="text-[#FF6B00]">Products</span>
            </h2>
            <p className="text-[8px] text-[#39FF14] font-bold uppercase tracking-[0.15em] mt-0.5">Live Stage</p>
            {isRecording && (
              <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.15em] text-red-500 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />REC
              </span>
            )}
            {song && <p className="text-[9px] text-[#5C5C6B] truncate mt-1">{song.title}</p>}
            {song && <p className="text-[8px] text-[#5C5C6B]/70 truncate">{song.artist}</p>}
          </div>
        </div>

        {/* Layout Tabs — vertical stack below brand */}
        <div className="px-2 pt-2 pb-1.5 border-b border-white/5" data-testid="layout-selector">
          <p className="text-[8px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold mb-1.5 px-1">View</p>
          <div className="flex flex-col gap-1">
            {LAYOUTS.map((l) => (
              <Button key={l.key} data-testid={`layout-${l.key}`}
                onClick={() => { if (!isRecording) setLayout(l.key); }}
                className={`w-full h-8 px-2.5 rounded-lg text-[10px] gap-1.5 transition-all justify-start font-bold ${
                  layout === l.key
                    ? "bg-[#FF6B00] text-white shadow-[0_0_12px_rgba(255,107,0,0.5)]"
                    : "bg-[#0F0F16] text-[#5C5C6B] border border-white/5 hover:border-white/15 hover:text-white"
                }`}>
                <l.icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{l.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Action Toggles — Chat / AI BG / Cleanup */}
        <div className="px-2 pt-2 pb-1.5">
          <p className="text-[8px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold mb-1.5 px-1">Tools</p>
          <div className="flex flex-col gap-1">
            <Button data-testid="stage-chat-toggle" variant="ghost" onClick={() => setShowChat(!showChat)}
              className={`w-full h-7 px-2.5 rounded-lg text-[10px] gap-1.5 justify-start border transition-all font-bold ${
                showChat ? "border-[#39FF14]/40 text-[#39FF14] bg-[#39FF14]/10" : "border-white/10 text-[#5C5C6B] hover:text-white"
              }`}>
              <MessageCircle className="w-3 h-3 shrink-0" /> Chat
            </Button>
            <Button data-testid="ai-bg-toggle" variant="ghost" onClick={() => setAiBgRemoval(!aiBgRemoval)}
              className={`w-full h-7 px-2.5 rounded-lg text-[10px] gap-1.5 justify-start border transition-all font-bold ${
                aiBgRemoval ? "border-[#39FF14]/40 text-[#39FF14] bg-[#39FF14]/10" : "border-white/10 text-[#5C5C6B] hover:text-white"
              }`}>
              <Wand2 className="w-3 h-3 shrink-0" /> AI BG
            </Button>
            <Button data-testid="live-cleanup-toggle" variant="ghost" onClick={async () => {
              const next = !liveCleanup;
              setLiveCleanup(next);
              try {
                if (next) {
                  await axios.post(`${API}/studio/cleanup`, {
                    user_id: localStorage.getItem("sidetrack_voter_id") || "anon",
                    mode: "rock", live: true,
                  });
                  toast.success("Live AI Cleanup engaged");
                }
              } catch (e) { console.error("cleanup toggle err", e); }
            }}
              className={`w-full h-7 px-2.5 rounded-lg text-[10px] gap-1.5 justify-start border transition-all font-bold ${
                liveCleanup ? "border-[#FF6B00]/40 text-[#FF6B00] bg-[#FF6B00]/10" : "border-white/10 text-[#5C5C6B] hover:text-white"
              }`}>
              <Sparkles className="w-3 h-3 shrink-0" /> Cleanup
            </Button>
          </div>
        </div>

        {/* Chat panel — drops down INSIDE the sidebar, under the 3 toggles */}
        {showChat && (
          <div className="flex-shrink-0 px-1.5 pb-2" style={{ maxHeight: "28vh" }} data-testid="stage-chat-panel">
            <div className="h-full rounded-lg border border-[#39FF14]/20 overflow-hidden">
              <LiveChat trackTitle={song?.title} compact={true} />
            </div>
          </div>
        )}

        {/* Jam Room — Creator lane only (band sessions). */}
        {lane === "creator" && (
          <div className="px-1.5 pb-2">
            <JamRoomPanel song={song} />
          </div>
        )}
      </aside>

      {/* ── MAIN STAGE AREA (expanded, takes remaining space) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main content area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* ── STADIUM LAYOUT (PORTRAIT): Host top + collab strip below + L/R overlays ── */}
            {isStadium && (
              <div className="flex-1 flex flex-col gap-2 p-2 sm:p-3 min-h-0 layout-transition" data-testid="stadium-layout">
                {/* Main Performer / Host — vertical portrait, ~70% of vertical space */}
                <div className="flex-[70] relative rounded-2xl overflow-hidden neon-frame-orange neon-corners neon-corners-orange scan-line stage-glass mx-auto w-full max-w-md"
                  data-testid="host-frame"
                  style={{ aspectRatio: "9/16", maxHeight: "100%" }}>
                  <img src={STAGE_BG} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${aiBgRemoval ? "opacity-40" : "opacity-20"}`} />
                  <video ref={videoRef} autoPlay muted playsInline
                    className={`absolute inset-0 w-full h-full object-cover z-10 transition-all duration-500 ${aiBgRemoval ? "mix-blend-screen" : ""}`}
                    style={{ transform: "scaleX(-1)" }} data-testid="host-video" />

                  {/* LEFT — Floating neon green comments */}
                  <FloatingComments active={true} />
                  {/* RIGHT — Calligraphy lyrics overlay */}
                  <CalligraphyLyrics lyrics={lyrics} activeIdx={activeLyricIdx} />

                  {!streamRef.current && !isRecording && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 rounded-full bg-[#FF6B00]/5 flex items-center justify-center mb-3 border border-[#FF6B00]/15">
                        <Camera className="w-7 h-7 text-[#FF6B00]/25" />
                      </div>
                      <p className="text-sm text-[#8F8F9D] font-['Outfit'] font-semibold">Your Stage</p>
                      <p className="text-[10px] text-[#5C5C6B]/60 mt-1.5">Tap mic to start</p>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
                    <AvatarRing name="You" size="sm" isActive={isActive} intensity={intensity} icon={Mic} label="Host" />
                    <span className="badge-glass px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] text-[#FF6B00] border-[#FF6B00]/30" data-testid="first-man-badge">First Man</span>
                    {aiBgRemoval && <span className="badge-glass px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider text-[#39FF14] border-[#39FF14]/30">AI BG</span>}
                    {liveCleanup && <span className="badge-glass px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider text-[#FF6B00] border-[#FF6B00]/30" data-testid="live-cleanup-badge">Cleanup</span>}
                  </div>
                  {isRecording && (
                    <div className="absolute bottom-4 left-4 z-40 badge-glass rounded-full px-3 py-1.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                      <span className="text-xs text-[#39FF14] font-mono font-bold tracking-wider">{fmtDur(duration)}</span>
                    </div>
                  )}
                </div>

                {/* Collab Strip — horizontal scroll below host */}
                <div className="flex-[20] min-h-[88px] flex gap-2 overflow-x-auto pb-1 scrollbar-hide w-full max-w-md mx-auto" data-testid="collab-grid">
                  {collabSlots.map((slot) => (
                    <div key={slot.id}
                      className="flex-shrink-0 w-[110px] sm:w-[130px] relative rounded-xl overflow-hidden neon-frame-green stage-glass transition-all duration-300"
                      data-testid={`collab-slot-${slot.id}`}
                      style={{ aspectRatio: "3/4" }}>
                      <img src={STAGE_BG} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${aiBgRemoval ? "opacity-25" : "opacity-10"}`} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                        <AvatarRing name={slot.label} size="sm" icon={Users} isActive={false} intensity={0} />
                        <p className="text-[9px] text-[#8F8F9D] font-bold uppercase tracking-wider mt-1.5">{slot.label}</p>
                        <p className="text-[7px] text-[#5C5C6B]/40 mt-0.5 font-medium">Waiting</p>
                      </div>
                      <div className="absolute top-1.5 left-1.5 z-20">
                        <span className="badge-glass px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider text-[#39FF14]/60">{slot.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── VIEWER LAYOUT (PORTRAIT): Lead portrait top + band strip below + L/R overlays ── */}
            {layout === "viewer" && (
              <div className="flex-1 flex flex-col p-2 sm:p-3 gap-2 min-h-0 layout-transition" data-testid="viewer-layout">
                {/* Main Lead Frame — vertical portrait ~72% */}
                <div className="flex-[72] relative rounded-2xl overflow-hidden neon-frame-orange arena-glow scan-line mx-auto w-full max-w-md"
                  style={{ aspectRatio: "9/16", maxHeight: "100%", background: "radial-gradient(ellipse at 50% 100%, rgba(255,107,0,0.08) 0%, #06060C 60%)" }}
                  data-testid="arena-frame">
                  <img src={STAGE_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />

                  {/* LEFT — Floating neon green comments */}
                  <FloatingComments active={true} />
                  {/* RIGHT — Calligraphy lyrics overlay */}
                  <CalligraphyLyrics lyrics={lyrics} activeIdx={activeLyricIdx} />

                  {/* Centered lead performer avatar */}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
                    <AvatarRing name="Lead" size="lg" isActive={isActive} intensity={intensity} icon={Mic} />
                    <p className="text-[10px] text-[#FF6B00]/70 font-bold uppercase tracking-[0.2em] mt-3">Lead</p>
                  </div>

                  {/* Arena HUD */}
                  <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
                    <span className="badge-glass px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] text-[#FF6B00] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse shadow-[0_0_6px_rgba(255,107,0,0.6)]" /> Live Arena
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 z-40 badge-glass rounded-full px-3 py-1 flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-[#FF6B00]" />
                    <span className="text-[10px] text-white font-bold">0</span>
                  </div>
                </div>

                {/* Band Strip — horizontal scroll below */}
                <div className="flex-[18] min-h-[80px] flex gap-2 overflow-x-auto pb-1 scrollbar-hide w-full max-w-md mx-auto" data-testid="viewer-band-strip">
                  {["Guitar", "Bass", "Drums", "Keys"].map((role) => (
                    <div key={role} className="flex-shrink-0 w-[100px] relative rounded-lg overflow-hidden neon-frame-green stage-glass"
                      style={{ aspectRatio: "3/4" }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#39FF14]/6 via-transparent to-transparent" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <AvatarRing name={role} size="sm" icon={Users} isActive={false} intensity={0} />
                        <p className="text-[8px] text-[#39FF14]/50 font-bold uppercase tracking-wider mt-1">{role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SPLIT LAYOUT: Camera + Lyrics ── */}
            {layout === "split" && (
              <div className="flex-1 flex flex-col p-3 gap-2">
                <div className="relative h-[45%] bg-[#0A0A0F] flex-shrink-0 overflow-hidden rounded-xl neon-ambient-glow border border-[#FF6B00]/20" data-testid="camera-section">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} data-testid="video-preview" />
                  {!streamRef.current && !isRecording && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <img src={STAGE_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                      <div className="relative z-10 text-center">
                        <Camera className="w-12 h-12 text-[#FF6B00]/40 mb-2 mx-auto" />
                        <p className="text-xs text-[#5C5C6B]">Camera activates when recording</p>
                      </div>
                    </div>
                  )}
                  {isRecording && (
                    <div className="absolute bottom-3 left-3 crystal-glass rounded-full px-3 py-1">
                      <span className="text-[10px] text-[#39FF14] font-mono font-bold">{fmtDur(duration)}</span>
                    </div>
                  )}
                </div>
                {/* Lyrics pane */}
                <div className="h-[55%] bg-[#05050A] border border-white/5 rounded-xl overflow-hidden flex-shrink-0" data-testid="lyrics-section">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-2">
                      {currentChord && (
                        <div className="text-center mb-3 pb-3 border-b border-white/5">
                          <span className="text-3xl font-['Outfit'] font-black text-[#FF6B00] glow-text-orange tracking-tighter">{currentChord.chord}</span>
                        </div>
                      )}
                      {lyrics?.lyrics ? lyrics.lyrics.map((line, i) => {
                        const lk = `${line.time}-${line.type}-${i}`;
                        if (line.type === "section") return <p key={lk} className={`text-xs uppercase tracking-[0.15em] font-bold mt-3 ${i === activeLyricIdx ? "text-[#39FF14]" : "text-[#5C5C6B]"}`}>{line.text}</p>;
                        if (line.type === "break") return <div key={lk} className="h-2" />;
                        return <p key={lk} className={`text-base leading-relaxed transition-all duration-300 ${i === activeLyricIdx ? "text-[#39FF14] font-semibold scale-[1.02]" : i < activeLyricIdx ? "text-[#5C5C6B]/50" : "text-[#8F8F9D]"}`}>{line.text}</p>;
                      }) : <p className="text-[#5C5C6B] text-sm text-center py-8">Lyrics sync during recording</p>}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* ── LYRICS ONLY ── */}
            {layout === "lyrics" && (
              <div className="flex-1 bg-[#05050A] overflow-hidden p-3" data-testid="lyrics-section">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {lyrics?.lyrics ? lyrics.lyrics.map((line, i) => {
                      const lk = `${line.time}-${line.type}-${i}`;
                      if (line.type === "section") return <p key={lk} className={`text-xs uppercase tracking-[0.15em] font-bold mt-3 ${i === activeLyricIdx ? "text-[#39FF14]" : "text-[#5C5C6B]"}`}>{line.text}</p>;
                      if (line.type === "break") return <div key={lk} className="h-2" />;
                      return <p key={lk} className={`text-base leading-relaxed transition-all duration-300 ${i === activeLyricIdx ? "text-[#39FF14] font-semibold scale-[1.02]" : i < activeLyricIdx ? "text-[#5C5C6B]/50" : "text-[#8F8F9D]"}`}>{line.text}</p>;
                    }) : <p className="text-[#5C5C6B] text-sm text-center py-8">Lyrics sync during recording</p>}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* ── GUITAR ONLY ── */}
            {showGuitar && (
              <div className="flex-1 bg-[#0A0A0F] flex flex-col items-center justify-center p-4 rounded-xl m-3 border border-white/5" data-testid="guitar-full">
                {currentChord ? (
                  <div className="text-center animate-fade-in">
                    <div className="text-6xl sm:text-8xl font-['Outfit'] font-black text-[#FF6B00] glow-text-orange tracking-tighter">{currentChord.chord}</div>
                    <GuitarDiagram chord={currentChord.chord} />
                    {lyrics?.chords && (
                      <div className="flex gap-3 mt-6 justify-center flex-wrap">
                        {lyrics.chords.filter(c => c.time > currentTime).slice(0, 6).map((c) => (
                          <span key={`${c.time}-${c.chord}`} className="text-lg font-['Outfit'] font-bold px-3 py-1 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]/50">{c.chord}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : <p className="text-[#5C5C6B] text-sm">Guitar chords will appear here</p>}
              </div>
            )}
          </div>

          {/* Floating controls - crystal glass pill */}
          <div className="px-3 py-2 flex flex-col gap-2 flex-shrink-0">
            {/* Social links */}
            <div className="flex items-center justify-center gap-2" data-testid="social-links">
              {SOCIAL_LINKS.map((s) => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
                  data-testid={`social-${s.key}`}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-white/5 hover:border-white/20 transition-all"
                  style={{ color: s.color }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                  {s.label}
                  <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                </a>
              ))}
            </div>

            {/* Controls row - crystal glass pill */}
            <div className="crystal-glass rounded-full px-6 py-3 flex items-center justify-center gap-5 mx-auto" data-testid="stage-controls">
              <Button data-testid="toggle-mode-btn" variant="ghost" onClick={() => { if (!isRecording) setMode(mode === "audio" ? "video" : "audio"); }}
                className={`h-9 px-3 rounded-full text-xs gap-1 ${mode === "video" ? "text-[#39FF14]" : "text-[#8F8F9D]"}`}>
                <Video className="w-3.5 h-3.5" />{mode === "video" ? "Video" : "Audio"}
              </Button>

              <Button data-testid="record-start-stop-btn" onClick={isRecording ? stopRecording : startRecording}
                className={`w-14 h-14 rounded-full transition-all ${
                  isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]" : "bg-[#FF6B00] hover:bg-[#FF8533] shadow-[0_0_30px_rgba(255,107,0,0.5)]"
                }`}>
                {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </Button>

              <span className="text-sm font-mono text-[#5C5C6B] w-14 text-center" data-testid="duration-display">{fmtDur(duration)}</span>
            </div>

            {/* Global Sync HUD — Master Clock for group jams */}
            <div className="px-1">
              <SyncHUD
                roomId={`stage-${song?.id || "default"}`}
                userId={localStorage.getItem("sidetrack_voter_id") || "anon"}
                isHost={true}
                defaultBpm={120}
              />
            </div>

            {/* Trim & Share button — only when not recording */}
            {!isRecording && duration > 0 && (
              <div className="flex justify-center mt-2">
                <Button
                  data-testid="trim-share-btn"
                  onClick={() => setShowTrimModal(true)}
                  className="h-8 px-4 rounded-full text-[10px] font-bold uppercase tracking-wider gap-1.5 border border-[#FF6B00]/30 bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00]/20 transition-all"
                >
                  <Scissors className="w-3 h-3" /> Trim & Share
                </Button>
              </div>
            )}
          </div>
        </div>

      {/* ── Trim & Share Modal ──────────────────── */}
      {showTrimModal && (
        <TrimModal
          duration={duration}
          trimStart={trimStart}
          trimEnd={trimEnd}
          setTrimStart={setTrimStart}
          setTrimEnd={setTrimEnd}
          trimming={trimming}
          onTrim={async () => {
            setTrimming(true);
            try {
              const res = await axios.post(`${API}/trim`, {
                recording_id: song?.id || "unknown",
                start_pct: trimStart,
                end_pct: trimEnd,
              });
              if (res.data.success) {
                toast.success("Trim saved! " + res.data.message);
                setShowTrimModal(false);
              }
            } catch (err) {
              toast.error(err.response?.data?.detail || "Trim failed");
            } finally {
              setTrimming(false);
            }
          }}
          onClose={() => setShowTrimModal(false)}
          fmtDur={fmtDur}
        />
      )}
    </div>
  );
}

