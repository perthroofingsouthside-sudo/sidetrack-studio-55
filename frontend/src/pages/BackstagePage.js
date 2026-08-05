import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Play, Pause, Check, Trash2, Loader2, Music2, Clock, Archive, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import BackstageCinema from "@/components/BackstageCinema";

const TABS = [
  { key: "pending_review", label: "Pending", accent: "#FF5F1F" },
  { key: "kept", label: "Kept", accent: "#39FF14" },
  { key: "discarded", label: "Discarded", accent: "#5C5C6B" },
];

/**
 * BackstagePage — Gamer-lane recording archive.
 *
 * Every karaoke / battle performance in Gamer lane is auto-recorded and lands
 * here under "Pending" with Keep / Discard buttons. Kept recordings persist
 * to the user's library; discarded ones are soft-deleted (visible under
 * the Discarded tab in case they change their mind).
 */
export default function BackstagePage() {
  const [tab, setTab] = useState("pending_review");
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [cinemaRec, setCinemaRec] = useState(null);
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/gamer/recordings/${userId.current}?status=${tab}&limit=50`);
      if (res.data?.success) setRecordings(res.data.recordings || []);
    } catch (err) {
      console.error("[Backstage] load failed", err?.message);
      toast.error("Couldn't load performances");
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const review = async (rec, action) => {
    setActing(rec.id);
    try {
      await axios.post(`${API}/gamer/recordings/${rec.id}/review`, {
        user_id: userId.current,
        action,
      });
      toast.success(action === "keep" ? "Saved to your library" : "Performance discarded");
      load();
    } catch (err) {
      console.error("[Backstage] review failed", err?.message);
      toast.error(`Couldn't ${action} the recording`);
    } finally { setActing(null); }
  };

  const togglePlay = (rec) => {
    if (!rec.blob_url) { toast.message("No playback file available"); return; }
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(rec.blob_url);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { toast.error("Playback unavailable"); setPlayingId(null); };
    audio.play().catch(err => { toast.error("Playback blocked"); setPlayingId(null); });
    audioRef.current = audio;
    setPlayingId(rec.id);
  };

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  const pendingCount = tab === "pending_review" ? recordings.length : undefined;

  return (
    <div className="min-h-screen bg-[#05050A] pb-28" data-testid="backstage-page">
      {/* Hero */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#39FF14]/8 via-[#05050A] to-[#05050A] z-0" />
        <div className="relative z-10 flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(57,255,20,0.12)", boxShadow: "0 0 24px rgba(57,255,20,0.25)" }}>
            <Archive className="w-6 h-6 text-[#39FF14]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white">
              <span className="text-[#39FF14] glow-text-green">Backstage</span>
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">
              Every set recorded · Keep what&rsquo;s worth keeping
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="relative z-10 inline-flex items-center gap-1 rounded-full border border-white/10 p-1 mt-2"
             style={{ background: "rgba(15,15,22,0.6)" }} data-testid="backstage-tabs">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              data-testid={`backstage-tab-${t.key}`}
              className={`px-3.5 h-8 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                tab === t.key
                  ? "text-[#05050A]"
                  : "text-[#5C5C6B]"
              }`}
              style={tab === t.key ? {
                background: t.accent,
                boxShadow: `0 0 14px ${t.accent}55`,
              } : undefined}
            >
              {t.label}
              {tab === t.key && pendingCount !== undefined && t.key === "pending_review" && pendingCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] bg-[#05050A] text-[#FF5F1F] font-bold">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-[#39FF14] animate-spin" />
            <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold">Loading performances…</p>
          </div>
        ) : recordings.length === 0 ? (
          <div className="py-16 rounded-2xl border border-dashed border-white/10 flex flex-col items-center gap-2"
               data-testid="backstage-empty">
            <Music2 className="w-9 h-9 text-[#39FF14]/30" />
            <p className="text-sm font-bold text-white">
              {tab === "pending_review" && "No pending performances"}
              {tab === "kept" && "Nothing saved yet"}
              {tab === "discarded" && "No discarded performances"}
            </p>
            <p className="text-[11px] text-[#5C5C6B] px-8 text-center">
              {tab === "pending_review"
                ? "Head to Battle and pick a karaoke track — your performance will appear here for review."
                : tab === "kept"
                  ? "Performances you keep will show up here."
                  : "Discarded performances live here in case you change your mind."}
            </p>
            {tab === "kept" && (
              <Button
                onClick={() => setCinemaRec({
                  id: "demo-cinematic",
                  song_title: "Demo Performance",
                  artist: "Pocket Products",
                  duration_sec: 32,
                  blob_url: null,
                  created_at: new Date().toISOString(),
                  views: 0,
                  likes: 0,
                })}
                data-testid="backstage-demo-cinema"
                className="mt-4 h-9 px-4 rounded-full text-[10px] font-black bg-[#FF5F1F] hover:bg-[#FF7A42] text-white gap-1.5 uppercase tracking-wider"
                style={{ boxShadow: "0 0 14px rgba(255,95,31,0.45)" }}
              >
                <Film className="w-3 h-3" /> Preview Cinematic Intro
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2" data-testid="backstage-list">
            {recordings.map(r => {
              const isPlaying = playingId === r.id;
              const isPending = tab === "pending_review";
              return (
                <div key={r.id}
                  data-testid={`backstage-rec-${r.id}`}
                  className="rounded-xl border border-white/5 hover:border-[#39FF14]/30 transition-all overflow-hidden"
                  style={{ background: "rgba(15,15,22,0.5)" }}>
                  <div className="flex items-center gap-3 p-3">
                    <button onClick={() => togglePlay(r)}
                      data-testid={`backstage-play-${r.id}`}
                      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isPlaying ? "bg-[#FF5F1F]" : "bg-[#39FF14]/15 hover:bg-[#39FF14]/25"
                      }`}
                      style={isPlaying ? { boxShadow: "0 0 16px rgba(255,95,31,0.45)" } : undefined}>
                      {isPlaying
                        ? <Pause className="w-4 h-4 text-white" />
                        : <Play className="w-4 h-4 text-[#39FF14] ml-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{r.song_title || "Untitled performance"}</p>
                      <p className="text-[10px] text-[#5C5C6B] truncate flex items-center gap-2">
                        <Clock className="w-2.5 h-2.5" />
                        {Math.round(r.duration_sec || 0)}s
                        {r.artist && ` · ${r.artist}`}
                        {r.created_at && ` · ${new Date(r.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button onClick={() => review(r, "keep")} disabled={acting === r.id}
                          data-testid={`backstage-keep-${r.id}`}
                          className="h-8 px-3 rounded-lg bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] text-[10px] font-black gap-1"
                          style={{ boxShadow: "0 0 12px rgba(57,255,20,0.35)" }}>
                          {acting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Keep</>}
                        </Button>
                        <Button onClick={() => review(r, "discard")} disabled={acting === r.id}
                          data-testid={`backstage-discard-${r.id}`}
                          className="h-8 px-3 rounded-lg text-[10px] font-bold border border-red-500/30 text-red-400 bg-transparent hover:bg-red-500/10 gap-1">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {tab === "kept" && (
                      <Button
                        onClick={() => setCinemaRec(r)}
                        data-testid={`backstage-watch-${r.id}`}
                        className="h-8 px-3 rounded-lg text-[10px] font-black bg-[#FF5F1F] hover:bg-[#FF7A42] text-white gap-1 uppercase tracking-wider flex-shrink-0"
                        style={{ boxShadow: "0 0 12px rgba(255,95,31,0.45)" }}
                      >
                        <Film className="w-3 h-3" /> Watch
                      </Button>
                    )}
                    {tab === "discarded" && (
                      <Button onClick={() => review(r, "keep")} disabled={acting === r.id}
                        data-testid={`backstage-restore-${r.id}`}
                        className="h-8 px-3 rounded-lg text-[10px] font-bold border border-[#39FF14]/30 text-[#39FF14] bg-transparent hover:bg-[#39FF14]/10 flex-shrink-0">
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 mt-6 text-center">
        <p className="text-[10px] text-[#5C5C6B]">
          <Sparkles className="inline w-3 h-3 mr-1 text-[#39FF14]" />
          Recordings are private to you. Backstage is your performance archive.
        </p>
      </div>
      {/* Cinematic playback overlay */}
      {cinemaRec && (
        <BackstageCinema
          recording={cinemaRec}
          currentUserId={userId.current}
          onClose={() => { setCinemaRec(null); load(); }}
        />
      )}
    </div>
  );
}
