import { useState, useEffect, useRef, useCallback } from "react";
import { Users, Copy, Check, UserPlus, Crown, Loader2, Share2, LogOut, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import log from "@/utils/log";
import useJamWebRTC from "@/hooks/useJamWebRTC";
import JamVideoGrid from "@/components/JamVideoGrid";

const ROLES = ["vocals", "guitar", "bass", "drums", "keys"];

/**
 * JamRoomPanel — sidebar widget for hosting/joining a band session.
 *
 * Workflow:
 *  - Host clicks "Create Room" → gets a 6-char code + shareable URL.
 *  - Sharing the URL (`?jam=XXXXXX`) auto-joins anyone who opens it.
 *  - Polls /jam/rooms/{code} every 4s for member presence updates.
 *
 * Video tiles are currently placeholder; real WebRTC P2P video is Phase 2.
 */
export default function JamRoomPanel({ song, onMembersChange }) {
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");
  const userName = useRef(localStorage.getItem("sidetrack_username") || `Player-${userId.current.slice(0, 4)}`);

  const [room, setRoom] = useState(null);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myRole, setMyRole] = useState("vocals");
  const [videoOn, setVideoOn] = useState(false);
  const pollRef = useRef(null);

  // Live WebRTC video — only activates when user toggles videoOn AND is in a room
  const {
    localStream, peers, status: rtcStatus,
    micMuted, camOff, toggleMic, toggleCam,
  } = useJamWebRTC({
    code: room?.code,
    peerId: userId.current,
    name: userName.current,
    enabled: !!(room?.code && videoOn),
    video: true,
    audio: true,
  });

  // Auto-join via ?jam=XXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get("jam");
    if (auto && !room) {
      setCode(auto.toUpperCase());
      doJoin(auto.toUpperCase(), myRole);
    }
    // eslint-disable-next-line
  }, []);

  // Poll room state while in a room
  useEffect(() => {
    if (!room?.code) return;
    const tick = async () => {
      try {
        const res = await axios.get(`${API}/jam/rooms/${room.code}`);
        if (res.data?.success) {
          setRoom(res.data.room);
          if (onMembersChange) onMembersChange(res.data.room.members);
        }
      } catch (err) { log.debug("[Jam] poll failed", err?.message); }
    };
    pollRef.current = setInterval(tick, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line
  }, [room?.code]);

  const doCreate = async () => {
    setCreating(true);
    try {
      const res = await axios.post(`${API}/jam/rooms`, {
        host_id: userId.current,
        host_name: userName.current,
        song_id: song?.id,
        song_title: song?.title,
        song_artist: song?.artist,
      });
      if (res.data?.success) {
        setRoom(res.data.room);
        toast.success(`Jam room ${res.data.code} created`);
      }
    } catch (err) {
      toast.error("Couldn't create room");
    } finally { setCreating(false); }
  };

  const doJoin = useCallback(async (joinCode, role) => {
    const c = (joinCode || code).toUpperCase().trim();
    if (!c) { toast.error("Enter a room code"); return; }
    setJoining(true);
    try {
      const res = await axios.post(`${API}/jam/rooms/${c}/join`, {
        user_id: userId.current,
        user_name: userName.current,
        role: role || myRole,
      });
      if (res.data?.success) {
        setRoom(res.data.room);
        toast.success(`Joined as ${res.data.you.role}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't join room");
    } finally { setJoining(false); }
  }, [code, myRole]);

  const doLeave = async () => {
    if (!room?.code) return;
    try {
      await axios.post(`${API}/jam/rooms/${room.code}/leave`, { user_id: userId.current });
    } catch (err) { log.debug("[Jam] leave call failed", err?.message); }
    setRoom(null);
    toast.message("Left the jam");
    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete("jam");
    window.history.replaceState({}, "", url.toString());
  };

  const inviteUrl = room?.code
    ? `${window.location.origin}${window.location.pathname}?jam=${room.code}`
    : "";

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Couldn't copy"); }
  };

  const nativeShare = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Pocket Products jam",
          text: `Jam with me on ${room?.song_title || "Pocket Products"} — code ${room?.code}`,
          url: inviteUrl,
        });
      } catch (err) { log.debug("[Jam] native share dismissed:", err?.message); }
    } else { copyInvite(); }
  };

  // ── Not yet in a room: create + join UI ──
  if (!room) {
    return (
      <div className="rounded-xl border border-[#39FF14]/20 p-3 space-y-3"
           style={{ background: "rgba(57,255,20,0.04)" }} data-testid="jam-panel">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(57,255,20,0.15)" }}>
            <Users className="w-4 h-4 text-[#39FF14]" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#39FF14]">Jam Room</p>
            <p className="text-[9px] text-[#5C5C6B]">Invite your band</p>
          </div>
        </div>

        <Button onClick={doCreate} disabled={creating} data-testid="jam-create-btn"
          className="w-full h-9 rounded-lg bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-bold text-[11px]"
          style={{ boxShadow: "0 0 14px rgba(57,255,20,0.35)" }}>
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserPlus className="w-3 h-3 mr-1.5" /> Host a Jam</>}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
          <div className="relative flex justify-center text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold">
            <span className="px-2" style={{ background: "rgb(13, 17, 14)" }}>or join</span>
          </div>
        </div>

        <div className="space-y-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ROOM CODE" maxLength={6}
            data-testid="jam-code-input"
            className="h-8 text-center text-sm font-mono font-black tracking-[0.3em] bg-[#0F0F16] border-white/10 focus-visible:ring-[#39FF14]/50" />
          <div className="grid grid-cols-3 gap-1">
            {ROLES.slice(0, 3).map(r => (
              <button key={r} onClick={() => setMyRole(r)} data-testid={`jam-role-${r}`}
                className={`h-6 text-[9px] uppercase tracking-wider font-bold rounded border transition-all ${
                  myRole === r ? "border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10" : "border-white/10 text-[#5C5C6B]"
                }`}>{r}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {ROLES.slice(3).map(r => (
              <button key={r} onClick={() => setMyRole(r)} data-testid={`jam-role-${r}`}
                className={`h-6 text-[9px] uppercase tracking-wider font-bold rounded border transition-all ${
                  myRole === r ? "border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10" : "border-white/10 text-[#5C5C6B]"
                }`}>{r}</button>
            ))}
          </div>
          <Button onClick={() => doJoin()} disabled={joining || !code} data-testid="jam-join-btn"
            className="w-full h-8 rounded-lg bg-[#FF5F1F] hover:bg-[#FF7A42] text-white font-bold text-[10px]">
            {joining ? <Loader2 className="w-3 h-3 animate-spin" /> : "Join"}
          </Button>
        </div>
      </div>
    );
  }

  // ── In a room: show code + members ──
  return (
    <div className="rounded-xl border border-[#39FF14]/30 p-3 space-y-2.5"
         style={{ background: "rgba(57,255,20,0.05)", boxShadow: "0 0 18px rgba(57,255,20,0.1)" }}
         data-testid="jam-panel-active">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(57,255,20,0.2)" }}>
          <Users className="w-4 h-4 text-[#39FF14]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#5C5C6B]">Room Code</p>
          <p className="text-base font-['Outfit'] font-black tracking-[0.25em] text-[#39FF14]" data-testid="jam-room-code">{room.code}</p>
        </div>
      </div>

      {/* Share */}
      <div className="flex gap-1">
        <Button onClick={copyInvite} data-testid="jam-copy-btn"
          className="flex-1 h-7 rounded-lg text-[9px] font-bold border border-[#39FF14]/30 text-[#39FF14] bg-[#39FF14]/10 hover:bg-[#39FF14]/20">
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied" : "Copy Link"}
        </Button>
        <Button onClick={nativeShare} data-testid="jam-share-btn"
          className="h-7 px-2 rounded-lg text-[9px] font-bold border border-white/10 text-[#5C5C6B] hover:text-white bg-transparent">
          <Share2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Members */}
      <div className="space-y-1" data-testid="jam-members">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#5C5C6B]">
          Band · {room.members?.length || 0}/5
        </p>
        {(room.members || []).map(m => (
          <div key={m.user_id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded ${
              m.is_host ? "bg-[#FF5F1F]/10 border border-[#FF5F1F]/25" : "bg-white/5"
            }`}
            data-testid={`jam-member-${m.user_id}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${m.is_host ? "bg-[#FF5F1F]" : "bg-[#39FF14]"} animate-pulse`} />
            {m.is_host && <Crown className="w-2.5 h-2.5 text-[#FF5F1F]" />}
            <p className="text-[10px] font-bold text-white truncate flex-1">{m.user_name}</p>
            <span className={`text-[8px] uppercase tracking-wider font-bold ${m.is_host ? "text-[#FF5F1F]" : "text-[#39FF14]"}`}>
              {m.role}
            </span>
          </div>
        ))}
        {(room.members?.length || 0) < 5 && Array.from({ length: 5 - (room.members?.length || 0) }).map((_, i) => (
          <div key={`empty-${i}`} className="flex items-center gap-1.5 px-2 py-1 rounded border border-dashed border-white/10">
            <Mic2 className="w-2.5 h-2.5 text-[#5C5C6B]/40" />
            <p className="text-[10px] text-[#5C5C6B]/40 italic">Waiting…</p>
          </div>
        ))}
      </div>

      {/* Video grid — only mounted when user opts in (saves bandwidth + perms) */}
      {videoOn ? (
        <JamVideoGrid
          localStream={localStream}
          peers={peers}
          micMuted={micMuted}
          camOff={camOff}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          members={room.members || []}
          myPeerId={userId.current}
          status={rtcStatus}
        />
      ) : (
        <Button onClick={() => setVideoOn(true)} data-testid="jam-start-video-btn"
          className="w-full h-8 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#39FF14]/15 hover:bg-[#39FF14]/25 text-[#39FF14] border border-[#39FF14]/40">
          Start Live Video
        </Button>
      )}

      {/* Leave */}
      <Button onClick={() => { setVideoOn(false); doLeave(); }} data-testid="jam-leave-btn"
        className="w-full h-7 rounded-lg text-[9px] font-bold border border-red-500/30 text-red-400 bg-transparent hover:bg-red-500/10">
        <LogOut className="w-3 h-3 mr-1" /> Leave Jam
      </Button>
    </div>
  );
}
