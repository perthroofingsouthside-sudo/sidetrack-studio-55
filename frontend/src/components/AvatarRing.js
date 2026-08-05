import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Users } from "lucide-react";

/**
 * useAudioActivity — Detects voice/instrument input via Web Audio API AnalyserNode.
 * Returns a 0-1 intensity value updated ~30fps when active.
 * Works with any audio stream (microphone, instrument input).
 */
export function useAudioActivity(stream) {
  const [intensity, setIntensity] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    if (!stream) { setIntensity(0); setIsActive(false); return; }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataRef.current);
        // Compute RMS energy across frequency bins
        let sum = 0;
        for (let i = 0; i < dataRef.current.length; i++) sum += dataRef.current[i] * dataRef.current[i];
        const rms = Math.sqrt(sum / dataRef.current.length) / 255;
        // Convert RMS to dB: 20·log10(rms). rms=1 → 0dB, rms=0.0178 → -35dB
        const db = rms > 0 ? 20 * Math.log10(rms) : -120;
        // Active threshold: -35dB (configurable). Map -35dB..-5dB → 0..1 intensity.
        const ACTIVE_DB = -35;
        const PEAK_DB = -5;
        const normalized = Math.max(0, Math.min(1, (db - ACTIVE_DB) / (PEAK_DB - ACTIVE_DB)));
        setIntensity(normalized);
        setIsActive(db > ACTIVE_DB);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("Audio activity detection failed:", err);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ctxRef.current && ctxRef.current.state !== "closed") ctxRef.current.close();
    };
  }, [stream]);

  return { intensity, isActive };
}

/**
 * AvatarRing — Circular avatar with orange ring (default) + green glow (active).
 * Props:
 *  - name: display initial
 *  - size: "lg" | "md" | "sm" (default "md")
 *  - isActive: boolean — green glow on
 *  - intensity: 0-1 — dynamic glow intensity
 *  - icon: optional Lucide icon component
 *  - imageUrl: optional profile picture URL
 *  - label: role label below avatar
 */
export default function AvatarRing({
  name = "?",
  size = "md",
  isActive = false,
  intensity = 0,
  icon: IconComponent,
  imageUrl,
  label,
}) {
  const sizeMap = { lg: "w-20 h-20", md: "w-12 h-12", sm: "w-10 h-10" };
  const iconSize = { lg: "w-8 h-8", md: "w-5 h-5", sm: "w-4 h-4" };
  const textSize = { lg: "text-2xl", md: "text-sm", sm: "text-xs" };
  const dim = sizeMap[size] || sizeMap.md;
  const useDynamic = intensity > 0;

  return (
    <div className="flex flex-col items-center gap-1.5" data-testid={`avatar-ring-${name}`}>
      <div
        className={`${dim} rounded-full flex items-center justify-center overflow-hidden
          ${useDynamic ? "avatar-ring avatar-ring-dynamic" : isActive ? "avatar-ring avatar-ring-active" : "avatar-ring"}
          ${size === "sm" ? "avatar-ring-sm" : ""}`}
        style={useDynamic ? { "--glow-intensity": intensity } : undefined}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : IconComponent ? (
          <IconComponent className={`${iconSize[size]} ${isActive ? "text-[#39FF14]" : "text-[#FF5F1F]/40"} transition-colors duration-200`} />
        ) : (
          <span className={`${textSize[size]} font-bold ${isActive ? "text-[#39FF14]" : "text-[#FF5F1F]"} transition-colors duration-200`}>
            {name[0]?.toUpperCase() || "?"}
          </span>
        )}
      </div>
      {label && (
        <span className={`text-[8px] font-bold uppercase tracking-wider transition-colors duration-200 ${isActive ? "text-[#39FF14]" : "text-[#5C5C6B]"}`}>
          {label}
        </span>
      )}
    </div>
  );
}
