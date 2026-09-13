<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 利用者の指示（2026-09-13）
- 管理者は既存のmuroアカウントのみ。UIDや既存アカウントを勝手に変更しない。
- 修正後は必ず最終バグチェックを行い、確認範囲と未確認事項を報告する。
- 変更時は必ずREADME.md・WORKLOG.mdなどの共有資料も更新する。仕様、検証結果、公開結果、未完了事項を記録してコミット・pushする。
- この端末では2026-09-13にSSH鍵がなく、GitHub CLIのログインは有効だった。
  このリポジトリのみHTTPS + gh credential helperへ変更してpullを確認済み。

## 引き継ぎ（2026-09-13、Claude → Codex）で足したこと
- 横断の約束（開始時 `git pull`、確認なしで commit & push、当日中に WORKLOG、責任アカウント `muro.nerve@gmail.com` と `u/1`）は `../kameda-tools/HANDOFF.md`。本番の状態・未完了は `WORKLOG.md` の「引き継ぎ」節
- ⚠️ **このリポジトリは GitHub 上で public**。`2be3b64` の履歴に Gemini API キーが残っている。キーの失効か private 化か履歴除去が要る（未対応）。秘密を絶対にコミットしない
- 秘密の場所（値は書かない）: Admin SDK 鍵 `scripts/serviceAccountKey.json`（gitignore 済。iCloud 同期下なので `~/.config/kameda/` へ移すのが望ましい）、`.env.local` の `GEMINI_API_KEY`
- `ADMIN_UID` は `firestore.rules` と `functions/index.js` の2か所。片方だけ変えない
- `tests/*-baseline.json` は失敗を隠す目的で更新しない
- iCloud の複製（「index 2.html」、「sounds 3/」）を `out/` から配信しない。`git add` しない
- `quiz-data/*/quiz.json` は PuzzleProject の正本でもある。形式を変えない
- remote は HTTPS（`gh` の credential）。`gh` のトークンが無効な環境では SSH（`git@github.com:muro-anesth/anesthesia-quiz.git`）に切り替える
