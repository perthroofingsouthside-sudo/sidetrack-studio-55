import { Swords, Trophy, Play, Pause, ThumbsUp, Mic, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * BattleDetailView — single-battle voting screen.
 */
export default function BattleDetailView({
  battle, covers, playingCoverId,
  onBack, onEnterSubmit, onPlayCover, onVote, onDuet,
}) {
  return (
    <div className="min-h-screen bg-[#05050A]" data-testid="battle-detail">
      <div className="glass-heavy px-4 py-3 flex items-center gap-3">
        <Button data-testid="detail-back-btn" variant="ghost" size="icon" onClick={onBack} className="text-[#A0A0B0]">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-['Outfit'] text-lg font-bold truncate">{battle.song_title}</h2>
          <p className="text-xs text-[#A0A0B0] truncate">{battle.song_artist}</p>
        </div>
        <Button
          data-testid="enter-battle-btn"
          onClick={onEnterSubmit}
          className="h-9 px-4 bg-[#FF6B00] hover:bg-[#FF8533] rounded-2xl text-sm font-bold gap-1.5"
        >
          <Mic className="w-3.5 h-3.5" /> Enter
        </Button>
      </div>
      <div className="px-4 py-4">
        <div className="surface-card p-4 flex items-center gap-4">
          {battle.song_cover_url && (
            <img src={battle.song_cover_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
          )}
          <div>
            <p className="text-sm text-[#A0A0B0]">{battle.challenge_text || "Record your best cover!"}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-[#FF6B00] flex items-center gap-1">
                <Users className="w-3 h-3" />{battle.cover_count || 0} covers
              </span>
              <span className="text-xs text-[#606070]">{battle.status}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4">
        <h3 className="font-['Outfit'] text-sm uppercase tracking-[0.2em] font-bold text-[#A0A0B0] mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#FF6B00]" /> Covers
        </h3>
        {covers.length === 0 && (
          <div className="surface-card p-8 text-center">
            <Swords className="w-10 h-10 text-[#FF6B00]/30 mx-auto mb-3" />
            <p className="text-sm text-[#606070]">No covers yet. Be the first!</p>
          </div>
        )}
        <div className="space-y-2 pb-24">
          {covers.map((cover, idx) => (
            <div
              key={cover.id}
              data-testid={`cover-${idx}`}
              className={`surface-card p-3 flex items-center gap-3 ${
                idx === 0 && cover.votes > 0 ? "border-[#FF6B00]/30" : ""
              }`}
            >
              <div className="w-8 text-center flex-shrink-0">
                {idx === 0 && cover.votes > 0
                  ? <Trophy className="w-5 h-5 text-[#FF6B00] mx-auto" />
                  : <span className="text-sm text-[#606070] font-bold">{idx + 1}</span>}
              </div>
              <Button
                data-testid={`play-cover-${idx}`}
                variant="ghost"
                size="icon"
                onClick={() => onPlayCover(cover)}
                className="flex-shrink-0 text-[#FF6B00]"
              >
                {playingCoverId === cover.id
                  ? <Pause className="w-5 h-5" />
                  : <Play className="w-5 h-5" fill="#FF6B00" />}
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{cover.title}</p>
                <p className="text-xs text-[#606070]">by {cover.username}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-[#39FF14]">{cover.votes}</span>
                <Button
                  data-testid={`vote-cover-${idx}`}
                  onClick={() => onVote(cover.id)}
                  variant="ghost"
                  size="icon"
                  className="text-[#A0A0B0] hover:text-[#39FF14] hover:bg-[#39FF14]/10 rounded-full"
                >
                  <ThumbsUp className="w-4 h-4" />
                </Button>
                <Button
                  data-testid={`duet-cover-${idx}`}
                  onClick={() => onDuet(cover)}
                  variant="ghost"
                  size="icon"
                  className="text-[#A0A0B0] hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 rounded-full"
                  title="Duet with this cover"
                >
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
