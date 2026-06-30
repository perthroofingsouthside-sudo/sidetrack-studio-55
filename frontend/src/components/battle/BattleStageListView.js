import { Swords, Trophy, ThumbsUp, Plus, Users, Flame, Star, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import BattleStageBackdrop, { SKIN_KEYS, SKIN_LABELS } from "@/components/BattleStageBackdrop";

/**
 * BattleStageListView — the theatrical "Battle Stage" list view (curtains +
 * marquee + Hall of Fame + Tonight's Battles). Top-level Battle Arena screen.
 */
export default function BattleStageListView({
  battles, leaderboard,
  stageSkin, skinPickerOpen, onTogglePicker, onChangeSkin,
  onCreateBattle, onOpenBattle,
}) {
  const allSceneryCovers = [...battles, ...leaderboard];
  const marqueeArtists = (() => {
    const seen = new Set();
    const out = [];
    [...battles, ...leaderboard].forEach((b) => {
      const a = (b?.song_artist || b?.artist || "").trim();
      if (a && !seen.has(a.toLowerCase())) { seen.add(a.toLowerCase()); out.push(a); }
    });
    return out.length ? out : ["Pocket Products", "Live Tonight", "Take The Mic", "Karaoke Stars"];
  })();

  return (
    <div className="min-h-screen relative bg-[#05050A] overflow-x-hidden" data-testid="battle-arena">
      <BattleStageBackdrop covers={allSceneryCovers} skin={stageSkin} />

      <button
        onClick={onTogglePicker}
        data-testid="stage-skin-toggle"
        className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 h-8 rounded-full border border-white/15 backdrop-blur-md text-[10px] uppercase tracking-wider font-black text-white"
        style={{ background: "rgba(10,10,15,0.7)", boxShadow: "0 0 12px rgba(255,255,255,0.08)" }}
      >
        <Palette className="w-3 h-3 text-[#39FF14]" />
        {SKIN_LABELS[stageSkin]?.label || "Stage"}
      </button>
      {skinPickerOpen && (
        <div
          data-testid="stage-skin-picker"
          className="absolute top-12 left-3 z-30 rounded-2xl border border-white/15 backdrop-blur-md p-1.5 space-y-1"
          style={{ background: "rgba(10,10,15,0.92)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
        >
          {SKIN_KEYS.map((k) => (
            <button
              key={k}
              data-testid={`stage-skin-${k}`}
              onClick={() => onChangeSkin(k)}
              className={`w-full flex items-center gap-2 px-3 h-8 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                stageSkin === k
                  ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/40"
                  : "text-[#A0A0B0] hover:text-white hover:bg-white/5"
              }`}
            >
              {SKIN_LABELS[k]?.label || k}
              {stageSkin === k && <span className="ml-auto text-[#39FF14]">✓</span>}
            </button>
          ))}
        </div>
      )}

      <div className="relative z-10">
        {/* Marquee header */}
        <div className="px-4 pt-8 pb-3 flex flex-col items-center text-center" data-testid="battle-stage-header">
          <div className="flex items-center gap-1.5 px-3 h-7 rounded-full border border-[#39FF14]/40 mb-3"
            style={{ background: "rgba(57,255,20,0.06)", boxShadow: "0 0 18px rgba(57,255,20,0.18)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#39FF14]">On Stage Tonight</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
          </div>
          <h1 className="font-['Outfit'] font-black uppercase leading-none tracking-tight"
            style={{ textShadow: "0 0 22px rgba(255,107,0,0.55), 0 0 48px rgba(255,107,0,0.25)" }}>
            <span className="block text-4xl sm:text-5xl text-white">Battle</span>
            <span className="block text-5xl sm:text-6xl text-[#FF6B00]">Stage</span>
          </h1>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <Star className="w-3 h-3 text-[#39FF14] fill-[#39FF14] animate-pulse" />
            <p className="text-[11px] text-[#A0A0B0] font-bold tracking-wider uppercase">Record · Compete · Win The Spotlight</p>
            <Star className="w-3 h-3 text-[#39FF14] fill-[#39FF14] animate-pulse" />
          </div>
          <Button
            data-testid="create-battle-btn"
            onClick={() => onCreateBattle()}
            className="h-11 px-6 rounded-full text-sm font-black uppercase tracking-wider gap-2 bg-gradient-to-r from-[#FF6B00] to-[#FF8533] text-white hover:scale-105 transition-transform"
            style={{ boxShadow: "0 0 24px rgba(255,107,0,0.55), 0 8px 20px rgba(0,0,0,0.4)" }}
          >
            <Plus className="w-4 h-4" /> Take The Stage
          </Button>
        </div>

        {/* Scrolling artist marquee */}
        <div
          className="relative mx-3 my-3 h-8 overflow-hidden rounded-full border border-white/8"
          data-testid="artist-marquee"
          style={{ background: "rgba(10,10,15,0.55)", backdropFilter: "blur(6px)" }}
        >
          <div className="absolute inset-y-0 left-0 w-12 z-10 pointer-events-none"
            style={{ background: "linear-gradient(90deg, rgba(5,5,10,0.95), transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-12 z-10 pointer-events-none"
            style={{ background: "linear-gradient(270deg, rgba(5,5,10,0.95), transparent)" }} />
          <div
            className="flex items-center gap-6 h-full whitespace-nowrap will-change-transform"
            style={{ animation: "marqueeScroll 28s linear infinite" }}
          >
            {[...marqueeArtists, ...marqueeArtists].map((a, i) => (
              <span key={`mq-${i}`} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em]">
                <Star className="w-2.5 h-2.5 text-[#FF6B00] fill-[#FF6B00]" />
                <span className="text-white">{a}</span>
                <span className="text-[#39FF14]">·</span>
              </span>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="px-4 space-y-6 pb-28">
            {/* Hall of Fame */}
            {leaderboard.length > 0 && (
              <section data-testid="leaderboard-section">
                <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.3em] font-black text-[#39FF14] mb-3 flex items-center gap-2 justify-center">
                  <Trophy className="w-4 h-4" /> Hall of Fame
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                  {leaderboard.slice(0, 5).map((cover, idx) => (
                    <div
                      key={cover.id}
                      data-testid={`leaderboard-${idx}`}
                      className="flex-shrink-0 w-44 rounded-2xl p-3 relative border"
                      style={{
                        background: "rgba(15,15,22,0.85)",
                        borderColor: idx === 0 ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)",
                        boxShadow: idx === 0 ? "0 0 24px rgba(255,107,0,0.35)" : "0 4px 14px rgba(0,0,0,0.4)",
                      }}
                    >
                      {idx === 0 && (
                        <div
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-[#FF6B00] to-[#FF8533] flex items-center justify-center"
                          style={{ boxShadow: "0 0 14px rgba(255,107,0,0.7)" }}
                        >
                          <Trophy className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      {cover.song_cover_url && (
                        <img src={cover.song_cover_url} alt="" className="w-full h-24 rounded-lg object-cover mb-2" />
                      )}
                      <p className="text-xs font-bold text-white truncate">{cover.title}</p>
                      <p className="text-[10px] text-[#A0A0B0] truncate">{cover.song_title}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <ThumbsUp className="w-3 h-3 text-[#39FF14]" />
                        <span className="text-xs font-black text-[#39FF14]">{cover.votes}</span>
                        <span className="text-[9px] text-[#5C5C6B] ml-auto uppercase tracking-wider font-bold">#{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tonight's Battles */}
            <section data-testid="active-battles">
              <h3 className="font-['Outfit'] text-xs uppercase tracking-[0.3em] font-black text-[#FF6B00] mb-3 flex items-center gap-2 justify-center">
                <Flame className="w-4 h-4" /> Tonight&rsquo;s Battles
              </h3>
              {battles.length === 0 && (
                <div
                  className="rounded-2xl p-8 text-center border border-[#FF6B00]/20"
                  style={{ background: "rgba(255,107,0,0.04)" }}
                  data-testid="empty-battles"
                >
                  <Swords className="w-14 h-14 text-[#FF6B00]/30 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-white font-bold mb-1">The stage is empty…</p>
                  <p className="text-xs text-[#A0A0B0] mb-3">Be the first to grab the mic tonight!</p>
                  <p className="text-[10px] text-[#FF6B00] uppercase tracking-wider font-black">
                    Pick a song &amp; tap &ldquo;Take The Stage&rdquo;
                  </p>
                </div>
              )}
              <div className="space-y-2.5">
                {battles.map((battle) => (
                  <div
                    key={battle.id}
                    onClick={() => onOpenBattle(battle)}
                    className="rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer transition-all border group hover:scale-[1.01]"
                    style={{
                      background: "rgba(15,15,22,0.85)",
                      borderColor: "rgba(255,107,0,0.18)",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
                    }}
                    data-testid={`battle-card-${battle.id}`}
                  >
                    {battle.song_cover_url ? (
                      <div className="relative flex-shrink-0">
                        <img src={battle.song_cover_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                        <div
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF6B00] flex items-center justify-center"
                          style={{ boxShadow: "0 0 10px rgba(255,107,0,0.6)" }}
                        >
                          <Swords className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FF6B00]/20 to-[#39FF14]/15 flex items-center justify-center flex-shrink-0">
                        <Swords className="w-6 h-6 text-[#FF6B00]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate group-hover:text-[#FF6B00] transition-colors">
                        {battle.song_title}
                      </p>
                      <p className="text-[11px] text-[#A0A0B0] truncate">{battle.song_artist}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-[#FF6B00] flex items-center gap-1 font-bold uppercase tracking-wider">
                          <Users className="w-3 h-3" />{battle.cover_count || 0} on stage
                        </span>
                        <span className="text-[10px] text-[#39FF14] flex items-center gap-1 font-bold uppercase tracking-wider">
                          <Flame className="w-3 h-3" />Live
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <span className="text-[8px] uppercase tracking-wider text-[#FF6B00] font-black">Enter</span>
                      <Swords className="w-5 h-5 text-[#FF6B00] group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
