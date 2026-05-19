import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";

const MOCK_HANDLES = ["@neon_kid", "@mtv_fan", "@bass_drop", "@stage_owl", "@hh_head", "@gamer_44", "@rock_legend", "@vibe_kid", "@cover_queen"];
const MOCK_MSGS = [
  "Yes!! Killing it 🔥", "Bass is HUGE", "this verse though", "calligraphy lyrics 🤌",
  "voice glow up", "send the link", "drop the cover", "rewind that hook",
  "Neon vibe", "I'm crying", "stage entrance was clean", "absolute fire",
  "more reverb", "this layout slaps", "MTV era flashback", "first man energy",
];

/**
 * FloatingComments — Live-stage chat overlay that floats neon-green messages
 * up the LEFT side of a video frame. Each comment auto-fades after ~5s.
 * Mock-only for now; can be wired to the WebSocket chat later.
 */
export default function FloatingComments({ active = true }) {
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!active) return;
    let counter = 0;
    const tick = () => {
      counter++;
      const id = `c-${Date.now()}-${counter}`;
      const handle = MOCK_HANDLES[Math.floor(Math.random() * MOCK_HANDLES.length)];
      const text = MOCK_MSGS[Math.floor(Math.random() * MOCK_MSGS.length)];
      setComments(prev => [...prev.slice(-5), { id, handle, text, born: Date.now() }]);
    };
    const initial = setTimeout(tick, 600);
    const interval = setInterval(tick, 1700);
    const sweep = setInterval(() => {
      setComments(prev => prev.filter(c => Date.now() - c.born < 5500));
    }, 1000);
    return () => { clearTimeout(initial); clearInterval(interval); clearInterval(sweep); };
  }, [active]);

  if (!active) return null;
  return (
    <div className="absolute top-0 left-0 bottom-0 w-[42%] max-w-[200px] pointer-events-none z-30 flex flex-col-reverse gap-1.5 px-2 pb-3 pt-12 overflow-hidden"
         data-testid="floating-comments">
      {comments.map((c, idx) => {
        const age = Date.now() - c.born;
        const opacity = age < 4500 ? 1 : Math.max(0, 1 - (age - 4500) / 1000);
        const translateY = age < 600 ? (20 - (age / 30)) : 0;
        return (
          <div key={c.id}
            className="transition-all duration-700"
            style={{ opacity, transform: `translateY(${translateY}px)` }}
            data-testid={`floating-comment-${idx}`}>
            <div className="inline-flex items-start gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md"
              style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)" }}>
              <MessageCircle className="w-2.5 h-2.5 text-[#39FF14] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[8px] text-[#39FF14]/70 font-bold leading-none mb-0.5 uppercase tracking-wider">{c.handle}</p>
                <p className="text-[11px] font-['Outfit'] font-semibold text-[#39FF14] leading-snug truncate"
                   style={{ textShadow: "0 0 10px rgba(57,255,20,0.5)" }}>{c.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
