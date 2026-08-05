/* JamVideoGrid — Live video tiles for an active jam room. Renders local stream
   + remote peer streams from useJamWebRTC. */
import { useEffect, useRef } from "react";
import { MicOff, VideoOff, Mic, Video, User } from "lucide-react";
import { Button } from "@/components/ui/button";

function VideoTile({ stream, label, isLocal, muted = false, dataTestId }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-[#0F0F16]"
         data-testid={dataTestId}>
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={isLocal || muted}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: isLocal ? "scaleX(-1)" : "none" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <User className="w-8 h-8 text-[#5C5C6B]/40" />
        </div>
      )}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-black text-white"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
          {label}
        </span>
        {isLocal && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-[#39FF14]"
                          style={{ background: "rgba(0,0,0,0.65)" }}>You</span>}
      </div>
    </div>
  );
}

export default function JamVideoGrid({ localStream, peers, micMuted, camOff, onToggleMic, onToggleCam, members = [], myPeerId, status }) {
  // Map peer_id → member info if available
  const memberMap = {};
  members.forEach((m) => { memberMap[m.user_id] = m; });
  const peerIds = Object.keys(peers);

  return (
    <div className="space-y-2.5" data-testid="jam-video-grid">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-wider text-[#5C5C6B]">
          Live Video · {status === "live" ? <span className="text-[#39FF14]">connected</span>
            : status === "connecting" ? <span className="text-[#FF5F1F]">connecting…</span>
            : status === "error" ? <span className="text-red-400">error</span>
            : <span className="text-[#5C5C6B]">idle</span>}
        </p>
        <div className="flex gap-1">
          <Button onClick={onToggleMic} data-testid="jam-toggle-mic"
            className={`w-7 h-7 rounded-full p-0 ${micMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30"}`}>
            {micMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          </Button>
          <Button onClick={onToggleCam} data-testid="jam-toggle-cam"
            className={`w-7 h-7 rounded-full p-0 ${camOff ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30"}`}>
            {camOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* Local tile always first */}
        <VideoTile
          stream={camOff ? null : localStream}
          label={memberMap[myPeerId]?.user_name || "You"}
          isLocal
          dataTestId="jam-tile-local"
        />
        {peerIds.map((pid) => (
          <VideoTile
            key={pid}
            stream={peers[pid]?.stream}
            label={memberMap[pid]?.user_name || peers[pid]?.name || pid.slice(0, 4)}
            isLocal={false}
            dataTestId={`jam-tile-${pid}`}
          />
        ))}
      </div>
    </div>
  );
}
