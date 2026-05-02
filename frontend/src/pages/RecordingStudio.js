import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Mic, Video, Square, ArrowLeft, Camera, SplitSquareVertical, Type, Guitar, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import LiveChat from "@/components/LiveChat";

const STAGE_BG = "https://images.unsplash.com/photo-1773769234826-65edeac80f99?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHw0fHxjb25jZXJ0JTIwc3RhZ2UlMjBsaWdodGluZyUyMGRhcmt8ZW58MHx8fHwxNzc3Njk1MTcwfDA&ixlib=rb-4.1.0&q=85&w=800";

const LAYOUTS = [
  { key: "camera", label: "Camera", icon: Camera, desc: "Full selfie view" },
  { key: "split", label: "Split", icon: SplitSquareVertical, desc: "Camera + Lyrics" },
  { key: "lyrics", label: "Lyrics", icon: Type, desc: "Full lyrics view" },
  { key: "guitar", label: "Guitar", icon: Guitar, desc: "Full guitar tabs" },
];

const SOCIAL_LINKS = [
  { key: "tiktok", label: "TikTok Live", color: "#00F2EA", url: "https://www.tiktok.com/live", icon: "M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" },
  { key: "instagram", label: "IG Live", color: "#E1306C", url: "https://www.instagram.com/", icon: "M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3Z" },
  { key: "youtube", label: "YT Live", color: "#FF0000", url: "https://studio.youtube.com/channel/UC/livestreaming", icon: "m10 15 5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73Z" },
];

