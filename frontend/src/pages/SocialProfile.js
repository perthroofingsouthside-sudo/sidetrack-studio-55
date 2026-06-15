import { useState, useEffect, useRef } from "react";
import { User, Trophy, Star, ListMusic, Mic2, TrendingUp, Settings, Share2, Crown, Upload, CheckCircle2, AlertCircle, Users, Heart, Camera, Gamepad2, Music2, Zap, Headphones, Sparkles, Guitar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const TIER_LABELS = {
  stadium_vip: { name: "Stadium VIP", color: "#FF6B00", icon: Crown },
  individual: { name: "Individual Pro", color: "#39FF14", icon: Star },
  student: { name: "Student Pro", color: "#39FF14", icon: Star },
  couple_duo: { name: "Duo Pro", color: "#FF6B00", icon: Star },
  family: { name: "Family Pro", color: "#39FF14", icon: Star },
  adult_band: { name: "Band Pro", color: "#FF6B00", icon: Mic2 },
  under18_band: { name: "Young Band", color: "#39FF14", icon: Star },
};

// Gamer avatar builder palette
const GAMER_ICONS = [
  { key: "gamepad", Icon: Gamepad2 },
  { key: "headphones", Icon: Headphones },
  { key: "mic", Icon: Mic2 },
  { key: "guitar", Icon: Guitar },
  { key: "music", Icon: Music2 },
  { key: "zap", Icon: Zap },
  { key: "star", Icon: Star },
  { key: "crown", Icon: Crown },
  { key: "sparkles", Icon: Sparkles },
];

const GAMER_PALETTES = [
  { key: "neon-green", from: "#39FF14", to: "#0F1A0F" },
  { key: "neon-orange", from: "#FF6B00", to: "#1A0F08" },
  { key: "neon-purple", from: "#B57BFF", to: "#16091F" },
  { key: "neon-cyan", from: "#00E0FF", to: "#06141B" },
  { key: "neon-pink", from: "#FF4FB1", to: "#1F0A16" },
  { key: "split", from: "#FF6B00", to: "#39FF14" },
];

export default function SocialProfile({ onNavigate }) {
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState(username);
  const [subStatus, setSubStatus] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [lane] = useState(() => localStorage.getItem("pp_lane") || "creator");
  const [photoUrl, setPhotoUrl] = useState(() => localStorage.getItem("pp_profile_photo") || "");
  const [gamerAvatar, setGamerAvatar] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pp_gamer_avatar") || "null") || { icon: "gamepad", palette: "neon-green" }; }
    catch { return { icon: "gamepad", palette: "neon-green" }; }
  });
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const fileInputRef = useRef(null);
  const userId = useRef(
    localStorage.getItem("sidetrack_voter_id") ||
      (() => { const id = crypto.randomUUID(); localStorage.setItem("sidetrack_voter_id", id); return id; })()
  );

  useEffect(() => {
    loadSubStatus();
    loadLiveStats();
  }, []);

  const loadSubStatus = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/${userId.current}/status`);
      if (res.data.success) setSubStatus(res.data);
    } catch (err) { console.error("Load failed:", err); }
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

  const currentPalette = GAMER_PALETTES.find(p => p.key === gamerAvatar.palette) || GAMER_PALETTES[0];
  const CurrentGamerIcon = (GAMER_ICONS.find(i => i.key === gamerAvatar.icon) || GAMER_ICONS[0]).Icon;

  const tierKey = subStatus?.tier_key || "free";
  const tierInfo = TIER_LABELS[tierKey];
  const isBand = subStatus?.is_band;
  const uploadStatus = subStatus?.upload_status;

  const stats = [
    { label: "Battles", value: liveStats?.battles ?? 0, icon: Trophy, color: "#FF6B00" },
    { label: "Stars", value: liveStats?.stars ?? 0, icon: Star, color: "#39FF14" },
    { label: "Playlists", value: liveStats?.playlists ?? 0, icon: ListMusic, color: "#FF6B00" },
    { label: "Votes", value: liveStats?.total_votes ?? 0, icon: Heart, color: "#39FF14" },
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
              {/* AVATAR — lane-aware (Creator: photo / Gamer: builder) */}
              {lane === "gamer" ? (
                <button
                  onClick={() => setShowAvatarBuilder(true)}
                  data-testid="gamer-avatar-edit"
                  className="group w-20 h-20 rounded-2xl border-4 border-[#05050A] flex items-center justify-center relative overflow-hidden transition-transform hover:scale-[1.03]"
                  style={{
                    background: `linear-gradient(135deg, ${currentPalette.from} 0%, ${currentPalette.to} 100%)`,
                    boxShadow: `0 0 30px ${currentPalette.from}55`,
                  }}
                  title="Customize Gamer avatar"
                >
                  <CurrentGamerIcon className="w-9 h-9 text-white" style={{ filter: `drop-shadow(0 0 8px ${currentPalette.from})` }} />
                  <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[#05050A]/80 border border-[#39FF14]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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

          {/* Pro Status Indicator */}
          {tierInfo && tierKey !== "free" ? (
            <div className="rounded-2xl border p-4 flex items-center gap-4"
              style={{ borderColor: `${tierInfo.color}30`, background: `${tierInfo.color}08`, boxShadow: `0 0 24px ${tierInfo.color}12` }}
              data-testid="pro-status-indicator">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${tierInfo.color}20`, boxShadow: `0 0 14px ${tierInfo.color}30` }}>
                <tierInfo.icon className="w-5 h-5" style={{ color: tierInfo.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white" data-testid="pro-tier-name">{tierInfo.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: `${tierInfo.color}99` }}>
                  {subStatus?.subscription?.status === "trial" ? "Free trial active" : subStatus?.subscription?.status === "reward" ? "Competition reward" : "Active subscription"}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${tierInfo.color}18`, color: tierInfo.color }}
                data-testid="pro-status-badge">
                {subStatus?.subscription?.status === "trial" ? "Trial" : subStatus?.subscription?.status === "reward" ? "Reward" : "Pro"}
              </span>
            </div>
          ) : (
            <button onClick={() => onNavigate && onNavigate("pricing")}
              className="w-full rounded-2xl border border-[#FF6B00]/30 p-4 flex items-center gap-4 text-left transition-all hover:border-[#FF6B00]/50 group"
              style={{ background: "rgba(255,107,0,0.06)" }} data-testid="go-pro-btn">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,107,0,0.15)", boxShadow: "0 0 16px rgba(255,107,0,0.25)" }}>
                <Crown className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-[#FF6B00] transition-colors">Stadium VIP & Pro Plans</p>
                <p className="text-[10px] text-[#5C5C6B] mt-0.5">Neon badges, priority DMs, unlimited skips & more</p>
              </div>
              <span className="text-[#FF6B00] text-xs font-bold shrink-0">From $2.98</span>
            </button>
          )}

          {/* Band Weekly Upload Tracker */}
          {isBand && uploadStatus && (
            <div className="rounded-2xl border border-[#FF6B00]/20 p-4 space-y-3"
              style={{ background: "rgba(255,107,0,0.04)" }} data-testid="band-upload-tracker">
              <div className="flex items-center justify-between">
                <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#FF6B00] flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" /> Weekly Upload Tracker
                </h3>
                {uploadStatus.met ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#39FF14] uppercase tracking-wider" data-testid="upload-status-met">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Met
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#FF6B00] uppercase tracking-wider" data-testid="upload-status-pending">
                    <AlertCircle className="w-3.5 h-3.5" /> Pending
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((uploadStatus.uploads_this_week / uploadStatus.required) * 100, 100)}%`,
                    background: uploadStatus.met ? "#39FF14" : "#FF6B00",
                    boxShadow: uploadStatus.met ? "0 0 10px rgba(57,255,20,0.5)" : "0 0 10px rgba(255,107,0,0.4)",
                  }} data-testid="upload-progress-bar" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#5C5C6B]">{uploadStatus.uploads_this_week} / {uploadStatus.required} upload this week</span>
                <span className="text-[10px] text-[#5C5C6B]">Resets {new Date(uploadStatus.week_end).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              </div>
            </div>
          )}

          {/* Stats Grid — Live from DB */}
          <div className="grid grid-cols-2 gap-3" data-testid="profile-stats">
            {stats.map((s) => (
              <div key={s.label} className="surface-card p-4 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
                <p className="text-2xl font-['Outfit'] font-black text-white">{s.value}</p>
                <p className="text-[10px] text-[#5C5C6B] uppercase tracking-[0.15em] font-bold mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Activity Feed */}
          <section data-testid="activity-feed">
            <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#8F8F9D] mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#39FF14]" /> Recent Activity
            </h3>
            <div className="surface-card p-8 text-center">
              <Mic2 className="w-10 h-10 text-[#FF6B00]/15 mx-auto mb-3" />
              <p className="text-sm text-[#5C5C6B]">Your activity will appear here</p>
              <p className="text-xs text-[#5C5C6B]/60 mt-1">Record covers, enter battles, and create playlists to build your profile</p>
            </div>
          </section>

          {/* Share Profile */}
          <Button variant="ghost" className="w-full border border-white/5 text-[#5C5C6B] gap-2 rounded-2xl" data-testid="share-profile-btn">
            <Share2 className="w-4 h-4" /> Share Profile
          </Button>
        </div>
      </ScrollArea>

      {/* Gamer Avatar Builder Modal */}
      {showAvatarBuilder && lane === "gamer" && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="avatar-builder">
          <div className="w-full max-w-md rounded-2xl border border-[#39FF14]/30 bg-[#0A0A0F] p-5 space-y-5"
               style={{ boxShadow: "0 0 60px rgba(57,255,20,0.15)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-['Outfit'] text-lg font-black text-white">Build Your Gamer Avatar</h3>
                <p className="text-[10px] text-[#5C5C6B] uppercase tracking-wider mt-0.5">Pick an icon + palette</p>
              </div>
              <Button onClick={() => setShowAvatarBuilder(false)} data-testid="avatar-builder-close"
                variant="ghost" className="w-8 h-8 text-[#5C5C6B] hover:text-white p-0">×</Button>
            </div>

            {/* Preview */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center transition-all"
                style={{
                  background: `linear-gradient(135deg, ${currentPalette.from} 0%, ${currentPalette.to} 100%)`,
                  boxShadow: `0 0 32px ${currentPalette.from}66`,
                }}>
                <CurrentGamerIcon className="w-11 h-11 text-white" style={{ filter: `drop-shadow(0 0 10px ${currentPalette.from})` }} />
              </div>
            </div>

            {/* Icons grid */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold mb-2">Icon</p>
              <div className="grid grid-cols-5 gap-2">
                {GAMER_ICONS.map(({ key, Icon }) => (
                  <button key={key} onClick={() => updateGamerAvatar({ icon: key })}
                    data-testid={`avatar-icon-${key}`}
                    className={`aspect-square rounded-xl flex items-center justify-center border-2 transition-all ${
                      gamerAvatar.icon === key
                        ? "border-[#39FF14] bg-[#39FF14]/10 shadow-[0_0_12px_rgba(57,255,20,0.3)]"
                        : "border-white/10 bg-[#0F0F16] hover:border-white/25"
                    }`}>
                    <Icon className={`w-5 h-5 ${gamerAvatar.icon === key ? "text-[#39FF14]" : "text-[#5C5C6B]"}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Palette */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold mb-2">Palette</p>
              <div className="grid grid-cols-6 gap-2">
                {GAMER_PALETTES.map(p => (
                  <button key={p.key} onClick={() => updateGamerAvatar({ palette: p.key })}
                    data-testid={`avatar-palette-${p.key}`}
                    className={`aspect-square rounded-xl border-2 transition-all ${
                      gamerAvatar.palette === p.key
                        ? "border-white scale-110"
                        : "border-white/15 hover:border-white/40"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`,
                      boxShadow: gamerAvatar.palette === p.key ? `0 0 14px ${p.from}88` : "none",
                    }}
                    title={p.key}
                  />
                ))}
              </div>
            </div>

            <Button onClick={() => { setShowAvatarBuilder(false); toast.success("Avatar saved"); }}
              data-testid="avatar-builder-save"
              className="w-full h-10 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-bold text-sm"
              style={{ boxShadow: "0 0 20px rgba(57,255,20,0.35)" }}>
              Save Avatar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
