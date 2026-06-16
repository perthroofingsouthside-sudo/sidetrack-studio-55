import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Mic, Search, Music2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";

export default function RecordSearchScreen({ onSongSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const lane = (typeof window !== "undefined" && localStorage.getItem("pp_lane")) || "creator";
  const isCreator = lane === "creator";

  useEffect(() => {
    if (isCreator && onSongSelect) {
      onSongSelect({
        id: "original_" + crypto.randomUUID(),
        title: "Original Session",
        artist: localStorage.getItem("sidetrack_username") || "You",
        album: "", cover_url: "", genre: "Original", preview_url: "",
      });
      return;
    }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/music/search?q=${encodeURIComponent(query)}&limit=15`);
      if (res.data?.success) setResults(res.data.tracks);
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  };

  const selectTrack = (track) => {
    if (onSongSelect) onSongSelect({
      id: track.id || crypto.randomUUID(), title: track.title, artist: track.artist,
      album: track.album || "", cover_url: track.cover_url || "", genre: track.genre || "",
      preview_url: track.preview_url || "",
    });
  };

  if (isCreator) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center" data-testid="record-search-screen">
        <Sparkles className="w-10 h-10 text-[#FF6B00]/40 mb-3 animate-pulse" />
        <p className="text-sm text-[#5C5C6B]">Opening Original Live Stage…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="record-search-screen">
      <div className={`flex-1 flex flex-col items-center px-6 ${results.length ? "pt-8" : "justify-center"}`}>
        <Mic className="w-12 h-12 text-[#39FF14]/30 mb-3" />
        <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white mb-1" data-testid="record-search-title">
          Pick a <span className="text-[#39FF14]">Karaoke</span> Track
        </h2>
        <p className="text-sm text-[#5C5C6B] mb-6 text-center">
          Curated MTV / MOS / Hip-Hop / Alt-Rock catalog. Sing or jam over the song.
        </p>

        <div className="w-full max-w-lg flex gap-2 mb-4">
          <Input
            ref={inputRef}
            data-testid="record-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search the catalog..."
            className="h-12 bg-[#0F0F16] border-white/10 text-white placeholder:text-[#5C5C6B] rounded-xl text-base focus:border-[#39FF14] focus:ring-[#39FF14]/20"
          />
          <Button
            data-testid="record-search-btn"
            onClick={doSearch}
            disabled={searching}
            className="h-12 px-6 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-bold text-sm shrink-0"
            style={{ boxShadow: "0 0 20px rgba(57,255,20,0.3)" }}
          >
            {searching ? <span className="animate-pulse">...</span> : <><Search className="w-4 h-4 mr-1.5" /> Search</>}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="w-full max-w-lg space-y-1 pb-24" data-testid="record-search-results">
            {results.map((track, idx) => (
              <button
                key={track.id || idx}
                data-testid={`record-track-${idx}`}
                onClick={() => selectTrack(track)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#FF6B00]/8 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 group-hover:border-[#FF6B00]/30 relative">
                  {track.cover_url ? (
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-[#12121A] flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-[#5C5C6B]" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Mic className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#FF6B00] transition-colors">{track.title}</p>
                  <p className="text-[10px] text-[#5C5C6B] truncate">{track.artist}{track.album ? ` — ${track.album}` : ""}</p>
                </div>
                <span className="text-[10px] text-[#FF6B00] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Record</span>
              </button>
            ))}
          </div>
        )}

        {results.length === 0 && !searching && query && (
          <p className="text-sm text-[#5C5C6B]">No results found. Try a different search.</p>
        )}
      </div>
    </div>
  );
}
