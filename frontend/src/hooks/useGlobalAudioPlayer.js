import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

/**
 * useGlobalAudioPlayer — single Audio element for the whole app.
 *
 *  • playTrack(track)          — load + play (track must have preview_url)
 *  • togglePlayPause()         — pause / resume current track
 *  • handleSeek(pct)           — seek to a fraction [0..1]
 *  • Returned state: { nowPlaying, isPlaying, progress (%) }
 *
 *  Uses the audio element's native `timeupdate` so no rAF loops accumulate.
 */
export function useGlobalAudioPlayer() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  const attachProgressListener = useCallback((audio) => {
    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => { setIsPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio._cleanupProgress = () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const playTrack = useCallback((track) => {
    if (!track?.preview_url) { toast.info("No preview available"); return; }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current._cleanupProgress?.();
      audioRef.current = null;
    }
    const audio = new Audio(track.preview_url);
    audio.volume = 0.8;
    audioRef.current = audio;
    setNowPlaying(track);
    setIsPlaying(true);
    setProgress(0);
    attachProgressListener(audio);
    audio.play().catch(() => toast.error("Playback failed"));
  }, [attachProgressListener]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setIsPlaying(true); }
  }, [isPlaying]);

  const handleSeek = useCallback((pct) => {
    if (!audioRef.current?.duration) return;
    audioRef.current.currentTime = pct * audioRef.current.duration;
    setProgress(pct * 100);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current._cleanupProgress?.();
      audioRef.current = null;
    }
  }, []);

  return { nowPlaying, isPlaying, progress, playTrack, togglePlayPause, handleSeek };
}
