import { useState, useRef, useEffect } from "react";
import { setSfxEnabled } from "./sound";

export function useQuizAudio() {
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [bgmTrack, setBgmTrack] = useState<"1" | "2" | "3">("1");
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSfxEnabled(bgmEnabled);
    if (bgmEnabled) {
      if (
        !bgmRef.current ||
        bgmRef.current.src !==
          window.location.origin + `/sounds/bgm${bgmTrack}.mp3`
      ) {
        if (bgmRef.current) {
          bgmRef.current.pause();
          bgmRef.current = null;
        }
        const a = new Audio(`/sounds/bgm${bgmTrack}.mp3`);
        a.loop = true;
        a.volume = 0.3;
        a.play().catch(() => {});
        bgmRef.current = a;
      }
    } else {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
    }
  }, [bgmEnabled, bgmTrack]);

  return { bgmEnabled, setBgmEnabled, bgmTrack, setBgmTrack };
}
