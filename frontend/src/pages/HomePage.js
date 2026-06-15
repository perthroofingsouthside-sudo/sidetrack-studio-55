import { useState, useRef, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function HomePage({ onSongRecognized, nowPlaying }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await recognizeSong(blob);
      };

      mediaRecorder.start();
      setIsListening(true);

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          setIsListening(false);
        }
      }, 5000);
    } catch (err) {
      toast.error("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const recognizeSong = async (audioBlob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      const response = await axios.post(`${API}/recognize`, formData);
      if (response.data.success) {
        const song = response.data.song;
        toast.success(`Found: ${song.title} by ${song.artist}`);
        if (response.data.demo) {
          toast.info("Using demo song. Update API key for real recognition.");
        }
        onSongRecognized(song);
      } else {
        toast.error("Could not identify the song. Try again.");
      }
    } catch (err) {
      toast.error("Recognition failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4"
      data-testid="home-page"
    >
      {/* Background abstract */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#FF6B00]/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#39FF14]/5 blur-[100px]" />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-12 animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-center glow-orange">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M8 30V10L16 6V34L8 30Z" fill="#FF6B00"/>
            <path d="M18 28V12L26 8V32L18 28Z" fill="#39FF14" opacity="0.8"/>
            <path d="M28 26V14L34 11V29L28 26Z" fill="#FF6B00" opacity="0.6"/>
            <circle cx="12" cy="32" r="2" fill="#FF6B00"/>
            <circle cx="22" cy="30" r="2" fill="#39FF14"/>
            <circle cx="31" cy="28" r="2" fill="#FF6B00" opacity="0.6"/>
          </svg>
        </div>
        <h1 className="font-['Outfit'] text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-center">
          <span className="text-white">Pocket </span>
          <span className="text-[#FF6B00] glow-text-orange">Products</span>
        </h1>
        <p className="text-[#A0A0B0] text-sm mt-2 text-center font-['Manrope']">
          Recognize. Separate. Create.
        </p>
      </div>

      {/* Main recognize button with radar rings */}
      <div className="relative z-10 flex items-center justify-center" data-testid="recognize-section">
        {/* Radar rings */}
        {isListening && (
          <>
            <div className="absolute w-48 h-48 rounded-full border border-[#FF6B00]/30 animate-pulse-ring" style={{ animationDelay: "0s" }} />
            <div className="absolute w-64 h-64 rounded-full border border-[#FF6B00]/20 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
            <div className="absolute w-80 h-80 rounded-full border border-[#FF6B00]/10 animate-pulse-ring" style={{ animationDelay: "1s" }} />
          </>
        )}

        <Button
          data-testid="shazam-button"
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? "bg-[#FF6B00] glow-orange scale-110"
              : isProcessing
              ? "bg-[#12121A] border border-white/10"
              : "bg-[#12121A] border border-[#FF6B00]/40 hover:border-[#FF6B00] hover:glow-orange hover:-translate-y-1"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-[#FF6B00] animate-spin" />
          ) : (
            <Mic className={`w-10 h-10 ${isListening ? "text-white" : "text-[#FF6B00]"}`} />
          )}
        </Button>
      </div>

      {/* Status text */}
      <p
        className="relative z-10 mt-8 text-sm text-[#A0A0B0] font-['Manrope'] text-center"
        data-testid="status-text"
      >
        {isProcessing
          ? "Analyzing audio..."
          : isListening
          ? "Listening... Tap to stop"
          : "Tap to recognize a song"}
      </p>

      {/* Waveform visualization when listening */}
      {isListening && (
        <div className="relative z-10 flex items-end gap-[3px] mt-6 h-8" data-testid="waveform-visual">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`wave-${i}`}
              className="w-[3px] bg-[#FF6B00] rounded-full waveform-bar"
              style={{
                animation: `waveform 0.8s ease-in-out infinite`,
                animationDelay: `${i * 0.05}s`,
                height: "4px",
              }}
            />
          ))}
        </div>
      )}

      {/* Now Playing — Album Art Display (right side) */}
      {nowPlaying && !isListening && !isProcessing && (
        <div className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 z-10 hidden sm:block" data-testid="discover-album-art">
          <div className="w-48 h-48 lg:w-64 lg:h-64 rounded-3xl overflow-hidden border border-[#FF6B00]/20 shadow-[0_0_60px_rgba(255,107,0,0.15)] animate-float">
            {nowPlaying.cover_url || nowPlaying.cover_thumb ? (
              <img src={nowPlaying.cover_url || nowPlaying.cover_thumb} alt={nowPlaying.title}
                className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#12121A] flex items-center justify-center">
                <Mic className="w-16 h-16 text-[#FF6B00]/20" />
              </div>
            )}
          </div>
          <div className="mt-3 text-center">
            <p className="text-xs font-bold text-white truncate max-w-48 lg:max-w-64">{nowPlaying.title}</p>
            <p className="text-[10px] text-[#5C5C6B] truncate max-w-48 lg:max-w-64">{nowPlaying.artist}</p>
          </div>
        </div>
      )}
    </div>
  );
}
