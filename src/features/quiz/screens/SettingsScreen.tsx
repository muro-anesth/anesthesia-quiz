import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";

type Props = Pick<
  QuizController,
  | "bgmEnabled"
  | "bgmTrack"
  | "categories"
  | "phase"
  | "saving"
  | "selectedCats"
  | "selectedYears"
  | "setBgmEnabled"
  | "setBgmTrack"
  | "setPhase"
  | "setSelectedCats"
  | "setSelectedYears"
  | "years"
>;

export function SettingsScreen({
  bgmEnabled,
  bgmTrack,
  categories,
  phase,
  saving,
  selectedCats,
  selectedYears,
  setBgmEnabled,
  setBgmTrack,
  setPhase,
  setSelectedCats,
  setSelectedYears,
  years,
}: Props) {
  return (
    <>
      {phase === "settings" && (
        <div style={{ padding: 16 }}>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 16 }}
          >
            <button
              disabled={saving}
              onClick={() => setPhase("home")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${s.border}`,
                borderRadius: 10,
                padding: "8px 16px",
                color: s.text,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← ホーム
            </button>
            <span style={{ fontWeight: 600, marginLeft: 12 }}>設定</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: s.card,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                BGM
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 14 }}>
                  BGM {bgmEnabled ? "オン" : "オフ"}
                </span>
                <div
                  onClick={() => setBgmEnabled((v) => !v)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: bgmEnabled
                      ? "#0ea5e9"
                      : "rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: bgmEnabled ? 22 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>
              {bgmEnabled && (
                <div style={{ display: "flex", gap: 8 }}>
                  {(["1", "2", "3"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBgmTrack(t)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 8,
                        border: `1px solid ${bgmTrack === t ? "#0ea5e9" : "rgba(255,255,255,0.1)"}`,
                        background:
                          bgmTrack === t
                            ? "rgba(14,165,233,0.2)"
                            : "transparent",
                        color: bgmTrack === t ? "#38bdf8" : s.sub,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      BGM {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              style={{
                background: s.card,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                年度フィルター
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() =>
                      setSelectedYears((prev) =>
                        prev.includes(y)
                          ? prev.filter((x) => x !== y)
                          : [...prev, y],
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid",
                      fontSize: 13,
                      cursor: "pointer",
                      background: selectedYears.includes(y)
                        ? "rgba(14,165,233,0.2)"
                        : "rgba(255,255,255,0.03)",
                      borderColor: selectedYears.includes(y)
                        ? "rgba(14,165,233,0.5)"
                        : "rgba(255,255,255,0.1)",
                      color: selectedYears.includes(y) ? "#38bdf8" : s.sub,
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                background: s.card,
                border: `1px solid ${s.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                カテゴリーフィルター
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      setSelectedCats((prev) =>
                        prev.includes(c)
                          ? prev.filter((x) => x !== c)
                          : [...prev, c],
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid",
                      fontSize: 12,
                      cursor: "pointer",
                      background: selectedCats.includes(c)
                        ? catStyle(c).bg
                        : "rgba(255,255,255,0.03)",
                      borderColor: selectedCats.includes(c)
                        ? catStyle(c).border
                        : "rgba(255,255,255,0.1)",
                      color: selectedCats.includes(c)
                        ? catStyle(c).color
                        : s.sub,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
