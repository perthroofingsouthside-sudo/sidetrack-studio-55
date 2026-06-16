/* GamerTracksPage — Gamer-Mode primary catalog browser.
   Two collections: Triple J Hottest 100 (year-picker 1990-2025) and Top 200 Hip-Hop.
   Powered by /api/gamer/catalog/*. */
import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Loader2, Music2, Trophy, Flame, Search, Calendar, Disc3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API } from "@/App";

const COLLECTIONS = [
  { key: "hottest_100",     label: "Hottest 100", Icon: Trophy, accent: "#FF6B00" },
  { key: "hip_hop_top_200", label: "Top 200 Hip-Hop", Icon: Flame,   accent: "#39FF14" },
];

export default function GamerTracksPage({ onTrackSelect }) {
  const [collection, setCollection] = useState("hottest_100");
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(null);          // null = all years
  const [q, setQ] = useState("");
  const [tracks, setTracks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load year picker once
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/gamer/catalog/years`).then((r) => {
      if (cancelled) return;
      const list = r.data?.years || [];
      setYears(list);
      if (list.length && year == null) setYear(list[0]); // default to newest
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch tracks when filters change
  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ collection, limit: "200", enrich: "true" });
      if (collection === "hottest_100" && year != null) params.set("year", String(year));
      if (q.trim()) params.set("q", q.trim());
      const r = await axios.get(`${API}/gamer/catalog/tracks?${params}`);
      if (r.data?.success) { setTracks(r.data.tracks || []); setTotal(r.data.total || 0); }
    } catch (e) {
      console.error("[GamerTracks] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [collection, year, q]);

  useEffect(() => {
    const id = setTimeout(loadTracks, q ? 300 : 0); // debounce search
    return () => clearTimeout(id);
  }, [loadTracks, q]);

  const currentCollection = useMemo(() => COLLECTIONS.find((c) => c.key === collection), [collection]);

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="gamer-tracks-page">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-5 pb-3 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[160px]"
          style={{ background: `radial-gradient(ellipse at top, ${currentCollection.accent}26, transparent 70%)`, filter: "blur(8px)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <Disc3 className="w-3 h-3 text-[#39FF14] animate-spin" style={{ animationDuration: "6s" }} />
            <p className="text-[9px] uppercase tracking-[0.35em] font-black text-[#39FF14]">Gamer Library</p>
          </div>
          <h1 className="font-['Outfit'] font-black uppercase leading-none tracking-tight text-3xl sm:text-4xl"
              style={{ color: "white", textShadow: `0 0 18px ${currentCollection.accent}66` }}>
            <span className="text-white">Track</span>{" "}
            <span style={{ color: currentCollection.accent }}>Catalog</span>
          </h1>
          <p className="text-xs text-[#A0A0B0] mt-1.5">3,800+ tracks · Hottest 100 archive · Top 200 Hip-Hop · for Gamer-Mode performances</p>
        </div>
      </header>

      {/* Collection picker */}
      <div className="px-4 sm:px-6 pt-3 flex gap-1.5" data-testid="collection-picker">
        {COLLECTIONS.map(({ key, label, Icon, accent }) => {
          const active = collection === key;
          return (
            <button key={key} onClick={() => setCollection(key)} data-testid={`coll-${key}`}
              className="flex-1 sm:flex-none px-4 h-9 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              style={{
                background: active ? accent : "rgba(255,255,255,0.04)",
                color: active ? "#05050A" : "#A0A0B0",
                boxShadow: active ? `0 0 16px ${accent}80` : "none",
                border: `1px solid ${active ? accent : "rgba(255,255,255,0.08)"}`,
              }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Year picker — Hottest 100 only */}
      {collection === "hottest_100" && (
        <div className="px-4 sm:px-6 pt-3" data-testid="year-picker">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3 h-3 text-[#FF6B00]" />
            <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#FF6B00]">Year</p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {years.map((y) => (
              <button key={y} onClick={() => setYear(y)} data-testid={`year-${y}`}
                className={`flex-shrink-0 px-3 h-8 rounded-full text-[11px] font-black tracking-wider border transition-all ${
                  year === y
                    ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-[0_0_14px_rgba(255,107,0,0.5)]"
                    : "bg-transparent text-[#A0A0B0] border-white/10 hover:text-white hover:border-white/30"
                }`}>{y}</button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 sm:px-6 pt-2 pb-3 relative" data-testid="catalog-search-wrap">
        <Search className="absolute left-7 sm:left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C6B]" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} data-testid="catalog-search"
          placeholder="Search title or artist…"
          className="h-10 bg-[#0F0F16] border-white/10 text-white text-sm pl-9 placeholder:text-[#5C5C6B] rounded-xl" />
      </div>

      {/* Counter */}
      <div className="px-4 sm:px-6 pb-1.5 flex items-center justify-between" data-testid="catalog-count">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">
          {loading ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
            : `${total} track${total === 1 ? "" : "s"}`}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#39FF14] font-black">Gamer Mode</p>
      </div>

      {/* Track list */}
      <ScrollArea className="flex-1">
        <div className="px-4 sm:px-6 pb-32 space-y-1.5" data-testid="catalog-list">
          {!loading && tracks.length === 0 && (
            <div className="py-16 text-center" data-testid="catalog-empty">
              <Music2 className="w-12 h-12 text-[#FF6B00]/30 mx-auto mb-3" />
              <p className="text-sm font-bold text-white mb-1">No tracks found</p>
              <p className="text-[11px] text-[#5C5C6B]">Try a different year or clear your search.</p>
            </div>
          )}
          {tracks.map((t, i) => (
            <button key={t.track_id || i}
              data-testid={`catalog-track-${i}`}
              onClick={() => onTrackSelect && onTrackSelect({
                id: t.track_id,
                title: t.title,
                artist: t.artist,
                album: t.album || (t.collection?.includes("hottest_100") ? `Hottest 100 — ${t.year}` : "Top 200 Hip-Hop"),
                cover_url: t.cover_url || "",
                genre: t.source === "top_200_hip_hop" ? "hip_hop" : "alt_rock",
                preview_url: t.preview_url || "",
                year: t.year,
                rank: t.rank,
              })}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/5 hover:border-[#FF6B00]/30 hover:bg-[#FF6B00]/5 transition-all text-left group">
              {/* Rank badge */}
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-['Outfit'] font-black text-sm"
                style={{
                  background: t.source === "top_200_hip_hop" ? "rgba(57,255,20,0.12)" : "rgba(255,107,0,0.12)",
                  color: t.source === "top_200_hip_hop" ? "#39FF14" : "#FF6B00",
                  border: `1px solid ${t.source === "top_200_hip_hop" ? "rgba(57,255,20,0.25)" : "rgba(255,107,0,0.25)"}`,
                }}>
                #{t.rank}
              </div>
              {/* Cover */}
              <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                {t.cover_url ? (
                  <img src={t.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-[#12121A] flex items-center justify-center">
                    <Music2 className="w-4 h-4 text-[#5C5C6B]" />
                  </div>
                )}
              </div>
              {/* Title / artist */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate group-hover:text-[#FF6B00] transition-colors">{t.title}</p>
                <p className="text-[11px] text-[#A0A0B0] truncate">{t.artist}</p>
              </div>
              {/* Year chip — Hottest 100 only */}
              {t.year > 0 && (
                <span className="hidden sm:inline-flex items-center px-2 h-6 rounded-full border border-white/10 text-[10px] font-black tracking-wider text-[#A0A0B0]" data-testid={`catalog-track-${i}-year`}>
                  {t.year}
                </span>
              )}
              <span className="text-[10px] text-[#FF6B00] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Play</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
