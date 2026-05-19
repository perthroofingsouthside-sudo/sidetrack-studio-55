import { useState, useEffect } from "react";
import { Sparkles, Wand2, Music2, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

/**
 * BeatMaker — Studio AI tool that generates a beat in one of the curated genres.
 * Currently the backend returns a mocked pattern + preview URL; UI is fully wired.
 */
export default function BeatMaker({ userId }) {
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState("mtv_classic");
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(8);
  const [keySig, setKeySig] = useState("C");
  const [generating, setGenerating] = useState(false);
  const [beat, setBeat] = useState(null);

  useEffect(() => {
    axios.get(`${API}/studio/genres`).then(r => {
      if (r.data.success) setGenres(r.data.genres);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setBeat(null);
    try {
      const res = await axios.post(`${API}/studio/beat/generate`, {
        genre, bpm, bars, key: keySig, user_id: userId,
      });
      if (res.data.success) {
        setBeat(res.data.beat);
        toast.success(`Beat generated · ${res.data.beat.genre_label} · ${bpm} BPM`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate beat");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#FF6B00]/25 p-4 sm:p-5" style={{ background: "rgba(255,107,0,0.04)" }} data-testid="beat-maker">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,107,0,0.15)" }}>
          <Wand2 className="w-4.5 h-4.5 text-[#FF6B00]" />
        </div>
        <div className="flex-1">
          <h3 className="font-['Outfit'] text-sm font-black text-white">Make a Beat</h3>
          <p className="text-[10px] text-[#5C5C6B] font-medium">AI engine · MTV · MOS · Hip-Hop · Alt-Rock</p>
        </div>
        <span className="badge-glass px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider text-[#39FF14] border-[#39FF14]/30">Studio AI</span>
      </div>

      {/* Genre chips */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-2">Genre</p>
        <div className="flex flex-wrap gap-1.5">
          {genres.map(g => (
            <button
              key={g.key}
              onClick={() => setGenre(g.key)}
              data-testid={`beat-genre-${g.key}`}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                genre === g.key
                  ? "border-[#FF6B00] bg-[#FF6B00]/15 text-[#FF6B00]"
                  : "border-white/10 text-[#5C5C6B] hover:text-white"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* BPM + Bars */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold">BPM</span>
            <span className="text-xs text-[#39FF14] font-bold font-mono">{bpm}</span>
          </div>
          <Slider value={[bpm]} onValueChange={(v) => setBpm(v[0])} min={60} max={200} step={1} data-testid="beat-bpm-slider" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-1.5">Bars</p>
          <div className="flex gap-1.5">
            {[4, 8, 16, 32].map(b => (
              <button
                key={b}
                onClick={() => setBars(b)}
                data-testid={`beat-bars-${b}`}
                className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-all border ${
                  bars === b
                    ? "border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14]"
                    : "border-white/10 text-[#5C5C6B]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-1.5">Key</p>
        <div className="flex flex-wrap gap-1">
          {["C", "D", "E", "F", "G", "A", "B"].map(k => (
            <button
              key={k}
              onClick={() => setKeySig(k)}
              data-testid={`beat-key-${k}`}
              className={`w-7 h-7 rounded text-[10px] font-bold transition-all border ${
                keySig === k
                  ? "border-[#FF6B00] bg-[#FF6B00]/15 text-[#FF6B00]"
                  : "border-white/10 text-[#5C5C6B]"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating}
        data-testid="beat-generate-btn"
        className="w-full h-10 rounded-xl text-xs font-bold text-[#05050A] bg-gradient-to-r from-[#FF6B00] to-[#39FF14] hover:opacity-90 transition-all"
        style={{ boxShadow: "0 0 20px rgba(255,107,0,0.3)" }}
      >
        {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating beat...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Beat</>}
      </Button>

      {/* Generated beat result */}
      {beat && (
        <div className="mt-4 p-3 rounded-xl border border-[#39FF14]/25" style={{ background: "rgba(57,255,20,0.04)" }} data-testid="beat-result">
          <div className="flex items-center gap-2 mb-2">
            <Music2 className="w-4 h-4 text-[#39FF14]" />
            <p className="text-xs font-bold text-white">{beat.genre_label} · {beat.bpm} BPM · {beat.bars} bars</p>
          </div>
          <p className="text-[10px] text-[#5C5C6B] mb-2">{beat.duration_sec}s · Key {beat.key} · {beat.engine}</p>

          {/* Mini pattern preview */}
          <div className="space-y-1.5 mb-2">
            {Object.entries(beat.pattern).map(([drum, hits]) => (
              <div key={drum} className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider w-12 text-[#A0A0B0] font-bold">{drum}</span>
                <div className="flex gap-0.5 flex-1">
                  {hits.slice(0, 32).map((h, i) => (
                    <span key={i}
                      className={`h-1.5 flex-1 rounded-sm transition-colors ${
                        h ? (drum === "kick" || drum === "bass" ? "bg-[#FF6B00]" : "bg-[#39FF14]") : "bg-white/5"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button variant="ghost" className="w-full h-8 rounded-lg text-[10px] font-bold border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/10" data-testid="beat-preview-btn">
            <Play className="w-3 h-3 mr-1.5" /> Preview (Mock)
          </Button>
        </div>
      )}
    </div>
  );
}
