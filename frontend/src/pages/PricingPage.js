/* FREE ACCESS PAGE — Pocket Products is 100% free.
   Replaced the old subscription/ownership pricing page in the free pivot.
   Route key remains "pricing" for router compatibility. */
import { useState, useEffect } from "react";
import {
  ArrowLeft, Sparkles, Music2, Gamepad2, Swords, GraduationCap, Mic2,
  Users, Radio, Heart, Check, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API } from "@/App";
import axios from "axios";

const FREE_FEATURES = [
  { Icon: Music2, label: "Creator Studio", desc: "16-pad sampler, stems, AI beats", accent: "#FF6B00" },
  { Icon: Gamepad2, label: "Gamer Lane", desc: "Karaoke game, avatars, Backstage AI", accent: "#39FF14" },
  { Icon: Swords, label: "Battle Stage", desc: "Rap battles, matchmaking, voting", accent: "#FF6B00" },
  { Icon: GraduationCap, label: "Learn Mode", desc: "Guitar & piano with pitch feedback", accent: "#39FF14" },
  { Icon: Mic2, label: "Recording", desc: "Stem separation, vocal drops, mixing", accent: "#FF6B00" },
  { Icon: Users, label: "Connect", desc: "Jam rooms, duets, vibe-match", accent: "#39FF14" },
  { Icon: Radio, label: "Full Catalog", desc: "Every curated track, zero locks", accent: "#FF6B00" },
  { Icon: Heart, label: "Social Profile", desc: "Posting, playlists, followers", accent: "#39FF14" },
];

export default function PricingPage({ onBack }) {
  const [artistCut, setArtistCut] = useState(70);

  useEffect(() => {
    axios.get(`${API}/store/pricing`)
      .then((res) => { if (res.data?.artist_cut_pct) setArtistCut(res.data.artist_cut_pct); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#05050A] pb-32" data-testid="pricing-page">
      {/* Header */}
      <div className="px-4 pt-5 flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} className="text-[#5C5C6B] hover:text-white p-2" data-testid="pricing-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Hero */}
      <div className="relative px-4 pt-4 pb-8 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#39FF14]/10 via-[#05050A] to-[#05050A]" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/8 text-[#39FF14] text-[10px] font-black uppercase tracking-[0.25em] mb-4">
            <Sparkles className="w-3 h-3" /> No subscriptions · No paywalls
          </span>
          <h1 className="font-['Outfit'] text-4xl sm:text-5xl font-black text-white leading-tight" data-testid="pricing-heading">
            100% <span className="text-[#39FF14]" style={{ textShadow: "0 0 24px rgba(57,255,20,0.5)" }}>Free.</span>{" "}
            <span className="text-[#FF6B00]" style={{ textShadow: "0 0 24px rgba(255,107,0,0.5)" }}>Forever.</span>
          </h1>
          <p className="text-sm text-[#A0A0B0] mt-3 max-w-md mx-auto">
            Every lane, every feature, every track — completely free for everyone. Just join and create.
          </p>
          <Button onClick={onBack} data-testid="join-free-btn"
            className="mt-5 h-12 px-8 rounded-full bg-[#39FF14] hover:bg-[#39FF14]/90 text-[#05050A] font-black text-sm uppercase tracking-wider"
            style={{ boxShadow: "0 0 28px rgba(57,255,20,0.45)" }}>
            Start Creating — Free
          </Button>
        </div>
      </div>

      {/* Everything unlocked grid */}
      <div className="px-4">
        <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.2em] font-bold text-[#5C5C6B] mb-3 flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-[#39FF14]" /> Everything Unlocked
        </h3>
        <div className="grid grid-cols-2 gap-3" data-testid="free-features-grid">
          {FREE_FEATURES.map(({ Icon, label, desc, accent }) => (
            <div key={label} className="rounded-2xl border border-white/8 p-4"
              style={{ background: "rgba(15,15,22,0.6)" }}>
              <Icon className="w-5 h-5 mb-2" style={{ color: accent }} />
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-[10px] text-[#5C5C6B] leading-snug mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Artist economy */}
      <div className="px-4 mt-6">
        <div className="rounded-2xl border border-[#FF6B00]/25 p-5"
          style={{ background: "rgba(255,107,0,0.05)" }} data-testid="artist-economy-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,107,0,0.15)", boxShadow: "0 0 16px rgba(255,107,0,0.3)" }}>
              <TrendingUp className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Artists Get Paid</p>
              <p className="text-[10px] text-[#5C5C6B]">The creator economy, artist-favoured</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full overflow-hidden flex">
              <div style={{ width: `${artistCut}%`, background: "#39FF14", boxShadow: "0 0 10px rgba(57,255,20,0.5)" }} />
              <div style={{ width: `${100 - artistCut}%`, background: "rgba(255,107,0,0.4)" }} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] font-black text-[#39FF14]" data-testid="artist-split-pct">{artistCut}% to the artist</span>
            <span className="text-[11px] font-bold text-[#5C5C6B]">{100 - artistCut}% platform</span>
          </div>
          <p className="text-[10px] text-[#A0A0B0] leading-snug mt-3">
            Platform access costs nothing. When fans buy a creator's music, the artist keeps {artistCut}% of every sale.
          </p>
        </div>
      </div>
    </div>
  );
}
