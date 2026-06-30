import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

/**
 * useBattleRecorder — encapsulates mic recording, duration timer, and cover
 * playback for the Battle Arena's Submit + Detail views.
 *
 *  • startRecording() / stopRecording()
 *  • playCoverAudio(cover, battleId)
 *  • State: isRecording, duration (sec), recordedBlob, playingCoverId
 *  • resetTake() — clears the latest recorded blob (e.g. after submission)
 */
export function useBattleRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [playingCoverId, setPlayingCoverId] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setRecordedBlob(null);
      timerRef.current = setInterval(() => setDuration((p) => p + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  }, []);

  const resetTake = useCallback(() => setRecordedBlob(null), []);

  const playCoverAudio = useCallback(async (cover, battleId) => {
    if (playingCoverId === cover.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingCoverId(null);
      return;
    }
    try {
      const res = await axios.get(`${API}/battles/${battleId}/cover/${cover.id}/audio`);
      if (res.data.success && res.data.audio_data) {
        const byteString = atob(res.data.audio_data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(url);
        audio.play();
        audioRef.current = audio;
        setPlayingCoverId(cover.id);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setPlayingCoverId(null);
        };
      }
    } catch {
      toast.error("Playback failed");
    }
  }, [playingCoverId]);

  // Cleanup on unmount: stop recording, clear timer, stop playback
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  return {
    isRecording, duration, recordedBlob, playingCoverId,
    startRecording, stopRecording, resetTake, playCoverAudio,
  };
}

export const fmtDur = (s) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
