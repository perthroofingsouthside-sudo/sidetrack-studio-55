import { useState, useEffect, useRef } from "react";
import { ListMusic, Plus, Lock, Globe, Play, Pause, Trash2, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function PlaylistsPage({ onTrackSelect }) {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const [owner] = useState(() => localStorage.getItem("sidetrack_username") || "anonymous");

  useEffect(() => { loadPlaylists(); }, []);

  const loadPlaylists = async () => {
    try {
      const res = await axios.get(`${API}/playlists?owner=${owner}`);
      if (res.data.success) setPlaylists(res.data.playlists);
      // Also load public playlists
      const pubRes = await axios.get(`${API}/playlists?public_only=true`);
      if (pubRes.data.success) {
        const pubIds = new Set(playlists.map(p => p.id));
        const newPub = pubRes.data.playlists.filter(p => !pubIds.has(p.id));
        setPlaylists(prev => [...prev, ...newPub.filter(p => !prev.find(x => x.id === p.id))]);
      }
    } catch (err) { /* empty */ }
  };

  const createPlaylist = async () => {
    if (!newName.trim()) { toast.error("Enter a playlist name"); return; }
    try {
      const res = await axios.post(`${API}/playlists`, {
        name: newName, is_public: newPublic, owner,
      });
      if (res.data.success) {
        toast.success("Playlist created!");
        setNewName("");
        setShowCreate(false);
        loadPlaylists();
      }
    } catch (err) { toast.error("Failed to create playlist"); }
  };

  const openPlaylist = async (pl) => {
    try {
      const res = await axios.get(`${API}/playlists/${pl.id}`);
      if (res.data.success) setSelectedPlaylist(res.data.playlist);
    } catch (err) { toast.error("Failed to load playlist"); }
  };

  const removeTrack = async (trackId) => {
    try {
      await axios.delete(`${API}/playlists/${selectedPlaylist.id}/tracks/${trackId}`);
      openPlaylist(selectedPlaylist);
      toast.success("Track removed");
    } catch (err) { toast.error("Failed to remove"); }
  };

  const togglePrivacy = async (pl) => {
    try {
      const formData = new FormData();
      formData.append("is_public", !pl.is_public);
      formData.append("name", pl.name);
      await axios.put(`${API}/playlists/${pl.id}`, formData);
      loadPlaylists();
      toast.success(pl.is_public ? "Now private" : "Now public");
    } catch (err) { toast.error("Failed to update"); }
  };

  const deletePlaylist = async (pl) => {
    try {
      await axios.delete(`${API}/playlists/${pl.id}`);
      setSelectedPlaylist(null);
      loadPlaylists();
      toast.success("Playlist deleted");
    } catch (err) { toast.error("Failed to delete"); }
  };

  const playPreview = (track) => {
    if (!track.preview_url) { toast.info("No preview"); return; }
    if (audioRef.current) audioRef.current.pause();
    if (playingId === track.track_id) { setPlayingId(null); return; }
    const audio = new Audio(track.preview_url);
    audio.play();
    audioRef.current = audio;
    setPlayingId(track.track_id);
    audio.onended = () => setPlayingId(null);
  };

  const fmtMs = (ms) => { if (!ms) return "--:--"; const m = Math.floor(ms/60000); const s = Math.floor((ms%60000)/1000); return `${m}:${s.toString().padStart(2,"0")}`; };

  // Detail view
  if (selectedPlaylist) {
    return (
      <div className="min-h-screen bg-[#05050A]" data-testid="playlist-detail">
        <div className="glass-heavy px-4 py-3 flex items-center gap-3">
          <Button data-testid="pl-back-btn" variant="ghost" size="icon" onClick={() => setSelectedPlaylist(null)} className="text-[#A0A0B0]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-['Outfit'] text-lg font-bold truncate">{selectedPlaylist.name}</h2>
            <div className="flex items-center gap-2">
              {selectedPlaylist.is_public ? <Globe className="w-3 h-3 text-[#00E5FF]" /> : <Lock className="w-3 h-3 text-[#FFD60A]" />}
              <span className="text-xs text-[#606070]">{selectedPlaylist.track_count} tracks</span>
            </div>
          </div>
          <Button data-testid="pl-delete-btn" variant="ghost" size="icon" onClick={() => deletePlaylist(selectedPlaylist)} className="text-[#606070] hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        {selectedPlaylist.cover_url && (
          <div className="px-4 py-4">
            <img src={selectedPlaylist.cover_url} alt="" className="w-full max-h-48 object-cover rounded-2xl" />
          </div>
        )}
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="px-4 space-y-1 pb-24">
            {(selectedPlaylist.tracks || []).length === 0 && (
              <div className="surface-card p-8 text-center">
                <ListMusic className="w-10 h-10 text-[#8A2BE2]/20 mx-auto mb-3" />
                <p className="text-sm text-[#606070]">No tracks yet. Search for songs on the Stream page and add them!</p>
              </div>
            )}
            {(selectedPlaylist.tracks || []).map((track, idx) => (
              <div key={track.track_id + idx} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 group" data-testid={`pl-track-${idx}`}>
                <Button variant="ghost" size="icon" onClick={() => playPreview(track)} className="text-[#8A2BE2] flex-shrink-0">
                  {playingId === track.track_id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" fill="#8A2BE2" />}
                </Button>
                {track.cover_url && <img src={track.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onTrackSelect && onTrackSelect(track)}>
                  <p className="text-sm text-white truncate">{track.title}</p>
                  <p className="text-xs text-[#606070] truncate">{track.artist}</p>
                </div>
                <span className="text-xs text-[#606070] hidden sm:block">{fmtMs(track.duration_ms)}</span>
                <Button variant="ghost" size="icon" onClick={() => removeTrack(track.track_id)} className="text-[#606070] hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="playlists-page">
      <div className="px-4 pt-6 pb-2 flex items-center justify-between">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ListMusic className="w-6 h-6 text-[#8A2BE2]" />
            <span className="text-white">My Playlists</span>
          </h1>
          <p className="text-[#606070] text-xs mt-1">Your personal collection</p>
        </div>
        <Button data-testid="create-playlist-btn" onClick={() => setShowCreate(!showCreate)} className="h-10 px-4 bg-[#8A2BE2] hover:bg-[#9D4CDD] rounded-2xl text-sm font-bold gap-1.5 glow-violet">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-4 py-3" data-testid="create-playlist-form">
          <div className="surface-card p-4 space-y-3">
            <Input data-testid="playlist-name-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Playlist name..." className="h-11 bg-[#05050A] border-white/10 text-white rounded-2xl" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {newPublic ? <Globe className="w-4 h-4 text-[#00E5FF]" /> : <Lock className="w-4 h-4 text-[#FFD60A]" />}
                <span className="text-sm text-[#A0A0B0]">{newPublic ? "Public" : "Private"}</span>
              </div>
              <Switch data-testid="privacy-toggle" checked={newPublic} onCheckedChange={setNewPublic} />
            </div>
            <Button data-testid="save-playlist-btn" onClick={createPlaylist} className="w-full h-10 bg-[#8A2BE2] hover:bg-[#9D4CDD] rounded-2xl font-bold">Create Playlist</Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="px-4 space-y-2 pb-24">
          {playlists.length === 0 && !showCreate && (
            <div className="surface-card p-8 text-center">
              <ListMusic className="w-12 h-12 text-[#8A2BE2]/20 mx-auto mb-3" />
              <p className="text-sm text-[#606070]">No playlists yet. Create your first one!</p>
            </div>
          )}
          {playlists.map((pl) => (
            <div key={pl.id} onClick={() => openPlaylist(pl)} className="surface-card p-4 flex items-center gap-3 cursor-pointer hover:border-[#8A2BE2]/30 transition-all group" data-testid={`playlist-card-${pl.id}`}>
              {pl.cover_url ? (
                <img src={pl.cover_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#8A2BE2]/10 flex items-center justify-center flex-shrink-0"><ListMusic className="w-6 h-6 text-[#8A2BE2]" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-[#8A2BE2]">{pl.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {pl.is_public ? <Globe className="w-3 h-3 text-[#00E5FF]" /> : <Lock className="w-3 h-3 text-[#FFD60A]" />}
                  <span className="text-xs text-[#606070]">{pl.track_count || 0} tracks</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); togglePrivacy(pl); }} className="text-[#606070] hover:text-[#8A2BE2]">
                {pl.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
