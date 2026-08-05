import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Volume2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API } from "@/App";
import axios from "axios";

const STYLES = [
  { key: "rock_legend", label: "Rock Legend" },
  { key: "hiphop_pioneer", label: "Hip-Hop Pioneer" },
  { key: "mtv_icon", label: "MTV Icon" },
  { key: "mos_dj", label: "MOS DJ" },
];

/**
 * BackstageScreen — Pre-show AI motivational transition for the Gamer lane.
 * Renders 3 AI-generated lines from simulated prior performers, fading in
 * one at a time with neon green glow, then offers a "Take The Stage" CTA.
 */
export default function BackstageScreen({ song, userId, onProceed, onBack }) {
  const [style, setStyle] = useState("rock_legend");
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const requestLines = useCallback(async (selStyle) => {
    setLoading(true);
    setLines([]);
    setVisible(0);
    try {
      const res = await axios.post(`${API}/backstage/motivation`, {
        user_id: userId,
        song_title: song?.title || "Untitled",
        artist: song?.artist || "",
        style: selStyle,
      });
      if (res.data.success) {
        setLines(res.data.lines);
        // Stagger reveal
        let i = 0;
        const tick = () => {
          i++;
          setVisible(i);
          if (i < res.data.lines.length) {
            timerRef.current = setTimeout(tick, 1400);
          }
        };
        timerRef.current = setTimeout(tick, 600);
      }
    } catch (err) { console.error("Backstage err", err); }
    finally { setLoading(false); }
  }, [userId, song?.title, song?.artist]);

  useEffect(() => { requestLines(style); }, [style, requestLines]);

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="backstage-screen"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(57,255,20,0.08) 0%, #05050A 60%)" }}>
      {/* Faded backdrop logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
        <span className="font-['Outfit'] text-[18vw] font-black text-[#39FF14] tracking-tighter">BACKSTAGE</span>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#39FF14] font-bold mb-2" data-testid="backstage-label">Backstage · 2 min to show</p>
          <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-black text-white">
            <span className="text-[#FF5F1F]">{song?.title || "Your Track"}</span>
          </h1>
          {song?.artist && <p className="text-sm text-[#5C5C6B] mt-1">{song.artist}</p>}
        </div>

        {/* Style picker */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {STYLES.map(s => (
            <button key={s.key} onClick={() => setStyle(s.key)} data-testid={`backstage-style-${s.key}`}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                style === s.key
                  ? "border-[#39FF14] bg-[#39FF14]/15 text-[#39FF14]"
                  : "border-white/10 text-[#5C5C6B] hover:text-white"
              }`}>{s.label}</button>
          ))}
        </div>

        {/* AI motivation lines — floating, neon green calligraphy */}
        <div className="space-y-6 min-h-[320px]" data-testid="backstage-lines">
          {loading && lines.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-7 h-7 text-[#39FF14] animate-spin mb-3" />
              <p className="text-[10px] uppercase tracking-wider text-[#5C5C6B] font-bold">A legend is whispering...</p>
            </div>
          )}
          {lines.map((line, i) => {
            const isVisible = i < visible;
            return (
              <div key={line.id}
                data-testid={`backstage-line-${i}`}
                className="transition-all duration-1000 ease-out"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "translateY(0)" : "translateY(20px)",
                }}>
                <p className="font-['Outfit'] italic text-2xl sm:text-3xl leading-snug text-[#39FF14] font-bold"
                  style={{ textShadow: "0 0 24px rgba(57,255,20,0.6), 0 0 48px rgba(57,255,20,0.2)" }}>
                  &ldquo;{line.text}&rdquo;
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#FF5F1F] mt-2 font-bold">
                  — {line.performer} {line.is_ai && <span className="text-[#5C5C6B]/60 ml-1">(AI)</span>}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button onClick={onBack} variant="ghost" className="h-11 px-5 rounded-xl text-xs font-bold border border-white/10 text-[#5C5C6B] hover:text-white" data-testid="backstage-back-btn">
            Back
          </Button>
          <Button onClick={onProceed} disabled={visible < 1} data-testid="backstage-take-stage-btn"
            className="h-11 px-6 rounded-xl text-sm font-black text-[#05050A] bg-gradient-to-r from-[#FF5F1F] to-[#39FF14] hover:opacity-90"
            style={{ boxShadow: "0 0 28px rgba(57,255,20,0.45)" }}>
            <Volume2 className="w-4 h-4 mr-1.5" /> Take The Stage <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[10px] text-[#5C5C6B] uppercase tracking-wider">
            <Sparkles className="inline w-3 h-3 mr-1 text-[#39FF14]" />
            Gamer Lane · Private session · No social fanout
          </p>
        </div>
      </div>
    </div>
  );
}
