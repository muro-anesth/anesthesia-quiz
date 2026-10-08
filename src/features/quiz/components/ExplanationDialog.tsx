import { s } from "../theme";

export function ExplanationDialog({ text, onClose }: { text: string; onClose: () => void }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 500 }}>
    <section role="dialog" aria-modal="true" aria-label="解説" onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } if (e.key === "Tab") { e.preventDefault(); e.currentTarget.querySelector("button")?.focus(); } }}
      style={{ background: s.card, color: s.text, borderRadius: "20px 20px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", width: "100%", maxWidth: 430, maxHeight: "80dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", border: `1px solid ${s.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}><strong>解説</strong>
        <button type="button" autoFocus aria-label="解説を閉じる" onClick={onClose} style={{ minWidth: 44, minHeight: 44, border: "none", background: "transparent", color: s.text, fontSize: 22 }}>×</button>
      </div>
      <div style={{ overflowY: "auto", minHeight: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.8 }}>{text}</div>
    </section>
  </div>;
}
