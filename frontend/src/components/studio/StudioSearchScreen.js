/* Studio Search + Original Mode screen — extracted from PlayerStudio */
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Loader2, Music2, Mic, Search, Sparkles, Upload, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";

export default function StudioSearchScreen({ onSongSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("create"); // create | mytracks
  const [myTracks, setMyTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [showRecordPicker, setShowRecordPicker] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const inputRef = useRef(null);
  const deviceImportRef = useRef(null);
  const userId = useRef(localStorage.getItem("sidetrack_voter_id") || "anon");
  const lane = (typeof window !== "undefined" && localStorage.getItem("pp_lane")) || "creator";
  const isCreator = lane === "creator";

  // Creator lane is ALWAYS in Original Studio
  useEffect(() => {
    if (isCreator) setShowOriginal(true);
  }, [isCreator]);

  // Load My Tracks when that tab opens
  useEffect(() => {
    if (activeTab !== "mytracks") return;
    setLoadingTracks(true);
    Promise.all([
      axios.get(`${API}/recordings?user_id=${encodeURIComponent(userId.current)}`).catch(() => ({ data: { recordings: [] } })),
      axios.get(`${API}/gamer/recordings/${encodeURIComponent(userId.current)}`).catch(() => ({ data: { recordings: [] } })),
    ]).then(([cr, gr]) => {
      const creator = (cr.data?.recordings || []).map((r) => ({ ...r, lane: r.lane || "creator" }));
      const gamer = (gr.data?.recordings || []).map((r) => ({ ...r, lane: "gamer" }));
      setMyTracks([...creator, ...gamer].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
      setLoadingTracks(false);
    });
  }, [activeTab]);

  useEffect(() => { if (!showOriginal && !isCreator) inputRef.current?.focus(); }, [showOriginal, isCreator]);

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

  const handleDeviceImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50MB)"); return; }
    setImporting(true);
    try {
      const url = URL.createObjectURL(file);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const song = {
        id: `import-${Date.now()}`,
        title: baseName || "Imported Track",
        artist: localStorage.getItem("sidetrack_username") || "You",
        album: "Device Import",
        cover_url: "",
        genre: "imported",
        preview_url: url,
        is_local_import: true,
        local_blob: file,
      };
      if (onSongSelect) onSongSelect(song);
      toast.success(`Imported "${baseName}" — opening in Studio`);
    } catch {
      toast.error("Couldn't import file");
    } finally {
      setImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleStemUpload = async (stemType, file) => {
    if (!file) return;
    setUploading(stemType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("stem_type", stemType);
      formData.append("username", localStorage.getItem("sidetrack_username") || "anonymous");
      await axios.post(`${API}/recordings`, { song_id: "original", title: `Original ${stemType}`, recording_type: stemType });
      toast.success(`${stemType} stem uploaded!`);
    } catch { toast.error(`Failed to upload ${stemType}`); }
    finally { setUploading(null); }
  };

  const openRecordPicker = () => {
    setShowRecordPicker(true);
    setLoadingTracks(true);
    Promise.all([
      axios.get(`${API}/recordings?user_id=${encodeURIComponent(userId.current)}`).catch(() => ({ data: { recordings: [] } })),
      axios.get(`${API}/gamer/recordings/${encodeURIComponent(userId.current)}`).catch(() => ({ data: { recordings: [] } })),
    ]).then(([cr, gr]) => {
      const creator = (cr.data?.recordings || []).map((r) => ({ ...r, lane: r.lane || "creator" }));
      const gamer = (gr.data?.recordings || []).map((r) => ({ ...r, lane: "gamer" }));
      setRecordings([...creator, ...gamer].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
      setLoadingTracks(false);
    });
  };

  if (showOriginal) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center px-6 pt-6" data-testid="original-mode">
        {isCreator && (
          <div className="flex items-center gap-1 mb-6 rounded-full border border-white/10 p-1" style={{ background: "rgba(15,15,22,0.6)" }} data-testid="studio-tabs">
            <button onClick={() => setActiveTab("create")} data-testid="studio-tab-create"
              className={`px-4 h-8 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${
                activeTab === "create" ? "bg-[#FF6B00] text-white shadow-[0_0_14px_rgba(255,107,0,0.4)]" : "text-[#5C5C6B]"
              }`}>
              Create
            </button>
            <button onClick={() => setActiveTab("mytracks")} data-testid="studio-tab-mytracks"
              className={`px-4 h-8 rounded-full text-[11px] font-black uppercase tracking-wider transition-all ${
                activeTab === "mytracks" ? "bg-[#39FF14] text-[#05050A] shadow-[0_0_14px_rgba(57,255,20,0.4)]" : "text-[#5C5C6B]"
              }`}>
              My Tracks
            </button>
          </div>
        )}

        {activeTab === "mytracks" ? (
          <div className="w-full max-w-md" data-testid="studio-my-tracks">
            <h2 className="font-['Outfit'] text-2xl font-black text-white mb-1 text-center">
              My <span className="text-[#39FF14]">Tracks</span>
            </h2>
            <p className="text-xs text-[#5C5C6B] mb-5 text-center">Every recording you've made in the Studio</p>
            {loadingTracks ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#39FF14] animate-spin" />
                <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold">Loading tracks…</p>
              </div>
            ) : myTracks.length === 0 ? (
              <div className="py-12 rounded-2xl border border-dashed border-white/10 flex flex-col items-center gap-2" data-testid="studio-my-tracks-empty">
                <Music2 className="w-8 h-8 text-[#39FF14]/30" />
                <p className="text-sm font-bold text-white">No tracks yet</p>
                <p className="text-[11px] text-[#5C5C6B] px-6 text-center">Record on the Record page or upload from device to start your library.</p>
                <Button onClick={() => setActiveTab("create")} className="mt-3 h-9 rounded-full bg-[#FF6B00] hover:bg-[#FF8533] text-white font-bold text-xs">
                  Start a recording
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {myTracks.map((t, i) => (
                  <button key={t.id || i}
                    data-testid={`studio-my-track-${i}`}
                    onClick={() => onSongSelect && onSongSelect({
                      id: t.id || `mt-${i}`, title: t.song_title || t.title || "Untitled",
                      artist: t.artist || "You", album: "My Track", cover_url: "",
                      genre: t.lane || "original", preview_url: t.blob_url || t.url || "",
                      is_my_track: true,
                    })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all text-left">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${t.lane === "gamer" ? "bg-[#39FF14]/12" : "bg-[#FF6B00]/12"}`}>
                      <Music2 className={`w-4 h-4 ${t.lane === "gamer" ? "text-[#39FF14]" : "text-[#FF6B00]"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">{t.song_title || t.title || "Untitled"}</p>
                      <p className="text-[10px] text-[#5C5C6B] truncate">
                        {t.lane === "gamer" ? "Karaoke" : "Original"} · {Math.round(t.duration_sec || t.duration || 0)}s
                        {t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#39FF14]/40" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <Sparkles className="w-10 h-10 text-[#39FF14]/40 mb-3" />
            <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white mb-1">
              {isCreator
                ? <>Your <span className="text-[#FF6B00]">Original</span> Studio</>
                : <>Create <span className="text-[#39FF14]">Original</span> Music</>}
            </h2>
            <p className="text-sm text-[#5C5C6B] mb-6 text-center max-w-md">
              {isCreator
                ? "Creator Lane is for ORIGINAL music only — upload stems, import recordings, then mix, post and battle."
                : "Upload your stems so other artists can cover your track"}
            </p>

            <div className="w-full max-w-md mb-4 space-y-2">
              <input
                ref={deviceImportRef}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={handleDeviceImport}
                data-testid="studio-device-import-input"
              />
              <Button
                onClick={() => deviceImportRef.current?.click()}
                disabled={importing}
                data-testid="studio-device-import-btn"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#39FF14] text-[#05050A] font-black text-sm hover:opacity-90"
                style={{ boxShadow: "0 0 22px rgba(255,107,0,0.35)" }}
              >
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload from Device
              </Button>
              <Button
                onClick={openRecordPicker}
                data-testid="studio-from-record-btn"
                className="w-full h-11 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-black text-sm"
                style={{ boxShadow: "0 0 18px rgba(57,255,20,0.3)" }}
              >
                <Mic className="w-4 h-4 mr-2" />
                Upload from Pocket Products Record
              </Button>
              <p className="text-[10px] text-[#5C5C6B] text-center">.mp3 / .wav / .webm / .mp4 · up to 50MB · OR pick from your recordings</p>
            </div>

            <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold mb-3 mt-2">Or layer in stems</p>

            <div className="w-full max-w-md space-y-3" data-testid="stem-upload-section">
              {["Vocals", "Guitar", "Bass", "Drums"].map((stem) => (
                <label key={stem} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-[#39FF14]/30 transition-all cursor-pointer group" data-testid={`upload-stem-${stem.toLowerCase()}`}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(57,255,20,0.08)" }}>
                    <Upload className="w-4 h-4 text-[#39FF14]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white group-hover:text-[#39FF14] transition-colors">{stem}</p>
                    <p className="text-[10px] text-[#5C5C6B]">Upload {stem.toLowerCase()} stem (.wav, .mp3)</p>
                  </div>
                  {uploading === stem.toLowerCase() ? (
                    <Loader2 className="w-4 h-4 text-[#39FF14] animate-spin" />
                  ) : (
                    <span className="text-[10px] text-[#5C5C6B] uppercase tracking-wider font-bold opacity-0 group-hover:opacity-100">Choose File</span>
                  )}
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleStemUpload(stem.toLowerCase(), e.target.files?.[0])} />
                </label>
              ))}
            </div>

            {!isCreator && (
              <Button onClick={() => setShowOriginal(false)} variant="ghost" className="mt-6 text-[#5C5C6B]" data-testid="back-to-search">
                Back to Karaoke Search
              </Button>
            )}
          </>
        )}

        {showRecordPicker && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" data-testid="studio-record-picker">
            <div className="w-full max-w-md rounded-2xl border border-[#39FF14]/30 bg-[#0A0A0F] p-5 space-y-3 max-h-[80vh] flex flex-col"
              style={{ boxShadow: "0 0 60px rgba(57,255,20,0.15)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-['Outfit'] text-base font-black text-white">Your Pocket Products Recordings</h3>
                  <p className="text-[10px] text-[#5C5C6B] uppercase tracking-wider mt-0.5">Pick one to open in Studio</p>
                </div>
                <Button onClick={() => setShowRecordPicker(false)} data-testid="studio-record-picker-close"
                  variant="ghost" className="w-8 h-8 text-[#5C5C6B] hover:text-white p-0 text-lg">×</Button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-1.5 -mx-2 px-2">
                {loadingTracks ? (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 text-[#39FF14] animate-spin" />
                  </div>
                ) : recordings.length === 0 ? (
                  <div className="py-8 text-center">
                    <Mic className="w-7 h-7 text-[#39FF14]/30 mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">No recordings yet</p>
                    <p className="text-[11px] text-[#5C5C6B] mt-1">Head to the Record tab to make one.</p>
                  </div>
                ) : (
                  recordings.map((r, i) => (
                    <button key={r.id || i}
                      onClick={() => {
                        onSongSelect && onSongSelect({
                          id: r.id || `r-${i}`,
                          title: r.song_title || r.title || "Untitled",
                          artist: r.artist || "You",
                          album: "Pocket Products Record",
                          cover_url: "",
                          genre: r.lane || "original",
                          preview_url: r.blob_url || r.url || "",
                          is_my_track: true,
                        });
                        setShowRecordPicker(false);
                        toast.success("Loaded into Studio");
                      }}
                      data-testid={`studio-record-pick-${i}`}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/5 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-all text-left">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${r.lane === "gamer" ? "bg-[#39FF14]/12" : "bg-[#FF6B00]/12"}`}>
                        <Mic className={`w-4 h-4 ${r.lane === "gamer" ? "text-[#39FF14]" : "text-[#FF6B00]"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{r.song_title || r.title || "Untitled"}</p>
                        <p className="text-[10px] text-[#5C5C6B] truncate">
                          {r.lane === "gamer" ? "Karaoke" : "Original"} · {Math.round(r.duration_sec || r.duration || 0)}s
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] flex flex-col" data-testid="studio-search-screen">
      <div className={`flex-1 flex flex-col items-center px-6 ${results.length ? "pt-8" : "justify-center"}`}>
        <Music2 className="w-12 h-12 text-[#39FF14]/40 mb-3" />
        <h2 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white mb-1" data-testid="studio-search-title">
          Pick a <span className="text-[#39FF14]">Karaoke</span> Track
        </h2>
        <p className="text-sm text-[#5C5C6B] mb-6 text-center max-w-md">
          Sing or jam over the song. Your performance stays <span className="text-[#39FF14] font-bold">private</span>.
        </p>

        <div className="w-full max-w-lg flex gap-2 mb-4">
          <Input ref={inputRef} data-testid="studio-search-input" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search MTV / MOS / Hip-Hop / Alt-Rock..."
            className="h-12 bg-[#0F0F16] border-white/10 text-white placeholder:text-[#5C5C6B] rounded-xl text-base focus:border-[#39FF14] focus:ring-[#39FF14]/20" />
          <Button data-testid="studio-search-btn" onClick={doSearch} disabled={searching}
            className="h-12 px-6 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-bold text-sm shrink-0"
            style={{ boxShadow: "0 0 20px rgba(57,255,20,0.3)" }}>
            {searching ? "..." : <><Search className="w-4 h-4 mr-1.5" /> Search</>}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">
            Curated catalog · MTV / MOS / Hip-Hop / Alt-Rock
          </p>
        </div>

        {results.length > 0 && (
          <div className="w-full max-w-lg space-y-1 pb-24" data-testid="studio-search-results">
            {results.map((track, idx) => (
              <button key={track.id || idx} data-testid={`studio-track-${idx}`} onClick={() => selectTrack(track)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#FF6B00]/8 transition-all text-left group">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 group-hover:border-[#FF6B00]/30 relative">
                  {track.cover_url ? (
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-[#12121A] flex items-center justify-center"><Music2 className="w-5 h-5 text-[#5C5C6B]" /></div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#FF6B00] transition-colors">{track.title}</p>
                  <p className="text-[10px] text-[#5C5C6B] truncate">{track.artist}</p>
                </div>
                <span className="text-[10px] text-[#FF6B00] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Open</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
