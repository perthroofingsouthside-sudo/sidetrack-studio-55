import { useState, useEffect, useRef, useCallback } from "react";
import {
  Grid3X3, Mic, Square, Upload, Scissors, Repeat, Disc3,
  Play, Pause, Zap, Loader2, Volume2, VolumeX, Search, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";
import { SamplerEngine, NUM_PADS } from "@/services/SamplerEngine";

const FX_LIST = [
  { key: "stutter", label: "Stutter" },
  { key: "crush",   label: "Crush" },
  { key: "reverb",  label: "Reverb" },
  { key: "delay",   label: "Delay" },
  { key: "pitch",   label: "Pitch" },
];

const STEM_OPTS = [
  { key: "drums",  label: "Drums" },
  { key: "bass",   label: "Bass" },
  { key: "keys",   label: "Keys" },
  { key: "vocals", label: "Vocals" },
];

/**
 * KoalaStudio — 16-pad sampler with sequencer, ADSR/filters, Hold-FX, auto-chop,
 * resample, and stem routing. Replaces the old PlayerStudio.
 */
export default function KoalaStudio({ onBack }) {
  const engineRef = useRef(null);
  const [, rerender] = useState(0);
  const force = () => rerender((n) => n + 1);

  const [pads, setPads] = useState(() => Array.from({ length: NUM_PADS }, () => ({ hasSample: false, label: "" })));
  const [active, setActive] = useState(null);     // briefly highlighted pad on play
  const [selected, setSelected] = useState(0);    // pad whose ADSR/filter is being edited
  const [stemVol, setStemVol] = useState({ drums: 85, bass: 85, keys: 85, vocals: 85, master: 85 });
  const [stemMute, setStemMute] = useState({ drums: false, bass: false, keys: false, vocals: false });
  const [holdFx, setHoldFx] = useState(null);
  const [fxAmount, setFxAmount] = useState(0.5);
  const [recordingPad, setRecordingPad] = useState(null);
  const [isResampling, setIsResampling] = useState(false);
  const resampleHandleRef = useRef(null);

  // Sample library search (3,800-track catalog)
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);

  // Step sequencer
  const [seqEnabled, setSeqEnabled] = useState(false);
  const [bpm, setBpm] = useState(96);
  const [steps, setSteps] = useState(() => Array.from({ length: NUM_PADS }, () => Array(16).fill(false)));
  const [stepIdx, setStepIdx] = useState(0);
  const seqTimerRef = useRef(null);
  const stepsRef = useRef(steps);
  // Keep ref in sync with state so the interval callback sees current cells
  // without restarting the interval each toggle.
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  const mediaRef = useRef({ stream: null, rec: null, chunks: [] });

  // Init engine once
  useEffect(() => {
    engineRef.current = new SamplerEngine();
    const eng = engineRef.current;
    return () => { eng?.dispose(); };
  }, []);

  // Push stem volume / mute to engine
  useEffect(() => {
    const eng = engineRef.current; if (!eng) return;
    STEM_OPTS.forEach((s) => {
      eng.setStemVolume(s.key, stemVol[s.key] / 100);
      eng.setStemMute(s.key, !!stemMute[s.key]);
    });
    eng.setMasterVolume(stemVol.master / 100);
  }, [stemVol, stemMute]);

  // Sequencer loop — reads steps via ref so cell toggles don't restart timing
  useEffect(() => {
    if (!seqEnabled) {
      if (seqTimerRef.current) { clearInterval(seqTimerRef.current); seqTimerRef.current = null; }
      setStepIdx(0);
      return;
    }
    const stepMs = (60_000 / bpm) / 4; // 1/16 note
    seqTimerRef.current = setInterval(() => {
      setStepIdx((idx) => {
        const next = (idx + 1) % 16;
        const eng = engineRef.current;
        stepsRef.current.forEach((row, padId) => { if (row[next]) eng?.play(padId); });
        return next;
      });
    }, stepMs);
    return () => { if (seqTimerRef.current) clearInterval(seqTimerRef.current); };
  }, [seqEnabled, bpm]);

  // ── Pad triggers ───────────────────────────────────────────────────────
  const triggerPad = useCallback(async (padId) => {
    const eng = engineRef.current; if (!eng) return;
    await eng.resume();
    eng.play(padId);
    setActive(padId);
    setSelected(padId);
    setTimeout(() => setActive((a) => (a === padId ? null : a)), 140);
  }, []);

  // ── Mic sample → pad ───────────────────────────────────────────────────
  const startMicSample = async (padId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRef.current = { stream, rec, chunks: [] };
      rec.ondataavailable = (e) => { if (e.data.size > 0) mediaRef.current.chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(mediaRef.current.chunks, { type: "audio/webm" });
        const ab = await blob.arrayBuffer();
        const buf = await engineRef.current.loadBufferIntoPad(padId, ab, "Mic");
        if (buf) {
          setPads((p) => p.map((pad, i) => (i === padId ? { hasSample: true, label: "Mic" } : pad)));
          toast.success(`Mic sampled → Pad ${padId + 1}`);
        } else {
          toast.error("Couldn't decode mic recording");
        }
        stream.getTracks().forEach((t) => t.stop());
        setRecordingPad(null);
      };
      rec.start();
      setRecordingPad(padId);
      toast.message(`Recording Pad ${padId + 1}… tap stop`);
    } catch {
      toast.error("Mic permission denied");
    }
  };

  const stopMicSample = () => { mediaRef.current.rec?.stop(); };

  // ── Track from catalog → pad ───────────────────────────────────────────
  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API}/gamer/catalog/tracks`, { params: { q, limit: 12, enrich: true } });
      setResults(res.data?.tracks || []);
    } catch {
      toast.error("Search failed");
    } finally { setSearching(false); }
  };

  const sampleFromTrack = async (track, padId) => {
    if (!track.preview_url) { toast.info("No preview for that track"); return; }
    try {
      const r = await fetch(track.preview_url);
      const ab = await r.arrayBuffer();
      const buf = await engineRef.current.loadBufferIntoPad(padId, ab, track.title || "Track");
      if (!buf) { toast.error("Couldn't decode that audio (may be DRM/CORS)"); return; }
      setPads((p) => p.map((pad, i) => (i === padId ? { hasSample: true, label: (track.title || "Track").slice(0, 14) } : pad)));
      toast.success(`Loaded "${track.title}" → Pad ${padId + 1}`);
      setShowSearch(false);
    } catch {
      toast.error("Couldn't load the track");
    }
  };

  // ── Auto-chop selected pad across all pads ─────────────────────────────
  const autoChop = () => {
    const eng = engineRef.current;
    const buf = eng?.pads[selected]?.buffer;
    if (!buf) { toast.info("Select a pad with a sample first"); return; }
    const slices = eng.autoChop(buf, NUM_PADS);
    if (slices.length === 0) { toast.error("No transients detected"); return; }
    slices.forEach((sliceBuf, i) => eng.setPadBuffer(i, sliceBuf, `Slice ${i + 1}`));
    setPads((prev) => prev.map((_, i) => (i < slices.length
      ? { hasSample: true, label: `Slice ${i + 1}` }
      : { hasSample: false, label: "" })));
    toast.success(`Chopped into ${slices.length} slices`);
  };

  // ── Resample (record master out) ───────────────────────────────────────
  const toggleResample = async () => {
    const eng = engineRef.current; await eng.resume();
    if (!isResampling) {
      resampleHandleRef.current = eng.startMasterRecord();
      setIsResampling(true);
      toast.message("Recording master · play pads to capture");
    } else {
      const { buffer } = await resampleHandleRef.current.stop();
      resampleHandleRef.current = null;
      setIsResampling(false);
      if (!buffer) { toast.error("Couldn't capture master"); return; }
      const freePad = pads.findIndex((p) => !p.hasSample);
      const padId = freePad === -1 ? selected : freePad;
      eng.setPadBuffer(padId, buffer, "Resample");
      setPads((p) => p.map((pad, i) => (i === padId ? { hasSample: true, label: "Resample" } : pad)));
      toast.success(`Resampled → Pad ${padId + 1}`);
    }
  };

  // ── Hold-FX ────────────────────────────────────────────────────────────
  const engageFx = (kind) => {
    const eng = engineRef.current;
    if (holdFx === kind) {
      eng.setMasterFx("off");
      setHoldFx(null);
    } else {
      eng.setMasterFx(kind, fxAmount);
      setHoldFx(kind);
    }
  };
  const onFxAmount = (v) => {
    setFxAmount(v);
    if (holdFx) engineRef.current.setMasterFx(holdFx, v);
  };

  // ── Per-pad config (ADSR / filter / routing / pitch) ───────────────────
  const padCfg = engineRef.current?.pads[selected];
  const updatePad = (changes) => {
    const eng = engineRef.current; if (!eng) return;
    Object.assign(eng.pads[selected], changes);
    force();
  };
  const updateAdsr = (k, v) => updatePad({ adsr: { ...padCfg.adsr, [k]: v } });
  const updateFilter = (k, v) => updatePad({ filter: { ...padCfg.filter, [k]: v } });

  return (
    <div className="min-h-screen bg-[#05050A] pb-28" data-testid="koala-studio">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-white/5 flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="text-[#5C5C6B] hover:text-white" data-testid="studio-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,107,0,0.15)", boxShadow: "0 0 22px rgba(255,107,0,0.3)" }}>
          <Grid3X3 className="w-5 h-5 text-[#FF6B00]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-['Outfit'] text-xl sm:text-2xl font-black text-white">
            <span className="text-[#FF6B00] glow-text-orange">Studio</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#5C5C6B] font-bold">
            16-Pad Sampler · Sequencer · ADSR · Hold-FX
          </p>
        </div>
        <Button onClick={() => setShowSearch(true)} data-testid="studio-open-search"
          variant="ghost"
          className="h-9 px-3 rounded-xl border border-[#39FF14]/30 text-[#39FF14] text-[10px] font-black uppercase tracking-wider gap-1.5">
          <Search className="w-3.5 h-3.5" /> Sample Track
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 px-4 pt-4">
        {/* MAIN — pad grid + sequencer + fx */}
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2" data-testid="studio-toolbar">
            <Button
              onClick={() => (recordingPad === null ? startMicSample(selected) : stopMicSample())}
              data-testid="studio-mic-sample"
              className={`h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider gap-1.5 border ${
                recordingPad !== null
                  ? "bg-red-500 hover:bg-red-600 text-white border-red-500/50"
                  : "bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 text-[#FF6B00] border-[#FF6B00]/40"
              }`}>
              {recordingPad !== null ? <><Square className="w-3 h-3" /> Stop Mic</> : <><Mic className="w-3 h-3" /> Mic → Pad {selected + 1}</>}
            </Button>
            <Button
              onClick={autoChop}
              data-testid="studio-auto-chop"
              className="h-9 px-3 rounded-xl bg-[#39FF14]/15 hover:bg-[#39FF14]/25 text-[#39FF14] border border-[#39FF14]/40 text-[10px] font-black uppercase tracking-wider gap-1.5">
              <Scissors className="w-3 h-3" /> Auto-Chop
            </Button>
            <Button
              onClick={toggleResample}
              data-testid="studio-resample"
              className={`h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider gap-1.5 border ${
                isResampling
                  ? "bg-red-500 hover:bg-red-600 text-white border-red-500/50"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/15"
              }`}>
              <Repeat className="w-3 h-3" /> {isResampling ? "Stop Resample" : "Resample Master"}
            </Button>
          </div>

          {/* 16-Pad Grid */}
          <div className="grid grid-cols-4 gap-2.5" data-testid="studio-pad-grid">
            {pads.map((pad, i) => {
              const isActive = active === i;
              const isSel = selected === i;
              const recHere = recordingPad === i;
              return (
                <button
                  key={i}
                  data-testid={`studio-pad-${i}`}
                  onMouseDown={() => triggerPad(i)}
                  onContextMenu={(e) => { e.preventDefault(); setSelected(i); }}
                  className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden
                    ${isActive
                      ? "bg-[#FF6B00] border-[#FF6B00] scale-95"
                      : pad.hasSample
                        ? "bg-[#FF6B00]/15 border-[#FF6B00]/50 hover:bg-[#FF6B00]/25"
                        : "bg-white/3 border-white/10 hover:border-white/20"}
                    ${isSel ? "ring-2 ring-[#39FF14] ring-offset-2 ring-offset-[#05050A]" : ""}
                  `}
                  style={isActive
                    ? { boxShadow: "0 0 28px rgba(255,107,0,0.65)" }
                    : pad.hasSample
                      ? { boxShadow: "0 0 14px rgba(255,107,0,0.25)" }
                      : undefined}
                >
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-60"
                    style={{ color: isActive ? "#fff" : pad.hasSample ? "#FF6B00" : "#5C5C6B" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {pad.label && (
                    <span className="text-[9px] font-bold mt-0.5 truncate w-full px-1 text-center text-white">
                      {pad.label}
                    </span>
                  )}
                  {recHere && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Hold-FX bar */}
          <div className="rounded-2xl border border-white/5 p-3" style={{ background: "rgba(15,15,22,0.5)" }} data-testid="studio-holdfx-bar">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#FF6B00]" />
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#FF6B00] font-black">Hold-FX</p>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold">
                Amount {Math.round(fxAmount * 100)}%
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {FX_LIST.map((fx) => (
                <button
                  key={fx.key}
                  data-testid={`studio-fx-${fx.key}`}
                  onClick={() => engageFx(fx.key)}
                  className={`h-10 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                    holdFx === fx.key
                      ? "bg-[#FF6B00] text-white border-[#FF6B00]"
                      : "border-white/10 text-[#A0A0B0] hover:text-white hover:border-[#FF6B00]/40"
                  }`}
                  style={holdFx === fx.key ? { boxShadow: "0 0 16px rgba(255,107,0,0.55)" } : undefined}>
                  {fx.label}
                </button>
              ))}
            </div>
            <Slider value={[Math.round(fxAmount * 100)]} min={0} max={100} step={1}
              onValueChange={([v]) => onFxAmount(v / 100)}
              data-testid="studio-fx-amount" />
          </div>

          {/* Step sequencer */}
          <div className="rounded-2xl border border-white/5 p-3" style={{ background: "rgba(15,15,22,0.5)" }} data-testid="studio-sequencer">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSeqEnabled((v) => !v)}
                  data-testid="studio-seq-toggle"
                  className={`h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider gap-1.5 inline-flex items-center border ${
                    seqEnabled
                      ? "bg-[#39FF14] text-[#05050A] border-[#39FF14]"
                      : "border-white/10 text-[#A0A0B0]"
                  }`}>
                  {seqEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {seqEnabled ? "Stop" : "Play"} Sequencer
                </button>
                <span className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold">
                  Pad {selected + 1} row
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold">BPM</span>
                <Input type="number" value={bpm}
                  onChange={(e) => setBpm(Math.max(40, Math.min(220, +e.target.value || 96)))}
                  className="h-7 w-16 bg-[#0F0F16] border-white/10 text-white text-xs"
                  data-testid="studio-seq-bpm" />
              </div>
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, 1fr)" }}>
              {Array.from({ length: 16 }).map((_, s) => {
                const on = steps[selected]?.[s];
                const playing = seqEnabled && stepIdx === s;
                return (
                  <button
                    key={s}
                    data-testid={`studio-step-${selected}-${s}`}
                    onClick={() => setSteps((prev) => prev.map((row, i) => (i === selected
                      ? row.map((v, j) => (j === s ? !v : v))
                      : row)))}
                    className={`h-8 rounded-md border transition-all ${
                      on
                        ? "bg-[#FF6B00] border-[#FF6B00]"
                        : "bg-white/5 border-white/10 hover:border-[#FF6B00]/40"
                    } ${playing ? "ring-2 ring-[#39FF14]" : ""}`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[9px] text-[#5C5C6B]">
              Click a pad to select its sequencer row. Right-click a pad to edit ADSR/filter without playing.
            </p>
          </div>
        </div>

        {/* SIDE — stem mixer + selected-pad config */}
        <aside className="space-y-3" data-testid="studio-side-panel">
          {/* Stem Mixer */}
          <div className="rounded-2xl border border-white/5 p-3" style={{ background: "rgba(15,15,22,0.5)" }} data-testid="studio-stem-mixer">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#39FF14] font-black mb-2.5">Stem Mixer</p>
            <div className="grid grid-cols-5 gap-1.5">
              {STEM_OPTS.map((s) => (
                <div key={s.key} className="flex flex-col items-center gap-1.5">
                  <p className="text-[8px] uppercase tracking-wider text-white font-black">{s.label.slice(0, 3)}</p>
                  <Slider orientation="vertical" min={0} max={100} step={1}
                    value={[stemMute[s.key] ? 0 : stemVol[s.key]]}
                    onValueChange={([v]) => setStemVol((sv) => ({ ...sv, [s.key]: v }))}
                    className="h-28"
                    data-testid={`studio-stem-${s.key}-slider`} />
                  <button
                    onClick={() => setStemMute((m) => ({ ...m, [s.key]: !m[s.key] }))}
                    data-testid={`studio-stem-${s.key}-mute`}
                    className={`w-6 h-5 rounded text-[8px] font-black uppercase ${
                      stemMute[s.key]
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "border border-white/10 text-[#5C5C6B] hover:text-white"
                    }`}>
                    {stemMute[s.key] ? <VolumeX className="w-2.5 h-2.5 mx-auto" /> : <Volume2 className="w-2.5 h-2.5 mx-auto" />}
                  </button>
                </div>
              ))}
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-[8px] uppercase tracking-wider text-[#FF6B00] font-black">MST</p>
                <Slider orientation="vertical" min={0} max={100} step={1}
                  value={[stemVol.master]}
                  onValueChange={([v]) => setStemVol((sv) => ({ ...sv, master: v }))}
                  className="h-28"
                  data-testid="studio-stem-master-slider" />
                <span className="text-[8px] text-[#5C5C6B] font-mono">{stemVol.master}</span>
              </div>
            </div>
          </div>

          {/* Selected pad config */}
          <div className="rounded-2xl border border-white/5 p-3" style={{ background: "rgba(15,15,22,0.5)" }} data-testid="studio-pad-config">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#FF6B00] font-black">
                Pad {selected + 1} · {padCfg?.label || "Empty"}
              </p>
              <Disc3 className="w-3.5 h-3.5 text-[#FF6B00]" />
            </div>

            {/* Stem route */}
            <div className="mb-3">
              <p className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-1.5">Route to stem</p>
              <div className="grid grid-cols-4 gap-1">
                {STEM_OPTS.map((s) => (
                  <button key={s.key}
                    data-testid={`studio-pad-route-${s.key}`}
                    onClick={() => updatePad({ stem: s.key })}
                    className={`h-7 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                      padCfg?.stem === s.key
                        ? "bg-[#39FF14] text-[#05050A] border-[#39FF14]"
                        : "border-white/10 text-[#A0A0B0] hover:text-white"
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ADSR */}
            <p className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-1.5">ADSR</p>
            {[
              { k: "a", label: "Attack",  max: 1, step: 0.001, fmt: (v) => `${(v * 1000).toFixed(0)}ms` },
              { k: "d", label: "Decay",   max: 2, step: 0.005, fmt: (v) => `${v.toFixed(2)}s` },
              { k: "s", label: "Sustain", max: 1, step: 0.01,  fmt: (v) => `${Math.round(v * 100)}%` },
              { k: "r", label: "Release", max: 2, step: 0.005, fmt: (v) => `${v.toFixed(2)}s` },
            ].map(({ k, label, max, step, fmt }) => (
              <div key={k} className="flex items-center gap-2 mb-1.5" data-testid={`studio-adsr-${k}`}>
                <span className="w-12 text-[9px] text-white font-black uppercase tracking-wider">{label}</span>
                <Slider value={[padCfg?.adsr?.[k] ?? 0]} min={0} max={max} step={step}
                  onValueChange={([v]) => updateAdsr(k, v)}
                  className="flex-1" />
                <span className="w-12 text-right text-[9px] text-[#A0A0B0] font-mono">{fmt(padCfg?.adsr?.[k] ?? 0)}</span>
              </div>
            ))}

            {/* Filter */}
            <p className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-1.5 mt-2">Filter</p>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[
                { k: "off", label: "Off" },
                { k: "lp",  label: "Low-pass" },
                { k: "hp",  label: "Hi-pass" },
              ].map((opt) => (
                <button key={opt.k}
                  data-testid={`studio-filter-${opt.k}`}
                  onClick={() => updateFilter("type", opt.k)}
                  className={`h-7 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                    padCfg?.filter?.type === opt.k
                      ? "bg-[#FF6B00] text-white border-[#FF6B00]"
                      : "border-white/10 text-[#A0A0B0] hover:text-white"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-12 text-[9px] text-white font-black uppercase tracking-wider">Freq</span>
              <Slider value={[padCfg?.filter?.freq ?? 1000]} min={80} max={12000} step={10}
                onValueChange={([v]) => updateFilter("freq", v)}
                className="flex-1"
                data-testid="studio-filter-freq" />
              <span className="w-14 text-right text-[9px] text-[#A0A0B0] font-mono">{Math.round(padCfg?.filter?.freq ?? 1000)}Hz</span>
            </div>

            {/* Pitch */}
            <p className="text-[9px] uppercase tracking-wider text-[#5C5C6B] font-bold mb-1.5 mt-2">Pitch</p>
            <div className="flex items-center gap-2">
              <span className="w-12 text-[9px] text-white font-black uppercase tracking-wider">±Semi</span>
              <Slider value={[padCfg?.pitch ?? 0]} min={-12} max={12} step={1}
                onValueChange={([v]) => updatePad({ pitch: v })}
                className="flex-1"
                data-testid="studio-pad-pitch" />
              <span className="w-14 text-right text-[9px] text-[#A0A0B0] font-mono">
                {(padCfg?.pitch ?? 0) > 0 ? "+" : ""}{padCfg?.pitch ?? 0}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Search overlay — sample from the 3,800-track catalog */}
      {showSearch && (
        <div className="fixed inset-0 z-40 bg-[#05050A]/95 backdrop-blur-md flex items-start justify-center pt-20 px-4" data-testid="studio-search-overlay">
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowSearch(false)} variant="ghost" size="icon" className="text-[#5C5C6B]" data-testid="studio-search-close">
                <Square className="w-4 h-4" />
              </Button>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#FF6B00] font-black">
                Sample Library · Pad {selected + 1}
              </p>
            </div>
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search 3,800-track catalog…"
                data-testid="studio-search-input"
                className="h-10 bg-[#0F0F16] border-white/10 text-white text-sm rounded-xl" />
              <Button onClick={doSearch} disabled={searching || !query.trim()}
                data-testid="studio-search-btn"
                className="h-10 px-4 bg-[#FF6B00] hover:bg-[#FF8533] rounded-xl text-sm font-black">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
              </Button>
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {results.map((t, idx) => (
                <button
                  key={t.track_id || idx}
                  onClick={() => sampleFromTrack(t, selected)}
                  data-testid={`studio-search-result-${idx}`}
                  className="w-full flex items-center gap-2 p-2 rounded-xl border border-white/5 hover:border-[#FF6B00]/40 hover:bg-[#FF6B00]/5 text-left">
                  {t.cover_url && <img src={t.cover_url} alt="" className="w-9 h-9 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{t.title}</p>
                    <p className="text-[10px] text-[#5C5C6B] truncate">{t.artist}</p>
                  </div>
                  <Upload className="w-3.5 h-3.5 text-[#FF6B00]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