export default function RecordingStudio({ song, onRecordingComplete, onBack }) {
  const [mode, setMode] = useState("audio");
  const [layout, setLayout] = useState("split");
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (song?.id) fetchLyrics();
    return () => { stopAllStreams(); if (timerRef.current) clearInterval(timerRef.current); };
  }, [song?.id]);

  const fetchLyrics = async () => {
    try {
      const res = await axios.get(`${API}/songs/${song.id}/lyrics`);
      if (res.data.success) setLyrics(res.data);
    } catch { /* mock data will be used */ }
  };

  const stopAllStreams = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  const startRecording = async () => {
    try {
      const needsVideo = mode === "video" || (layout !== "lyrics" && layout !== "guitar");
      const constraints = needsVideo
        ? { audio: true, video: { facingMode: "user", width: 1280, height: 720 } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
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

  const showCamera = layout === "camera" || layout === "split";
  const showLyrics = layout === "lyrics" || layout === "split";
  const showGuitar = layout === "guitar";

  return (
    <div className="bg-[#05050A] flex flex-col max-w-full overflow-x-hidden stage-ambient" style={{ height: "calc(100vh - 4rem)" }} data-testid="recording-studio">
      {/* Header bar */}
      <div className="crystal-glass px-3 py-2 flex items-center gap-2 flex-shrink-0 z-20">
        <Button data-testid="back-btn" variant="ghost" size="icon" onClick={onBack} className="text-[#8F8F9D] hover:text-white w-8 h-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-['Outfit'] text-base font-black tracking-tight text-white flex items-center gap-2">
            Live Stage
            {isRecording && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-red-500"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />REC</span>}
          </h2>
          {song && <p className="text-[10px] text-[#5C5C6B] truncate">{song.title} &mdash; {song.artist}</p>}
        </div>
        <Button data-testid="stage-chat-toggle" variant="ghost" onClick={() => setShowChat(!showChat)}
          className={`h-8 px-2.5 rounded-full text-xs gap-1 border ${showChat ? "border-[#39FF14]/40 text-[#39FF14]" : "border-white/10 text-[#5C5C6B]"}`}>
          <MessageCircle className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Main stage area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Stage content */}
        <div className={`flex-1 flex flex-col min-w-0 ${showChat ? "lg:mr-0" : ""}`}>
          {/* Layout Selector */}
          <div className="px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide" data-testid="layout-selector">
            {LAYOUTS.map((l) => (
              <Button key={l.key} data-testid={`layout-${l.key}`}
                onClick={() => { if (!isRecording) setLayout(l.key); }}
                className={`flex-shrink-0 h-8 px-3 rounded-full text-[10px] gap-1 transition-all ${
                  layout === l.key ? "bg-[#FF6B00] text-white shadow-[0_0_16px_rgba(138,43,226,0.5)]" : "bg-[#0F0F16] text-[#5C5C6B] border border-white/5 hover:border-white/15"
                }`}>
                <l.icon className="w-3 h-3" />{l.label}
              </Button>
            ))}
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Camera / Video */}
            {showCamera && (
              <div className={`relative ${layout === "camera" ? "flex-1" : "h-[45%]"} bg-[#0A0A0F] flex-shrink-0 overflow-hidden rounded-xl mx-3 mt-1 neon-ambient-glow border border-white/5`} data-testid="camera-section">
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
                {/* Overlay info */}
                {isRecording && (
                  <div className="absolute bottom-3 left-3 crystal-glass rounded-full px-3 py-1">
                    <span className="text-[10px] text-[#39FF14] font-mono font-bold">{fmtDur(duration)}</span>
                  </div>
                )}
              </div>
            )}

            {showGuitar && (
              <div className="flex-1 bg-[#0A0A0F] flex flex-col items-center justify-center p-4 rounded-xl mx-3 mt-1 border border-white/5" data-testid="guitar-full">
                {currentChord ? (
                  <div className="text-center animate-fade-in">
                    <div className="text-6xl sm:text-8xl font-['Outfit'] font-black text-[#FF6B00] glow-text-orange landscape-chords tracking-tighter">
                      {currentChord.chord}
                    </div>
                    <GuitarDiagram chord={currentChord.chord} />
                    {lyrics?.chords && (
                      <div className="flex gap-3 mt-6 justify-center flex-wrap">
                        {lyrics.chords.filter(c => c.time > currentTime).slice(0, 6).map((c, i) => (
                          <span key={i} className="text-lg font-['Outfit'] font-bold px-3 py-1 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]/50">{c.chord}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[#5C5C6B] text-sm">Guitar chords will appear here</p>
                )}
              </div>
            )}

            {/* Lyrics */}
            {(showLyrics || layout === "split") && (
              <div className={`${layout === "lyrics" ? "flex-1" : "h-[55%]"} bg-[#05050A] border-t border-white/5 overflow-hidden flex-shrink-0`} data-testid="lyrics-section">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {layout === "split" && currentChord && (
                      <div className="text-center mb-3 pb-3 border-b border-white/5">
                        <span className="text-3xl font-['Outfit'] font-black text-[#FF6B00] glow-text-orange tracking-tighter">{currentChord.chord}</span>
                      </div>
                    )}
                    {lyrics?.lyrics ? lyrics.lyrics.map((line, i) => {
                      if (line.type === "section") return (
                        <p key={i} className={`text-xs uppercase tracking-[0.15em] font-bold mt-3 ${i === activeLyricIdx ? "text-[#39FF14]" : "text-[#5C5C6B]"}`}>{line.text}</p>
                      );
                      if (line.type === "break") return <div key={i} className="h-2" />;
                      return (
                        <p key={i} className={`text-base leading-relaxed transition-all duration-300 landscape-lyrics ${
                          i === activeLyricIdx ? "text-[#39FF14] font-semibold scale-[1.02]" : i < activeLyricIdx ? "text-[#5C5C6B]/50" : "text-[#8F8F9D]"
                        }`}>{line.text}</p>
                      );
                    }) : (
                      <p className="text-[#5C5C6B] text-sm text-center py-8">Lyrics will sync here during recording</p>
                    )}
                  </div>
                </ScrollArea>
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
                  isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]" : "bg-[#FF6B00] hover:bg-[#FF8533] shadow-[0_0_30px_rgba(138,43,226,0.5)]"
                }`}>
                {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </Button>

              <span className="text-sm font-mono text-[#5C5C6B] w-14 text-center" data-testid="duration-display">{fmtDur(duration)}</span>
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-[280px] lg:w-[300px] flex-shrink-0 p-2 hidden sm:block" data-testid="stage-chat-panel">
            <LiveChat trackTitle={song?.title} />
          </div>
        )}
      </div>
    </div>
  );
}

function GuitarDiagram({ chord }) {
  const shapes = {
    Am: [[-1,0,2,2,1,0]], C: [[-1,3,2,0,1,0]], G: [[3,2,0,0,0,3]], F: [[1,3,3,2,1,1]],
    Dm: [[-1,-1,0,2,3,1]], Em: [[0,2,2,0,0,0]], D: [[-1,-1,0,2,3,2]], E: [[0,2,2,1,0,0]],
    A: [[-1,0,2,2,2,0]], B: [[-1,2,4,4,4,2]],
  };
  const frets = shapes[chord]?.[0];
  if (!frets) return null;
  return (
    <div className="mt-4 flex justify-center gap-1">
      {frets.map((f, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-[8px] text-[#5C5C6B]">{f === -1 ? "x" : f === 0 ? "o" : ""}</span>
          {[1,2,3,4].map((pos) => (
            <div key={pos} className={`w-4 h-4 rounded-full border ${f === pos ? "bg-[#FF6B00] border-[#FF6B00] shadow-[0_0_8px_rgba(138,43,226,0.5)]" : "border-white/10"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
