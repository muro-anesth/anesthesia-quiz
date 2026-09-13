# 周術期管理チーム試験 クイズアプリ

周術期管理チーム試験の過去問クイズアプリ。

**本番: https://periop-quiz.web.app**

2026-09-13: ログイン状態の復元を待って起動先を選ぶよう修正。ログイン済みならホームへ進む。ログイン保持の回帰5件を含む全14テストと本番ビルド成功。本番反映状況はWORKLOGを参照。

2026-09-13: 回答後の操作パネルを画面下に固定し、手応えの選択と保存・終了の説明を改善して公開済み。
回帰テスト9件・型チェック付きビルド・GitHub Actionsが成功。画面比較は変更対象10状態の新基準と、変更していない14状態の分割前基準で検証する。
権限ルール・Functions・データ形式は今回のUI変更では変更していない。
iPhoneのホーム画面起動で上下のブラウザバーが消えたことは利用者確認済み。
今回の回答パネルはスマホ寸法のブラウザで確認。本番の実アカウント操作・iPhone実機でのパネル確認は未実施。

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

## 回答後の操作

通常クイズ・復習は、回答すると画面下に正誤・正答・解説ボタンと手応えの選択を表示する。
問題文と選択肢はその上でスクロールでき、操作パネルに覆われない。試験モードも正誤・正答・次への操作を画面下に表示する。
画面の高さが小さい場合や文字を拡大した場合はパネル内もスクロールできる。

- **思い出せない**：早めに復習（従来の「もう一度」）
- **迷った**：短めの間隔で復習（従来の「難しい」）
- **思い出せた**：通常の間隔で復習（従来の「良い」）
- **余裕で分かった**：長めの間隔で復習（従来の「簡単」）

選ぶと回答を保存して次の問題へ進む。「思い出せない」も、その場で同じ問題を再出題する操作ではない。
次の復習日時は手応えと学習履歴から計算されるため、固定の「1日後／3日後／7日後」は表示しない。
終了するときは「今日はここまで（終了する）」を押し、手応えを選んで最後の回答を保存して終了する。
「終了をやめて、続ける」で取り消せる。保存中は手応え・終了・ホーム操作を無効にし、保存失敗時は再試行できる。

## ログイン保持

同じ端末・同じWebアプリで一度ログインすると、次回起動時はFirebaseの保存済みログインを復元してホームへ進む。`/login`をブックマークしている場合も同様。復元前の一瞬だけを見て未ログインと判定しない。

従来は起動時に必ずログイン画面を表示していたため、保持されていても再ログインが必要に見えた。Firebase SDKの標準の永続保存（IndexedDB／localStorage）を継続して使い、パスワードをアプリ独自に保存しない。

ログアウト、サイトデータの削除、プライベートブラウズ、端末側の保存制限などでは再ログインが必要になる。Safariのタブとホーム画面Webアプリで状態が分かれる場合は、ホーム画面側で一度ログインする。共用端末では終了時にログアウトする。

参考：[Firebase公式の認証状態の永続性](https://firebase.google.com/docs/auth/web/auth-state-persistence?hl=ja)。iPhone実機での今回の復元動作は利用者確認待ち。

## iPhoneのホーム画面から使う

Safariで本番URLを開き、共有 →「ホーム画面に追加」。項目が表示されるiOSでは「Webアプリとして開く」をオンにする。
2026-09-13にstandalone表示・ルート全体のscope・Apple Web App設定を追加した。
以前のアイコンで上下にブラウザ操作バーが出る場合は、新しく追加したアイコンで確認する（再ログインが必要な場合あり）。
通常のSafariタブや別アプリ内のブラウザでは操作バーが表示される。アプリからそれを強制的に消すことはできない。
設定は `public/manifest.webmanifest` と `src/app/layout.tsx`。`/login` と `/quiz` を同じアプリの範囲に含める。
オフライン機能は実装していない。iPhone実機での操作バー解消は利用者確認済み（2026-09-13）。

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
