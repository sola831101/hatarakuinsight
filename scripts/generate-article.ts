/**
 * 記事生成スクリプト (Claude API使用)
 * 実行: npx tsx scripts/generate-article.ts [topic_id]
 *
 * 使い方:
 *   npx tsx scripts/generate-article.ts            # topics.jsonから自動選択
 *   npx tsx scripts/generate-article.ts 3          # topics.jsonのID=3を指定
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles');
const TOPICS_FILE = path.join(process.cwd(), 'data/topics.json');
const PROCESSED_DIR = path.join(process.cwd(), 'data/processed');

interface Topic {
  id: number;
  title: string;
  category: string;
  tags: string[];
  keywords: string;
  affiliateType: string;
  dataPoints?: string[];
  done?: boolean;
}

// ========================================
// スタイルガイド (記事生成の指示)
// ========================================
const STYLE_GUIDE = `
あなたは「はたらくインサイト」の編集者です。以下のスタイルガイドに従って記事を生成してください。

## メディアコンセプト
- 転職・採用・年収・働き方・人材業界に関するデータ分析ブログ
- 統計データ・ニュースをもとに独自分析し、平易な言葉で仮説を述べる

## 文体・スタイル
- です・ます調（敬体）
- 会話的なトーンで読みやすく
- 専門用語は最初に平易な言葉で説明する
- 読者: 企業の人事、マネジメント職、就活生、転職活動中の社会人（知識はそれほどない層）

## 記事構成
1. リード文 (150〜200字): 何についての記事か、読者に何が得られるか
2. H2見出し4〜6個 (各500〜800字)
   - 1つ目のH2: 基本概念・定義の説明
   - 中盤のH2: データ・統計を使った分析（表を含める）
   - 後半のH2: 独自仮説・考察
   - 最後のH2: まとめ表または実践的な示唆
3. FAQ (3〜5問): よくある疑問をQ&A形式で
4. 免責事項の1行

## 必須要素
- 表 (Markdownテーブル形式) を最低2つ含める
- 数値・統計を必ず引用 (出典を明記)
- 独自の仮説・解釈を述べる (「〜と考えられる」「〜という仮説が立てられる」)
- 文字数: 3000〜5000文字

## フロントマター形式
記事の冒頭に必ず以下のYAMLフロントマターを付ける:
\`\`\`yaml
---
title: "記事タイトル（30〜40文字）"
description: "記事の説明（80〜120文字）"
date: YYYY-MM-DD
category: "カテゴリキー"
tags: ["タグ1", "タグ2", "タグ3"]
keywords: "SEOキーワード"
author: "はたらくインサイト編集部"
dataSource: "主要データ出典"
affiliate:
  - type: "転職エージェント"
    position: "top"
  - type: "転職エージェント"
    position: "bottom"
draft: true
---
\`\`\`

カテゴリキーの選択肢: tenshoku, saiyo, nenshu, career, hatarakikata, shinsotsu, koyo, worklife
`;

// ========================================
// トピック選定
// ========================================
function selectTopic(topicId?: number): Topic {
  if (!fs.existsSync(TOPICS_FILE)) {
    throw new Error(`topics.jsonが見つかりません: ${TOPICS_FILE}`);
  }

  const topics: Topic[] = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  const available = topics.filter(t => !t.done);

  if (available.length === 0) {
    throw new Error('すべてのトピックが生成済みです。topics.jsonを更新してください。');
  }

  if (topicId !== undefined) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) throw new Error(`ID=${topicId} のトピックが見つかりません`);
    return topic;
  }

  // 未処理の最初のトピックを選択
  return available[0];
}

// ========================================
// 記事生成
// ========================================
async function generateArticle(topic: Topic): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // 最新データサマリーを取得
  let dataContext = '';
  try {
    const files = fs.readdirSync(PROCESSED_DIR)
      .filter(f => f.startsWith('daily-summary'))
      .sort()
      .reverse();
    if (files.length > 0) {
      dataContext = fs.readFileSync(path.join(PROCESSED_DIR, files[0]), 'utf-8');
    }
  } catch {
    // データなしでも続行
  }

  const prompt = `
${STYLE_GUIDE}

## 今回の記事テーマ
タイトル案: ${topic.title}
カテゴリ: ${topic.category}
タグ: ${topic.tags.join(', ')}
SEOキーワード: ${topic.keywords}
アフィリエイト種別: ${topic.affiliateType}

${topic.dataPoints ? `## 盛り込みたいデータポイント\n${topic.dataPoints.map(d => `- ${d}`).join('\n')}` : ''}

${dataContext ? `## 最新データサマリー (参考)\n${dataContext}` : ''}

上記のスタイルガイドと記事テーマに従い、完全な記事をMarkdown形式で生成してください。
フロントマターのdraftはtrueに設定してください。
今日の日付: ${new Date().toISOString().slice(0, 10)}
`;

  console.log(`[Generate] "${topic.title}" の記事を生成中...`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  return content.text;
}

// ========================================
// ファイル保存
// ========================================
function saveArticle(content: string, topic: Topic): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = topic.title
    .toLowerCase()
    .replace(/[^\w\u3040-\u9fff]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

  const filename = `${dateStr}-${topic.id}-${slug}.md`;
  const outPath = path.join(ARTICLES_DIR, filename);

  fs.writeFileSync(outPath, content);
  console.log(`[Save] 記事を保存: ${outPath}`);

  return outPath;
}

// ========================================
// トピックを完了済みにマーク
// ========================================
function markTopicDone(topicId: number): void {
  const topics: Topic[] = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  const topic = topics.find(t => t.id === topicId);
  if (topic) {
    topic.done = true;
    fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2));
    console.log(`[Topics] ID=${topicId} を完了済みにマーク`);
  }
}

// ========================================
// メイン
// ========================================
async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません。.envに追加してください。');
  }

  const topicId = process.argv[2] ? parseInt(process.argv[2]) : undefined;

  console.log(`\n=== 記事生成開始: ${new Date().toLocaleString('ja-JP')} ===\n`);

  const topic = selectTopic(topicId);
  console.log(`[Topic] 選択: "${topic.title}" (ID=${topic.id})`);

  const content = await generateArticle(topic);
  const savedPath = saveArticle(content, topic);

  markTopicDone(topic.id);

  console.log(`\n✅ 記事生成完了: ${savedPath}`);
  console.log('📝 draft: true で保存されました。確認後 draft: false に変更してください。\n');
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
