import { Home, Music2, Mic2, Share2, Radio, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { key: "stream", icon: Radio, label: "Stream", alwaysEnabled: true },
  { key: "home", icon: Home, label: "Discover", alwaysEnabled: true },
  { key: "battle", icon: Swords, label: "Battle", alwaysEnabled: true },
  { key: "studio", icon: Music2, label: "Studio" },
  { key: "record", icon: Mic2, label: "Record" },
];

export default function BottomNav({ currentView, onNavigate, hasSong }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-heavy safe-bottom"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.key;
          const isDisabled = !item.alwaysEnabled && item.key !== "home" && !hasSong;

          return (
            <Button
              key={item.key}
              data-testid={`nav-${item.key}`}
              variant="ghost"
              onClick={() => !isDisabled && onNavigate(item.key)}
              className={`flex flex-col items-center gap-1 h-14 px-4 rounded-xl transition-all ${
                isActive
                  ? "text-[#8A2BE2]"
                  : isDisabled
                  ? "text-[#606070]/40 cursor-not-allowed"
                  : "text-[#606070] hover:text-[#A0A0B0]"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_8px_rgba(138,43,226,0.6)]" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
