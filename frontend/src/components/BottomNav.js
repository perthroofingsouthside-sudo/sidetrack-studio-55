import { Home, Music2, Mic2, Swords, ListMusic, Star, User, MessageSquare, Gamepad2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Creator-lane items (Originals, social, battles)
const CREATOR_ITEMS = [
  { key: "home", icon: Home, label: "Discover" },
  { key: "battle", icon: Swords, label: "Battle" },
  { key: "star", icon: Star, label: "Star" },
  { key: "connect", icon: MessageSquare, label: "Connect" },
  { key: "studio", icon: Music2, label: "Studio" },
  { key: "record", icon: Mic2, label: "Record" },
  { key: "profile", icon: User, label: "Profile" },
];

// Gamer-lane items (Private, skill-build, spectator hub)
const GAMER_ITEMS = [
  { key: "gamer", icon: Gamepad2, label: "Gamer" },
  { key: "battle", icon: Swords, label: "Hub" },
  { key: "playlists", icon: ListMusic, label: "Tracks" },
  { key: "backstage", icon: Sparkles, label: "Backstage" },
  { key: "record", icon: Mic2, label: "Stage" },
  { key: "profile", icon: User, label: "Profile" },
];

export default function BottomNav({ currentView, onNavigate, lane = "creator", onLaneChange }) {
  const items = lane === "gamer" ? GAMER_ITEMS : CREATOR_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-heavy safe-bottom"
      data-testid="bottom-nav"
    >
      {/* Lane Toggle Pill */}
      <div className="flex items-center justify-center pt-2 pb-1">
        <div className="inline-flex items-center gap-0.5 rounded-full p-0.5 border border-white/10" style={{ background: "rgba(15,15,22,0.85)" }} data-testid="lane-toggle">
          <button onClick={() => onLaneChange("creator")} data-testid="lane-toggle-creator"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
              lane === "creator" ? "bg-[#FF6B00] text-[#05050A] shadow-[0_0_12px_rgba(255,107,0,0.4)]" : "text-[#5C5C6B]"
            }`}>
            <Music2 className="w-2.5 h-2.5" /> Creator
          </button>
          <button onClick={() => onLaneChange("gamer")} data-testid="lane-toggle-gamer"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${
              lane === "gamer" ? "bg-[#39FF14] text-[#05050A] shadow-[0_0_12px_rgba(57,255,20,0.4)]" : "text-[#5C5C6B]"
            }`}>
            <Gamepad2 className="w-2.5 h-2.5" /> Gamer
          </button>
        </div>
      </div>

      <div className="flex items-center justify-around max-w-2xl mx-auto h-14 px-1">
        {items.map((item) => {
          const isActive = currentView === item.key;
          const accent = lane === "gamer" ? "#39FF14" : "#FF6B00";
          return (
            <Button
              key={item.key}
              data-testid={`nav-${item.key}`}
              variant="ghost"
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center gap-0.5 h-12 px-1.5 sm:px-2 rounded-xl transition-all min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                isActive ? "" : "text-[#606070] hover:text-[#A0A0B0]"
              }`}
              style={isActive ? { color: accent } : undefined}
            >
              <item.icon style={{ width: 18, height: 18, filter: isActive ? `drop-shadow(0 0 8px ${accent}99)` : "none" }} />
              <span className="text-[8px] sm:text-[9px] font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
