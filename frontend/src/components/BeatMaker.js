import { useState, useEffect, useRef } from "react";
import { Sparkles, Wand2, Music2, Loader2, Play, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

/**
 * BeatMaker — Studio AI tool that generates a beat in one of the curated genres.
 * Currently the backend returns a mocked pattern + preview URL; UI is fully wired.
 */
const BAR_OPTIONS = [4, 8, 16, 32];
const KEY_OPTIONS = ["C", "D", "E", "F", "G", "A", "B"];

export default function BeatMaker({ userId }) {
  const [genres, setGenres] = useState([]);
  const [genre, setGenre] = useState("mtv_classic");
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(8);
  const [keySig, setKeySig] = useState("C");
  const [generating, setGenerating] = useState(false);
  const [beat, setBeat] = useState(null);
  const [humming, setHumming] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const humStreamRef = useRef(null);
  const humCtxRef = useRef(null);
  const humPitchesRef = useRef([]);
  const humRafRef = useRef(null);
  const audioRef = useRef(null);

  const previewBeat = () => {
    if (!beat?.preview_url) return;
    // Re-use audio element so toggling works
    if (previewing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPreviewing(false);
      return;
    }
    if (!audioRef.current || audioRef.current.src !== beat.preview_url) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      audioRef.current = new Audio(beat.preview_url);
      audioRef.current.onended = () => setPreviewing(false);
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setPreviewing(true)).catch(() => {
      toast.error("Preview playback blocked");
      setPreviewing(false);
    });
  };

  // Lightweight autocorrelation pitch detector for hum input
  const detectPitch = (buf, sampleRate) => {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return 0; // too quiet
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    const trimmed = buf.slice(r1, r2);
    const T = trimmed.length;
    const c = new Array(T).fill(0);
    for (let i = 0; i < T; i++) for (let j = 0; j < T - i; j++) c[i] += trimmed[j] * trimmed[j + i];
    let d = 0;
    while (d < T - 1 && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < T; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    if (maxpos < 1) return 0;
    return sampleRate / maxpos;
  };

  const startHum = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      humStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      humCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      humPitchesRef.current = [];
      setHumming(true);
      let lastSample = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const now = performance.now();
        if (now - lastSample >= 50) {
          const hz = detectPitch(buf, ctx.sampleRate);
          humPitchesRef.current.push(hz);
          lastSample = now;
        }
        humRafRef.current = requestAnimationFrame(tick);
      };
      humRafRef.current = requestAnimationFrame(tick);
      // Cap at 6s
      setTimeout(() => { if (humming || humStreamRef.current) stopHum(); }, 6000);
    } catch (e) {
      toast.error("Microphone access denied");
      setHumming(false);
    }
  };

  const stopHum = async () => {
    if (humRafRef.current) cancelAnimationFrame(humRafRef.current);
    if (humStreamRef.current) { humStreamRef.current.getTracks().forEach(t => t.stop()); humStreamRef.current = null; }
    if (humCtxRef.current && humCtxRef.current.state !== "closed") humCtxRef.current.close();
    setHumming(false);
    const pitches = humPitchesRef.current;
    if (!pitches || pitches.length < 4) { toast.error("Hum a little longer"); return; }
    setGenerating(true);
    setBeat(null);
    try {
      const res = await axios.post(`${API}/studio/beat/hum`, {
        user_id: userId, pitches, sample_interval_ms: 50, genre, quantize_to: 16,
      });
      if (res.data.success) {
        setBeat(res.data.beat);
        toast.success(`Hum → Beat · ${res.data.beat.bpm} BPM · ${res.data.beat.melody_notes.length} notes`);
        // Log vibe-match behavior
        axios.post(`${API}/discover/mix-behavior`, {
          user_id: userId, event: "beat_gen", genre,
        }).catch(() => {});
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Hum-to-beat failed");
    } finally { setGenerating(false); }
  };

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
    <div className="rounded-2xl border border-[#FF5F1F]/25 p-4 sm:p-5" style={{ background: "rgba(255,95,31,0.04)" }} data-testid="beat-maker">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,95,31,0.15)" }}>
          <Wand2 className="w-4.5 h-4.5 text-[#FF5F1F]" />
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
                  ? "border-[#FF5F1F] bg-[#FF5F1F]/15 text-[#FF5F1F]"
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
            {BAR_OPTIONS.map(b => (
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
          {KEY_OPTIONS.map(k => (
            <button
              key={k}
              onClick={() => setKeySig(k)}
              data-testid={`beat-key-${k}`}
              className={`w-7 h-7 rounded text-[10px] font-bold transition-all border ${
                keySig === k
                  ? "border-[#FF5F1F] bg-[#FF5F1F]/15 text-[#FF5F1F]"
                  : "border-white/10 text-[#5C5C6B]"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button + Hum button */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleGenerate}
          disabled={generating || humming}
          data-testid="beat-generate-btn"
          className="h-10 rounded-xl text-xs font-bold text-[#05050A] bg-gradient-to-r from-[#FF5F1F] to-[#39FF14] hover:opacity-90 transition-all"
          style={{ boxShadow: "0 0 20px rgba(255,95,31,0.3)" }}
        >
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate</>}
        </Button>
        <Button
          onClick={humming ? stopHum : startHum}
          disabled={generating}
          data-testid="beat-hum-btn"
          className={`h-10 rounded-xl text-xs font-bold transition-all ${
            humming
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
              : "bg-[#39FF14]/15 hover:bg-[#39FF14]/25 text-[#39FF14] border border-[#39FF14]/40"
          }`}
          style={humming ? { boxShadow: "0 0 24px rgba(239,68,68,0.5)" } : { boxShadow: "0 0 16px rgba(57,255,20,0.25)" }}
        >
          {humming ? <><Square className="w-4 h-4 mr-2" /> Stop Humming</> : <><Mic className="w-4 h-4 mr-2" /> Hum-to-Beat</>}
        </Button>
      </div>

      {/* Generated beat result */}
      {beat && (
        <div className="mt-4 p-3 rounded-xl border border-[#39FF14]/25" style={{ background: "rgba(57,255,20,0.04)" }} data-testid="beat-result">
          <div className="flex items-center gap-2 mb-2">
            <Music2 className="w-4 h-4 text-[#39FF14]" />
            <p className="text-xs font-bold text-white">{beat.genre_label} · {beat.bpm} BPM · {beat.bars} bars</p>
          </div>
          <p className="text-[10px] text-[#5C5C6B] mb-2">{beat.duration_sec || beat.bars}s · Key {beat.key || (beat.melody_notes && beat.melody_notes[0]?.name) || "—"} · {beat.engine}</p>

          {/* Hum melody notes preview */}
          {beat.melody_notes && beat.melody_notes.length > 0 && (
            <div className="mb-2 p-2 rounded-lg border border-[#39FF14]/20" style={{ background: "rgba(57,255,20,0.04)" }} data-testid="beat-melody-notes">
              <p className="text-[9px] uppercase tracking-wider text-[#39FF14] font-bold mb-1">Hum Melody · {beat.melody_notes.length} notes</p>
              <div className="flex flex-wrap gap-1">
                {beat.melody_notes.slice(0, 14).map((n, i) => (
                  <span key={`note-${n.step}-${n.name}-${i}`} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#39FF14]/15 text-[#39FF14]">{n.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Mini pattern preview */}
          <div className="space-y-1.5 mb-2">
            {Object.entries(beat.pattern).map(([drum, hits]) => (
              <div key={drum} className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider w-12 text-[#A0A0B0] font-bold">{drum}</span>
                <div className="flex gap-0.5 flex-1">
                  {hits.slice(0, 32).map((h, i) => (
                    <span key={`${drum}-step-${i}`}
                      className={`h-1.5 flex-1 rounded-sm transition-colors ${
                        h ? (drum === "kick" || drum === "bass" ? "bg-[#FF5F1F]" : "bg-[#39FF14]") : "bg-white/5"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={previewBeat} variant="ghost"
            className="w-full h-8 rounded-lg text-[10px] font-bold border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/10"
            data-testid="beat-preview-btn">
            {previewing
              ? <><Square className="w-3 h-3 mr-1.5" /> Stop Preview</>
              : <><Play className="w-3 h-3 mr-1.5" /> Preview Beat</>}
          </Button>
        </div>
      )}
    </div>
  );
}
