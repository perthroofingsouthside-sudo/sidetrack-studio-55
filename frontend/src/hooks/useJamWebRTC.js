/* useJamWebRTC — Multi-peer mesh WebRTC for the Jam Room.
   Signaling: native FastAPI WebSocket at /api/ws/jam/{code}.
   Transport: simple-peer (P2P video + audio).
   TURN: Open Relay (metered.ca) free public TURN service.
*/
import { useEffect, useRef, useState, useCallback } from "react";
import SimplePeer from "simple-peer/simplepeer.min.js";
import log from "@/utils/log";

// Free public ICE servers — STUN + TURN via Open Relay (metered.ca)
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Open Relay Project — free public TURN. Reliability not guaranteed for production.
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

function getWsUrl(code) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const wsProto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  return `${wsProto}://${host}/api/ws/jam/${encodeURIComponent(code)}`;
}

export default function useJamWebRTC({ code, peerId, name, enabled, video = true, audio = true }) {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});       // {peerId: {stream, name}}
  const [status, setStatus] = useState("idle"); // idle | connecting | live | error
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const wsRef = useRef(null);
  const peersRef = useRef({});  // {peerId: SimplePeer}
  const localStreamRef = useRef(null);

  const cleanup = useCallback(() => {
    Object.values(peersRef.current).forEach((p) => {
      try { p.destroy(); } catch (err) { log.debug("[Jam] peer destroy failed:", err?.message); }
    });
    peersRef.current = {};
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (err) { log.debug("[Jam] ws close failed:", err?.message); }
      wsRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setPeers({});
    setStatus("idle");
  }, []);

  const sendSignal = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Create a peer connection (as initiator OR receiver)
  const createPeer = useCallback((targetPeerId, initiator, stream) => {
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: { iceServers: ICE_SERVERS },
    });
    peer.on("signal", (data) => {
      sendSignal({
        type: data.type === "offer" ? "offer" : data.type === "answer" ? "answer" : "ice",
        target: targetPeerId,
        data,
      });
    });
    peer.on("stream", (remoteStream) => {
      setPeers((prev) => ({ ...prev, [targetPeerId]: { ...(prev[targetPeerId] || {}), stream: remoteStream } }));
    });
    peer.on("close", () => {
      setPeers((prev) => { const next = { ...prev }; delete next[targetPeerId]; return next; });
      delete peersRef.current[targetPeerId];
    });
    peer.on("error", (err) => {
      log.debug("[Jam] peer error", targetPeerId, err?.message);
    });
    peersRef.current[targetPeerId] = peer;
    return peer;
  }, [sendSignal]);

  // Main lifecycle — gate everything on `enabled`
  useEffect(() => {
    if (!enabled || !code || !peerId) return;
    let cancelled = false;
    setStatus("connecting");

    const start = async () => {
      // 1. Acquire local media
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      } catch (err) {
        console.error("[Jam] getUserMedia failed", err);
        setStatus("error");
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Open signaling socket
      const ws = new WebSocket(getWsUrl(code));
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "hello", peer_id: peerId, name }));
      };

      ws.onmessage = (event) => {
        let msg; try { msg = JSON.parse(event.data); } catch { return; }
        const { type } = msg;
        if (type === "roster") {
          setStatus("live");
          // Initiate a peer connection to every existing peer
          (msg.peers || []).forEach((pid) => {
            if (pid === peerId) return;
            if (peersRef.current[pid]) return;
            createPeer(pid, true, localStreamRef.current);
          });
        } else if (type === "peer-joined") {
          // New peer arrived — they will initiate to us; we wait.
          setPeers((prev) => ({ ...prev, [msg.peer_id]: { ...(prev[msg.peer_id] || {}), name: msg.name } }));
        } else if (type === "peer-left") {
          const p = peersRef.current[msg.peer_id];
          if (p) {
            try { p.destroy(); } catch (err) { log.debug("[Jam] peer destroy failed:", err?.message); }
            delete peersRef.current[msg.peer_id];
          }
          setPeers((prev) => { const next = { ...prev }; delete next[msg.peer_id]; return next; });
        } else if (type === "offer") {
          const from = msg.from;
          if (!from) return;
          let peer = peersRef.current[from];
          if (!peer) peer = createPeer(from, false, localStreamRef.current);
          peer.signal(msg.data);
        } else if (type === "answer" || type === "ice") {
          const from = msg.from;
          const peer = peersRef.current[from];
          if (peer) peer.signal(msg.data);
        }
      };

      ws.onerror = () => { setStatus("error"); };
      ws.onclose = () => { if (!cancelled) setStatus("idle"); };
    };

    start();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, code, peerId, name, video, audio, createPeer, cleanup]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !micMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMicMuted(next);
  }, [micMuted]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !camOff;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCamOff(next);
  }, [camOff]);

  return { localStream, peers, status, micMuted, camOff, toggleMic, toggleCam };
}
