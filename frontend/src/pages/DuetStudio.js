import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Mic, Square, Video, Camera, Play, Pause, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function DuetStudio({ battle, cover, onRecordingComplete, onBack }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [coverAudioReady, setCoverAudioReady] = useState(false);
  const [coverPlaying, setCoverPlaying] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [mode, setMode] = useState("video");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const coverAudioRef = useRef(null);
  const waveAnimRef = useRef(null);
  const [waveHeights, setWaveHeights] = useState(() => Array.from({ length: 40 }, () => Math.random() * 60 + 20));

  useEffect(() => {
    loadCoverAudio();
    return () => {
      stopAll();
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveAnimRef.current) cancelAnimationFrame(waveAnimRef.current);
    };
  }, [cover?.id]);

  const loadCoverAudio = async () => {
    if (!cover?.id || !battle?.id) return;
    try {
      const res = await axios.get(`${API}/battles/${battle.id}/cover/${cover.id}/audio`);
      if (res.data.success && res.data.audio_data) {
        const byteString = atob(res.data.audio_data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        coverAudioRef.current = audio;
        audio.oncanplaythrough = () => setCoverAudioReady(true);
        audio.onended = () => {
          setCoverPlaying(false);
          if (isRecording) stopRecording();
        };
        audio.load();
      }
    } catch {
      toast.error("Failed to load cover audio");
    }
  };

  const stopAll = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (coverAudioRef.current) {
      coverAudioRef.current.pause();
      coverAudioRef.current = null;
    }
  };

  const animateWave = useCallback(() => {
    setWaveHeights(Array.from({ length: 40 }, () => Math.random() * 70 + 15));
    waveAnimRef.current = requestAnimationFrame(() => setTimeout(animateWave, 150));
  }, []);

  const startDuet = async () => {
    if (!coverAudioReady) {
      toast.info("Cover audio still loading...");
      return;
    }

    // 3-2-1 countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 800));
    }
    setCountdown(null);

    try {
      const needsVideo = mode === "video";
      const constraints = needsVideo
        ? { audio: true, video: { facingMode: "user", width: 1280, height: 720 } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (needsVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mimeType = needsVideo ? "video/webm" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        onRecordingComplete({
          id: crypto.randomUUID(),
          songId: battle?.id,
          songTitle: `Duet: ${battle?.song_title || "Unknown"}`,
          type: needsVideo ? "video" : "audio",
          blob,
          url,
          duration,
          isDuet: true,
          partnerUsername: cover?.username,
          createdAt: new Date().toISOString(),
        });
      };

      // Start both simultaneously
      mediaRecorder.start();
      coverAudioRef.current.currentTime = 0;
      coverAudioRef.current.play();
      setCoverPlaying(true);

      setIsRecording(true);
      setDuration(0);
      animateWave();
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } catch {
      toast.error("Camera/microphone access denied");
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (coverAudioRef.current) {
      coverAudioRef.current.pause();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveAnimRef.current) cancelAnimationFrame(waveAnimRef.current);
    setCoverPlaying(false);
    setIsRecording(false);
  }, []);

  const fmtDur = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (!battle || !cover) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#A0A0B0]">No cover selected for duet</p>
          <Button data-testid="duet-go-back-btn" onClick={onBack} className="mt-4 bg-[#8A2BE2]">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col max-w-full overflow-x-hidden" data-testid="duet-studio">
      {/* Header */}
      <div className="glass-heavy px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <Button data-testid="duet-back-btn" variant="ghost" size="icon" onClick={onBack} className="text-[#A0A0B0] hover:text-white w-8 h-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-['Outfit'] text-base font-bold truncate flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#00E5FF]" />
            Duet Mode
          </h2>
          <p className="text-[10px] text-[#A0A0B0] truncate">with {cover.username} &bull; {battle.song_title}</p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono text-white">{fmtDur(duration)}</span>
          </div>
        )}
      </div>

      {/* Top section: Partner's cover audio + waveform */}
      <div className="h-[35%] min-h-[180px] bg-[#0A0A0F] border-b border-white/5 flex flex-col items-center justify-center p-4 relative" data-testid="duet-partner-section">
        {/* Cover art + info */}
        <div className="flex items-center gap-3 mb-3">
          {battle.song_cover_url && (
            <img src={battle.song_cover_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-['Outfit'] font-bold text-white truncate">{cover.username}'s Cover</p>
            <p className="text-[10px] text-[#A0A0B0] truncate">{battle.song_title} &mdash; {battle.song_artist}</p>
          </div>
        </div>

        {/* Waveform visualization */}
        <div className="flex items-end gap-[2px] h-16 w-full max-w-xs" data-testid="duet-waveform">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-150 ${
                coverPlaying ? "bg-[#00E5FF]" : "bg-[#00E5FF]/20"
              }`}
              style={{ height: `${coverPlaying ? h : 20}%` }}
            />
          ))}
        </div>

        {!coverAudioReady && (
          <p className="text-[10px] text-[#606070] mt-2 animate-pulse">Loading cover audio...</p>
        )}
        {coverAudioReady && !isRecording && (
          <p className="text-[10px] text-[#00E5FF]/60 mt-2">Ready to duet</p>
        )}

        {/* Countdown overlay */}
        {countdown && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <span className="text-7xl font-['Outfit'] font-extrabold text-[#00E5FF] glow-text-cyan animate-pulse">
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* Bottom section: User's camera */}
      <div className="flex-1 min-h-[200px] bg-[#0A0A0F] relative overflow-hidden" data-testid="duet-camera-section">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          data-testid="duet-video-preview"
        />
        {!streamRef.current && !isRecording && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0F]">
            <Camera className="w-10 h-10 text-[#8A2BE2]/40 mb-2" />
            <p className="text-xs text-[#606070]">Your camera activates when you start</p>
          </div>
        )}
        {/* Your label */}
        <div className="absolute bottom-2 left-2 glass px-2 py-1 rounded-lg">
          <span className="text-[10px] text-white font-medium">You</span>
        </div>
        {/* Partner label on top section via overlay */}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center justify-center gap-4 flex-shrink-0 glass-heavy border-t border-white/5">
        {/* Mode toggle */}
        <Button
          data-testid="duet-mode-toggle"
          variant="ghost"
          onClick={() => { if (!isRecording) setMode(mode === "audio" ? "video" : "audio"); }}
          className={`h-9 px-3 rounded-full text-xs gap-1 ${mode === "video" ? "text-[#00E5FF]" : "text-[#A0A0B0]"}`}
        >
          <Video className="w-3.5 h-3.5" />{mode === "video" ? "Video" : "Audio"}
        </Button>

        {/* Record / Stop */}
        <Button
          data-testid="duet-record-btn"
          onClick={isRecording ? stopRecording : startDuet}
          disabled={!!countdown}
          className={`w-16 h-16 rounded-full transition-all ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : "bg-gradient-to-br from-[#8A2BE2] to-[#00E5FF] hover:opacity-90 glow-violet"
          }`}
        >
          {isRecording ? <Square className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
        </Button>

        {/* Duration */}
        <span className="text-sm font-mono text-[#606070] w-14 text-center" data-testid="duet-duration">
          {fmtDur(duration)}
        </span>
      </div>
    </div>
  );
}
