/* NoteHighway — perspective neon highway for the Learn tab.
   Notes are queue-positioned (index-relative), the current target pulses
   at the strike line until hit. Reuses the GamerStage visual language. */
import { useEffect, useRef } from "react";
import { noteName } from "@/services/PitchDetector";

const LANE_COLORS = ["#FF5F1F", "#39FF14", "#FFA64D", "#7FFF8E"];

export default function NoteHighway({ notes, currentIdx, hitFlash }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const posRef = useRef({}); // smooth-animated t per note index
  const stateRef = useRef({ notes, currentIdx, hitFlash });
  stateRef.current = { notes, currentIdx, hitFlash };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { notes: ns, currentIdx: ci, hitFlash: hf } = stateRef.current;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);

      const VP_X = W / 2, VP_Y = H * 0.04;
      const STRIKE_Y = H * 0.82;
      const FAR_W = W * 0.14, NEAR_W = W * 0.94;

      // Lane separators
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      [-2, -1, 0, 1, 2].forEach((i) => {
        const farX = VP_X + (FAR_W / 4) * i * 0.6;
        const nearX = VP_X + (NEAR_W / 4) * i;
        ctx.beginPath(); ctx.moveTo(farX, VP_Y); ctx.lineTo(nearX, H); ctx.stroke();
      });

      // Depth frets
      for (let f = 0; f <= 8; f++) {
        const yy = VP_Y + (STRIKE_Y - VP_Y) * Math.pow(f / 8, 2.2);
        const w = FAR_W + (NEAR_W - FAR_W) * Math.pow(f / 8, 2.2);
        ctx.strokeStyle = `rgba(57,255,20,${0.05 + (f / 8) * 0.12})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(VP_X - w / 2, yy); ctx.lineTo(VP_X + w / 2, yy); ctx.stroke();
      }

      // Strike line
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(VP_X - NEAR_W / 2, STRIKE_Y - 4, NEAR_W, 8);
      ctx.fillStyle = "rgba(255,95,31,0.55)";
      ctx.fillRect(VP_X - NEAR_W / 2, STRIKE_Y - 2, NEAR_W, 4);

      // Hit flash burst
      if (hf && performance.now() - hf.at < 380) {
        const p = (performance.now() - hf.at) / 380;
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = "#39FF14";
        ctx.beginPath(); ctx.arc(VP_X, STRIKE_Y, 22 + p * 60, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Notes: index-relative target position; current note sits at t=1
      const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
      for (let i = ns.length - 1; i >= ci; i--) {
        const rel = i - ci;
        if (rel > 5) continue;
        const targetT = Math.max(0.06, 1 - rel * 0.19);
        const cur = posRef.current[i] ?? targetT - 0.15;
        const t = cur + (targetT - cur) * 0.12;
        posRef.current[i] = t;

        const lane = ns[i] % 4;
        const laneOffset = lane - 1.5;
        const farX = VP_X + (FAR_W / 4) * laneOffset * 0.5;
        const nearX = VP_X + (NEAR_W / 4) * laneOffset;
        const px = farX + (nearX - farX) * Math.pow(t, 2.2);
        const py = VP_Y + (STRIKE_Y - VP_Y) * Math.pow(t, 2.2);
        const isCurrent = rel === 0;
        const radius = (5 + 16 * Math.pow(t, 2.2)) * (isCurrent ? pulse : 1);
        const color = LANE_COLORS[lane];

        ctx.shadowBlur = isCurrent ? 22 : 12;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(px - radius * 0.25, py - radius * 0.25, radius * 0.3, 0, Math.PI * 2); ctx.fill();

        // Note label
        ctx.fillStyle = isCurrent ? "#FFFFFF" : "rgba(255,255,255,0.7)";
        ctx.font = `900 ${isCurrent ? 13 : 10}px Outfit, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(noteName(ns[i]), px, py + radius + (isCurrent ? 16 : 12));
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" data-testid="learn-note-highway" />;
}
