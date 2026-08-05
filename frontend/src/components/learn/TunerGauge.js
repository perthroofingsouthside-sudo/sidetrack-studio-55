/* TunerGauge — live mic pitch readout: detected note, frequency, cents needle. */
import { noteName } from "@/services/PitchDetector";
import { Mic, MicOff } from "lucide-react";

export default function TunerGauge({ pitch, micOn, isMatch }) {
  const cents = pitch ? Math.max(-50, Math.min(50, pitch.cents)) : 0;
  const needlePct = 50 + cents; // 0..100

  return (
    <div className="rounded-xl border border-white/8 px-3 py-2 flex items-center gap-3"
      style={{ background: "rgba(10,10,16,0.8)" }} data-testid="tuner-gauge">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${micOn ? "bg-[#39FF14]/15" : "bg-white/5"}`}>
        {micOn ? <Mic className="w-4 h-4 text-[#39FF14]" /> : <MicOff className="w-4 h-4 text-[#5C5C6B]" />}
      </div>
      <div className="w-14 text-center flex-shrink-0">
        <p className="font-['Outfit'] font-black text-xl leading-none"
          style={{ color: isMatch ? "#39FF14" : pitch ? "#FF5F1F" : "#5C5C6B", textShadow: isMatch ? "0 0 12px #39FF14" : "none" }}
          data-testid="tuner-detected-note">
          {pitch ? noteName(pitch.midi) : "--"}
        </p>
        <p className="text-[8px] text-[#5C5C6B] font-mono" data-testid="tuner-freq">
          {pitch ? `${pitch.freq.toFixed(1)} Hz` : micOn ? "listening…" : "mic off"}
        </p>
      </div>
      {/* Cents needle */}
      <div className="flex-1 relative h-6">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/8" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/25" />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-[left] duration-100"
          style={{
            left: `${needlePct}%`,
            background: pitch ? (Math.abs(cents) < 15 ? "#39FF14" : "#FF5F1F") : "#2A2A34",
            boxShadow: pitch ? `0 0 10px ${Math.abs(cents) < 15 ? "#39FF14" : "#FF5F1F"}` : "none",
          }} />
        <span className="absolute left-0 -bottom-1.5 text-[7px] text-[#5C5C6B] font-bold">-50¢</span>
        <span className="absolute right-0 -bottom-1.5 text-[7px] text-[#5C5C6B] font-bold">+50¢</span>
      </div>
    </div>
  );
}
