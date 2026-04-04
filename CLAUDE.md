# はたらくインサイト — プロジェクト設定

## サービス概要
- **サービス名**: はたらくインサイト
- **URL**: https://hatarakuinsight.com
- **テーマ**: 人材・転職・採用・年収・働き方のデータ分析ブログ
- **リポジトリ**: https://github.com/sola831101/hatarakuinsight

## 技術スタック
- **フレームワーク**: Astro 5 (SSG)
- **スタイル**: Tailwind CSS v4
- **ホスティング**: Cloudflare Pages (main ブランチへのpushで自動デプロイ)
- **ドメイン**: お名前.com取得 → Cloudflare DNS

## ディレクトリ構造
```
src/
  content/articles/   ← 記事Markdownファイル (YYYYMMDD-slug.md)
  content.config.ts   ← Content Collectionsスキーマ
  layouts/            ← BaseLayout, ArticleLayout
  pages/              ← ルーティング
  styles/global.css   ← グローバルCSS

scripts/              ← 自動化スクリプト
  collect-data.ts     ← データ収集 (e-Stat, doda)
  generate-article.ts ← Claude API で記事生成
  publish-article.ts  ← draft解除 + git push
  batch-generate.ts   ← 初期50本一括生成
  post-to-x.ts        ← X自動投稿

data/
  topics.json         ← 記事トピック候補リスト
  affiliates.json     ← アフィリエイトリンク管理
  raw/                ← 収集した生データ
  processed/          ← 整形済みデータ
```

## 記事執筆

### 記事を書くときは `article-writer` スキルを使うこと

```
「〇〇の記事を書いて」と入力するだけでOK
```

スキルが `src/content/articles/` に `.md` ファイルを自動生成する。

### 記事フロントマターの形式
```yaml
---
title: "記事タイトル（30〜40文字）"
description: "記事の説明（80〜120文字）"
date: YYYY-MM-DD
category: "カテゴリキー"
tags: ["タグ1", "タグ2"]
author: "はたらくインサイト編集部"
dataSource: "データ出典"
affiliate:
  - type: "転職エージェント"
    position: "top"   # top / mid / bottom
draft: true           # 確認後 false に変更
---
```

カテゴリキー: `tenshoku` / `saiyo` / `nenshu` / `career` / `hatarakikata` / `shinsotsu` / `koyo` / `worklife`

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド確認
npm run build

# 記事一括生成 (Claude API使用)
npx tsx scripts/generate-article.ts

# 初期50本一括生成
npx tsx scripts/batch-generate.ts 1 10

# 未公開記事一覧
npx tsx scripts/publish-article.ts

# 記事を公開 (draft: false → git push)
npx tsx scripts/publish-article.ts 2026-04-04

# X投稿
npx tsx scripts/post-to-x.ts
```

## 環境変数 (.env)
```
ANTHROPIC_API_KEY=         # 記事自動生成に使用
ESTAT_APP_ID=              # e-Stat API (無料・要登録)
RESAS_API_KEY=             # RESAS API (無料・要登録)
X_API_KEY=                 # X API (旧Twitter)
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
POST_TO_X=false            # true にすると公開時に自動投稿
DRY_RUN=false              # true にするとX投稿をスキップ
```

## デプロイフロー
1. 記事を `src/content/articles/` に追加 (draft: false)
2. `git push origin main`
3. Cloudflare Pagesが自動ビルド・デプロイ (約1〜2分)

## GitHub Actions (PC不要の自動化)
`.github/workflows/daily-pipeline.yml` が毎朝03:00に実行:
1. データ収集
2. 記事生成 (draft: true)
3. 通知 (GitHub Actions完了メール)

公開は人間が05:30以降に確認して `npx tsx scripts/publish-article.ts <日付>` を実行。

## アフィリエイト
- `data/affiliates.json` でリンクを管理
- ASP審査通過後にURLを差し替える
- 主要ASP: A8.net, もしもアフィリエイト, バリューコマース, アクセストレード
