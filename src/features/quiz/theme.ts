const CAT_COLORS: Record<
  string,
  { bg: string; border: string; color: string }
> = {
  "薬理・局所麻酔": {
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    color: "#34d399",
  },
  "薬理・アナフィラキシー": {
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.3)",
    color: "#fbbf24",
  },
  "薬理・筋弛緩": {
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.3)",
    color: "#fbbf24",
  },
  "薬理・オピオイド": {
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.3)",
    color: "#fbbf24",
  },
  心肺蘇生: {
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    color: "#f87171",
  },
  "モニタリング・ECG": {
    bg: "rgba(14,165,233,0.12)",
    border: "rgba(14,165,233,0.3)",
    color: "#38bdf8",
  },
  "モニタリング・バイタル": {
    bg: "rgba(14,165,233,0.12)",
    border: "rgba(14,165,233,0.3)",
    color: "#38bdf8",
  },
  気道管理: {
    bg: "rgba(168,85,247,0.12)",
    border: "rgba(168,85,247,0.3)",
    color: "#c084fc",
  },
  区域麻酔: {
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.3)",
    color: "#a78bfa",
  },
  産科麻酔: {
    bg: "rgba(236,72,153,0.12)",
    border: "rgba(236,72,153,0.3)",
    color: "#f472b6",
  },
  小児麻酔: {
    bg: "rgba(236,72,153,0.12)",
    border: "rgba(236,72,153,0.3)",
    color: "#f472b6",
  },
  "輸血・出血管理": {
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
    color: "#f87171",
  },
  術後管理: {
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.3)",
    color: "#818cf8",
  },
};
// Additional perioperative topics retain the existing palette and do not
// change the colors of historical categories.
for (const [category, reference] of Object.entries({
  "CE関連": "モニタリング・バイタル",
  "感染対策": "薬理・局所麻酔",
  "術前評価・合併症": "術後管理",
  "解剖・生理": "区域麻酔",
  "薬理・その他": "薬理・オピオイド",
  "医療安全・チーム医療": "気道管理",
  "体位・皮膚障害": "産科麻酔",
  "輸液・電解質": "モニタリング・バイタル",
  "呼吸管理": "気道管理",
})) CAT_COLORS[category] = CAT_COLORS[reference];
export const catStyle = (cat: string) =>
  CAT_COLORS[cat] ?? {
    bg: "rgba(100,100,100,0.1)",
    border: "rgba(100,100,100,0.2)",
    color: "#9ca3af",
  };

export const s = {
  bg: "#0d1526",
  card: "#111f36",
  border: "rgba(255,255,255,0.07)",
  text: "#e2eaf4",
  sub: "#4a7fa5",
};
