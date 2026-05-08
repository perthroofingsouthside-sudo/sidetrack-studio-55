import { useState, useEffect, useRef, useCallback } from "react";
import { Swords, Trophy, Play, Pause, ThumbsUp, Plus, Mic, Square, ArrowLeft, Users, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function BattleArena({ currentSong, onStartDuet }) {
  const [view, setView] = useState("list"); // list | detail | submit | leaderboard
  const [battles, setBattles] = useState([]);
  const [selectedBattle, setSelectedBattle] = useState(null);
  const [covers, setCovers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playingCoverId, setPlayingCoverId] = useState(null);
  const [voterId] = useState(() => {
    let id = localStorage.getItem("sidetrack_voter_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); }
    return id;
  });

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadBattles();
    loadLeaderboard();
  }, []);

  const loadBattles = async () => {
    try {
      const res = await axios.get(`${API}/battles?status=active&limit=20`);
      if (res.data.success) setBattles(res.data.battles);
    } catch (err) { /* empty */ }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await axios.get(`${API}/battles/leaderboard/top?limit=10`);
      if (res.data.success) setLeaderboard(res.data.leaderboard);
    } catch (err) { /* empty */ }
  };

  const openBattle = async (battle) => {
    setSelectedBattle(battle);
    setView("detail");
    try {
      const res = await axios.get(`${API}/battles/${battle.id}`);
      if (res.data.success) {
        setSelectedBattle(res.data.battle);
        setCovers(res.data.covers);
      }
    } catch (err) { toast.error("Failed to load battle"); }
  };

  const createBattle = async () => {
    if (!currentSong) {
      toast.info("Select a song from Stream or Discover first!");
      return;
    }
    try {
      const res = await axios.post(`${API}/battles`, {
        song_title: currentSong.title,
        song_artist: currentSong.artist,
        song_cover_url: currentSong.cover_url || "",
        challenge_text: `Cover "${currentSong.title}" by ${currentSong.artist}!`,
      });
      if (res.data.success) {
        toast.success("Battle created!");
        loadBattles();
        openBattle(res.data.battle);
      }
    } catch (err) { toast.error("Failed to create battle"); }
  };

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setRecordedBlob(null);
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } catch (err) { toast.error("Microphone access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const submitCover = async () => {
    if (!recordedBlob || !username.trim()) {
      toast.error("Record your cover and enter a username first!");
      return;
    }
    localStorage.setItem("sidetrack_username", username);
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("title", `${username}'s Cover`);
      formData.append("file", recordedBlob, "cover.webm");
      const res = await axios.post(`${API}/battles/${selectedBattle.id}/submit`, formData);
      if (res.data.success) {
        toast.success("Cover submitted!");
        setRecordedBlob(null);
        setView("detail");
        openBattle(selectedBattle);
      }
    } catch (err) { toast.error("Submission failed"); }
  };

  const voteCover = async (coverId) => {
    try {
      const formData = new FormData();
      formData.append("voter_id", voterId);
      const res = await axios.post(`${API}/battles/${selectedBattle.id}/vote/${coverId}`, formData);
      if (res.data.success) {
        setCovers((prev) => prev.map((c) => c.id === coverId ? { ...c, votes: res.data.cover.votes } : c));
        toast.success("Voted!");
      }
    } catch (err) {
      if (err.response?.status === 400) toast.info("Already voted!");
      else toast.error("Vote failed");
    }
  };

  const playCoverAudio = async (cover) => {
    if (playingCoverId === cover.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingCoverId(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/battles/${selectedBattle.id}/cover/${cover.id}/audio`);
      if (res.data.success && res.data.audio_data) {
        const byteString = atob(res.data.audio_data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(url);
        audio.play();
        audioRef.current = audio;
        setPlayingCoverId(cover.id);
        audio.onended = () => setPlayingCoverId(null);
      }
    } catch (err) { toast.error("Playback failed"); }
  };

  const fmtDur = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // --- VIEWS ---
  if (view === "submit" && selectedBattle) {
    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="battle-submit">
        <div className="glass-heavy px-4 py-3 flex items-center gap-3">
          <Button data-testid="submit-back-btn" variant="ghost" size="icon" onClick={() => setView("detail")} className="text-[#A0A0B0]"><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="font-['Outfit'] text-lg font-bold">Record Your Cover</h2>
            <p className="text-xs text-[#A0A0B0]">{selectedBattle.song_title} - {selectedBattle.song_artist}</p>
          </div>
        </div>
        <div className="px-4 py-6 flex flex-col items-center gap-6">
          <Input data-testid="username-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username..." className="max-w-sm h-11 bg-[#12121A] border-white/10 text-white rounded-2xl text-center" />
          <div className="relative">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center border transition-all ${isRecording ? "bg-red-500/20 border-red-500/50 animate-rec-pulse" : "bg-[#12121A] border-white/10"}`}>
              <Mic className={`w-12 h-12 ${isRecording ? "text-red-400" : "text-[#FF6B00]"}`} />
            </div>
            {isRecording && <div className="absolute inset-0 w-32 h-32 rounded-full border border-red-500/30 animate-pulse-ring" />}
          </div>
          <span className="text-2xl font-mono font-bold" data-testid="rec-duration">{fmtDur(duration)}</span>
          {isRecording && <div className="flex items-center gap-[2px] h-8">{Array.from({ length: 25 }).map((_, i) => (<div key={`wave-${i}`} className="w-[3px] bg-red-500 rounded-full" style={{ animation: "waveform 0.6s ease-in-out infinite", animationDelay: `${i * 0.04}s`, height: "4px" }} />))}</div>}
          <Button data-testid="rec-toggle-btn" onClick={isRecording ? stopRecording : startRecording} className={`w-20 h-20 rounded-full ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-[#FF6B00] hover:bg-[#FF8533] glow-orange"}`}>
            {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
          </Button>
          {recordedBlob && (
            <Button data-testid="submit-cover-btn" onClick={submitCover} className="w-full max-w-sm h-12 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-bold rounded-2xl glow-cyan">
              <Swords className="w-5 h-5 mr-2" /> Submit Cover
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedBattle) {
    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="battle-detail">
        <div className="glass-heavy px-4 py-3 flex items-center gap-3">
          <Button data-testid="detail-back-btn" variant="ghost" size="icon" onClick={() => { setView("list"); setCovers([]); }} className="text-[#A0A0B0]"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold truncate">{selectedBattle.song_title}</h2>
            <p className="text-xs text-[#A0A0B0] truncate">{selectedBattle.song_artist}</p>
          </div>
          <Button data-testid="enter-battle-btn" onClick={() => setView("submit")} className="h-9 px-4 bg-[#FF6B00] hover:bg-[#FF8533] rounded-2xl text-sm font-bold gap-1.5">
            <Mic className="w-3.5 h-3.5" /> Enter
          </Button>
        </div>
        {/* Battle header */}
        <div className="px-4 py-4">
          <div className="surface-card p-4 flex items-center gap-4">
            {selectedBattle.song_cover_url && (
              <img src={selectedBattle.song_cover_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
            )}
            <div>
              <p className="text-sm text-[#A0A0B0]">{selectedBattle.challenge_text || "Record your best cover!"}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-[#FF6B00] flex items-center gap-1"><Users className="w-3 h-3" />{selectedBattle.cover_count || 0} covers</span>
                <span className="text-xs text-[#606070]">{selectedBattle.status}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Covers list */}
        <div className="px-4">
          <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FF6B00]" /> Covers
          </h3>
          {covers.length === 0 && (
            <div className="surface-card p-8 text-center">
              <Swords className="w-10 h-10 text-[#FF6B00]/30 mx-auto mb-3" />
              <p className="text-sm text-[#606070]">No covers yet. Be the first!</p>
            </div>
          )}
          <div className="space-y-2 pb-24">
            {covers.map((cover, idx) => (
              <div key={cover.id} className={`surface-card p-3 flex items-center gap-3 ${idx === 0 && cover.votes > 0 ? "border-[#FF6B00]/30" : ""}`} data-testid={`cover-${idx}`}>
                <div className="w-8 text-center flex-shrink-0">
                  {idx === 0 && cover.votes > 0 ? <Trophy className="w-5 h-5 text-[#FF6B00] mx-auto" /> : <span className="text-sm text-[#606070] font-bold">{idx + 1}</span>}
                </div>
                <Button data-testid={`play-cover-${idx}`} variant="ghost" size="icon" onClick={() => playCoverAudio(cover)} className="flex-shrink-0 text-[#FF6B00]">
                  {playingCoverId === cover.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="#FF6B00" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{cover.title}</p>
                  <p className="text-xs text-[#606070]">by {cover.username}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-bold text-[#39FF14]">{cover.votes}</span>
                  <Button data-testid={`vote-cover-${idx}`} onClick={() => voteCover(cover.id)} variant="ghost" size="icon" className="text-[#A0A0B0] hover:text-[#39FF14] hover:bg-[#39FF14]/10 rounded-full">
                    <ThumbsUp className="w-4 h-4" />
                  </Button>
                  <Button data-testid={`duet-cover-${idx}`} onClick={() => onStartDuet && onStartDuet(selectedBattle, cover)} variant="ghost" size="icon" className="text-[#A0A0B0] hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded-full" title="Duet with this cover">
                    <Users className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List + Leaderboard view
  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="battle-arena">
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Swords className="w-6 h-6 text-[#FF6B00]" />
            <span className="text-white">Cover</span>
            <span className="text-[#39FF14]">Battle</span>
          </h1>
          <p className="text-[#606070] text-xs mt-1">Record covers, get votes, climb the ranks</p>
        </div>
        <Button data-testid="create-battle-btn" onClick={createBattle} className="h-10 px-4 bg-[#FF6B00] hover:bg-[#FF8533] rounded-2xl text-sm font-bold gap-1.5 glow-orange">
          <Plus className="w-4 h-4" /> New Battle
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="px-4 space-y-6 pb-24">
          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <section data-testid="leaderboard-section">
              <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#FF6B00]" /> Top Covers
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {leaderboard.slice(0, 5).map((cover, idx) => (
                  <div key={cover.id} className="flex-shrink-0 w-40 surface-card p-3 relative">
                    {idx === 0 && <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#FF6B00] rounded-full flex items-center justify-center"><Trophy className="w-3 h-3 text-black" /></div>}
                    {cover.song_cover_url && <img src={cover.song_cover_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2" />}
                    <p className="text-xs font-medium text-white truncate">{cover.title}</p>
                    <p className="text-[10px] text-[#606070] truncate">{cover.song_title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <ThumbsUp className="w-3 h-3 text-[#39FF14]" />
                      <span className="text-xs font-bold text-[#39FF14]">{cover.votes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active Battles */}
          <section data-testid="active-battles">
            <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#FF3B30]" /> Active Battles
            </h3>
            {battles.length === 0 && (
              <div className="surface-card p-8 text-center">
                <Swords className="w-12 h-12 text-[#FF6B00]/20 mx-auto mb-3" />
                <p className="text-sm text-[#606070] mb-3">No active battles yet</p>
                <p className="text-xs text-[#FF6B00]">Select a song and create the first battle!</p>
              </div>
            )}
            <div className="space-y-2">
              {battles.map((battle) => (
                <div key={battle.id} onClick={() => openBattle(battle)} className="surface-card p-4 flex items-center gap-3 cursor-pointer hover:border-[#FF6B00]/30 transition-all group" data-testid={`battle-card-${battle.id}`}>
                  {battle.song_cover_url ? (
                    <img src={battle.song_cover_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#FF6B00]/10 flex items-center justify-center flex-shrink-0"><Swords className="w-6 h-6 text-[#FF6B00]" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-[#FF6B00] transition-colors">{battle.song_title}</p>
                    <p className="text-xs text-[#606070] truncate">{battle.song_artist}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-[#FF6B00] flex items-center gap-1"><Users className="w-3 h-3" />{battle.cover_count || 0} covers</span>
                    </div>
                  </div>
                  <Swords className="w-5 h-5 text-[#606070] group-hover:text-[#FF6B00] transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
