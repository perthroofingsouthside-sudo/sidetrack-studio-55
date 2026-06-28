import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Mic, X, ThumbsUp, Trophy, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

/**
 * BattleLiveStage — Live stream view for a 60-second rap battle.
 *
 *  - Plays the server-generated 60s beat (data: WAV).
 *  - Shows a synced countdown.
 *  - Renders live vote tally (polls every 2s).
 *  - Lets viewers vote once.
 *  - Auto-finishes the battle when the beat ends (sets winner + archives 7 days).
 */
export default function BattleLiveStage({ battleId, userId, onExit }) {
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef(null);
  const pollRef = useRef(null);
  const finishedRef = useRef(false);

  const load = useCallback(async (includeBeat = false) => {
    try {
      const res = await axios.get(`${API}/rap-battles/${battleId}`, {
        params: includeBeat ? { include_beat: true } : {},
      });
      setBattle(res.data.battle);
      return res.data.battle;
    } catch (err) {
      console.error("[BattleLive] load failed:", err);
      return null;
    } finally { setLoading(false); }
  }, [battleId]);

  // Initial load with beat, then poll without beat every 2s
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await load(true);
      if (cancelled) return;
      // Auto-start audio + countdown if status is "live"
      if (b && b.status === "live" && b.beat_data_url) {
        const audio = new Audio(b.beat_data_url);
        audioRef.current = audio;
        audio.onended = () => {
          if (finishedRef.current) return;
          finishedRef.current = true;
          finishBattle();
        };
        audio.play().then(() => setAudioStarted(true)).catch(() => {
          // Autoplay blocked; show manual play
          setAudioStarted(false);
        });
      }
    })();
    pollRef.current = setInterval(() => load(false), 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [load]);

  // Countdown timer driven by audio.currentTime so it stays in sync
  useEffect(() => {
    if (!audioStarted) return;
    const id = setInterval(() => {
      if (audioRef.current) setElapsed(audioRef.current.currentTime);
    }, 250);
    return () => clearInterval(id);
  }, [audioStarted]);

  const manualStart = async () => {
    const b = await load(true);
    if (!b?.beat_data_url) return;
    const audio = new Audio(b.beat_data_url);
    audioRef.current = audio;
    audio.onended = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      finishBattle();
    };
    try {
      await audio.play();
      setAudioStarted(true);
    } catch {
      toast.error("Couldn't start audio");
    }
  };

  const finishBattle = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await axios.post(`${API}/rap-battles/${battleId}/finish`);
      const b = await load(false);
      toast.success(b?.winner ? `Winner: ${b.winner === b.user_a ? b.profile_a.display_name : b.profile_b.display_name}` : "Battle tied!");
    } catch (err) {
      console.error("[BattleLive] finish failed:", err);
    } finally { setFinishing(false); }
  };

  const vote = async (choice) => {
    setVoting(true);
    try {
      await axios.post(`${API}/rap-battles/${battleId}/vote`, { voter_id: userId, choice });
      toast.success("Vote recorded");
      load(false);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Couldn't vote";
      toast.error(msg);
    } finally { setVoting(false); }
  };

  if (loading || !battle) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center" data-testid="battle-live-loading">
        <div className="text-[#5C5C6B] text-sm uppercase tracking-wider font-bold animate-pulse">Loading stream…</div>
      </div>
    );
  }

  const isParticipant = battle.user_a === userId || battle.user_b === userId;
  const isLive = battle.status === "live";
  const isDone = battle.status === "archived" || battle.status === "finished";
  const totalVotes = (battle.votes_a || 0) + (battle.votes_b || 0);
  const pctA = totalVotes ? Math.round(((battle.votes_a || 0) / totalVotes) * 100) : 50;
  const remaining = Math.max(0, 60 - Math.floor(elapsed));
  const firstMoverProfile = battle.first_mover === "a" ? battle.profile_a : battle.profile_b;

  return (
    <div className="min-h-screen bg-[#05050A] pb-24 relative overflow-hidden" data-testid="battle-live-stage">
      {/* Pulsing backdrop */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#FF6B00]/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#39FF14]/10 blur-[120px] animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-6 pb-3 flex items-center gap-3 border-b border-white/5">
        <Button onClick={onExit} variant="ghost" size="icon" className="text-[#5C5C6B] hover:text-white" data-testid="battle-live-exit">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <span className={`w-2 h-2 rounded-full ${isLive ? "bg-[#FF6B00] animate-pulse" : "bg-[#5C5C6B]"}`} />
          <span className="text-[10px] uppercase tracking-[0.35em] font-black text-[#FF6B00]">
            {isLive ? "Live" : isDone ? "Archived" : battle.status}
          </span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-[#39FF14] font-mono text-sm font-black" data-testid="battle-countdown">
            <Clock className="w-3.5 h-3.5" />
            00:{String(remaining).padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="relative z-10 px-4 py-5 max-w-2xl mx-auto space-y-5">
        {/* Versus + first mover banner */}
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#5C5C6B] font-black mb-1.5">First Mover</p>
          <p className="font-['Outfit'] text-base font-black text-[#39FF14]">{firstMoverProfile.display_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3" data-testid="battle-versus">
          <RapperStage profile={battle.profile_a} side="a" votes={battle.votes_a || 0} pct={pctA} isFirst={battle.first_mover === "a"} />
          <RapperStage profile={battle.profile_b} side="b" votes={battle.votes_b || 0} pct={100 - pctA} isFirst={battle.first_mover === "b"} />
        </div>

        {/* Beat progress */}
        <div className="rounded-2xl border border-white/5 p-3" style={{ background: "rgba(15,15,22,0.6)" }} data-testid="battle-beat-progress">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#FF6B00] font-black">60-Second Beat</span>
            </div>
            <span className="text-[10px] font-mono text-[#5C5C6B]">{Math.floor(elapsed)}s / 60s</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full transition-[width] duration-200 linear"
              style={{
                width: `${Math.min(100, (elapsed / 60) * 100)}%`,
                background: "linear-gradient(90deg, #FF6B00, #39FF14)",
                boxShadow: "0 0 12px rgba(255,107,0,0.4)",
              }}
            />
          </div>
          {!audioStarted && isLive && (
            <Button
              onClick={manualStart}
              data-testid="battle-manual-start"
              className="mt-3 w-full h-10 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white font-black text-xs uppercase tracking-wider"
            >
              <Radio className="w-3.5 h-3.5 mr-1.5" /> Tap to Start Beat
            </Button>
          )}
        </div>

        {/* Live vote */}
        {isLive && !isParticipant && (
          <div className="space-y-2" data-testid="battle-live-vote">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-black text-center">Live Vote · 1 per profile</p>
            <div className="flex gap-2">
              <Button
                onClick={() => vote("a")}
                disabled={voting}
                data-testid="battle-vote-a"
                className="flex-1 h-12 rounded-2xl bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 border border-[#FF6B00]/40 text-[#FF6B00] font-black text-xs uppercase tracking-wider gap-2"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> {battle.profile_a.display_name}
              </Button>
              <Button
                onClick={() => vote("b")}
                disabled={voting}
                data-testid="battle-vote-b"
                className="flex-1 h-12 rounded-2xl bg-[#39FF14]/15 hover:bg-[#39FF14]/25 border border-[#39FF14]/40 text-[#39FF14] font-black text-xs uppercase tracking-wider gap-2"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> {battle.profile_b.display_name}
              </Button>
            </div>
          </div>
        )}

        {isLive && isParticipant && (
          <p className="text-[10px] text-[#5C5C6B] text-center" data-testid="battle-no-self-vote">
            <Mic className="inline w-3 h-3 mr-1 text-[#FF6B00]" />
            Drop your bars over the beat — viewers are voting live.
          </p>
        )}

        {/* Outcome */}
        {isDone && (
          <div className="rounded-2xl border border-[#39FF14]/40 p-4 text-center"
               style={{ background: "rgba(57,255,20,0.05)" }}
               data-testid="battle-result">
            <Trophy className="w-7 h-7 text-[#39FF14] mx-auto mb-1.5" />
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#39FF14] mb-1">Battle Over</p>
            <p className="text-base font-black text-white">
              {battle.winner
                ? `Winner: ${battle.winner === battle.user_a ? battle.profile_a.display_name : battle.profile_b.display_name}`
                : "Tied!"}
            </p>
            <p className="text-[10px] text-[#5C5C6B] mt-1">Archived in Viewing Section for 7 days</p>
          </div>
        )}

        {/* Manual finish (in case audio.onended doesn't fire — e.g. tab muted) */}
        {isLive && elapsed >= 60 && (
          <Button
            onClick={finishBattle}
            disabled={finishing}
            data-testid="battle-finish-btn"
            className="w-full h-11 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-black uppercase tracking-wider"
          >
            End Battle &amp; Tally Votes
          </Button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#5C5C6B] uppercase tracking-wider">
          <Users className="w-3 h-3" /> {totalVotes} live votes
        </div>
      </div>
    </div>
  );
}

function RapperStage({ profile, side, votes, pct, isFirst }) {
  const colour = side === "a" ? "#FF6B00" : "#39FF14";
  return (
    <div
      className="relative rounded-3xl border p-4 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, rgba(${side === "a" ? "255,107,0" : "57,255,20"}, 0.10), rgba(15,15,22,0.6))`,
        borderColor: `${colour}55`,
        boxShadow: `0 0 22px ${colour}22`,
      }}
      data-testid={`battle-stage-${side}`}
    >
      {isFirst && (
        <span
          className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
          style={{ borderColor: `${colour}66`, color: colour, background: `${colour}10` }}
        >
          1st
        </span>
      )}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2"
        style={{ background: `${colour}22`, boxShadow: `0 0 22px ${colour}44` }}
      >
        <span className="font-['Outfit'] text-2xl font-black" style={{ color: colour }}>
          {(profile.display_name || "?")[0]?.toUpperCase()}
        </span>
      </div>
      <p className="text-sm font-black text-white text-center truncate">{profile.display_name}</p>
      <p className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold text-center mt-0.5">
        {profile.lifetime_wins || 0}W · {profile.lifetime_losses || 0}L
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: colour, boxShadow: `0 0 10px ${colour}66` }} />
      </div>
      <p className="text-center text-[10px] font-black uppercase tracking-wider mt-1.5" style={{ color: colour }}>
        {votes} vote{votes === 1 ? "" : "s"}
      </p>
    </div>
  );
}
