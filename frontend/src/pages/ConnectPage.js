import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Video, Phone, Send, ArrowLeft, UserPlus, Music2, Check, X, Mic, Camera, CameraOff, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function ConnectPage() {
  const [view, setView] = useState("inbox"); // inbox | chat | call
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [newDmUser, setNewDmUser] = useState("");
  const [showNewDm, setShowNewDm] = useState(false);
  const [jamInvites, setJamInvites] = useState([]);
  const [callActive, setCallActive] = useState(false);
  const [callUser, setCallUser] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");
  const username = localStorage.getItem("sidetrack_username") || "Fan";
  const scrollRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/messages/conversations/${username || userId.current}`);
      if (res.data.success) setConversations(res.data.conversations);
    } catch (err) { console.error("Connect load error:", err); }
  }, [username]);

  const loadJamInvites = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jam/invites/${username || userId.current}`);
      if (res.data.success) setJamInvites(res.data.received || []);
    } catch (err) { console.error("Connect load error:", err); }
  }, [username]);

  useEffect(() => {
    loadConversations();
    loadJamInvites();
  }, [loadConversations, loadJamInvites]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openConversation = async (convo) => {
    setActiveConvo(convo);
    setView("chat");
    try {
      const res = await axios.get(`${API}/messages/${convo.convo_id}?limit=50`);
      if (res.data.success) setMessages(res.data.messages);
      await axios.post(`${API}/messages/${convo.convo_id}/read`, `user_id=${username || userId.current}`, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    } catch (err) { console.error("Connect load error:", err); }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConvo) return;
    const other = activeConvo.other_user;
    try {
      await axios.post(`${API}/messages/send`, {
        from_user: username || userId.current,
        to_user: other,
        text: input.trim(),
      });
      setInput("");
      const res = await axios.get(`${API}/messages/${activeConvo.convo_id}?limit=50`);
      if (res.data.success) setMessages(res.data.messages);
    } catch { toast.error("Failed to send"); }
  };

  const startNewDm = async () => {
    if (!newDmUser.trim()) return;
    const pair = [username || userId.current, newDmUser.trim()].sort();
    const convoId = `${pair[0]}___${pair[1]}`;
    setActiveConvo({ convo_id: convoId, other_user: newDmUser.trim(), participants: pair });
    setMessages([]);
    setView("chat");
    setShowNewDm(false);
    setNewDmUser("");
  };

  const startCall = async (user) => {
    setCallUser(user);
    setCallActive(true);
    setView("call");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera/mic access error:", err);
      toast.error("Camera/mic access denied");
    }
  };

  const endCall = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCallActive(false);
    setCallUser(null);
    setView(activeConvo ? "chat" : "inbox");
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setCameraOn(!cameraOn);
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setMicOn(!micOn);
    }
  };

  const respondToInvite = async (inviteId, action) => {
    try {
      await axios.post(`${API}/jam/invites/${inviteId}/respond`, `action=${action}`, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      toast.success(action === "accepted" ? "Jam invite accepted!" : "Invite declined");
      loadJamInvites();
    } catch { toast.error("Failed to respond"); }
  };

  const sendJamInvite = async () => {
    if (!activeConvo) return;
    try {
      await axios.post(`${API}/jam/invite`, {
        from_user: username || userId.current,
        to_user: activeConvo.other_user,
        message: "Let's jam together!",
      });
      toast.success(`Jam invite sent to ${activeConvo.other_user}!`);
    } catch { toast.error("Failed to send invite"); }
  };

  // ── CALL VIEW ──
  if (view === "call") {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="call-view">
        {/* Video area */}
        <div className="flex-1 relative flex items-center justify-center bg-[#0A0A10]">
          {/* Self video */}
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full max-h-[60vh] object-cover rounded-3xl border border-white/5" data-testid="self-video" />
          {!cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A10]">
              <CameraOff className="w-16 h-16 text-[#5C5C6B]" />
            </div>
          )}
          {/* Call info */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
            <p className="text-sm font-bold text-white">{callUser || "Calling..."}</p>
            <p className="text-[10px] text-[#39FF14] uppercase tracking-wider animate-pulse">Connecting...</p>
          </div>
        </div>

        {/* Call controls */}
        <div className="px-6 py-6 flex items-center justify-center gap-4" data-testid="call-controls">
          <Button onClick={toggleMic} variant="ghost" className={`w-14 h-14 rounded-full ${micOn ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400"}`} data-testid="toggle-mic">
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>
          <Button onClick={toggleCamera} variant="ghost" className={`w-14 h-14 rounded-full ${cameraOn ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400"}`} data-testid="toggle-camera">
            {cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </Button>
          <Button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white" data-testid="end-call-btn">
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    );
  }

  // ── CHAT VIEW ──
  if (view === "chat" && activeConvo) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="chat-view">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setView("inbox"); setActiveConvo(null); }} className="text-[#5C5C6B] hover:text-white" data-testid="chat-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-full bg-[#FF6B00]/15 flex items-center justify-center">
            <span className="text-xs font-bold text-[#FF6B00]">{(activeConvo.other_user || "?")[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate" data-testid="chat-user-name">{activeConvo.other_user}</p>
            <p className="text-[9px] text-[#39FF14] uppercase tracking-wider">Online</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => startCall(activeConvo.other_user)} className="text-[#39FF14] hover:bg-[#39FF14]/10 rounded-full" data-testid="start-video-call">
            <Video className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={sendJamInvite} className="text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded-full" data-testid="send-jam-invite" title="Invite to Jam">
            <Music2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" ref={scrollRef} data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="w-10 h-10 text-[#FF6B00]/15 mx-auto mb-3" />
              <p className="text-sm text-[#5C5C6B]">Start the conversation</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.from_user === (username || userId.current);
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`} data-testid="chat-message-bubble">
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? "bg-[#FF6B00] text-white rounded-br-md"
                    : "bg-white/5 text-[#C0C0C8] rounded-bl-md"
                }`}>
                  {msg.text}
                  {msg.media_url && <p className="text-[10px] mt-1 opacity-60">[{msg.media_type || "media"}]</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="flex gap-2">
            <Input data-testid="dm-input" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              className="h-11 bg-[#0F0F16] border-white/10 text-white placeholder:text-[#5C5C6B] rounded-xl text-sm focus:border-[#FF6B00]" />
            <Button data-testid="dm-send-btn" onClick={sendMessage}
              className="h-11 w-11 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── INBOX VIEW ──
  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="connect-page">
      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="px-4 sm:px-6 py-6 pb-24 max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="font-['Outfit'] text-2xl font-black text-white" data-testid="connect-heading">Connect</h1>
            <Button onClick={() => setShowNewDm(true)} className="h-9 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF8533] text-white text-xs font-bold gap-1.5" data-testid="new-dm-btn">
              <UserPlus className="w-3.5 h-3.5" /> New Message
            </Button>
          </div>

          {/* New DM Input */}
          {showNewDm && (
            <div className="flex gap-2" data-testid="new-dm-section">
              <Input value={newDmUser} onChange={(e) => setNewDmUser(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startNewDm()}
                placeholder="Enter username..."
                className="h-10 bg-[#0F0F16] border-white/10 text-white rounded-xl text-sm focus:border-[#FF6B00]"
                data-testid="new-dm-input" autoFocus />
              <Button onClick={startNewDm} className="h-10 px-4 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/80 text-[#05050A] text-xs font-bold" data-testid="new-dm-start">Start</Button>
              <Button onClick={() => setShowNewDm(false)} variant="ghost" className="h-10 text-[#5C5C6B]">Cancel</Button>
            </div>
          )}

          {/* Jam Invites */}
          {jamInvites.length > 0 && (
            <section data-testid="jam-invites-section">
              <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#39FF14] mb-3 flex items-center gap-2">
                <Music2 className="w-3.5 h-3.5" /> Jam Invites
              </h3>
              <div className="space-y-2">
                {jamInvites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/5" data-testid={`jam-invite-${inv.id}`}>
                    <div className="w-9 h-9 rounded-full bg-[#39FF14]/15 flex items-center justify-center shrink-0">
                      <Music2 className="w-4 h-4 text-[#39FF14]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{inv.from_user}</p>
                      <p className="text-[10px] text-[#5C5C6B]">{inv.message || "Wants to jam with you!"}</p>
                    </div>
                    <Button onClick={() => respondToInvite(inv.id, "accepted")} size="icon" className="w-8 h-8 rounded-full bg-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/30" data-testid={`accept-jam-${inv.id}`}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => respondToInvite(inv.id, "declined")} size="icon" variant="ghost" className="w-8 h-8 rounded-full text-[#5C5C6B] hover:text-red-400" data-testid={`decline-jam-${inv.id}`}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Conversations */}
          <section data-testid="conversations-section">
            <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-3 flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-[#FF6B00]" /> Messages
            </h3>
            {conversations.length === 0 ? (
              <div className="text-center py-12 surface-card rounded-2xl">
                <MessageCircle className="w-10 h-10 text-[#FF6B00]/15 mx-auto mb-3" />
                <p className="text-sm text-[#5C5C6B]">No messages yet</p>
                <p className="text-xs text-[#5C5C6B]/60 mt-1">Tap "New Message" to start a conversation</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((convo) => (
                  <button key={convo.convo_id} onClick={() => openConversation(convo)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-all text-left group"
                    data-testid={`convo-${convo.convo_id}`}>
                    <div className="w-11 h-11 rounded-full bg-[#FF6B00]/10 flex items-center justify-center shrink-0 border border-[#FF6B00]/20 group-hover:border-[#FF6B00]/40">
                      <span className="text-sm font-bold text-[#FF6B00]">{(convo.other_user || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white truncate">{convo.other_user}</p>
                        {convo.unread > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#FF6B00] text-white text-[9px] font-bold flex items-center justify-center" data-testid="unread-badge">{convo.unread}</span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C5C6B] truncate">{convo.last_message}</p>
                    </div>
                    {/* Quick call */}
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); startCall(convo.other_user); }}
                      className="text-[#39FF14]/60 hover:text-[#39FF14] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`quick-call-${convo.other_user}`}>
                      <Phone className="w-4 h-4" />
                    </Button>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
