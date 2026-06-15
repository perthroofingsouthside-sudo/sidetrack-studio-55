import { useState } from "react";
import { Youtube, Music, Radio, Globe, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const DESTINATIONS = [
  { key: "internal_live",  Icon: Radio,   label: "Live Stage",   accent: "#FF6B00", note: "Stream to in-app viewers immediately" },
  { key: "youtube",        Icon: Youtube, label: "YouTube",      accent: "#FF0000", note: "Upload as video (needs YouTube OAuth)" },
  { key: "rtmp",           Icon: Radio,   label: "RTMP Live",    accent: "#39FF14", note: "Twitch / YouTube Live / custom server" },
  { key: "tiktok",         Icon: Music,   label: "TikTok",       accent: "#FF6B00", note: "Requires TikTok developer approval" },
  { key: "instagram",      Icon: Globe,   label: "Instagram",    accent: "#E1306C", note: "Native share (no upload API)" },
];

/**
 * PublishPanel — Post-record / live-broadcast destination picker.
 * For each destination shows real connection status from /api/publish/queue.
 */
export default function PublishPanel({ recording, song }) {
  const [selected, setSelected] = useState(new Set(["internal_live"]));
  const [rtmpUrl, setRtmpUrl] = useState("");
  const [rtmpKey, setRtmpKey] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);

  const toggle = (k) => {
    const next = new Set(selected);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelected(next);
  };

  const publish = async () => {
    if (selected.size === 0) { toast.error("Pick at least one destination"); return; }
    setPublishing(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/publish/queue`, {
        user_id: localStorage.getItem("sidetrack_voter_id") || "anon",
        recording_id: recording?.id,
        title: song?.title ? `${song.title} — Cover` : "My Pocket Products Performance",
        description: song?.artist ? `Cover of ${song.artist}` : "",
        destinations: Array.from(selected),
        rtmp_url: selected.has("rtmp") ? rtmpUrl : undefined,
        rtmp_key: selected.has("rtmp") ? rtmpKey : undefined,
      });
      if (res.data?.success) {
        setResult(res.data.destinations);
        toast.success("Publish queued");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Publish failed");
    } finally { setPublishing(false); }
  };

  return (
    <div className="rounded-2xl border border-[#FF6B00]/25 p-4 space-y-3"
         style={{ background: "rgba(255,107,0,0.04)" }} data-testid="publish-panel">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,107,0,0.18)" }}>
          <Radio className="w-4 h-4 text-[#FF6B00]" />
        </div>
        <div className="flex-1">
          <h3 className="font-['Outfit'] text-sm font-black text-white">Publish & Stream</h3>
          <p className="text-[10px] text-[#5C5C6B] font-medium">Pick where to send the performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DESTINATIONS.map(({ key, Icon, label, accent, note }) => {
          const isOn = selected.has(key);
          return (
            <button key={key} onClick={() => toggle(key)} data-testid={`publish-dest-${key}`}
              className={`flex items-start gap-2 p-2.5 rounded-xl text-left transition-all border ${
                isOn ? "border-white/30 bg-white/5" : "border-white/5 hover:border-white/15"
              }`}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                   style={{ background: `${accent}20` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">{label}</p>
                <p className="text-[9px] text-[#5C5C6B] leading-tight mt-0.5">{note}</p>
              </div>
              <span className={`w-3.5 h-3.5 rounded border-2 flex-shrink-0 ${isOn ? "border-[#39FF14] bg-[#39FF14]" : "border-white/20"}`} />
            </button>
          );
        })}
      </div>

      {selected.has("rtmp") && (
        <div className="space-y-1.5 p-2.5 rounded-xl border border-[#39FF14]/15" data-testid="publish-rtmp-fields">
          <p className="text-[9px] uppercase tracking-wider text-[#39FF14] font-bold">RTMP Credentials</p>
          <Input value={rtmpUrl} onChange={(e) => setRtmpUrl(e.target.value)}
            placeholder="rtmp://live.twitch.tv/app/"
            className="h-8 text-[11px] bg-[#0F0F16] border-white/10 focus-visible:ring-[#39FF14]/50"
            data-testid="publish-rtmp-url" />
          <Input value={rtmpKey} onChange={(e) => setRtmpKey(e.target.value)} type="password"
            placeholder="Stream key"
            className="h-8 text-[11px] bg-[#0F0F16] border-white/10 focus-visible:ring-[#39FF14]/50"
            data-testid="publish-rtmp-key" />
        </div>
      )}

      <Button onClick={publish} disabled={publishing || selected.size === 0}
        data-testid="publish-go-btn"
        className="w-full h-10 rounded-xl text-xs font-black text-[#05050A] bg-gradient-to-r from-[#FF6B00] to-[#39FF14] hover:opacity-90"
        style={{ boxShadow: "0 0 22px rgba(255,107,0,0.35)" }}>
        {publishing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Radio className="w-4 h-4 mr-1.5" />}
        {publishing ? "Publishing..." : `Go Live · ${selected.size} ${selected.size === 1 ? "destination" : "destinations"}`}
      </Button>

      {result && (
        <div className="space-y-1.5 pt-2 border-t border-white/5" data-testid="publish-result">
          {Object.entries(result).map(([k, v]) => {
            const okStates = ["live", "ready"];
            const isOk = okStates.includes(v.status);
            const dest = DESTINATIONS.find(d => d.key === k);
            return (
              <div key={k} className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                {isOk ? <CheckCircle2 className="w-3.5 h-3.5 text-[#39FF14] mt-0.5 shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-[#FF6B00] mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-white">{dest?.label || k}: <span className={isOk ? "text-[#39FF14]" : "text-[#FF6B00]"}>{v.status.replace("_", " ")}</span></p>
                  <p className="text-[9px] text-[#5C5C6B] leading-tight">{v.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
