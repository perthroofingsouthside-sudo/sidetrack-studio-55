import { useState, useEffect, useRef } from "react";
import { Activity, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

/**
 * SyncHUD — Global Master Clock indicator for group jams.
 * Polls /sync/state every 200ms and renders the live bar/beat position.
 * Host can /sync/start + /sync/stop. Collaborators only render the state.
 */
export default function SyncHUD({ roomId, userId, isHost = true, defaultBpm = 120 }) {
  const [state, setState] = useState(null);
  const [bpmInput, setBpmInput] = useState(defaultBpm);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const poll = async () => {
      try {
        const res = await axios.get(`${API}/sync/state/${encodeURIComponent(roomId)}`);
        if (res.data?.success) setState(res.data);
      } catch (e) { /* silent */ }
    };
    poll();
    pollRef.current = setInterval(poll, 200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [roomId]);

  const start = async () => {
    try {
      await axios.post(`${API}/sync/start`, { room_id: roomId, bpm: bpmInput, beats_per_bar: 4, user_id: userId });
      toast.success(`Master clock running · ${bpmInput} BPM`);
    } catch (e) { toast.error("Couldn't start sync"); }
  };
  const stop = async () => {
    try {
      await axios.post(`${API}/sync/stop`, { room_id: roomId });
      toast.message("Master clock stopped");
    } catch (e) { /* noop */ }
  };

  const running = state?.running;
  const bar = state?.bar;
  const beat = state?.beat;
  const beatsPerBar = state?.beats_per_bar || 4;
  const bpm = state?.bpm || bpmInput;
  const frac = state?.beat_fraction || 0;

  return (
    <div className="rounded-xl border border-[#39FF14]/20 p-2.5 flex items-center gap-2.5"
         style={{ background: "rgba(57,255,20,0.04)" }} data-testid="sync-hud">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(57,255,20,0.12)" }}>
        <Activity className="w-4 h-4 text-[#39FF14]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[#39FF14] font-bold" data-testid="sync-status">
          {running ? `Bar ${bar} · Beat ${beat}/${beatsPerBar} · ${bpm} BPM` : "Master Clock idle"}
        </p>
        {/* Beat dots */}
        <div className="flex gap-1 mt-1">
          {Array.from({ length: beatsPerBar }).map((_, i) => {
            const isCurrent = running && i === (beat - 1);
            return (
              <span key={i}
                className="h-1 flex-1 rounded-sm transition-all duration-100"
                style={{
                  background: isCurrent
                    ? `rgba(57,255,20,${0.4 + 0.6 * (1 - frac)})`
                    : "rgba(255,255,255,0.06)",
                  boxShadow: isCurrent ? "0 0 8px rgba(57,255,20,0.6)" : "none",
                }}
              />
            );
          })}
        </div>
      </div>
      {isHost && (
        running ? (
          <Button onClick={stop} variant="ghost" data-testid="sync-stop-btn"
            className="h-7 px-2 rounded-lg text-[10px] font-bold border border-white/10 text-[#5C5C6B] hover:text-white">
            <Square className="w-3 h-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <input type="number" min={40} max={240} value={bpmInput}
              onChange={(e) => setBpmInput(parseInt(e.target.value) || 120)}
              className="w-12 h-7 rounded bg-[#0F0F16] border border-white/10 text-[10px] text-white px-1.5 text-center"
              data-testid="sync-bpm-input" />
            <Button onClick={start} data-testid="sync-start-btn"
              className="h-7 px-2 rounded-lg text-[10px] font-bold bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A]">
              <Play className="w-3 h-3" />
            </Button>
          </div>
        )
      )}
    </div>
  );
}
