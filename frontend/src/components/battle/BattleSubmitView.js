import { Mic, Square, Swords, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDur } from "@/hooks/useBattleRecorder";

/**
 * BattleSubmitView — the "Record Your Cover" screen reached via Enter → Submit.
 */
export default function BattleSubmitView({
  battle, username, setUsername,
  isRecording, duration, recordedBlob,
  onStartRec, onStopRec, onSubmit, onBack,
}) {
  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="battle-submit">
      <div className="glass-heavy px-4 py-3 flex items-center gap-3">
        <Button data-testid="submit-back-btn" variant="ghost" size="icon" onClick={onBack} className="text-[#A0A0B0]">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-['Outfit'] text-lg font-bold">Record Your Cover</h2>
          <p className="text-xs text-[#A0A0B0]">{battle.song_title} - {battle.song_artist}</p>
        </div>
      </div>
      <div className="px-4 py-6 flex flex-col items-center gap-6">
        <Input
          data-testid="username-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your username..."
          className="max-w-sm h-11 bg-[#12121A] border-white/10 text-white rounded-2xl text-center"
        />
        <div className="relative">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center border transition-all ${
            isRecording ? "bg-red-500/20 border-red-500/50 animate-rec-pulse" : "bg-[#12121A] border-white/10"
          }`}>
            <Mic className={`w-12 h-12 ${isRecording ? "text-red-400" : "text-[#FF5F1F]"}`} />
          </div>
          {isRecording && <div className="absolute inset-0 w-32 h-32 rounded-full border border-red-500/30 animate-pulse-ring" />}
        </div>
        <span className="text-2xl font-mono font-bold" data-testid="rec-duration">{fmtDur(duration)}</span>
        {isRecording && (
          <div className="flex items-center gap-[2px] h-8">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={`wave-${i}`} className="w-[3px] bg-red-500 rounded-full"
                style={{ animation: "waveform 0.6s ease-in-out infinite", animationDelay: `${i * 0.04}s`, height: "4px" }}
              />
            ))}
          </div>
        )}
        <Button
          data-testid="rec-toggle-btn"
          onClick={isRecording ? onStopRec : onStartRec}
          className={`w-20 h-20 rounded-full ${
            isRecording ? "bg-red-500 hover:bg-red-600" : "bg-[#FF5F1F] hover:bg-[#FF7A42] glow-orange"
          }`}
        >
          {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
        </Button>
        {recordedBlob && (
          <Button
            data-testid="submit-cover-btn"
            onClick={onSubmit}
            className="w-full max-w-sm h-12 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-bold rounded-2xl glow-cyan"
          >
            <Swords className="w-5 h-5 mr-2" /> Submit Cover
          </Button>
        )}
      </div>
    </div>
  );
}
