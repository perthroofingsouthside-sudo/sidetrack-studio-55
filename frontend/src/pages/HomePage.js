import { useState, useRef, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function HomePage({ onSongRecognized }) {
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
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#8A2BE2]/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#4B0082]/8 blur-[100px]" />
      </div>

      {/* Logo */}
      <div className="relative z-10 mb-12 animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#8A2BE2]/10 border border-[#8A2BE2]/30 flex items-center justify-center glow-violet">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M8 30V10L16 6V34L8 30Z" fill="#8A2BE2"/>
            <path d="M18 28V12L26 8V32L18 28Z" fill="#00E5FF" opacity="0.8"/>
            <path d="M28 26V14L34 11V29L28 26Z" fill="#8A2BE2" opacity="0.6"/>
            <circle cx="12" cy="32" r="2" fill="#8A2BE2"/>
            <circle cx="22" cy="30" r="2" fill="#00E5FF"/>
            <circle cx="31" cy="28" r="2" fill="#8A2BE2" opacity="0.6"/>
          </svg>
        </div>
        <h1 className="font-['Outfit'] text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-center">
          <span className="text-white">SIDE</span>
          <span className="text-[#8A2BE2] glow-text-violet">TRACK</span>
        </h1>
        <p className="text-[#606070] text-[10px] mt-1 text-center font-['Manrope'] uppercase tracking-[0.3em]">
          studios
        </p>
        <p className="text-[#A0A0B0] text-sm mt-2 text-center font-['Manrope']">
          Recognize. Separate. Create.
        </p>
      </div>

      {/* Main recognize button with radar rings */}
      <div className="relative z-10 flex items-center justify-center" data-testid="recognize-section">
        {/* Radar rings */}
        {isListening && (
          <>
            <div className="absolute w-48 h-48 rounded-full border border-[#8A2BE2]/30 animate-pulse-ring" style={{ animationDelay: "0s" }} />
            <div className="absolute w-64 h-64 rounded-full border border-[#8A2BE2]/20 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
            <div className="absolute w-80 h-80 rounded-full border border-[#8A2BE2]/10 animate-pulse-ring" style={{ animationDelay: "1s" }} />
          </>
        )}

        <Button
          data-testid="shazam-button"
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? "bg-[#8A2BE2] glow-violet scale-110"
              : isProcessing
              ? "bg-[#12121A] border border-white/10"
              : "bg-[#12121A] border border-[#8A2BE2]/40 hover:border-[#8A2BE2] hover:glow-violet hover:-translate-y-1"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-[#8A2BE2] animate-spin" />
          ) : (
            <Mic className={`w-10 h-10 ${isListening ? "text-white" : "text-[#8A2BE2]"}`} />
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
              key={i}
              className="w-[3px] bg-[#8A2BE2] rounded-full waveform-bar"
              style={{
                animation: `waveform 0.8s ease-in-out infinite`,
                animationDelay: `${i * 0.05}s`,
                height: "4px",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
