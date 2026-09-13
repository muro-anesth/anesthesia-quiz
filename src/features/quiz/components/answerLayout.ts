import type { CSSProperties } from "react";
import { s } from "../theme";

// Keep the controls on screen without covering the scrollable question.
export const questionViewport: CSSProperties = {
  position: "fixed",
  inset: 0,
  height: "100dvh",
  width: "100%",
  maxWidth: 430,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: s.bg,
};
export const questionScroll: CSSProperties = {
  flex: "1 1 0%",
  minHeight: 0,
  overflowY: "auto",
  padding: 16,
  overscrollBehaviorY: "contain",
  boxSizing: "border-box",
};
export const answerDock: CSSProperties = {
  flexShrink: 0,
  maxHeight: "65%",
  overflowY: "auto",
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
  background: s.card,
  borderTop: `1px solid ${s.border}`,
  boxShadow: "0 -6px 24px rgba(0,0,0,0.25)",
  boxSizing: "border-box",
};
