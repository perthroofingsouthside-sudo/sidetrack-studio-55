import { useState, useEffect, useRef } from "react";
import { Search, Music2, Gamepad2, Lock, ArrowRight, Mic2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

/**
 * GamerPage — Gamer-lane track picker.
 * Workflow: search/pick a track → catalog gate check → Backstage transition.
 * Gamer recordings are PRIVATE (no social fanout).
 */
export default function GamerPage({ onPickedTrack, onOpenBackstage }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState([]);
  const [loading, setLoading] = useState(false);
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");

  useEffect(() => { loadRecents(); /* eslint-disable-next-line */ }, []);

  const loadRecents = async () => {
    try {
      const res = await axios.get(`${API}/gamer/recordings/${userId.current}`);
      if (res.data.success) setRecents(res.data.recordings || []);
    } catch (err) { console.error("Gamer recents err", err); }
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/music/search`, { params: { query, limit: 12 } });
      setResults(res.data?.tracks || res.data?.results || []);
    } catch (err) {
      console.error("Gamer search err", err);
      toast.error("Search failed");
    } finally { setLoading(false); }
  };

  const pickTrack = (track) => {
    onPickedTrack(track);
    onOpenBackstage(track);
  };

  return (
    <div className="min-h-screen bg-[#05050A] pb-28" data-testid="gamer-page">
      {/* Hero */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#39FF14]/8 via-[#05050A] to-[#05050A] z-0" />
        <div className="relative z-10 flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(57,255,20,0.12)", boxShadow: "0 0 24px rgba(57,255,20,0.25)" }}>
            <Gamepad2 className="w-6 h-6 text-[#39FF14]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white">
              <span className="text-[#39FF14] glow-text-green">Gamer</span> Lane
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">Private · Skill-build · Backstage AI</p>
          </div>
        </div>
        <div className="relative z-10 rounded-2xl border border-[#39FF14]/15 p-3 flex items-center gap-2.5" style={{ background: "rgba(57,255,20,0.04)" }}>
          <Lock className="w-3.5 h-3.5 text-[#39FF14] shrink-0" />
          <p className="text-[10px] text-[#A0A0B0] leading-snug">
            <span className="text-[#39FF14] font-bold">Private mode</span> — Recordings stay yours. No social posting, no battles. Step backstage, get hyped, take the stage.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C6B]" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Search the catalog…"
              className="pl-9 h-11 bg-[#0F0F16] border-white/5 focus-visible:ring-[#39FF14]/50 text-sm"
              data-testid="gamer-search-input" />
          </div>
          <Button onClick={doSearch} disabled={loading} data-testid="gamer-search-btn"
            className="h-11 px-5 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-bold text-sm" style={{ boxShadow: "0 0 18px rgba(57,255,20,0.35)" }}>
            <Search className="w-4 h-4 mr-1.5" /> Find
          </Button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="px-4 mb-6" data-testid="gamer-search-results">
          <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-2">Results</h3>
          <div className="space-y-1.5">
            {results.map((t, idx) => (
              <button key={t.id || idx} onClick={() => pickTrack(t)} data-testid={`gamer-track-${idx}`}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-[#39FF14]/30 hover:bg-[#39FF14]/5 transition-all text-left">
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5 flex-shrink-0">
                  {t.cover_url ? <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-[#39FF14] text-sm font-bold">{t.title?.[0] || "?"}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{t.title}</p>
                  <p className="text-[10px] text-[#5C5C6B] truncate">{t.artist}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#39FF14]/40 group-hover:text-[#39FF14] transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent private recordings */}
      <div className="px-4">
        <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-2 flex items-center gap-2">
          <Lock className="w-3 h-3 text-[#39FF14]" /> Your Private Recordings
        </h3>
        {recents.length === 0 ? (
          <div className="rounded-xl border border-white/5 p-6 text-center" data-testid="gamer-recents-empty">
            <Mic2 className="w-7 h-7 text-[#39FF14]/30 mx-auto mb-2" />
            <p className="text-[11px] text-[#5C5C6B]">No private recordings yet. Pick a track to start your set.</p>
          </div>
        ) : (
          <div className="space-y-1.5" data-testid="gamer-recents-list">
            {recents.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#0A0A0F]">
                <div className="w-9 h-9 rounded-lg bg-[#39FF14]/10 flex items-center justify-center flex-shrink-0">
                  <Music2 className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{r.song_title || "Untitled"}</p>
                  <p className="text-[10px] text-[#5C5C6B] truncate">{r.artist || ""} · {Math.round(r.duration_sec || 0)}s</p>
                </div>
                <Lock className="w-3 h-3 text-[#39FF14]/40" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 mt-6">
        <p className="text-[10px] text-[#5C5C6B] text-center">
          <Sparkles className="inline w-3 h-3 mr-1 text-[#FF5F1F]" />
          Every track, every mode — <span className="text-[#39FF14] font-bold">100% free</span>.
        </p>
      </div>
    </div>
  );
}
