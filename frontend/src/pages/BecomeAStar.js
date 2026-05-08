import { useState, useEffect, useRef, useCallback } from "react";
import { Star, Mic, Square, Play, Pause, ThumbsUp, ArrowLeft, Search, Trophy, TrendingUp, Camera, Video, Type, Calendar, Crown, ChevronRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const KARAOKE_LAYOUTS = [
  { key: "camera-lyrics", label: "Camera + Lyrics", icon: Camera },
  { key: "lyrics-only", label: "Lyrics Only", icon: Type },
  { key: "camera-only", label: "Camera Only", icon: Video },
];

export default function BecomeAStar() {
  const [view, setView] = useState("feed"); // feed | search | karaoke | challenge
  const [feed, setFeed] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeEntries, setChallengeEntries] = useState([]);
  const [challengeHistory, setChallengeHistory] = useState([]);
  const [joinChallenge, setJoinChallenge] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [karaokeLayout, setKaraokeLayout] = useState("camera-lyrics");
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [voterId] = useState(() => {
    let id = localStorage.getItem("sidetrack_voter_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); }
    return id;
  });

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const previewAudioRef = useRef(null);
  const feedAudioRef = useRef(null);

  useEffect(() => {
    loadFeed();
    loadLeaderboard();
    loadCurrentChallenge();
    return () => {
      stopAllStreams();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      if (feedAudioRef.current) feedAudioRef.current.pause();
    };
  }, []);

  const loadFeed = async () => {
    try {
      const res = await axios.get(`${API}/stars/feed?limit=30`);
      if (res.data.success) setFeed(res.data.performances);
    } catch (err) { console.error("Star load error:", err); }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await axios.get(`${API}/stars/leaderboard?limit=10`);
      if (res.data.success) setLeaderboard(res.data.leaderboard);
    } catch (err) { console.error("Star load error:", err); }
  };

  const loadCurrentChallenge = async () => {
    try {
      const res = await axios.get(`${API}/challenges/current`);
      if (res.data.success) setCurrentChallenge(res.data.challenge);
    } catch (err) { console.error("Star load error:", err); }
  };

  const loadChallengeEntries = async (challengeId) => {
    try {
      const res = await axios.get(`${API}/challenges/${challengeId}/entries`);
      if (res.data.success) setChallengeEntries(res.data.entries);
    } catch (err) { console.error("Star load error:", err); }
  };

  const loadChallengeHistory = async () => {
    try {
      const res = await axios.get(`${API}/challenges/history?limit=8`);
      if (res.data.success) setChallengeHistory(res.data.challenges);
    } catch (err) { console.error("Star load error:", err); }
  };

  const openChallenge = (challenge) => {
    loadChallengeEntries(challenge.id);
    loadChallengeHistory();
    setView("challenge");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/music/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      if (res.data?.success) setSearchResults(res.data.tracks);
    } catch (err) {
      console.error("Star search failed:", err);
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const selectSong = async (track) => {
    setSelectedSong(track);
    setView("karaoke");
    setRecordedBlob(null);
    setDuration(0);
    setCurrentTime(0);
    // Load lyrics for the song
    if (track.id) {
      try {
        const res = await axios.get(`${API}/songs/${track.id}/lyrics`);
        if (res.data.success) setLyrics(res.data);
      } catch (err) {
        console.error("Star lyrics load failed:", err);
        setLyrics(null);
      }
    }
  };

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startKaraoke = async () => {
    try {
      const needsVideo = karaokeLayout !== "lyrics-only";
      const constraints = needsVideo
        ? { audio: true, video: { facingMode: "user", width: 1280, height: 720 } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (needsVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mimeType = needsVideo ? "video/webm" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        stopAllStreams();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setCurrentTime(0);

      // Play backing track (iTunes preview) if available
      if (selectedSong?.preview_url) {
        const audio = new Audio(selectedSong.preview_url);
        audio.volume = 0.4;
        audio.play().catch(() => {});
        previewAudioRef.current = audio;
        audio.onended = () => stopKaraoke();
      }

      timerRef.current = setInterval(() => {
        setDuration((p) => p + 1);
        setCurrentTime((p) => p + 1);
      }, 1000);
    } catch (err) {
      console.error("Camera/mic access denied:", err);
      toast.error("Camera/microphone access denied");
    }
  };

  const stopKaraoke = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  const submitPerformance = async () => {
    if (!recordedBlob) { toast.error("Record your performance first!"); return; }
    if (!username.trim()) { toast.error("Enter your stage name!"); return; }
    localStorage.setItem("sidetrack_username", username);

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("song_title", selectedSong?.title || "Unknown");
      formData.append("song_artist", selectedSong?.artist || "");
      formData.append("song_cover_url", selectedSong?.cover_url || "");
      formData.append("song_id", selectedSong?.id || "");
      formData.append("title", `${username} sings ${selectedSong?.title || "a song"}`);
      formData.append("file", recordedBlob, "karaoke.webm");
      if (joinChallenge && currentChallenge?.id) {
        formData.append("challenge_id", currentChallenge.id);
      }

      const res = await axios.post(`${API}/stars`, formData);
      if (res.data.success) {
        toast.success(joinChallenge ? "Submitted to this week's challenge!" : "You're a star! Performance submitted!");
        setView("feed");
        setRecordedBlob(null);
        setSelectedSong(null);
        setJoinChallenge(false);
        loadFeed();
        loadLeaderboard();
        loadCurrentChallenge();
      }
    } catch (err) {
      console.error("Star submission failed:", err);
      toast.error("Submission failed. Try again.");
    }
  };

  const votePerformance = async (perfId) => {
    try {
      const formData = new FormData();
      formData.append("voter_id", voterId);
      const res = await axios.post(`${API}/stars/${perfId}/vote`, formData);
      if (res.data.success) {
        setFeed((prev) => prev.map((p) => p.id === perfId ? { ...p, votes: res.data.performance.votes } : p));
        setLeaderboard((prev) => prev.map((p) => p.id === perfId ? { ...p, votes: res.data.performance.votes } : p));
        toast.success("Voted!");
      }
    } catch (err) {
      if (err.response?.status === 400) toast.info("Already voted!");
      else toast.error("Vote failed");
    }
  };

  const playPerformanceAudio = async (perf) => {
    if (playingId === perf.id) {
      if (feedAudioRef.current) { feedAudioRef.current.pause(); feedAudioRef.current = null; }
      setPlayingId(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/stars/${perf.id}/audio`);
      if (res.data.success && res.data.audio_data) {
        const byteString = atob(res.data.audio_data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (feedAudioRef.current) feedAudioRef.current.pause();
        const audio = new Audio(url);
        audio.play();
        feedAudioRef.current = audio;
        setPlayingId(perf.id);
        audio.onended = () => setPlayingId(null);
      }
    } catch { toast.error("Playback failed"); }
  };

  const fmtDur = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const activeLyricIdx = lyrics?.lyrics
    ? (() => { for (let i = (lyrics.lyrics.length - 1); i >= 0; i--) { if (currentTime >= lyrics.lyrics[i].time) return i; } return 0; })()
    : 0;

  // --- KARAOKE VIEW ---
  if (view === "karaoke" && selectedSong) {
    const showCamera = karaokeLayout !== "lyrics-only";
    const showLyrics = karaokeLayout !== "camera-only";

    return (
      <div className="bg-[#05050A] flex flex-col max-w-full overflow-x-hidden" style={{ height: "calc(100vh - 4rem)" }} data-testid="karaoke-studio">
        {/* Header */}
        <div className="glass-heavy px-3 py-2 flex items-center gap-2 flex-shrink-0">
          <Button data-testid="karaoke-back-btn" variant="ghost" size="icon" onClick={() => { stopKaraoke(); setView("search"); }} className="text-[#A0A0B0] hover:text-white w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-['Outfit'] text-base font-bold truncate flex items-center gap-1.5">
              <Star className="w-4 h-4 text-[#FF6B00]" />
              Karaoke
            </h2>
            <p className="text-[10px] text-[#A0A0B0] truncate">{selectedSong.title} — {selectedSong.artist}</p>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-white">{fmtDur(duration)}</span>
            </div>
          )}
        </div>

        {/* Layout picker */}
        <div className="px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide" data-testid="karaoke-layout-selector">
          {KARAOKE_LAYOUTS.map((l) => (
            <Button key={l.key} data-testid={`karaoke-layout-${l.key}`}
              onClick={() => { if (!isRecording) setKaraokeLayout(l.key); }}
              className={`flex-shrink-0 h-8 px-3 rounded-full text-[10px] gap-1 transition-all ${
                karaokeLayout === l.key ? "bg-[#FF6B00] text-black" : "bg-[#12121A] text-[#606070] border border-white/10"
              }`}>
              <l.icon className="w-3 h-3" />{l.label}
            </Button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Camera section */}
          {showCamera && (
            <div className={`relative ${showLyrics ? "h-[45%]" : "flex-1"} bg-[#0A0A0F] flex-shrink-0 overflow-hidden`} data-testid="karaoke-camera">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              {!streamRef.current && !isRecording && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0F]">
                  <Camera className="w-10 h-10 text-[#FF6B00]/30 mb-2" />
                  <p className="text-xs text-[#606070]">Camera activates when you sing</p>
                </div>
              )}
              {/* Song info overlay */}
              <div className="absolute top-2 left-2 glass px-2 py-1 rounded-lg flex items-center gap-2">
                {selectedSong.cover_url && <img src={selectedSong.cover_url} alt="" className="w-6 h-6 rounded" />}
                <span className="text-[10px] text-white font-medium truncate max-w-[120px]">{selectedSong.title}</span>
              </div>
            </div>
          )}

          {/* Lyrics section */}
          {showLyrics && (
            <div className={`${showCamera ? "h-[55%]" : "flex-1"} bg-[#05050A] border-t border-white/5 overflow-hidden flex-shrink-0`} data-testid="karaoke-lyrics">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {lyrics?.lyrics ? lyrics.lyrics.map((line, i) => {
                    const lk = `${line.time}-${line.type}-${i}`;
                    if (line.type === "section") return (
                      <p key={lk} className={`text-xs uppercase tracking-[0.15em] font-bold mt-3 ${i === activeLyricIdx ? "text-[#FF6B00]" : "text-[#606070]"}`}>{line.text}</p>
                    );
                    if (line.type === "break") return <div key={lk} className="h-2" />;
                    return (
                      <p key={lk} className={`text-lg leading-relaxed transition-all duration-300 ${
                        i === activeLyricIdx ? "text-[#FF6B00] font-bold scale-[1.02]" : i < activeLyricIdx ? "text-[#606070]/40" : "text-[#A0A0B0]"
                      }`}>{line.text}</p>
                    );
                  }) : (
                    <div className="text-center py-8">
                      <Star className="w-8 h-8 text-[#FF6B00]/20 mx-auto mb-3" />
                      <p className="text-sm text-[#606070]">Lyrics sync during recording</p>
                      <p className="text-xs text-[#606070]/60 mt-1">Sing your heart out!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 flex flex-col gap-2 flex-shrink-0 glass-heavy border-t border-white/5">
          {/* Challenge join toggle */}
          {currentChallenge && !isRecording && (
            <button data-testid="challenge-join-toggle" onClick={() => setJoinChallenge(!joinChallenge)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium mx-auto transition-all border ${
                joinChallenge ? "bg-[#FF6B00]/10 border-[#FF6B00]/40 text-[#FF6B00]" : "bg-transparent border-white/10 text-[#606070]"
              }`}>
              <Flame className="w-3 h-3" />
              {joinChallenge ? `Entering: ${currentChallenge.title}` : `Join this week: ${currentChallenge.title}`}
            </button>
          )}

          {/* Record / Submit */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-mono text-[#606070] w-14 text-center">{fmtDur(duration)}</span>
            {!recordedBlob ? (
              <Button data-testid="karaoke-record-btn" onClick={isRecording ? stopKaraoke : startKaraoke}
                className={`w-16 h-16 rounded-full transition-all ${
                  isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-[#FF6B00] hover:bg-[#FF6B00]/80 text-black"
                }`}>
                {isRecording ? <Square className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7" />}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button data-testid="karaoke-redo-btn" onClick={() => setRecordedBlob(null)} variant="ghost" className="text-[#A0A0B0] text-sm">
                  Redo
                </Button>
                <Button data-testid="karaoke-submit-btn" onClick={submitPerformance}
                  className="h-12 px-6 bg-[#FF6B00] hover:bg-[#FF6B00]/80 text-black font-bold rounded-2xl gap-2">
                  <Star className="w-4 h-4" /> {joinChallenge ? "Submit to Challenge!" : "Become a Star!"}
                </Button>
              </div>
            )}
            <span className="text-sm font-mono text-[#606070] w-14 text-center">{recordedBlob ? "Done" : ""}</span>
          </div>

          {/* Username input (show when recorded) */}
          {recordedBlob && (
            <Input data-testid="star-username-input" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="Your stage name..."
              className="h-10 bg-[#12121A] border-white/10 text-white rounded-2xl text-center text-sm max-w-xs mx-auto" />
          )}
        </div>
      </div>
    );
  }

  // --- CHALLENGE DETAIL VIEW ---
  if (view === "challenge" && currentChallenge) {
    const daysLeft = (() => {
      const end = new Date(currentChallenge.end_date);
      const now = new Date();
      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return Math.max(0, diff);
    })();

    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="challenge-detail">
        {/* Header */}
        <div className="glass-heavy px-3 py-2 flex items-center gap-2">
          <Button data-testid="challenge-back-btn" variant="ghost" size="icon" onClick={() => setView("feed")} className="text-[#A0A0B0] hover:text-white w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-['Outfit'] text-base font-bold truncate flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#FF6B00]" /> Weekly Challenge
            </h2>
          </div>
          <Button data-testid="challenge-join-btn" onClick={() => { setJoinChallenge(true); setView("search"); }}
            className="h-8 px-3 bg-[#FF6B00] hover:bg-[#FF6B00]/80 text-white rounded-2xl text-xs font-bold gap-1">
            <Mic className="w-3 h-3" /> Enter
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="px-4 py-4 space-y-5 pb-24">
            {/* Challenge Banner */}
            <div className="rounded-2xl p-5 relative overflow-hidden" data-testid="challenge-banner"
              style={{ background: "linear-gradient(135deg, #FF6B00 0%, #39FF14 100%)" }}>
              <div className="relative z-10">
                <p className="text-xs uppercase tracking-[0.2em] font-bold text-white/70 mb-1">This Week's Challenge</p>
                <h3 className="font-['Outfit'] text-2xl font-extrabold text-white">{currentChallenge.title}</h3>
                <p className="text-sm text-white/80 mt-1">{currentChallenge.description}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /> {daysLeft} days left</span>
                  <span className="text-xs text-white/60">{currentChallenge.entry_count || 0} entries</span>
                </div>
              </div>
            </div>

            {/* Star of the Week */}
            {currentChallenge.star_of_week && (
              <div className="surface-card p-4" data-testid="star-of-week">
                <h4 className="font-['Outfit'] text-sm uppercase tracking-[0.15em] font-bold text-[#FF6B00] mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4" /> Star of the Week
                </h4>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#FF6B00] p-[2px]">
                    <div className="w-full h-full rounded-2xl overflow-hidden">
                      {currentChallenge.star_of_week.song_cover_url ? (
                        <img src={currentChallenge.star_of_week.song_cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#12121A] flex items-center justify-center"><Crown className="w-6 h-6 text-[#FF6B00]" /></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-['Outfit'] font-bold text-white">{currentChallenge.star_of_week.username}</p>
                    <p className="text-xs text-[#606070] truncate">{currentChallenge.star_of_week.song_title}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Star className="w-4 h-4 text-[#FF6B00]" />
                    <span className="text-lg font-bold text-[#FF6B00]">{currentChallenge.star_of_week.votes}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Challenge Entries */}
            <section data-testid="challenge-entries">
              <h4 className="font-['Outfit'] text-sm uppercase tracking-[0.15em] font-bold text-[#A0A0B0] mb-3">
                Entries ({challengeEntries.length})
              </h4>
              {challengeEntries.length === 0 && (
                <div className="surface-card p-6 text-center">
                  <Flame className="w-10 h-10 text-[#FF6B00]/20 mx-auto mb-2" />
                  <p className="text-sm text-[#606070]">No entries yet — be the first!</p>
                </div>
              )}
              <div className="space-y-2">
                {challengeEntries.map((perf, idx) => (
                  <div key={perf.id} className="surface-card p-3 flex items-center gap-3" data-testid={`challenge-entry-${idx}`}>
                    {idx === 0 && perf.votes > 0 && (
                      <div className="w-6 flex-shrink-0"><Crown className="w-5 h-5 text-[#FF6B00]" /></div>
                    )}
                    {(idx !== 0 || perf.votes === 0) && (
                      <div className="w-6 text-center flex-shrink-0"><span className="text-xs text-[#606070] font-bold">{idx + 1}</span></div>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => playPerformanceAudio(perf)} className="flex-shrink-0 text-[#FF6B00]">
                      {playingId === perf.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="#FF6B00" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{perf.username}</p>
                      <p className="text-xs text-[#606070] truncate">{perf.song_title}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-sm font-bold text-[#FF6B00]">{perf.votes}</span>
                      <Button onClick={() => votePerformance(perf.id)} variant="ghost" size="icon" className="text-[#A0A0B0] hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded-full">
                        <ThumbsUp className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Past Challenges */}
            {challengeHistory.length > 1 && (
              <section data-testid="past-challenges">
                <h4 className="font-['Outfit'] text-sm uppercase tracking-[0.15em] font-bold text-[#A0A0B0] mb-3">
                  Past Challenges
                </h4>
                <div className="space-y-2">
                  {challengeHistory.slice(1).map((ch, idx) => (
                    <div key={ch.id} className="surface-card p-3 flex items-center gap-3" data-testid={`past-challenge-${idx}`}>
                      <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4 text-[#FF6B00]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{ch.title}</p>
                        <p className="text-xs text-[#606070]">
                          {ch.star_of_week ? `Winner: ${ch.star_of_week.username}` : "No winner"} &bull; {ch.entry_count} entries
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // --- SEARCH VIEW ---
  if (view === "search") {
    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="star-search">
        <div className="glass-heavy px-3 py-2 flex items-center gap-2">
          <Button data-testid="search-back-btn" variant="ghost" size="icon" onClick={() => setView("feed")} className="text-[#A0A0B0] hover:text-white w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-['Outfit'] text-base font-bold flex items-center gap-1.5">
            <Star className="w-4 h-4 text-[#FF6B00]" /> Pick Your Song
          </h2>
        </div>

        <div className="px-4 py-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#606070]" />
              <Input data-testid="star-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search songs to sing..."
                className="pl-10 h-11 bg-[#12121A] border-white/10 text-white placeholder:text-[#606070] rounded-2xl focus:border-[#FF6B00]" />
            </div>
            <Button data-testid="star-search-btn" onClick={handleSearch} disabled={searching}
              className="h-11 px-5 bg-[#FF6B00] hover:bg-[#FF6B00]/80 text-black font-bold rounded-2xl">
              {searching ? "..." : "Search"}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="px-4 space-y-1 pb-24">
            {searchResults.length === 0 && !searching && (
              <div className="text-center py-12">
                <Mic className="w-10 h-10 text-[#FF6B00]/20 mx-auto mb-3" />
                <p className="text-sm text-[#606070]">{searchQuery ? "No results" : "Search for a song to perform"}</p>
              </div>
            )}
            {searchResults.map((track, idx) => (
              <div key={track.id || idx} onClick={() => selectSong(track)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#FF6B00]/5 cursor-pointer transition-all group" data-testid={`star-track-${idx}`}>
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  {track.cover_url ? (
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-[#12121A] flex items-center justify-center"><Mic className="w-4 h-4 text-[#606070]" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#FF6B00]">{track.title}</p>
                  <p className="text-xs text-[#606070] truncate">{track.artist}</p>
                </div>
                <Star className="w-4 h-4 text-[#FF6B00]/30 group-hover:text-[#FF6B00] flex-shrink-0" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // --- MAIN FEED + LEADERBOARD VIEW ---
  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="become-a-star">
      {/* Header */}
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-[#FF6B00]" />
            <span className="text-white">Become a</span>
            <span className="text-[#FF6B00]">Star</span>
          </h1>
          <p className="text-[#606070] text-xs mt-1">Sing karaoke. Get votes. Rise to fame.</p>
        </div>
        <Button data-testid="sing-now-btn" onClick={() => setView("search")}
          className="h-10 px-4 bg-[#FF6B00] hover:bg-[#FF6B00]/80 text-black rounded-2xl text-sm font-bold gap-1.5"
          style={{ boxShadow: "0 0 20px rgba(255,107,0,0.3)" }}>
          <Mic className="w-4 h-4" /> Sing Now
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="px-4 space-y-6 pb-24">
          {/* Weekly Challenge Banner */}
          {currentChallenge && (
            <section data-testid="challenge-card">
              <button onClick={() => openChallenge(currentChallenge)}
                className="w-full rounded-2xl p-4 relative overflow-hidden text-left transition-all hover:scale-[1.01]"
                style={{ background: "linear-gradient(135deg, #FF6B00 0%, #39FF14 100%)" }}>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">Weekly Challenge</p>
                    <h3 className="font-['Outfit'] text-lg font-extrabold text-white mt-0.5">{currentChallenge.title}</h3>
                    <p className="text-xs text-white/70 mt-0.5">{currentChallenge.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-white/50">{currentChallenge.entry_count || 0} entries</span>
                      {currentChallenge.star_of_week && (
                        <span className="text-[10px] text-[#FF6B00] flex items-center gap-1"><Crown className="w-2.5 h-2.5" />{currentChallenge.star_of_week.username}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/50 flex-shrink-0" />
                </div>
              </button>
            </section>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <section data-testid="star-leaderboard">
              <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#FF6B00]" /> Rising Stars
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {leaderboard.slice(0, 5).map((perf, idx) => (
                  <div key={perf.id} className="flex-shrink-0 w-40 surface-card p-3 relative cursor-pointer hover:border-[#FF6B00]/30 transition-all" onClick={() => playPerformanceAudio(perf)} data-testid={`star-leader-${idx}`}>
                    {idx === 0 && <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#FF6B00] rounded-full flex items-center justify-center"><Trophy className="w-3 h-3 text-black" /></div>}
                    {perf.song_cover_url && <img src={perf.song_cover_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2" />}
                    <p className="text-xs font-medium text-white truncate">{perf.username}</p>
                    <p className="text-[10px] text-[#606070] truncate">{perf.song_title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-[#FF6B00]" />
                      <span className="text-xs font-bold text-[#FF6B00]">{perf.votes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Feed */}
          <section data-testid="star-feed">
            <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#FF6B00]" /> Latest Performances
            </h3>
            {feed.length === 0 && (
              <div className="surface-card p-8 text-center">
                <Star className="w-12 h-12 text-[#FF6B00]/15 mx-auto mb-3" />
                <p className="text-sm text-[#606070] mb-2">No performances yet</p>
                <p className="text-xs text-[#FF6B00]/60">Be the first star! Tap "Sing Now" to get started.</p>
              </div>
            )}
            <div className="space-y-2">
              {feed.map((perf, idx) => (
                <div key={perf.id} className="surface-card p-3 flex items-center gap-3" data-testid={`star-perf-${idx}`}>
                  <Button data-testid={`star-play-${idx}`} variant="ghost" size="icon" onClick={() => playPerformanceAudio(perf)} className="flex-shrink-0 text-[#FF6B00]">
                    {playingId === perf.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" fill="#FF6B00" />}
                  </Button>
                  {perf.song_cover_url && (
                    <img src={perf.song_cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{perf.title}</p>
                    <p className="text-xs text-[#606070] truncate">by {perf.username} &bull; {perf.song_title}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-bold text-[#FF6B00]">{perf.votes}</span>
                    <Button data-testid={`star-vote-${idx}`} onClick={() => votePerformance(perf.id)} variant="ghost" size="icon" className="text-[#A0A0B0] hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded-full">
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
