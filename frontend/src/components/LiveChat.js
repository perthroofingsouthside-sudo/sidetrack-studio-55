import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, Radio, Clock, Users, Crown, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API } from "@/App";
import axios from "axios";

export default function LiveChat({ trackTitle }) {
  const [mode, setMode] = useState("live");
  const [messages, setMessages] = useState([]);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [username] = useState(() => localStorage.getItem("sidetrack_username") || "Fan");
  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const room = (trackTitle || "lobby").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase().slice(0, 40);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const backendUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/^https?/, "wss");
    const wsUrl = `${backendUrl}/api/ws/chat/${room}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.viewers !== undefined) setViewers(msg.viewers);
          if (msg.type === "message") {
            setMessages((prev) => [...prev.slice(-200), { id: Date.now() + Math.random(), ...msg }]);
          } else if (msg.type === "system") {
            setMessages((prev) => [...prev.slice(-200), { id: Date.now() + Math.random(), ...msg, user: "SYSTEM" }]);
          }
        } catch (err) { console.error("Chat parse error:", err); }
      };
      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connectWs, 3000);
      };
      ws.onerror = () => { ws.close(); };
    } catch (err) {
      console.error("WebSocket connection failed:", err);
      setConnected(false);
      reconnectRef.current = setTimeout(connectWs, 3000);
    }
  }, [room]);

  useEffect(() => {
    // Load history first, then connect WebSocket
    const loadHistory = async () => {
      try {
        const res = await axios.get(`${API}/chat/${room}/history?limit=50`);
        if (res.data.success) {
          setMessages(res.data.messages.map((m, i) => ({ id: i, ...m })));
          setViewers(res.data.viewers || 0);
        }
      } catch (err) { console.error("Chat history load error:", err); }
    };
    loadHistory();
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [room, connectWs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    if (mode === "live" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ user: username, text: input.trim() }));
    } else {
      setComments((prev) => [...prev, { id: Date.now(), user: username, text: input.trim(), ts: new Date().toISOString() }]);
    }
    setInput("");
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full retro-terminal rounded-xl overflow-hidden" data-testid="live-chat">
      {/* Header with connection status */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#39FF14]/10">
        <div className="flex items-center gap-1.5">
          {connected ? (
            <Wifi className="w-3 h-3 text-[#39FF14]" data-testid="ws-connected" />
          ) : (
            <WifiOff className="w-3 h-3 text-[#FF6B00] animate-pulse" data-testid="ws-disconnected" />
          )}
          <span className="text-[9px] text-[#5C5C6B] uppercase tracking-wider font-bold">
            {connected ? "Live" : "Connecting..."}
          </span>
        </div>
        <div className="flex items-center gap-1" data-testid="viewer-count">
          <Users className="w-3 h-3 text-[#FF6B00]" />
          <span className="text-[9px] text-[#FF6B00] font-bold">{viewers}</span>
        </div>
      </div>

      {/* Toggle tabs */}
      <div className="flex border-b border-[#39FF14]/10" data-testid="live-chat-toggle">
        <button data-testid="chat-tab-live" onClick={() => setMode("live")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${
            mode === "live" ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-[#5C5C6B] hover:text-[#8F8F9D]"
          }`}>
          <Radio className="w-3 h-3" /> Live
        </button>
        <button data-testid="chat-tab-comments" onClick={() => setMode("comments")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${
            mode === "comments" ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-[#5C5C6B] hover:text-[#8F8F9D]"
          }`}>
          <MessageCircle className="w-3 h-3" /> Comments
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3" ref={scrollRef} aria-live="polite">
        {mode === "live" ? (
          <div className="py-2 space-y-1">
            {messages.length === 0 && (
              <p className="text-xs text-[#5C5C6B] text-center py-6">No messages yet. Say something!</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="animate-chat-in py-1" data-testid="live-message">
                <span className="text-[10px] text-[#5C5C6B] mr-1.5">{fmtTime(msg.ts)}</span>
                {msg.badge && (
                  <span className={`text-[8px] font-black uppercase tracking-wider mr-1 px-1 py-0.5 rounded ${
                    msg.badge === "VIP" ? "bg-[#FF6B00]/20 text-[#FF6B00]" : "bg-[#39FF14]/15 text-[#39FF14]"
                  }`}>{msg.badge}</span>
                )}
                <span className={`text-xs font-bold ${msg.user === "SYSTEM" ? "text-[#5C5C6B] italic" : "text-[#39FF14]"}`}>{msg.user}</span>
                <span className="text-xs text-[#8F8F9D] ml-1.5">{msg.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 space-y-3">
            {comments.length === 0 && (
              <p className="text-xs text-[#5C5C6B] text-center py-6">No comments yet. Share your thoughts!</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="bg-white/5 rounded-lg p-3" data-testid="comment-message">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-[#FF6B00]/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-[#FF6B00]">{c.user[0]}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{c.user}</span>
                  <span className="text-[10px] text-[#5C5C6B] flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{fmtTime(c.ts)}</span>
                </div>
                <p className="text-sm text-[#8F8F9D] pl-7">{c.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-[#39FF14]/10">
        <div className="flex gap-2">
          <Input data-testid="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={mode === "live" ? "Say something..." : "Leave a comment..."}
            className="h-9 bg-transparent border-white/20 text-white placeholder:text-[#5C5C6B] rounded-lg text-sm focus:border-[#FF6B00]" />
          <Button data-testid="chat-send-btn" onClick={sendMessage} size="icon"
            className="h-9 w-9 bg-[#FF6B00] hover:bg-[#FF8533] hover:shadow-[0_0_20px_rgba(255,107,0,0.6)] rounded-lg flex-shrink-0">
            <Send className="w-3.5 h-3.5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
