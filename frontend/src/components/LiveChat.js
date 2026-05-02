import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Radio, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const MOCK_LIVE = [
  { id: 1, user: "DJ_Nova", text: "This track is fire!", ts: Date.now() - 30000 },
  { id: 2, user: "BeatKing", text: "Can you play some R&B next?", ts: Date.now() - 22000 },
  { id: 3, user: "VibeCheck", text: "Love the bass on this one", ts: Date.now() - 15000 },
];

export default function LiveChat({ trackTitle }) {
  const [mode, setMode] = useState("live"); // live | comments
  const [messages, setMessages] = useState(MOCK_LIVE);
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [username] = useState(() => localStorage.getItem("sidetrack_username") || "You");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg = { id: Date.now(), user: username, text: input.trim(), ts: Date.now() };
    if (mode === "live") {
      setMessages((prev) => [...prev, msg]);
    } else {
      setComments((prev) => [...prev, msg]);
    }
    setInput("");
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full retro-terminal rounded-xl overflow-hidden" data-testid="live-chat">
      {/* Toggle tabs */}
      <div className="flex border-b border-[#00E5FF]/10" data-testid="live-chat-toggle">
        <button
          data-testid="chat-tab-live"
          onClick={() => setMode("live")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all ${
            mode === "live" ? "text-[#00E5FF] border-b-2 border-[#00E5FF]" : "text-[#5C5C6B] hover:text-[#8F8F9D]"
          }`}
        >
          <Radio className="w-3 h-3" /> Live
        </button>
        <button
          data-testid="chat-tab-comments"
          onClick={() => setMode("comments")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all ${
            mode === "comments" ? "text-[#00E5FF] border-b-2 border-[#00E5FF]" : "text-[#5C5C6B] hover:text-[#8F8F9D]"
          }`}
        >
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
                <span className="text-xs font-bold text-[#00E5FF]">{msg.user}</span>
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
                  <div className="w-5 h-5 rounded-full bg-[#8A2BE2]/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-[#8A2BE2]">{c.user[0]}</span>
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
      <div className="px-3 pb-3 pt-2 border-t border-[#00E5FF]/10">
        <div className="flex gap-2">
          <Input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={mode === "live" ? "Say something..." : "Leave a comment..."}
            className="h-9 bg-transparent border-white/20 text-white placeholder:text-[#5C5C6B] rounded-lg text-sm focus:border-[#8A2BE2]"
          />
          <Button
            data-testid="chat-send-btn"
            onClick={sendMessage}
            size="icon"
            className="h-9 w-9 bg-[#8A2BE2] hover:bg-[#A64DFF] hover:shadow-[0_0_20px_rgba(138,43,226,0.6)] rounded-lg flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
