# 麻酔科クイズアプリ セットアップ手順

## ローカル開発

### 1. 環境変数を作成

```bash
cp .env.example .env.local
```

`.env.local` を編集して各値を設定してください。

### 2. DBのマイグレーション

```bash
npx prisma migrate dev --name init
```

### 3. 問題データを投入

```bash
# output/ が quiz.json のあるディレクトリ
npx tsx prisma/seed.ts /path/to/output
```

### 4. 画像ファイルを配置

```bash
# extract_images.py が出力した images/ フォルダを public/ 以下にコピー
mkdir -p public/quiz-images
cp -r /path/to/output/2023a/images public/quiz-images/2023a
cp -r /path/to/output/2023b/images public/quiz-images/2023b
# 以降の年度も同様
```

### 5. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 をブラウザで開く。

---

## Railway へのデプロイ

### Step 1: PostgreSQLアドオンを追加

Railway ダッシュボード → プロジェクト → 「+ New」→「Database」→「Add PostgreSQL」

追加すると `DATABASE_URL` が自動で環境変数に設定されます。

### Step 2: Next.jsサービスを作成

Railway ダッシュボード → 「+ New」→「GitHub Repo」→ このリポジトリを選択

### Step 3: 環境変数を設定

Railway の「Variables」タブで以下を設定:

| 変数名 | 値 |
|--------|-----|
| `AUTH_SECRET` | `openssl rand -base64 32` の出力 |
| `EMAIL_SERVER_HOST` | smtp.gmail.com |
| `EMAIL_SERVER_PORT` | 587 |
| `EMAIL_SERVER_USER` | Gmailアドレス |
| `EMAIL_SERVER_PASSWORD` | Googleアプリパスワード |
| `EMAIL_FROM` | 送信元メールアドレス |
| `ALLOWED_EMAIL_DOMAIN` | kameda.or.jp（任意） |
| `NEXTAUTH_URL` | https://your-app.railway.app |

### Step 4: デプロイ後にマイグレーションとシード

Railway の「Deploy」→「New Deployment」の後、Railway Shell（またはローカルから）で:

```bash
# Railway CLI を使う場合
railway run npx prisma migrate deploy
railway run npx tsx prisma/seed.ts /path/to/output
```

### Step 5: 画像の配置

画像ファイルは `public/quiz-images/` に置く必要があります。
Gitリポジトリに含めるのが最も簡単です（容量が大きい場合はGit LFSを検討）。

```bash
git add public/quiz-images/
git commit -m "add quiz images"
git push
```

---

## Googleアプリパスワードの取得方法

1. Google アカウント → セキュリティ
2. 2段階認証を有効化（必須）
3. 「アプリパスワード」を検索
4. アプリ:「メール」、デバイス:「その他」→ 名前を「quiz-app」などに
5. 生成された16文字のパスワードを `EMAIL_SERVER_PASSWORD` に設定

---

## 解説文の追加方法

現時点では直接DBに挿入します（後でUIを追加予定）:

```sql
INSERT INTO "Explanation" ("questionId", "body")
VALUES (123, '解説文をここに書く（Markdown可）');
```

Prisma Studioを使うと簡単:

```bash
npx prisma studio
```

ブラウザでGUIが開くので、Explanationテーブルから追加できます。

---

## package.jsonに追加するscripts

```json
{
  "scripts": {
    "seed": "tsx prisma/seed.ts"
  }
}
```
