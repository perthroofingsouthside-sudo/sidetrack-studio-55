import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import { SKIN_LABELS } from "@/components/BattleStageBackdrop";
import { useBattleRecorder } from "@/hooks/useBattleRecorder";
import GamerStage from "@/pages/GamerStage";
import BattleSubmitView from "@/components/battle/BattleSubmitView";
import BattleDetailView from "@/components/battle/BattleDetailView";
import BattleStageListView from "@/components/battle/BattleStageListView";

/**
 * BattleArena — Creator-lane cover battle hub. Thin orchestrator that:
 *   • loads battles + leaderboard,
 *   • routes between list → stage → detail → submit views,
 *   • delegates the heavy UI to BattleStageListView / BattleDetailView /
 *     BattleSubmitView and uses useBattleRecorder for mic + playback.
 */
export default function BattleArena({ currentSong, pendingBattleSong, onPendingBattleConsumed, onStartDuet }) {
  const [view, setView] = useState("list"); // list | stage | detail | submit
  const [battles, setBattles] = useState([]);
  const [selectedBattle, setSelectedBattle] = useState(null);
  const [covers, setCovers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [voterId] = useState(() => {
    let id = localStorage.getItem("sidetrack_voter_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); }
    return id;
  });
  const [stageSkin, setStageSkin] = useState(() => localStorage.getItem("pp_stage_skin") || "theater");
  const [skinPickerOpen, setSkinPickerOpen] = useState(false);

  const recorder = useBattleRecorder();

  const changeSkin = (k) => {
    setStageSkin(k);
    localStorage.setItem("pp_stage_skin", k);
    setSkinPickerOpen(false);
    toast.success(`Stage skin: ${SKIN_LABELS[k]?.label || k}`);
  };

  // ── Data loading ────────────────────────────────────────────────────
  const loadBattles = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/battles?status=active&limit=20`);
      if (res.data.success) setBattles(res.data.battles);
    } catch (err) { console.error("[Battle] load battles failed:", err); }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/battles/leaderboard/top?limit=10`);
      if (res.data.success) setLeaderboard(res.data.leaderboard);
    } catch (err) { console.error("[Battle] load leaderboard failed:", err); }
  }, []);

  useEffect(() => { loadBattles(); loadLeaderboard(); }, [loadBattles, loadLeaderboard]);

  // ── Battle actions ─────────────────────────────────────────────────
  const openBattle = useCallback(async (battle) => {
    setSelectedBattle(battle);
    setView("stage");
    try {
      const res = await axios.get(`${API}/battles/${battle.id}`);
      if (res.data.success) {
        setSelectedBattle(res.data.battle);
        setCovers(res.data.covers);
      }
    } catch { toast.error("Failed to load battle"); }
  }, []);

  const createBattle = useCallback(async (override) => {
    const songToUse = override || currentSong;
    if (!songToUse) {
      toast.info("Select a song from Stream or Discover first!");
      return;
    }
    try {
      const res = await axios.post(`${API}/battles`, {
        song_title: songToUse.title,
        song_artist: songToUse.artist,
        song_cover_url: songToUse.cover_url || "",
        challenge_text: `Cover "${songToUse.title}" by ${songToUse.artist}!`,
      });
      if (res.data.success) {
        toast.success("Battle created!");
        loadBattles();
        openBattle(res.data.battle);
      }
    } catch { toast.error("Failed to create battle"); }
  }, [currentSong, loadBattles, openBattle]);

  // Auto-create + enter Stage when arriving from Tracks tab with a pending song
  useEffect(() => {
    if (pendingBattleSong) {
      createBattle(pendingBattleSong);
      if (onPendingBattleConsumed) onPendingBattleConsumed();
    }
  }, [pendingBattleSong, createBattle, onPendingBattleConsumed]);

  const submitCover = useCallback(async () => {
    if (!recorder.recordedBlob || !username.trim()) {
      toast.error("Record your cover and enter a username first!");
      return;
    }
    localStorage.setItem("sidetrack_username", username);
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("title", `${username}'s Cover`);
      formData.append("file", recorder.recordedBlob, "cover.webm");
      const res = await axios.post(`${API}/battles/${selectedBattle.id}/submit`, formData);
      if (res.data.success) {
        toast.success("Cover submitted!");
        recorder.resetTake();
        setView("detail");
        openBattle(selectedBattle);
      }
    } catch { toast.error("Submission failed"); }
  }, [recorder, username, selectedBattle, openBattle]);

  const voteCover = useCallback(async (coverId) => {
    try {
      const formData = new FormData();
      formData.append("voter_id", voterId);
      const res = await axios.post(`${API}/battles/${selectedBattle.id}/vote/${coverId}`, formData);
      if (res.data.success) {
        setCovers((prev) => prev.map((c) => (c.id === coverId ? { ...c, votes: res.data.cover.votes } : c)));
        toast.success("Voted!");
      }
    } catch (err) {
      if (err.response?.status === 400) toast.info("Already voted!");
      else toast.error("Vote failed");
    }
  }, [voterId, selectedBattle]);

  // ── View dispatch ───────────────────────────────────────────────────
  if (view === "stage" && selectedBattle) {
    return <GamerStage battle={selectedBattle} onExit={() => setView("list")} />;
  }

  if (view === "submit" && selectedBattle) {
    return (
      <BattleSubmitView
        battle={selectedBattle}
        username={username}
        setUsername={setUsername}
        isRecording={recorder.isRecording}
        duration={recorder.duration}
        recordedBlob={recorder.recordedBlob}
        onStartRec={recorder.startRecording}
        onStopRec={recorder.stopRecording}
        onSubmit={submitCover}
        onBack={() => setView("detail")}
      />
    );
  }

  if (view === "detail" && selectedBattle) {
    return (
      <BattleDetailView
        battle={selectedBattle}
        covers={covers}
        playingCoverId={recorder.playingCoverId}
        onBack={() => { setView("list"); setCovers([]); }}
        onEnterSubmit={() => setView("submit")}
        onPlayCover={(cover) => recorder.playCoverAudio(cover, selectedBattle.id)}
        onVote={voteCover}
        onDuet={(cover) => onStartDuet && onStartDuet(selectedBattle, cover)}
      />
    );
  }

  return (
    <BattleStageListView
      battles={battles}
      leaderboard={leaderboard}
      stageSkin={stageSkin}
      skinPickerOpen={skinPickerOpen}
      onTogglePicker={() => setSkinPickerOpen((v) => !v)}
      onChangeSkin={changeSkin}
      onCreateBattle={createBattle}
      onOpenBattle={openBattle}
    />
  );
}
