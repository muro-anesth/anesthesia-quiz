# 周術期管理チーム試験 クイズアプリ

周術期管理チーム試験の過去問クイズアプリ。

**本番: https://periop-quiz.web.app**

2026-09-13: 復習・終了時保存・管理者制限の修正に続き、画面と操作処理を分割して公開済み。
回帰テスト7件（分割前の24画面状態との一致検査を含む）・型チェック付きビルド・GitHub Actionsが成功。
権限ルール・Functions・データ形式は今回の分割では変更していない。
本番ログイン後の実アカウント操作とスマートフォン実機検証は未実施。

> **⚠️ 名前が紛らわしい兄弟プロジェクトがあります（中身は全くの別物）**
> - [`anesthesia-exam-game`](https://github.com/muro-anesth/anesthesia-exam-game) —
>   **麻酔科専門医試験**の過去問アプリ（ゲーミフィケーション付き）
> - [`anesthesia-exam-quiz`](https://github.com/muro-anesth/anesthesia-exam-quiz) —
>   その Prisma/NextAuth 時代の版（開発終了）
>
> このリポジトリは**周術期管理チーム試験**のクイズで、Firebase プロジェクトも
> `periop-quiz` と別です。取り違えに注意。

---

## はじめて触る人へ

1. **この README** — 何をするアプリか、どう動かすか
2. **[WORKLOG.md](WORKLOG.md)** — いつ何を変えたか。セッションを跨ぐ引き継ぎはこのファイルが情報源

## 構成

- **Next.js 16 + React 19 + Tailwind v4 + TypeScript**
- **静的書き出し**（`output: 'export'`）＋ **Firebase**（Auth / Firestore / Hosting / Functions）
- SRS（間隔反復）に `ts-fsrs`、解説生成に `@google/generative-ai`

```
src/
  app/{layout,page}.tsx      レイアウトとトップ
  app/login/page.tsx         ログイン
  app/quiz/page.tsx          クイズの入口（5行）
  features/quiz/
    QuizApp.tsx              画面の組み立て
    screens/                 ホーム・クイズ・試験・復習・成績・設定など13画面
    AdminPanel.tsx           ユーザー管理画面
    useQuizController.ts     認証・通常出題・復習・回答保存・画面状態
    useExamSession.ts        試験A/Bの進行・採点・履歴
    useQuizAudio.ts          BGMの状態と再生制御
    sound.ts                 効果音
    types.ts / theme.ts      共通の型・配色
  lib/firebase.ts            Firebase 初期化
  lib/firebaseHelpers.ts     Firestore アクセス
  lib/srs.ts                 間隔反復のロジック
quiz-data/                   問題データ（2023a〜2025b の6セット）
周術期管理チームクイズ形式/    問題の元資料
functions/                   Cloud Functions
```

**サーバーを持たない構成です。** Next.js の API Routes は使っておらず、
ブラウザから直接 Firestore を読み書きします。アクセス制御は `firestore.rules` 側:

- `users/{uid}` — 本人の読み取りのみ。プロフィール書き込みはAdmin SDKのみ。一覧は既存muro UIDのみ
- `questions/**` — 認証済みなら読み取り可、書き込みは既存muro UIDのみ
- `attempts` / `progress` / `examHistory` — 本人のみ読み書き

## 開発

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # out/ に静的書き出し
```

`npm test` で復習・終了時保存・再試行・権限判定・試験遷移の回帰テスト。
`tests/screen-baseline.json` は分割前のコミット `e734364` で記録した
24画面状態の描画ツリー（文字・スタイル・要素属性）のハッシュ。
テストはFirebaseをモック化して実行し、本番成績を書き換えない。
基準値は失敗を隠す目的で更新しない。意図した画面変更のときだけ比較・レビューして更新する。
`npm run typecheck` で型チェック。`npm run build` も型エラーで停止する。
GitHub Actionsでpush/PR時にテストとビルドを実行する。
`npm run test:rules` はFirebase CLIの既存ログインを使い、公式RulesテストAPIに
合成リクエストを送る。本番データの変更・ルール公開は行わない。

通常クイズ・復習で「今日はここまで」または回答後の「ホーム」を押すと、
手応えを選んで回答と復習予定を保存してから終了する。
復習は開始時点の期限到来順の一覧を一巡する（新しく期限になった問題は次回）。


## デプロイ

```bash
npm test && npm run build && firebase deploy --project periop-quiz --only hosting,firestore:rules,functions
```

- Firebase プロジェクト: **`periop-quiz`**
- Hosting の公開ディレクトリは `out`（`npm run build` の出力）。**ビルドを先に実行すること**
- ルールだけ変えたとき: `firebase deploy --only firestore:rules`

## 分割前のバックアップと復元

- GitHub上の復元用タグ: `backup/pre-screen-split-20260913`（`e734364`）
- ローカル: `/Users/muro/ProjectBackups/anesthesia-quiz/20260913-125933/`
  - `history.bundle`: 全Git履歴（`git bundle verify` 済み）
  - `project.tar.gz`: ソース、ローカル設定、公開用 `out/` 等。
    `node_modules`・`.next`・`.git`・`.firebase` は除外。ローカル設定を含むため外部に公開しない。
  - `manifest.json`: 対象コミットとバックアップのSHA-256
- ソース・README・WORKLOG・lockfile・公開用quiz.htmlの一致を検証済み。
- Firestoreの問題・成績・アカウントはバックアップ対象外。今回それらの変更は行わない。

元の作業場所を上書きせず、別の作業場所で分割前へ戻せる:

```bash
git worktree add ../anesthesia-quiz-restore backup/pre-screen-split-20260913
```

復元先で `npm ci && npm test && npm run build` を確認してから、必要な場合に限り
`firebase deploy --project periop-quiz --only hosting` で分割前の画面を再公開する。
データ・権限ルール・Functionsを巻き戻す操作は不要。

## アカウントの使い分け

- **デプロイ用**（Firebase オーナー）: `muro.nerve@gmail.com`
- **アプリ管理者**: `greenfieldsmeister@gmail.com`

## 補足

`src/lib/firebase.ts` の `firebaseConfig` はソースに直書きされているが、
これは Firebase の Web API キーで**公開前提の値**。秘密情報ではない。
実際のアクセス制御は `firestore.rules` 側で行われる。

`AGENTS.md` に「この Next.js は学習データと違う。`node_modules/next/dist/docs/` を
読んでから書け」という注記がある（`CLAUDE.md` はこれを参照しているだけ）。
