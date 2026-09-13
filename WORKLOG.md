# 作業ログ (WORKLOG)

複数の端末をまたいで作業するため、**進捗と状態をここに記録**します。
別の端末で作業を始める前に、まず `git pull` してこのファイルを読むこと。

## 運用ルール
- 作業の区切りごとに **コミット＆push**（未コミットのまま放置しない ← ドリフトの原因）
- 端末を離れるときは、下の「現在地」を更新して push
- 作業再開時は必ず `git pull`

---

## 現在地（最新を上に）

### 2026-09-13 — Codex引き継ぎ、復習・保存・権限・型チェック修正

- GitHub接続をこのリポジトリだけHTTPS + gh credential helperへ変更。SSH鍵なし、ghログイン有効。pullで最新一致を確認。
- 本番プロフィールを読み取り、muroのみadmin（UID: kuredXmbTWhCfx4dVtvdUyiZsUq1）を確認。既存アカウント・問題・成績は変更しない。
- 本番ルールが自己role変更を許す状態と確認。Firestore/Functionsを既存muro UIDで制限。プロフィールのクライアント書き込みを禁止。作成可能な新規ユーザーは一般ユーザーのみ。
- 復習は期限到来順のキューを最後まで進める。従来の50件上限を外し、通常ランダム出題へ戻らない。
- 「今日はここまで」/回答後のホームは手応えを選択して保存後終了。二重クリック防止と、固定回答ID + Firestore transactionによる再試行時の重複防止・回答/SRS同時保存。
- ログイン画面の重複style指定を修正。型エラー無視を撤廃。`.next`にあったMac複製生成物は一時フォルダへ退避し再生成（ソースエラーを隠す除外は追加しない）。
- 回帰テスト6件、Rules APIによる合成権限テスト16件成功。型チェック付きビルド成功。GitHub Actions追加。
- ログイン後の本番実アカウント操作は未実施（本番成績を汚さないため、動作はモックによるコンポーネントテストで検証）。
- 実装コミット `1a53a0b` をGitHubへpush済み。GitHub Actions `34736646765` は成功。
- Firebase Hosting・Firestoreルール・Functions 2件の本番更新成功。本番ルールと手元の完全一致、ユーザー5件・adminはmuroのみで変更なしを再確認。
- 公開後のログイン画面の表示も確認。実アカウントでのログイン後操作とスマートフォン実機確認は未実施。
- 利用者の追加指示「修正後は必ずバグチェック」「README・WORKLOG等を必ず更新」をAGENTS.mdにも保存。


### 2026-07-31 — **棚卸し完了（消えた機能なし）**と、Gemini APIキーを .env.local へ退避

**① 解説は消えていない。事前生成に移行済みだった**

旧版は API ルート `src/app/api/explanation/[id]/route.ts` で**オンデマンド生成**し
DB にキャッシュしていた（`992ca7e`）。静的書き出し（`output: export`）では
API ルートを置けないので、この経路は移行時に消えている。
ただし**事前生成に置き換わっていた**。

- `scripts/generate-explanations.mjs`（Gemini）→ `scripts/explanations-cache.json`
  （1.85MB・358件・2026-05-21 生成・1問2000〜2700字）
- `scripts/import-to-firestore.mjs:46` が `explanation: cache[key]` で取り込み
- **Firestore の `questions` は 358問すべてに解説あり（100%）を実機確認**

**③ 旧機能3つも生きていた（棚卸し完了）**

| 旧コミット | 機能 | 現在 |
|---|---|---|
| `59e52b2` | 年度・カテゴリの複数選択フィルタ | ✅ 設定画面の「年度フィルター」「カテゴリーフィルター」。`fetchQuestions(years, categories)` が絞り込む |
| `54d3551` | フィルタタブ＋統計 | ✅ 統計は独立画面（`phase === "stats"`）。総回答数・正答率・直近7日・カテゴリー別正答率（低い順）|
| `0c9e095` | ログイン時の効果音 | ✅ `login/page.tsx:22` が `entry.mp3` を再生。音源も存在 |

`54d3551` は「統計を設定へ移す」変更だったが、現在は**タブではなく `Phase` による
画面切り替え**（`stats` と `settings` は別画面）。作りは変わったが機能は両方ある。

**結論: Firebase 移行で失われた機能は1つも無かった。**

> ⚠️ **`quiz-data/*/quiz.json` の解説は 0件**だが、これは正常。
> アプリが読むのは Firestore で、解説はキャッシュ側から合流する。
> ここを見て「解説が無い」と早合点しないこと（2026-07-31 に一度やった）。

**② Gemini APIキーがソース直書きだったのを `.env.local` へ移した**

`generate-explanations.mjs` と `generate-categories.mjs` の2本に直書きされていた。
`process.env.GEMINI_API_KEY` を読む形にし、未設定なら止まるようにした。

```
export $(grep GEMINI_API_KEY .env.local | xargs) && node scripts/generate-explanations.mjs
```

> ⚠️ **キーは `2be3b64` のコミット履歴に残っている**（`git log -S` で確認。該当は1コミット）。
> ファイルから消しても履歴からは復元できるので、**このリポジトリを公開する場合は、
> 先に履歴からの除去かキーの失効が要る**。private のまま使う前提で、
> 失効はせず退避のみとした（2026-07-31 利用者判断）。
> ※ `src/lib/firebase.ts` の `apiKey` は別物。Firebase の Web API キーで公開前提。


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

1. ~~Firebase 移行後の棚卸し（旧 Prisma 時代の機能で消えたものがないか）~~
   → **2026-07-31 完了。消えた機能は無かった**（下の現在地）。**やることは残っていない。**

---

## プロジェクト概要

- **周術期管理チーム試験のクイズアプリ**（`~/Desktop/ClaudeProject/anesthesia-quiz`）
- Firebase プロジェクト: **`periop-quiz`** / GitHub: https://github.com/muro-anesth/anesthesia-quiz
- Next.js 16 + React 19 + Tailwind v4 + Firebase（Auth / Firestore / Hosting / Functions）。静的書き出し
- 問題データは `quiz-data/` と `周術期管理チームクイズ形式/` にある
- **紛らわしい兄弟プロジェクト**（名前が似ているだけで中身は別物）:
  - `~/Desktop/ClaudeProject/anesthesia-exam-game` — 麻酔科**専門医試験**の過去問アプリ（ゲーミフィケーション付き）
  - `~/Desktop/ClaudeProject/anesthesia-exam-quiz` — その古い Prisma/NextAuth 版
