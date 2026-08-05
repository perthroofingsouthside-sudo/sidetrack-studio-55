/* LearnPage — Gamer LEARN tab. Interactive Guitar/Piano lessons using the
   neon rhythm-highway engine + real-time Web Audio mic pitch detection.
   Notes advance when the correct pitch is detected (or the visual aid is
   tapped as a no-instrument fallback). */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Guitar, Piano, GraduationCap, Mic, MicOff, Volume2, RotateCcw, ArrowLeft, Trophy, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MicPitchEngine, noteName } from "@/services/PitchDetector";
import axios from "axios";
import { API } from "@/App";
import NoteHighway from "@/components/learn/NoteHighway";
import GuitarAid from "@/components/learn/GuitarAid";
import PianoAid from "@/components/learn/PianoAid";
import TunerGauge from "@/components/learn/TunerGauge";

const LESSONS = {
  guitar: [
    { id: "open-strings", title: "Open Strings", desc: "Meet all six strings — E A D G B e", level: "Beginner", notes: [40, 45, 50, 55, 59, 64] },
    { id: "em-pentatonic", title: "E Minor Pentatonic", desc: "The riff-maker's scale, first position", level: "Beginner", notes: [40, 43, 45, 47, 50, 52, 55, 57] },
    { id: "power-riff", title: "First Power Riff", desc: "A classic rock riff shape on the low strings", level: "Intermediate", notes: [40, 40, 43, 45, 40, 40, 43, 46, 45] },
  ],
  piano: [
    { id: "c-major", title: "C Major Scale", desc: "The foundation — eight notes up from middle C", level: "Beginner", notes: [60, 62, 64, 65, 67, 69, 71, 72] },
    { id: "happy-bday", title: "Happy Birthday", desc: "Your first melody — opening phrase", level: "Beginner", notes: [60, 60, 62, 60, 65, 64] },
    { id: "ode-to-joy", title: "Ode to Joy", desc: "Beethoven's classic, right-hand melody", level: "Intermediate", notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62] },
  ],
};

const INSTRUMENTS = [
  { key: "guitar", label: "Guitar", Icon: Guitar, accent: "#FF5F1F", blurb: "Frets, strings & riffs on a neon fretboard" },
  { key: "piano", label: "Piano", Icon: Piano, accent: "#39FF14", blurb: "Keys, scales & melodies with a glowing keyboard" },
];

