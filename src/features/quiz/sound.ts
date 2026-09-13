const soundCache: Record<string, HTMLAudioElement> = {};
// BGM がオフのときは効果音（クリック・正誤）も鳴らさない
let sfxEnabled = false;
export function playSound(type: "correct" | "incorrect" | "click") {
  if (typeof window === "undefined") return;
  if (!sfxEnabled) return;
  const urls: Record<string, string> = {
    correct: "/sounds/right.mp3",
    incorrect: "/sounds/wrong.mp3",
    click: "/sounds/click.mp3",
  };
  if (!soundCache[type]) soundCache[type] = new Audio(urls[type]);
  soundCache[type].currentTime = 0;
  soundCache[type].play().catch(() => {});
}

export function setSfxEnabled(enabled: boolean) {
  sfxEnabled = enabled;
}
