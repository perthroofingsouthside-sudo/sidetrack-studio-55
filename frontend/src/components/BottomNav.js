import { Home, Music2, Mic2, Share2, Radio, Swords, ListMusic, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { key: "stream", icon: Radio, label: "Stream", alwaysEnabled: true },
  { key: "home", icon: Home, label: "Discover", alwaysEnabled: true },
  { key: "battle", icon: Swords, label: "Battle", alwaysEnabled: true },
  { key: "star", icon: Star, label: "Star", alwaysEnabled: true },
  { key: "playlists", icon: ListMusic, label: "Playlists", alwaysEnabled: true },
  { key: "profile", icon: User, label: "Profile", alwaysEnabled: true },
  { key: "studio", icon: Music2, label: "Studio" },
  { key: "record", icon: Mic2, label: "Record" },
];

export default function BottomNav({ currentView, onNavigate, hasSong }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-heavy safe-bottom"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around max-w-2xl mx-auto h-16 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.key;
          const isDisabled = !item.alwaysEnabled && item.key !== "home" && !hasSong;

          return (
            <Button
              key={item.key}
              data-testid={`nav-${item.key}`}
              variant="ghost"
              onClick={() => !isDisabled && onNavigate(item.key)}
              className={`flex flex-col items-center gap-0.5 h-14 px-1.5 sm:px-2 rounded-xl transition-all min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                isActive
                  ? "text-[#FF6B00]"
                  : isDisabled
                  ? "text-[#606070]/40 cursor-not-allowed"
                  : "text-[#606070] hover:text-[#A0A0B0]"
              }`}
            >
              <item.icon className={`${isActive ? "drop-shadow-[0_0_8px_rgba(255,107,0,0.6)]" : ""}`} style={{ width: 18, height: 18 }} />
              <span className="text-[8px] sm:text-[9px] font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
