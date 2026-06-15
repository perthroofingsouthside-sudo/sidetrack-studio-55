import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, Radio, Clock, Users, Crown, Wifi, WifiOff, Zap } from "lucide-react";
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
  const [typing, setTyping] = useState(false);
  const [username] = useState(() => localStorage.getItem("sidetrack_username") || "Fan");
  const [userBadge] = useState(() => {
    const tier = localStorage.getItem("sidetrack_tier") || "";
    return tier === "stadium_vip" ? "VIP" : tier ? "PRO" : "";
  });
  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
        } catch { /* ignore parse errors */ }
      };
      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connectWs, 3000);
      };
      ws.onerror = () => { ws.close(); };
    } catch {
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
      } catch { /* silent */ }
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
      wsRef.current.send(JSON.stringify({ user: username, text: input.trim(), badge: userBadge }));
    } else {
      setComments((prev) => [...prev, { id: Date.now(), user: username, text: input.trim(), ts: new Date().toISOString() }]);
    }
    setInput("");
    setTyping(false);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!typing) setTyping(true);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 1000);
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const getInitials = (name) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#05050A]/90 to-[#0A0A0F]/80 backdrop-blur-xl shadow-[0_0_30px_rgba(255,107,0,0.1)]" data-testid="live-chat">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#39FF14]/10 bg-[#05050A]/50">
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-[#39FF14] animate-pulse shadow-[0_0_8px_rgba(57,255,20,0.5)]" data-testid="ws-connected" />
              <span className="text-[10px] text-[#39FF14] uppercase tracking-widest font-black">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" data-testid="ws-disconnected" />
              <span className="text-[10px] text-[#FF6B00] uppercase tracking-widest font-bold">Reconnecting...</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-[#FF6B00]/20">
          <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
          <span className="text-[10px] text-[#FF6B00] font-bold">{viewers}</span>
        </div>
      </div>

      {/* Improved Toggle Tabs */}
      <div className="flex border-b border-[#39FF14]/10 bg-[#05050A]/30" data-testid="live-chat-toggle">
        {[
          { key: "live", label: "Live", icon: Radio },
          { key: "comments", label: "Comments", icon: MessageCircle }
        ].map((tab) => (
          <button
            key={tab.key}
            data-testid={`chat-tab-${tab.key}`}
            onClick={() => setMode(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-200 relative ${
              mode === tab.key
                ? "text-[#39FF14]"
                : "text-[#5C5C6B] hover:text-[#8F8F9D]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {mode === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#39FF14]/0 via-[#39FF14] to-[#39FF14]/0 shadow-[0_0_8px_rgba(57,255,20,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* Messages Area - Improved */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-1.5" ref={scrollRef} aria-live="polite">
        {mode === "live" ? (
          <div className="space-y-1">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-[#39FF14]/10 mx-auto mb-3" />
                <p className="text-xs text-[#5C5C6B]">No messages yet. Be the first to chat!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isSystem = msg.user === "SYSTEM";
              return (
                <div key={msg.id} className="animate-chat-in group" data-testid="live-message">
                  <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    {/* Avatar */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white ${
                      isSystem
                        ? "bg-[#5C5C6B]/30 border border-[#5C5C6B]/50"
                        : msg.badge === "VIP"
                        ? "bg-gradient-to-br from-[#FF6B00] to-[#FF8533] border border-[#FF6B00]/60 shadow-[0_0_8px_rgba(255,107,0,0.4)]"
                        : msg.badge === "PRO"
                        ? "bg-gradient-to-br from-[#39FF14] to-[#3FFF1F] border border-[#39FF14]/60 shadow-[0_0_8px_rgba(57,255,20,0.3)]"
                        : "bg-[#FF6B00]/20 border border-[#FF6B00]/40"
                    }`}>
                      {getInitials(msg.user)}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] text-[#5C5C6B]">{fmtTime(msg.ts)}</span>
                        {msg.badge && (
                          <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            msg.badge === "VIP"
                              ? "bg-[#FF6B00]/20 text-[#FF6B00]"
                              : "bg-[#39FF14]/15 text-[#39FF14]"
                          }`}>
                            {msg.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-xs font-bold ${
                          isSystem
                            ? "text-[#5C5C6B] italic"
                            : "text-[#39FF14]"
                        }`}>
                          {msg.user}
                        </span>
                        <span className="text-xs text-[#A0A0B0] break-words">{msg.text}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-3 space-y-2">
            {comments.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-[#39FF14]/10 mx-auto mb-3" />
                <p className="text-xs text-[#5C5C6B]">No comments yet. Share your thoughts!</p>
              </div>
            )}
            {comments.map((c) => (
              <div key={c.id} className="bg-gradient-to-r from-white/[0.05] to-white/[0.02] rounded-xl p-3 border border-white/5 hover:border-white/10 transition-all" data-testid="comment-message">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B00]/40 to-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-[#FF6B00]">{getInitials(c.user)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">{c.user}</p>
                    <p className="text-[9px] text-[#5C5C6B] flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtTime(c.ts)}</p>
                  </div>
                </div>
                <p className="text-sm text-[#C0C0C8] pl-9 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Input Area */}
      <div className="px-3 pb-3 pt-2 border-t border-[#39FF14]/10 bg-[#05050A]/50 space-y-2">
        {typing && mode === "live" && (
          <div className="flex items-center gap-2 px-2 text-[9px] text-[#39FF14]">
            <Zap className="w-2.5 h-2.5 animate-pulse" />
            <span>Typing...</span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            data-testid="chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={mode === "live" ? "Say something..." : "Leave a comment..."}
            className="h-10 bg-[#0F0F16]/80 border-white/15 text-white placeholder:text-[#5C5C6B] rounded-xl text-sm focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/30 transition-all"
          />
          <Button
            data-testid="chat-send-btn"
            onClick={sendMessage}
            size="icon"
            className="h-10 w-10 bg-gradient-to-br from-[#FF6B00] to-[#FF8533] hover:from-[#FF8533] hover:to-[#FFA050] text-white rounded-xl flex-shrink-0 shadow-[0_0_16px_rgba(255,107,0,0.3)] hover:shadow-[0_0_24px_rgba(255,107,0,0.5)] transition-all duration-200"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
