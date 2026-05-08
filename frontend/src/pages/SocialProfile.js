import { useState, useEffect, useRef } from "react";
import { User, Trophy, Star, ListMusic, Mic2, TrendingUp, Settings, Share2, Crown, Upload, CheckCircle2, AlertCircle, Users, Heart } from "lucide-react";
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

export default function SocialProfile({ onNavigate }) {
  const [username, setUsername] = useState(() => localStorage.getItem("sidetrack_username") || "");
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState(username);
  const [subStatus, setSubStatus] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
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
            <div className="h-28 bg-gradient-to-r from-[#FF6B00] to-[#39FF14] opacity-20" />
            <div className="px-5 pb-5 -mt-10">
              <div className="w-20 h-20 rounded-2xl bg-[#0F0F16] border-4 border-[#05050A] flex items-center justify-center shadow-[0_0_30px_rgba(255,107,0,0.3)]">
                <User className="w-8 h-8 text-[#FF6B00]" />
              </div>
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
              <p className="text-xs text-[#5C5C6B] mt-1">SIDETRACK member</p>

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
    </div>
  );
}