export default function LearnPage() {
  const [instrument, setInstrument] = useState(null);
  const [lesson, setLesson] = useState(null);

  if (lesson) return <PracticeSession instrument={instrument} lesson={lesson} onExit={() => setLesson(null)} />;

  return (
    <div className="min-h-screen bg-[#05050A] pb-32" data-testid="learn-page">
      {/* Hero */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-[#39FF14]/8 via-[#05050A] to-[#05050A]" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(57,255,20,0.12)", boxShadow: "0 0 24px rgba(57,255,20,0.25)" }}>
            <GraduationCap className="w-6 h-6 text-[#39FF14]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-2xl sm:text-3xl font-black text-white">
              <span className="text-[#39FF14] glow-text-green">Learn</span> Mode
            </h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">Real instrument · Real-time pitch feedback</p>
          </div>
        </div>
      </div>

      {/* Instrument picker */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-6">
        {INSTRUMENTS.map(({ key, label, Icon, accent, blurb }) => (
          <button key={key} onClick={() => setInstrument(key)} data-testid={`learn-instrument-${key}`}
            className="rounded-2xl p-4 text-left transition-all border"
            style={{
              borderColor: instrument === key ? accent : "rgba(255,255,255,0.08)",
              background: instrument === key ? `${accent}14` : "rgba(15,15,22,0.6)",
              boxShadow: instrument === key ? `0 0 24px ${accent}40` : "none",
            }}>
            <Icon className="w-8 h-8 mb-2" style={{ color: accent }} />
            <p className="font-['Outfit'] font-black text-white text-lg">{label}</p>
            <p className="text-[10px] text-[#A0A0B0] leading-snug mt-1">{blurb}</p>
          </button>
        ))}
      </div>

      {/* Lesson list */}
      {instrument && (
        <div className="px-4" data-testid="learn-lesson-list">
          <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-2">
            {instrument === "guitar" ? "Guitar" : "Piano"} Lessons
          </h3>
          <div className="space-y-2">
            {LESSONS[instrument].map((l, i) => {
              const best = Number(localStorage.getItem(`pp_learn_best_${l.id}`) || 0);
              return (
                <button key={l.id} onClick={() => setLesson(l)} data-testid={`learn-lesson-${l.id}`}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-white/5 hover:border-[#39FF14]/30 hover:bg-[#39FF14]/5 transition-all text-left">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-['Outfit'] font-black text-[#39FF14]"
                    style={{ background: "rgba(57,255,20,0.1)" }}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{l.title}</p>
                    <p className="text-[10px] text-[#5C5C6B] truncate">{l.desc}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[8px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full ${
                      l.level === "Beginner" ? "bg-[#39FF14]/10 text-[#39FF14]" : "bg-[#FF5F1F]/10 text-[#FF5F1F]"}`}>
                      {l.level}
                    </span>
                    {best > 0 && <p className="text-[9px] text-[#FFA64D] font-black mt-1">★ {best}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#39FF14]/40 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!instrument && (
        <p className="px-4 text-center text-[11px] text-[#5C5C6B]" data-testid="learn-pick-hint">
          Pick an instrument to see its lessons — plug in, or just tap the visual guide to play.
        </p>
      )}
    </div>
  );
}

function PracticeSession({ instrument, lesson, onExit }) {
  const engineRef = useRef(null);
  const matchFramesRef = useRef(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hitFlash, setHitFlash] = useState(null);
  const [done, setDone] = useState(false);
  const [misses, setMisses] = useState(0);
  const [aiGrade, setAiGrade] = useState(null);
  const startRef = useRef(performance.now());
  const missesRef = useRef(0);
  const gradedRef = useRef(false);

  const notes = lesson.notes;
  const targetMidi = notes[currentIdx];
  const currentIdxRef = useRef(0);
  currentIdxRef.current = currentIdx;
  const doneRef = useRef(false);
  doneRef.current = done;

  if (!engineRef.current) engineRef.current = new MicPitchEngine();

  useEffect(() => () => engineRef.current?.destroy(), []);

  const registerHit = useCallback(() => {
    setHitFlash({ at: performance.now() });
    setStreak((s) => s + 1);
    setScore((sc) => sc + 100 + streak * 10);
    const next = currentIdxRef.current + 1;
    if (next >= notes.length) {
      setDone(true);
      const total = score + 100 + streak * 10;
      const best = Number(localStorage.getItem(`pp_learn_best_${lesson.id}`) || 0);
      if (total > best) localStorage.setItem(`pp_learn_best_${lesson.id}`, String(total));
    } else {
      setCurrentIdx(next);
    }
  }, [notes.length, lesson.id, score, streak]);

  // Mic pitch matching: exact midi or octave-equivalent, held ~3 frames
  const onPitch = useCallback((p) => {
    setPitch(p);
    if (!p || doneRef.current) { matchFramesRef.current = 0; return; }
    const target = notes[currentIdxRef.current];
    const isMatch = p.midi === target || Math.abs(p.midi - target) === 12;
    if (isMatch && Math.abs(p.cents) < 50) {
      matchFramesRef.current += 1;
      if (matchFramesRef.current >= 3) {
        matchFramesRef.current = 0;
        registerHit();
      }
    } else {
      matchFramesRef.current = 0;
    }
  }, [notes, registerHit]);

  const toggleMic = async () => {
    if (micOn) {
      engineRef.current.stopMic();
      setMicOn(false);
      setPitch(null);
      return;
    }
    try {
      await engineRef.current.start(onPitch);
      setMicOn(true);
      toast.success("Mic live — play the glowing note!");
    } catch {
      toast.error("Mic access denied — tap the guide below to play instead.");
    }
  };

  // Tap-to-play fallback on the visual aid
  const playViaAid = useCallback((midi) => {
    if (doneRef.current) return;
    engineRef.current.playTone(midi, 0.6);
    if (midi === notes[currentIdxRef.current]) {
      registerHit();
    } else {
      setStreak(0);
      setMisses((m) => m + 1);
      missesRef.current += 1;
      toast.error(`That was ${noteName(midi)} — aim for ${noteName(notes[currentIdxRef.current])}`, { duration: 1500 });
    }
  }, [notes, registerHit]);

  const hearNote = () => engineRef.current.playTone(targetMidi, 1);

  // ── AI grading: objective Pitch + Timing only (Grommet-safe), fires once ──
  useEffect(() => {
    if (!done || gradedRef.current) return;
    gradedRef.current = true;
    const m = missesRef.current;
    const pitchAcc = Math.round((notes.length / (notes.length + m)) * 100);
    const avgSec = (performance.now() - startRef.current) / 1000 / notes.length;
    const timingAcc = Math.round(Math.max(0, Math.min(100, 100 - Math.max(0, avgSec - 2) * 12)));
    axios.post(`${API}/gamer/grade`, {
      user_id: localStorage.getItem("sidetrack_voter_id") || "anon",
      context: "learn",
      song_title: lesson.title,
      pitch_accuracy: pitchAcc,
      timing_accuracy: timingAcc,
    }).then((res) => setAiGrade(res.data)).catch(() => {});
  }, [done, notes.length, lesson.title]);

  const restart = () => {
    setCurrentIdx(0); setScore(0); setStreak(0); setMisses(0); setDone(false); setAiGrade(null);
    startRef.current = performance.now();
    missesRef.current = 0;
    gradedRef.current = false;
    matchFramesRef.current = 0;
  };

  const isLiveMatch = pitch && (pitch.midi === targetMidi || Math.abs(pitch.midi - targetMidi) === 12);
  const accuracy = notes.length ? Math.round((notes.length / (notes.length + misses)) * 100) : 100;
  const pianoRange = useMemo(() => ({ min: Math.min(...notes), max: Math.max(...notes) }), [notes]);

  return (
    <div className="fixed inset-0 z-[55] bg-[#05050A] overflow-hidden flex flex-col" data-testid="learn-practice">
      {/* Header */}
      <header className="px-3 sm:px-5 pt-3 pb-2 flex items-center gap-2 border-b border-white/5"
        style={{ background: "rgba(5,5,10,0.7)", backdropFilter: "blur(12px)" }}>
        <Button onClick={() => { engineRef.current.stopMic(); onExit(); }} data-testid="learn-exit" variant="ghost"
          className="w-8 h-8 p-0 rounded-full text-[#5C5C6B] hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-['Outfit'] font-black text-white truncate text-base sm:text-xl leading-none"
            style={{ textShadow: "0 0 14px rgba(57,255,20,0.4)" }} data-testid="learn-lesson-title">{lesson.title}</h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-[#5C5C6B] font-bold">{instrument} · {lesson.level}</p>
        </div>
        <span className="flex items-center gap-1 px-2 h-7 rounded-full border border-[#FF5F1F]/40 bg-[#FF5F1F]/8" data-testid="learn-score">
          <Trophy className="w-3 h-3 text-[#FF5F1F]" />
          <span className="text-[10px] font-black text-white">{score}</span>
        </span>
        <span className="flex items-center gap-1 px-2 h-7 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/8" data-testid="learn-streak">
          <Zap className="w-3 h-3 text-[#39FF14]" />
          <span className="text-[10px] font-black text-white">{streak}x</span>
        </span>
      </header>

      {/* Progress dots */}
      <div className="px-4 py-2 flex items-center gap-1" data-testid="learn-progress">
        {notes.map((n, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-colors"
            style={{ background: i < currentIdx || done ? "#39FF14" : i === currentIdx ? "#FF5F1F" : "rgba(255,255,255,0.08)",
              boxShadow: i === currentIdx && !done ? "0 0 8px #FF5F1F" : "none" }} />
        ))}
        <span className="text-[9px] font-black text-[#5C5C6B] ml-2">{Math.min(currentIdx + (done ? 1 : 0), notes.length)}/{notes.length}</span>
      </div>

      {/* Highway + target */}
      <div className="relative flex-1 mx-3 rounded-2xl border border-white/8 overflow-hidden min-h-0"
        style={{ background: "linear-gradient(180deg, #0a0a18, #050508)" }}>
        <NoteHighway notes={notes} currentIdx={done ? notes.length : currentIdx} hitFlash={hitFlash} />
        {/* Target overlay */}
        {!done && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#5C5C6B]">Play</p>
            <p className="font-['Outfit'] font-black text-4xl leading-none"
              style={{ color: isLiveMatch ? "#39FF14" : "#FF5F1F", textShadow: `0 0 20px ${isLiveMatch ? "#39FF14" : "#FF5F1F"}66` }}
              data-testid="learn-target-note">
              {noteName(targetMidi)}
            </p>
          </div>
        )}
        {/* Completion overlay */}
        {done && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ background: "rgba(5,5,10,0.88)", backdropFilter: "blur(6px)" }} data-testid="learn-complete">
            <Trophy className="w-12 h-12 text-[#FF5F1F]" style={{ filter: "drop-shadow(0 0 18px #FF5F1F)" }} />
            <h2 className="font-['Outfit'] font-black text-2xl text-white">Lesson Complete!</h2>
            <p className="font-['Outfit'] font-black text-4xl text-[#39FF14]" style={{ textShadow: "0 0 20px #39FF14" }}>{score}</p>
            <p className="text-[11px] text-[#A0A0B0]">Accuracy {accuracy}% · Best streak kept alive</p>
            {/* AI Grade — objective pitch + timing (no peer grading for minors) */}
            {aiGrade && (
              <div className="skeu-screen px-5 py-3 flex items-center gap-4" data-testid="ai-grade-card">
                <p className="font-['Outfit'] font-black text-5xl leading-none"
                  style={{ color: aiGrade.grade === "S" || aiGrade.grade === "A" ? "#39FF14" : "#FF5F1F",
                    textShadow: `0 0 20px ${aiGrade.grade === "S" || aiGrade.grade === "A" ? "#39FF14" : "#FF5F1F"}88` }}
                  data-testid="ai-grade-letter">{aiGrade.grade}</p>
                <div className="text-left">
                  <p className="text-[9px] uppercase tracking-[0.25em] font-black text-[#5C5C6B]">AI Grade · Pitch &amp; Timing</p>
                  <p className="text-[10px] text-[#A0A0B0] mt-1">Pitch <span className="text-[#39FF14] font-black">{aiGrade.pitch_score}%</span> · Timing <span className="text-[#FF5F1F] font-black">{aiGrade.timing_score}%</span></p>
                  <p className="text-[10px] text-white font-black mt-0.5" data-testid="ai-grade-score">{aiGrade.score}/100</p>
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <Button onClick={restart} data-testid="learn-restart"
                className="h-10 px-5 rounded-xl bg-[#FF5F1F] hover:bg-[#FF5F1F]/90 text-white font-bold">
                <RotateCcw className="w-4 h-4 mr-1.5" /> Replay
              </Button>
              <Button onClick={() => { engineRef.current.stopMic(); onExit(); }} data-testid="learn-back-to-lessons"
                className="h-10 px-5 rounded-xl bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-bold">
                More Lessons
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tuner + controls */}
      <div className="px-3 pt-2 space-y-2">
        <TunerGauge pitch={pitch} micOn={micOn} isMatch={!!isLiveMatch} />
        <div className="flex gap-2">
          <Button onClick={toggleMic} data-testid="learn-mic-toggle"
            className={`flex-1 h-10 rounded-xl font-bold text-xs ${micOn
              ? "bg-[#39FF14] text-[#05050A] hover:bg-[#39FF14]/90"
              : "bg-[#0F0F16] border border-[#39FF14]/40 text-[#39FF14] hover:bg-[#39FF14]/10"}`}>
            {micOn ? <><Mic className="w-4 h-4 mr-1.5" /> Mic Live</> : <><MicOff className="w-4 h-4 mr-1.5" /> Start Mic</>}
          </Button>
          <Button onClick={hearNote} data-testid="learn-hear-note"
            className="flex-1 h-10 rounded-xl bg-[#0F0F16] border border-[#FF5F1F]/40 text-[#FF5F1F] hover:bg-[#FF5F1F]/10 font-bold text-xs">
            <Volume2 className="w-4 h-4 mr-1.5" /> Hear Note
          </Button>
          <Button onClick={restart} data-testid="learn-restart-inline" variant="ghost"
            className="w-10 h-10 p-0 rounded-xl text-[#5C5C6B] hover:text-white border border-white/8">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Instrument visual aid */}
      <div className="px-3 py-3">
        {instrument === "guitar" ? (
          <GuitarAid targetMidi={done ? notes[notes.length - 1] : targetMidi} onPlayNote={playViaAid} />
        ) : (
          <PianoAid targetMidi={done ? notes[notes.length - 1] : targetMidi}
            rangeMin={pianoRange.min} rangeMax={pianoRange.max} onPlayNote={playViaAid} />
        )}
      </div>
    </div>
  );
}
