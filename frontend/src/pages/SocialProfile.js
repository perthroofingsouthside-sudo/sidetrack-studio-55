import { useState, useEffect, useRef, useCallback } from "react";
import { User, Trophy, Star, ListMusic, Mic2, TrendingUp, Settings, Share2, Users, Heart, Camera, Sparkles, Swords, Eye, Play, Pause, Radio, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import GamerAvatar, { DEFAULT_GAMER_AVATAR } from "@/components/GamerAvatar";
import CreationLab from "@/components/CreationLab";

// Gamer avatar — palette swatches used for the profile card background gradient.
// Strict Pocket Products brand: only Neon Orange and Electric Green tones.
const GAMER_PALETTES = [
  { key: "neon-green", from: "#39FF14", to: "#0F1A0F" },
  { key: "neon-orange", from: "#FF6B00", to: "#1A0F08" },
  { key: "split", from: "#FF6B00", to: "#39FF14" },
  { key: "ember", from: "#FFA64D", to: "#1A0F08" },
  { key: "mint", from: "#7FFF8E", to: "#0F1A0F" },
];

export default function SocialProfile({ onNavigate }) {
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState(username);
  const [liveStats, setLiveStats] = useState(null);
  const [lane] = useState(() => localStorage.getItem("pp_lane") || "creator");
  const [photoUrl, setPhotoUrl] = useState(() => localStorage.getItem("pp_profile_photo") || "");
  const [gamerAvatar, setGamerAvatar] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("pp_gamer_avatar") || "null");
      return { ...DEFAULT_GAMER_AVATAR, palette: "neon-orange", ...(stored || {}) };
    } catch {
      return { ...DEFAULT_GAMER_AVATAR, palette: "neon-orange" };
    }
  });
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  // New profile data — Battle stats, playlists, kept recordings ("My Raps")
  const [battleSnapshot, setBattleSnapshot] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [raps, setRaps] = useState([]);
  const [playingRap, setPlayingRap] = useState(null);
  const rapAudioRef = useRef(null);
  const fileInputRef = useRef(null);
  const userId = useRef(
    localStorage.getItem("sidetrack_voter_id") ||
      (() => { const id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); return id; })()
  );

  useEffect(() => {
    loadLiveStats();
    loadProfileExtras();
    return () => { if (rapAudioRef.current) rapAudioRef.current.pause(); };
  }, []);

  const loadProfileExtras = useCallback(async () => {
    const uid = userId.current;
    try {
      const [battle, pls, recs] = await Promise.all([
        axios.get(`${API}/rap-battles/me/${encodeURIComponent(uid)}`),
        axios.get(`${API}/playlists`, { params: { owner: uid } }),
        axios.get(`${API}/gamer/recordings/${encodeURIComponent(uid)}?status=kept&limit=12`),
      ]);
      setBattleSnapshot(battle.data || null);
      setPlaylists(pls.data?.playlists || []);
      setRaps(recs.data?.recordings || []);
    } catch (err) {
      console.error("[Profile] extras load failed:", err);
    }
  }, []);

  const togglePlayRap = (rec) => {
    if (!rec.blob_url) { toast.message("No playback file"); return; }
    if (playingRap === rec.id) {
      rapAudioRef.current?.pause();
      setPlayingRap(null);
      return;
    }
    if (rapAudioRef.current) rapAudioRef.current.pause();
    const audio = new Audio(rec.blob_url);
    audio.onended = () => setPlayingRap(null);
    audio.onerror = () => { setPlayingRap(null); toast.error("Playback unavailable"); };
    audio.play().catch(() => { setPlayingRap(null); toast.error("Playback blocked"); });
    rapAudioRef.current = audio;
    setPlayingRap(rec.id);
  };

  const loadLiveStats = async () => {
    const uname = localStorage.getItem("sidetrack_username") || userId.current;
    try {
      const res = await axios.get(`${API}/social/${uname}/stats`);
      if (res.data.success) setLiveStats(res.data.stats);
    } catch (err) { console.error("Load failed:", err); }
  };

  const saveName = () => {
    if (tempName.trim()) {
      localStorage.setItem("sidetrack_username", tempName.trim());
      setUsername(tempName.trim());
      setEditing(false);
      toast.success("Profile updated!");
    }
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Photo must be under 4MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPhotoUrl(dataUrl);
      localStorage.setItem("pp_profile_photo", dataUrl);
      toast.success("Photo updated!");
    };
    reader.onerror = () => toast.error("Couldn't read file");
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoUrl("");
    localStorage.removeItem("pp_profile_photo");
    toast.message("Photo removed");
  };

  const updateGamerAvatar = (patch) => {
    const next = { ...gamerAvatar, ...patch };
    setGamerAvatar(next);
    localStorage.setItem("pp_gamer_avatar", JSON.stringify(next));
  };

  const currentPalette = GAMER_PALETTES.find(p => p.key === gamerAvatar.palette) || GAMER_PALETTES[1];

  // Aggregate likes + views across kept raps (used in stats card)
  const totalRapLikes = raps.reduce((s, r) => s + (r.likes || 0), 0);
  const totalRapViews = raps.reduce((s, r) => s + (r.views || 0), 0);
  const battleWins = battleSnapshot?.user?.lifetime_wins ?? 0;
  const battleLosses = battleSnapshot?.user?.lifetime_losses ?? 0;

  const stats = [
    { label: "Battle Wins",  value: battleWins,                       icon: Trophy,    color: "#FF6B00", testId: "stat-wins" },
    { label: "Battle Losses", value: battleLosses,                    icon: Swords,    color: "#5C5C6B", testId: "stat-losses" },
    { label: "Likes",        value: (liveStats?.total_votes ?? 0) + totalRapLikes, icon: Heart, color: "#39FF14", testId: "stat-likes" },
    { label: "Views",        value: totalRapViews + (liveStats?.battles ?? 0) * 10, icon: Eye, color: "#39FF14", testId: "stat-views" },
  ];

  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="social-profile">
      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="px-4 sm:px-6 py-6 space-y-6 pb-24 max-w-lg mx-auto">
          {/* Profile Card */}
          <div className="relative rounded-2xl overflow-hidden" data-testid="profile-card">
            <div className="h-28 opacity-25" style={{
              background: lane === "gamer"
                ? `linear-gradient(90deg, ${currentPalette.from}, ${currentPalette.to})`
                : "linear-gradient(90deg, #FF6B00, #39FF14)",
            }} />
            <div className="px-5 pb-5 -mt-10">
              {/* AVATAR — lane-aware (Creator: photo / Gamer: Creation Lab character) */}
              {lane === "gamer" ? (
                <button
                  onClick={() => setShowAvatarBuilder(true)}
                  data-testid="gamer-avatar-edit"
                  className="group w-20 h-20 rounded-2xl border-4 border-[#05050A] relative overflow-hidden transition-transform hover:scale-[1.03]"
                  style={{
                    background: `linear-gradient(135deg, ${currentPalette.from} 0%, ${currentPalette.to} 100%)`,
                    boxShadow: `0 0 30px ${currentPalette.from}66`,
                  }}
                  title="Open Creation Lab"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GamerAvatar avatar={gamerAvatar} size={88} glowColor={currentPalette.from} showInstrument={false} />
                  </div>
                  <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#05050A]/85 border border-[#39FF14]/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles className="w-2.5 h-2.5 text-[#39FF14]" />
                  </span>
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="creator-photo-edit"
                    className="group w-20 h-20 rounded-2xl bg-[#0F0F16] border-4 border-[#05050A] flex items-center justify-center relative overflow-hidden transition-transform hover:scale-[1.03] shadow-[0_0_30px_rgba(255,107,0,0.3)]"
                    title="Upload profile photo"
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" data-testid="creator-photo-img" />
                    ) : (
                      <User className="w-8 h-8 text-[#FF6B00]" />
                    )}
                    <span className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-5 h-5 text-white" />
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoPick}
                    className="hidden"
                    data-testid="creator-photo-input"
                  />
                  {photoUrl && (
                    <button
                      onClick={clearPhoto}
                      data-testid="creator-photo-clear"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center"
                      title="Remove photo"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                {editing ? (
                  <div className="flex gap-2 flex-1">
                    <Input value={tempName} onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      className="h-9 bg-[#0F0F16] border-white/10 text-white rounded-xl text-sm"
                      data-testid="profile-name-input" autoFocus />
                    <Button onClick={saveName} className="h-9 px-3 bg-[#FF6B00] rounded-xl text-xs" data-testid="profile-save-btn">Save</Button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-['Outfit'] text-xl font-black text-white" data-testid="profile-username">
                      {username || "Set your stage name"}
                    </h2>
                    <Button variant="ghost" onClick={() => { setTempName(username); setEditing(true); }}
                      className="text-[#5C5C6B] text-xs" data-testid="profile-edit-btn">
                      <Settings className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-[#5C5C6B] mt-1">Pocket Products member</p>

              {/* Follower counts */}
              {liveStats && (
                <div className="flex items-center gap-4 mt-2" data-testid="follow-counts">
                  <span className="text-xs text-white font-bold">{liveStats.followers ?? 0} <span className="text-[#5C5C6B] font-normal">followers</span></span>
                  <span className="text-xs text-white font-bold">{liveStats.following ?? 0} <span className="text-[#5C5C6B] font-normal">following</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Free Access — everything unlocked */}
          <button onClick={() => onNavigate && onNavigate("pricing")}
            className="w-full rounded-2xl border border-[#39FF14]/25 p-4 flex items-center gap-4 text-left transition-all hover:border-[#39FF14]/50 group"
            style={{ background: "rgba(57,255,20,0.05)" }} data-testid="free-access-card">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(57,255,20,0.15)", boxShadow: "0 0 16px rgba(57,255,20,0.25)" }}>
              <Sparkles className="w-5 h-5 text-[#39FF14]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white group-hover:text-[#39FF14] transition-colors">Everything Unlocked — Free</p>
              <p className="text-[10px] text-[#5C5C6B] mt-0.5">All lanes, Studio, Battles, Learn & Backstage. Artists keep 70% of their sales.</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#39FF14]/15 text-[#39FF14] shrink-0" data-testid="free-badge">Free</span>
          </button>

          {/* Stats Grid — Live from DB + Rap Battle lifetime W/L */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="profile-stats">
            {stats.map((s) => (
              <div key={s.label} className="surface-card p-4 text-center" data-testid={s.testId}>
                <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
                <p className="text-2xl font-['Outfit'] font-black text-white">{s.value}</p>
                <p className="text-[10px] text-[#5C5C6B] uppercase tracking-[0.15em] font-bold mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* BATTLE STATUS — current active match + recent battles */}
          <BattleStatusSection snapshot={battleSnapshot} onNavigate={onNavigate} />

          {/* PERSONAL PLAYLISTS — curated from Discover */}
          <PlaylistsSection playlists={playlists} onNavigate={onNavigate} />

          {/* MY RAPS — 60-second raps the user has kept */}
          <MyRapsSection raps={raps} playingId={playingRap} onToggle={togglePlayRap} />

          {/* Share Profile */}
          <Button variant="ghost" className="w-full border border-white/5 text-[#5C5C6B] gap-2 rounded-2xl" data-testid="share-profile-btn">
            <Share2 className="w-4 h-4" /> Share Profile
          </Button>
        </div>
      </ScrollArea>

      {/* Gamer Avatar Builder Modal */}
      {/* Bitmoji-style Creation Lab — Gamer-lane only */}
      {lane === "gamer" && (
        <CreationLab
          open={showAvatarBuilder}
          avatar={gamerAvatar}
          onClose={() => setShowAvatarBuilder(false)}
          onSave={(next) => updateGamerAvatar(next)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function BattleStatusSection({ snapshot, onNavigate }) {
  const active = snapshot?.active_battle;
  const inQueue = snapshot?.in_queue;
  const history = (snapshot?.history || []).slice(0, 5);

  return (
    <section data-testid="profile-battle-status">
      <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.25em] font-black text-[#FF6B00] mb-2 flex items-center gap-1.5">
        <Swords className="w-3.5 h-3.5" /> Battle Status
      </h3>

      {active ? (
        <button
          onClick={() => onNavigate && onNavigate("connect")}
          data-testid="profile-active-battle"
          className="w-full text-left rounded-2xl border border-[#FF6B00]/40 p-3.5 flex items-center gap-3 hover:border-[#FF6B00]/70 transition-all"
          style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.10), rgba(57,255,20,0.04))", boxShadow: "0 0 18px rgba(255,107,0,0.18)" }}
        >
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#FF6B00]/20 flex-shrink-0">
            <Radio className={`w-5 h-5 text-[#FF6B00] ${active.status === "live" ? "animate-pulse" : ""}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">
              vs <span className="text-[#39FF14]">{active.user_a === snapshot.user?.user_id ? active.profile_b.display_name : active.profile_a.display_name}</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#FF6B00] font-bold">
              {active.status === "pending_agreement" ? "Awaiting agreement"
                : active.status === "agreed" ? "Ready to go live"
                : "LIVE — drop your bars"}
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6B00]">Open →</span>
        </button>
      ) : inQueue ? (
        <button
          onClick={() => onNavigate && onNavigate("connect")}
          data-testid="profile-queue-card"
          className="w-full text-left rounded-2xl border border-[#39FF14]/30 p-3.5 flex items-center gap-3"
          style={{ background: "rgba(57,255,20,0.05)" }}
        >
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#39FF14]/15 flex-shrink-0">
            <Users className="w-5 h-5 text-[#39FF14]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Searching for an opponent…</p>
            <p className="text-[10px] uppercase tracking-wider text-[#39FF14] font-bold">In matchmaking queue</p>
          </div>
        </button>
      ) : (
        <button
          onClick={() => onNavigate && onNavigate("connect")}
          data-testid="profile-register-cta"
          className="w-full text-left rounded-2xl border border-dashed border-[#FF6B00]/30 p-3.5 flex items-center gap-3 hover:border-[#FF6B00]/60 hover:bg-[#FF6B00]/5 transition-all"
        >
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#FF6B00]/10 flex-shrink-0">
            <Swords className="w-5 h-5 text-[#FF6B00]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Not registered for a battle</p>
            <p className="text-[10px] text-[#5C5C6B]">Head to Connect → Battle Hub to enter the queue.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6B00]">Register →</span>
        </button>
      )}

      {history.length > 0 && (
        <div className="mt-2 space-y-1.5" data-testid="profile-battle-history">
          <p className="text-[9px] uppercase tracking-[0.25em] text-[#5C5C6B] font-black pl-1 mb-1">Recent battles</p>
          {history.map((b) => {
            const meId = snapshot.user?.user_id;
            const opp = b.user_a === meId ? b.profile_b : b.profile_a;
            const won = b.winner && b.winner === meId;
            const tied = !b.winner;
            return (
              <div key={b.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/5"
                style={{ background: "rgba(15,15,22,0.4)" }} data-testid={`battle-history-${b.id}`}>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  won ? "bg-[#39FF14]/15 text-[#39FF14]"
                    : tied ? "bg-white/8 text-[#A0A0B0]"
                    : "bg-red-500/15 text-red-400"
                }`}>
                  {won ? "W" : tied ? "T" : "L"}
                </span>
                <span className="flex-1 text-xs font-bold text-white truncate">vs {opp.display_name}</span>
                <span className="text-[9px] text-[#5C5C6B]">{b.votes_a || 0}-{b.votes_b || 0}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PlaylistsSection({ playlists, onNavigate }) {
  return (
    <section data-testid="profile-playlists">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.25em] font-black text-[#39FF14] flex items-center gap-1.5">
          <ListMusic className="w-3.5 h-3.5" /> Personal Playlists
        </h3>
        <button
          onClick={() => onNavigate && onNavigate("playlists")}
          data-testid="profile-playlists-manage"
          className="text-[10px] text-[#5C5C6B] hover:text-white font-bold uppercase tracking-wider"
        >
          Manage →
        </button>
      </div>
      {playlists.length === 0 ? (
        <button
          onClick={() => onNavigate && onNavigate("home")}
          data-testid="profile-playlists-empty"
          className="w-full rounded-2xl border border-dashed border-[#39FF14]/25 p-4 flex items-center gap-3 hover:border-[#39FF14]/50 hover:bg-[#39FF14]/5 transition-all text-left"
        >
          <ListMusic className="w-9 h-9 text-[#39FF14]/40 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">No playlists yet</p>
            <p className="text-[10px] text-[#5C5C6B]">Save songs from Discover to build your collection.</p>
          </div>
        </button>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" data-testid="profile-playlists-row">
          {playlists.slice(0, 10).map((pl, idx) => (
            <button
              key={pl.id || idx}
              onClick={() => onNavigate && onNavigate("playlists")}
              data-testid={`profile-playlist-${idx}`}
              className="flex-shrink-0 w-28 rounded-2xl border border-white/5 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all text-left p-2"
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden mb-1.5 border border-white/5 bg-gradient-to-br from-[#39FF14]/15 via-[#0F0F16] to-[#FF6B00]/10 flex items-center justify-center">
                {pl.cover_url
                  ? <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                  : <ListMusic className="w-7 h-7 text-[#39FF14]/40" />}
              </div>
              <p className="text-xs font-bold text-white truncate">{pl.name || "Untitled"}</p>
              <p className="text-[10px] text-[#5C5C6B] truncate">
                {pl.track_count != null ? `${pl.track_count} tracks` : (pl.tracks?.length || 0) + " tracks"}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function MyRapsSection({ raps, playingId, onToggle }) {
  return (
    <section data-testid="profile-my-raps">
      <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.25em] font-black text-[#FF6B00] mb-2 flex items-center gap-1.5">
        <Mic2 className="w-3.5 h-3.5" /> My Raps · 60s
      </h3>
      {raps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center" data-testid="profile-my-raps-empty">
          <Mic2 className="w-9 h-9 text-[#FF6B00]/20 mx-auto mb-2" />
          <p className="text-sm font-bold text-white">No raps posted yet</p>
          <p className="text-[10px] text-[#5C5C6B] mt-1">Battles &amp; Backstage performances you keep will show here.</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="profile-my-raps-list">
          {raps.map((r) => {
            const isPlaying = playingId === r.id;
            return (
              <div
                key={r.id}
                data-testid={`profile-rap-${r.id}`}
                className="rounded-2xl border border-white/5 hover:border-[#FF6B00]/30 transition-all p-3 flex items-center gap-3"
                style={{ background: "rgba(15,15,22,0.5)" }}
              >
                <button
                  onClick={() => onToggle(r)}
                  data-testid={`profile-rap-play-${r.id}`}
                  className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isPlaying ? "bg-[#FF6B00]" : "bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25"
                  }`}
                  style={isPlaying ? { boxShadow: "0 0 16px rgba(255,107,0,0.45)" } : undefined}
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-[#FF6B00] ml-0.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{r.song_title || "Untitled rap"}</p>
                  <p className="text-[10px] text-[#5C5C6B] truncate flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5" />
                    {Math.round(r.duration_sec || 0)}s
                    {r.artist && ` · ${r.artist}`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] font-bold text-[#5C5C6B] flex-shrink-0">
                  <span className="flex items-center gap-1" data-testid={`profile-rap-likes-${r.id}`}>
                    <Heart className="w-3 h-3 text-[#39FF14]" /> {r.likes || 0}
                  </span>
                  <span className="flex items-center gap-1" data-testid={`profile-rap-views-${r.id}`}>
                    <Eye className="w-3 h-3 text-[#FF6B00]" /> {r.views || 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
