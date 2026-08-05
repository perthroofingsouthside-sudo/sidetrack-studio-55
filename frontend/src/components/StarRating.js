/* StarRating — 18+ peer grading widget for creator content. */
import { useState, useEffect, useCallback } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

export default function StarRating({ itemId, itemType = "battle", size = 14, compact = false }) {
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [mine, setMine] = useState(null);
  const [hover, setHover] = useState(0);
  const raterId = localStorage.getItem("sidetrack_voter_id") || "anon";
  const isGrommet = localStorage.getItem("pp_age_mode") === "grommet";

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ratings/${itemId}`, { params: { rater_id: raterId } });
      setAvg(res.data.avg || 0);
      setCount(res.data.count || 0);
      setMine(res.data.my_stars);
    } catch { /* silent */ }
  }, [itemId, raterId]);

  useEffect(() => { load(); }, [load]);

  const rate = async (stars) => {
    if (isGrommet) { toast.error("Peer grading is 18+ — level up with a guardian to unlock Creator mode."); return; }
    try {
      const res = await axios.post(`${API}/ratings`, { rater_id: raterId, item_id: itemId, item_type: itemType, stars });
      setAvg(res.data.avg); setCount(res.data.count); setMine(res.data.my_stars);
      toast.success(`Rated ${stars}★`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't rate");
    }
  };

  return (
    <div className="flex items-center gap-1.5" data-testid={`star-rating-${itemId}`}>
      <div className="flex items-center" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => {
          const lit = hover ? s <= hover : (mine ? s <= mine : s <= Math.round(avg));
          return (
            <button key={s} onClick={(e) => { e.stopPropagation(); rate(s); }} onMouseEnter={() => setHover(s)}
              data-testid={`star-${itemId}-${s}`} className="p-0.5">
              <Star style={{ width: size, height: size }}
                className={lit ? "text-[#FF5F1F]" : "text-white/15"}
                fill={lit ? "#FF5F1F" : "none"} />
            </button>
          );
        })}
      </div>
      {!compact && (
        <span className="text-[9px] font-bold text-[#5C5C6B]" data-testid={`rating-summary-${itemId}`}>
          {count > 0 ? `${avg.toFixed(1)} · ${count}` : "Rate it"}
        </span>
      )}
    </div>
  );
}
