import { useState, useEffect, useRef, useCallback } from "react";
import { Swords, Trophy, Users, Clock, Radio, Check, X, Coins, Crown, Calendar, ThumbsUp, Eye, ArrowLeft, Mic2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import BattleLiveStage from "@/components/BattleLiveStage";
import StarRating from "@/components/StarRating";

/**
 * BattleHub — Rap Battle Matchmaking inside the Connect tab.
 *
 * Sections:
 *  - Header / your stats
 *  - Active match (pending agreement → agreed → live)
 *  - Queue indicator
 *  - Register button
 *  - Archived viewing section (7-day window)
 *  - Quarterly tournament card + Top 200 leaderboard preview
 */
export default function BattleHub({ onBack, userId, displayName }) {
  const [snapshot, setSnapshot] = useState(null);
  const [archive, setArchive] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveBattleId, setLiveBattleId] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const RB = `${API}/rap-battles`;
      const [me, arc, tn, lb] = await Promise.all([
        axios.get(`${RB}/me/${encodeURIComponent(userId)}`),
        axios.get(`${RB}/archive?limit=20`),
        axios.get(`${RB}/tournament/current`),
        axios.get(`${RB}/leaderboard?limit=20`),
      ]);
      setSnapshot(me.data);
      setArchive(arc.data?.battles || []);
      setTournament(tn.data?.tournament || null);
      setLeaderboard(lb.data?.leaders || []);
    } catch (err) {
      console.error("[BattleHub] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load + light polling while in queue or pending agreement
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const active = snapshot?.active_battle;
    const inQ = snapshot?.in_queue;
    const shouldPoll = inQ || (active && (active.status === "pending_agreement" || active.status === "agreed"));
    if (shouldPoll) {
      pollRef.current = setInterval(() => load(), 3000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [snapshot, load]);

  const register = async () => {
    if (localStorage.getItem("pp_age_mode") === "grommet") {
      toast.error("Rap Battles are 18+ — level up with a guardian to unlock Creator mode.");
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/rap-battles/register`, { user_id: userId, display_name: displayName });
      if (res.data.status === "matched") {
        toast.success("Matched with an opponent!");
      } else if (res.data.status === "in_match") {
        toast.info("You already have an active battle");
      } else {
        toast.success("In queue — looking for opponent");
      }
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't register");
    } finally { setBusy(false); }
  };

  const agree = async (battleId) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/rap-battles/${battleId}/agree`, { user_id: userId });
      const b = res.data.battle;
      if (b.agreed_a && b.agreed_b) {
        toast.success(`Both agreed · first mover: ${b.first_mover === "a" ? b.profile_a.display_name : b.profile_b.display_name}${b.coin_flip ? " (coin flip!)" : ""}`);
      } else {
        toast.success("You agreed — waiting on opponent");
      }
      load();
    } catch (err) {
      toast.error("Couldn't agree");
    } finally { setBusy(false); }
  };

  const goLive = async (battleId) => {
    setBusy(true);
    try {
      await axios.post(`${API}/rap-battles/${battleId}/go-live`);
      setLiveBattleId(battleId);
    } catch (err) {
      toast.error("Couldn't start battle");
    } finally { setBusy(false); }
  };

  // Render the Live Stage as a takeover view
  if (liveBattleId) {
    return (
      <BattleLiveStage
        battleId={liveBattleId}
        userId={userId}
        onExit={() => { setLiveBattleId(null); load(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center" data-testid="battle-hub-loading">
        <div className="text-[#5C5C6B] text-sm uppercase tracking-wider font-bold animate-pulse">Loading Battle Hub…</div>
      </div>
    );
  }

  const me = snapshot?.user;
  const active = snapshot?.active_battle;
  const inQueue = snapshot?.in_queue;

  return (
    <div className="min-h-screen bg-[#05050A] pb-32" data-testid="battle-hub">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-4 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF5F1F]/8 via-[#05050A] to-[#05050A] z-0" />
        <div className="relative z-10 flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="icon" className="text-[#5C5C6B] hover:text-white" data-testid="battle-hub-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,95,31,0.15)", boxShadow: "0 0 22px rgba(255,95,31,0.3)" }}>
            <Swords className="w-5 h-5 text-[#FF5F1F]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-['Outfit'] text-xl sm:text-2xl font-black text-white">
              <span className="text-[#FF5F1F] glow-text-orange">Battle</span> Hub
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold">
              Auto-match · 45s each · Live voting
            </p>
          </div>
          {me && (
            <div className="text-right flex-shrink-0" data-testid="battle-hub-stats">
              <p className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold">Lifetime</p>
              <p className="text-sm font-black text-white">
                <span className="text-[#39FF14]">{me.lifetime_wins || 0}W</span>
                <span className="text-[#5C5C6B] mx-1">·</span>
                <span className="text-[#FF5F1F]">{me.lifetime_losses || 0}L</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto">
          {/* ACTIVE BATTLE CARD or REGISTER */}
          {active ? (
            <ActiveBattleCard
              battle={active}
              userId={userId}
              busy={busy}
              onAgree={agree}
              onGoLive={goLive}
            />
          ) : inQueue ? (
            <QueueCard userId={userId} />
          ) : (
            <RegisterCard userId={userId} busy={busy} onRegister={register} />
          )}

          {/* QUARTERLY TOURNAMENT */}
          {tournament && <TournamentCard tournament={tournament} />}

          {/* TOP RANKED */}
          {leaderboard.length > 0 && <LeaderboardSection leaders={leaderboard} userId={userId} />}

          {/* ARCHIVE — 7-day viewing window */}
          <ArchiveSection battles={archive} userId={userId} onChanged={load} />
        </div>
      </ScrollArea>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function RegisterCard({ userId, busy, onRegister }) {
  return (
    <div
      className="relative rounded-3xl border border-[#FF5F1F]/30 overflow-hidden p-5"
      style={{
        background: "linear-gradient(135deg, rgba(255,95,31,0.12), rgba(57,255,20,0.06))",
        boxShadow: "0 0 32px rgba(255,95,31,0.18)",
      }}
      data-testid="battle-register-card"
    >
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#FF5F1F]/15 blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Mic2 className="w-4 h-4 text-[#FF5F1F]" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#FF5F1F] font-black">Step into the ring</span>
        </div>
        <h2 className="font-['Outfit'] text-2xl font-black text-white mb-1">Register for a Rap Battle</h2>
        <p className="text-xs text-[#A0A0B0] mb-4">
          You&rsquo;ll be auto-matched with an opponent. Once matched, both rappers must agree via the Connect tab — then each rapper gets 45 seconds on a fresh 90-second beat with live voting.
        </p>
        <div className="text-[10px] uppercase tracking-wider text-[#5C5C6B] mb-3 font-bold">
          Your ID: <span className="text-white">{userId}</span>
        </div>
        <Button
          onClick={onRegister}
          disabled={busy}
          data-testid="battle-register-btn"
          className="w-full h-12 rounded-2xl bg-[#FF5F1F] hover:bg-[#FF7A42] text-white font-black text-sm uppercase tracking-wider gap-2"
          style={{ boxShadow: "0 0 22px rgba(255,95,31,0.45)" }}
        >
          <Swords className="w-4 h-4" />
          {busy ? "Joining…" : "Register Now"}
        </Button>
      </div>
    </div>
  );
}

function QueueCard({ userId }) {
  return (
    <div
      className="relative rounded-3xl border border-[#39FF14]/30 p-5 overflow-hidden"
      style={{ background: "rgba(57,255,20,0.06)" }}
      data-testid="battle-queue-card"
    >
      <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[#39FF14]/15 blur-3xl animate-pulse" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center bg-[#39FF14]/15">
          <Users className="w-5 h-5 text-[#39FF14]" />
          <div className="absolute inset-0 rounded-2xl border-2 border-[#39FF14]/40 animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-white">Searching for an opponent…</p>
          <p className="text-[10px] uppercase tracking-wider text-[#39FF14] font-bold mt-0.5">
            Matchmaking typically takes &lt; 60 minutes
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-[#5C5C6B]">
        Your ID: <span className="text-white">{userId}</span>
      </p>
    </div>
  );
}

function ActiveBattleCard({ battle, userId, busy, onAgree, onGoLive }) {
  const isA = battle.user_a === userId;
  const me = isA ? battle.profile_a : battle.profile_b;
  const opp = isA ? battle.profile_b : battle.profile_a;
  const meAgreed = isA ? battle.agreed_a : battle.agreed_b;
  const oppAgreed = isA ? battle.agreed_b : battle.agreed_a;
  const status = battle.status;

  return (
    <div
      className="relative rounded-3xl border border-[#FF5F1F]/40 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(255,95,31,0.10), rgba(57,255,20,0.06))",
        boxShadow: "0 0 28px rgba(255,95,31,0.25)",
      }}
      data-testid="battle-active-card"
    >
      <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F1F] animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#FF5F1F] font-black">
            {status === "pending_agreement" ? "Match Found" : status === "agreed" ? "Ready to Battle" : "Live"}
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold">
          ID {battle.id.slice(0, 6)}
        </span>
      </div>

      {/* Versus header */}
      <div className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
          <RapperSlot profile={me} side="me" agreed={meAgreed} />
          <div className="text-[#FF5F1F] font-['Outfit'] text-2xl font-black opacity-70">VS</div>
          <RapperSlot profile={opp} side="opp" agreed={oppAgreed} />
        </div>

        {/* Status block */}
        {status === "pending_agreement" && (
          <div className="space-y-2.5" data-testid="battle-pending-actions">
            <p className="text-[11px] text-[#A0A0B0] text-center">
              Both rappers must agree. Hop on a voice/video call below to verify before agreeing.
            </p>
            <Button
              onClick={() => onAgree(battle.id)}
              disabled={busy || meAgreed}
              data-testid="battle-agree-btn"
              className={`w-full h-11 rounded-2xl font-black text-sm uppercase tracking-wider gap-2 ${
                meAgreed
                  ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40"
                  : "bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A]"
              }`}
              style={!meAgreed ? { boxShadow: "0 0 18px rgba(57,255,20,0.4)" } : undefined}
            >
              <Check className="w-4 h-4" />
              {meAgreed ? "Waiting on opponent…" : "Agree to Battle"}
            </Button>
          </div>
        )}

        {status === "agreed" && (
          <div className="space-y-3" data-testid="battle-agreed-actions">
            <FirstMoverBanner battle={battle} />
            <Button
              onClick={() => onGoLive(battle.id)}
              disabled={busy}
              data-testid="battle-go-live-btn"
              className="w-full h-12 rounded-2xl bg-[#FF5F1F] hover:bg-[#FF7A42] text-white font-black text-sm uppercase tracking-wider gap-2"
              style={{ boxShadow: "0 0 22px rgba(255,95,31,0.5)" }}
            >
              <Radio className="w-4 h-4" />
              Enter Live Stream
            </Button>
          </div>
        )}

        {status === "live" && (
          <Button
            onClick={() => onGoLive(battle.id)}
            disabled={busy}
            data-testid="battle-rejoin-live-btn"
            className="w-full h-12 rounded-2xl bg-[#FF5F1F] hover:bg-[#FF7A42] text-white font-black text-sm uppercase tracking-wider gap-2"
          >
            <Radio className="w-4 h-4 animate-pulse" /> Re-enter Live Stream
          </Button>
        )}
      </div>
    </div>
  );
}

function RapperSlot({ profile, side, agreed }) {
  const colour = side === "me" ? "#FF5F1F" : "#39FF14";
  return (
    <div
      className="flex flex-col items-center text-center"
      data-testid={`battle-slot-${side}`}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1.5 border"
        style={{
          background: `rgba(${side === "me" ? "255,95,31" : "57,255,20"}, 0.15)`,
          borderColor: `${colour}66`,
          boxShadow: `0 0 16px ${colour}33`,
        }}
      >
        <span className="font-['Outfit'] text-lg font-black" style={{ color: colour }}>
          {(profile.display_name || "?")[0]?.toUpperCase()}
        </span>
      </div>
      <p className="text-xs font-black text-white truncate max-w-[120px]">{profile.display_name}</p>
      <p className="text-[9px] text-[#5C5C6B] uppercase tracking-wider font-bold mt-0.5">
        {profile.lifetime_wins || 0}W · {profile.lifetime_losses || 0}L
      </p>
      <div
        className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
          agreed
            ? "border-[#39FF14]/40 text-[#39FF14] bg-[#39FF14]/8"
            : "border-white/10 text-[#5C5C6B]"
        }`}
      >
        {agreed ? <Check className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
        {agreed ? "Agreed" : "Pending"}
      </div>
    </div>
  );
}

function FirstMoverBanner({ battle }) {
  const first = battle.first_mover === "a" ? battle.profile_a : battle.profile_b;
  return (
    <div
      className="rounded-2xl border border-[#39FF14]/30 p-3 flex items-center gap-2.5"
      style={{ background: "rgba(57,255,20,0.06)" }}
      data-testid="battle-first-mover"
    >
      {battle.coin_flip
        ? <Coins className="w-5 h-5 text-[#39FF14] flex-shrink-0" />
        : <Crown className="w-5 h-5 text-[#39FF14] flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#39FF14] font-black">
          {battle.coin_flip ? "Coin Flip" : "Highest-Ranked Picks First"}
        </p>
        <p className="text-sm font-bold text-white truncate">
          <span className="text-[#39FF14]">{first.display_name}</span> goes first
        </p>
      </div>
    </div>
  );
}

function TournamentCard({ tournament }) {
  const end = new Date(tournament.ends_at);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  return (
    <section data-testid="battle-tournament-card">
      <h2 className="font-['Outfit'] text-xs uppercase tracking-[0.25em] font-black text-[#FF5F1F] mb-2 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" /> Quarterly Global Contest
      </h2>
      <div
        className="rounded-3xl border border-[#FF5F1F]/25 p-4 overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(255,95,31,0.10), rgba(57,255,20,0.04))",
        }}
      >
        <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-[#39FF14]/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#FF5F1F]/15">
            <PartyPopper className="w-5 h-5 text-[#FF5F1F]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-['Outfit'] text-lg font-black text-white">
              Q{tournament.quarter} · {tournament.year}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold">
              Top {tournament.qualifies_top} qualify · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </p>
          </div>
          <Calendar className="w-4 h-4 text-[#5C5C6B] flex-shrink-0" />
        </div>
      </div>
    </section>
  );
}

function LeaderboardSection({ leaders, userId }) {
  return (
    <section data-testid="battle-leaderboard-card">
      <h2 className="font-['Outfit'] text-xs uppercase tracking-[0.25em] font-black text-[#39FF14] mb-2 flex items-center gap-1.5">
        <Crown className="w-3.5 h-3.5" /> Top Ranked
      </h2>
      <div className="rounded-2xl border border-white/5 overflow-hidden">
        {leaders.slice(0, 10).map((u, idx) => {
          const isMe = u.user_id === userId;
          return (
            <div
              key={u.user_id}
              data-testid={`leader-row-${idx}`}
              className={`flex items-center gap-3 px-3 py-2 border-b border-white/5 last:border-0 ${
                isMe ? "bg-[#FF5F1F]/8" : ""
              }`}
            >
              <span className="w-6 text-center text-[10px] font-black"
                style={{ color: idx === 0 ? "#FFD700" : idx === 1 ? "#C0C0C0" : idx === 2 ? "#CD7F32" : "#5C5C6B" }}>
                #{idx + 1}
              </span>
              <span className={`flex-1 text-sm font-bold truncate ${isMe ? "text-[#FF5F1F]" : "text-white"}`}>
                {u.display_name}{isMe ? " (you)" : ""}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-black text-[#39FF14]">{u.lifetime_wins}W</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#5C5C6B]">{u.lifetime_losses}L</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ArchiveSection({ battles, userId, onChanged }) {
  const [topRated, setTopRated] = useState([]);
  useEffect(() => {
    axios.get(`${API}/ratings/top`, { params: { item_type: "battle", limit: 5 } })
      .then((res) => setTopRated(res.data?.top || []))
      .catch(() => {});
  }, [battles.length]);
  const topIds = new Set(topRated.slice(0, 3).map((t) => t.item_id));
  // Peer-rated battles surface first (discovery via community grading)
  const ordered = [...battles].sort((a, b) => (topIds.has(b.id) ? 1 : 0) - (topIds.has(a.id) ? 1 : 0));
  return (
    <section data-testid="battle-archive">
      <h2 className="font-['Outfit'] text-xs uppercase tracking-[0.25em] font-black text-[#5C5C6B] mb-2 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" /> Viewing Section · 7-day window
      </h2>
      {battles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center" data-testid="archive-empty">
          <p className="text-sm font-bold text-white">No archived battles yet</p>
          <p className="text-[10px] text-[#5C5C6B] mt-1">Finished battles will show up here for 7 days.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordered.map((b) => (
            <ArchiveRow key={b.id} battle={b} userId={userId} onChanged={onChanged} isTopRated={topIds.has(b.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ArchiveRow({ battle, userId, onChanged, isTopRated }) {
  const [voting, setVoting] = useState(false);
  const totalVotes = (battle.votes_a || 0) + (battle.votes_b || 0);
  const pctA = totalVotes ? Math.round(((battle.votes_a || 0) / totalVotes) * 100) : 50;
  const isParticipant = battle.user_a === userId || battle.user_b === userId;

  const vote = async (choice) => {
    setVoting(true);
    try {
      await axios.post(`${API}/rap-battles/${battle.id}/vote`, { voter_id: userId, choice });
      toast.success("Vote recorded");
      onChanged && onChanged();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Couldn't vote";
      toast.error(msg);
    } finally { setVoting(false); }
  };

  return (
    <div
      className="rounded-2xl border border-white/5 p-3"
      style={{ background: "rgba(15,15,22,0.5)" }}
      data-testid={`archive-row-${battle.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-white truncate">
          {battle.profile_a.display_name} <span className="text-[#5C5C6B]">vs</span> {battle.profile_b.display_name}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isTopRated && (
            <span className="text-[8px] uppercase tracking-wider font-black text-[#FF5F1F] px-1.5 py-0.5 rounded-full border border-[#FF5F1F]/40 bg-[#FF5F1F]/10" data-testid={`top-rated-${battle.id}`}>
              ★ Top Rated
            </span>
          )}
          {battle.winner && (
            <span className="text-[9px] uppercase tracking-wider font-black text-[#39FF14] px-1.5 py-0.5 rounded-full border border-[#39FF14]/30">
              Winner: {battle.winner === battle.user_a ? battle.profile_a.display_name : battle.profile_b.display_name}
            </span>
          )}
        </div>
      </div>
      {/* Peer grading — 18+ community stars drive discovery */}
      <div className="mb-2">
        <StarRating itemId={battle.id} itemType="battle" />
      </div>
      {/* Vote bar */}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-1" data-testid="vote-bar">
        <div className="h-full flex">
          <div style={{ width: `${pctA}%`, background: "#FF5F1F", boxShadow: "0 0 12px rgba(255,95,31,0.4)" }} />
          <div style={{ width: `${100 - pctA}%`, background: "#39FF14", boxShadow: "0 0 12px rgba(57,255,20,0.4)" }} />
        </div>
      </div>
      <p className="text-[10px] text-[#5C5C6B] mb-2.5 flex items-center justify-between">
        <span className="text-[#FF5F1F]">{battle.votes_a || 0}</span>
        <span>{totalVotes} votes</span>
        <span className="text-[#39FF14]">{battle.votes_b || 0}</span>
      </p>
      {!isParticipant && (
        <div className="flex gap-2">
          <Button
            onClick={() => vote("a")}
            disabled={voting}
            data-testid={`archive-vote-a-${battle.id}`}
            className="flex-1 h-9 rounded-xl border border-[#FF5F1F]/40 bg-[#FF5F1F]/10 text-[#FF5F1F] hover:bg-[#FF5F1F]/20 text-[10px] font-black uppercase tracking-wider"
          >
            <ThumbsUp className="w-3 h-3 mr-1" /> Vote {battle.profile_a.display_name}
          </Button>
          <Button
            onClick={() => vote("b")}
            disabled={voting}
            data-testid={`archive-vote-b-${battle.id}`}
            className="flex-1 h-9 rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 text-[10px] font-black uppercase tracking-wider"
          >
            <ThumbsUp className="w-3 h-3 mr-1" /> Vote {battle.profile_b.display_name}
          </Button>
        </div>
      )}
      {isParticipant && (
        <p className="text-[10px] text-[#5C5C6B] text-center">Participants can&rsquo;t vote in their own battle.</p>
      )}
    </div>
  );
}
