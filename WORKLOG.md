# 作業ログ (WORKLOG)

複数の端末をまたいで作業するため、**進捗と状態をここに記録**します。
別の端末で作業を始める前に、まず `git pull` してこのファイルを読むこと。

## 運用ルール
- 作業の区切りごとに **コミット＆push**（未コミットのまま放置しない ← ドリフトの原因）
- 端末を離れるときは、下の「現在地」を更新して push
- 作業再開時は必ず `git pull`

---

## 現在地（最新を上に）

### 2026-07-26 — WORKLOG 新設。git は clean・origin と同期済み

> **この日より前の記録は git log から再構成したもの**で、実際のチャットの経緯ではありません。

- **2026-07-26 に README.md を新設**（それまで create-next-app のテンプレートのままだった）。
  兄弟プロジェクトとの取り違え注意も冒頭に明記した
- **2026-07-26 に `.claude/settings.json` を追跡開始**（セッション開始時 pull・終了時に未コミット警告）

### 2026-07-21 — Prisma/NextAuth → Firebase への全面移行（この日にまとめて）
- `cdf27f0` chore: firebase のサービスアカウントキーとキャッシュを gitignore
- `ec7f38b` **refactor: レガシーな Prisma/NextAuth バックエンドを削除**
- `2be3b64` **feat: Firebase バックエンドを追加**
- `32eb9b2` **feat: アプリ各ページを Firebase と静的書き出し(static export)に切り替え**
- `14b78f8` chore: アプリアイコンと静的 index のフォールバックを追加
- `2628076` fix: クイズの効果音を BGM トグルで制御するよう修正
- 現在の `src/` は非常に小さい: `app/{layout,page,login/page,quiz/page}.tsx` ＋
  `lib/{firebase.ts, firebaseHelpers.ts, srs.ts}`。**本体は `src/app/quiz/page.tsx`（998行）**

### 2026-05-05〜05-06 — アイコンと BGM
- `0c7d19a` アプリアイコン追加 / `14f6416` bgm1・bgm2 を更新

### それ以前（2026-05まで） — Prisma/NextAuth 時代の機能追加
- `880ce14` 2025b の問題を修正 / `992ca7e` 生成した解説を初回以降 DB にキャッシュ
- `59e52b2` 年度・カテゴリの複数選択フィルタ / `0c9e095` ログイン時の効果音
- `54d3551` フィルタタブを追加し統計を設定へ移動（＋ `29aa417` / `08bab22` でその修正）

---

## 次にやること

1. Firebase 移行後の動作確認が済んでいるか（旧 Prisma 時代の機能で消えたものがないか）の棚卸し

---

## プロジェクト概要

- **周術期管理チーム試験のクイズアプリ**（`~/Desktop/anesthesia-quiz`）
- Firebase プロジェクト: **`periop-quiz`** / GitHub: https://github.com/muro-anesth/anesthesia-quiz
- Next.js 16 + React 19 + Tailwind v4 + Firebase（Auth / Firestore / Hosting / Functions）。静的書き出し
- 問題データは `quiz-data/` と `周術期管理チームクイズ形式/` にある
- **紛らわしい兄弟プロジェクト**（名前が似ているだけで中身は別物）:
  - `~/Desktop/anesthesia-exam-game` — 麻酔科**専門医試験**の過去問アプリ（ゲーミフィケーション付き）
  - `~/Desktop/anesthesia-exam-quiz` — その古い Prisma/NextAuth 版
