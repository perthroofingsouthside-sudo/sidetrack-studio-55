import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Video, Square, ArrowLeft, Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function RecordingStudio({ song, onRecordingComplete, onBack }) {
  const [mode, setMode] = useState("audio"); // "audio" or "video"
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopAllStreams();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const constraints = mode === "video"
        ? { audio: true, video: { facingMode: "user", width: 1280, height: 720 } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (mode === "video" && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mimeType = mode === "video" ? "video/webm" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mimeType = mode === "video" ? "video/webm" : "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        stopAllStreams();

        onRecordingComplete({
          id: crypto.randomUUID(),
          songId: song?.id,
          songTitle: song?.title || "Unknown",
          type: mode,
          blob,
          url,
          duration,
          createdAt: new Date().toISOString(),
        });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error(
        mode === "video"
          ? "Camera/microphone access denied"
          : "Microphone access denied"
      );
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="recording-studio">
      {/* Header */}
      <div className="glass-heavy px-4 py-3 flex items-center gap-3">
        <Button
          data-testid="back-btn"
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-[#A0A0B0] hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-['Outfit'] text-lg font-bold">Recording Studio</h2>
          {song && (
            <p className="text-xs text-[#A0A0B0]">{song.title} - {song.artist}</p>
          )}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 py-4 flex gap-3" data-testid="mode-toggle">
        <Button
          data-testid="audio-mode-btn"
          onClick={() => { if (!isRecording) setMode("audio"); }}
          className={`flex-1 gap-2 rounded-2xl h-12 transition-all ${
            mode === "audio"
              ? "bg-[#8A2BE2] text-white glow-violet"
              : "bg-[#12121A] text-[#A0A0B0] border border-white/10 hover:border-[#8A2BE2]/40"
          }`}
        >
          <Mic className="w-4 h-4" />
          Audio Only
        </Button>
        <Button
          data-testid="video-mode-btn"
          onClick={() => { if (!isRecording) setMode("video"); }}
          className={`flex-1 gap-2 rounded-2xl h-12 transition-all ${
            mode === "video"
              ? "bg-[#8A2BE2] text-white glow-violet"
              : "bg-[#12121A] text-[#A0A0B0] border border-white/10 hover:border-[#8A2BE2]/40"
          }`}
        >
          <Video className="w-4 h-4" />
          Video
        </Button>
      </div>

      {/* Video Preview / Audio Visualizer */}
      <div className="flex-1 px-4 flex items-center justify-center">
        {mode === "video" ? (
          <div className="relative w-full max-w-md aspect-[9/16] sm:aspect-video rounded-2xl overflow-hidden bg-[#12121A] border border-white/10">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              data-testid="video-preview"
            />
            {!isRecording && !streamRef.current && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#12121A]">
                <Camera className="w-12 h-12 text-[#8A2BE2] mb-3" />
                <p className="text-sm text-[#A0A0B0]">Camera preview will appear here</p>
              </div>
            )}
            {isRecording && (
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-rec-pulse" />
                <span className="text-white text-sm font-mono glass px-2 py-1 rounded-lg">
                  {formatDuration(duration)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md" data-testid="audio-visualizer-section">
            {/* Audio recording visual */}
            <div className="surface-card p-8 flex flex-col items-center">
              <div className="relative mb-6">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
                  isRecording ? "bg-[#8A2BE2]/20" : "bg-[#12121A]"
                } border border-white/10 transition-all`}>
                  <Mic className={`w-12 h-12 ${isRecording ? "text-[#00E5FF]" : "text-[#8A2BE2]"}`} />
                </div>
                {isRecording && (
                  <>
                    <div className="absolute inset-0 w-32 h-32 rounded-full border border-[#8A2BE2]/30 animate-pulse-ring" />
                    <div className="absolute -inset-4 w-40 h-40 rounded-full border border-[#8A2BE2]/15 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
                  </>
                )}
              </div>
              {isRecording && (
                <div className="flex items-center gap-[2px] mb-4 h-10">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-[#8A2BE2] rounded-full"
                      style={{
                        animation: "waveform 0.6s ease-in-out infinite",
                        animationDelay: `${i * 0.04}s`,
                        height: "4px",
                      }}
                    />
                  ))}
                </div>
              )}
              <span className="text-2xl font-mono text-white font-bold" data-testid="duration-display">
                {formatDuration(duration)}
              </span>
              <span className="text-xs text-[#606070] mt-1">
                {isRecording ? "Recording..." : "Ready to record"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Record Button */}
      <div className="px-4 py-6 flex justify-center">
        <Button
          data-testid="record-start-stop-btn"
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-20 h-20 rounded-full transition-all ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-rec-pulse"
              : "bg-[#8A2BE2] hover:bg-[#9D4CDD] glow-violet hover:-translate-y-1"
          }`}
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </Button>
      </div>
    </div>
  );
}
