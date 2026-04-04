/**
 * X (Twitter) 自動投稿スクリプト
 * 実行: npx tsx scripts/post-to-x.ts [article_slug]
 *
 * 環境変数:
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles');
const SITE_URL = 'https://hatarakuinsight.com';

// ========================================
// 最新公開済み記事を取得
// ========================================
function getLatestPublishedArticle(slug?: string): { slug: string; title: string; description: string; category: string; tags: string[] } | null {
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();

  for (const file of files) {
    if (slug && !file.includes(slug)) continue;

    const content = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');

    // フロントマターを解析
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const fm = match[1];
    const draft = fm.match(/draft:\s*(true|false)/)?.[1];
    if (draft === 'true') continue; // draftはスキップ

    const title = fm.match(/title:\s*"([^"]+)"/)?.[1] ?? '';
    const description = fm.match(/description:\s*"([^"]+)"/)?.[1] ?? '';
    const category = fm.match(/category:\s*"([^"]+)"/)?.[1] ?? '';
    const tagsMatch = fm.match(/tags:\s*\[([^\]]+)\]/)?.[1] ?? '';
    const tags = tagsMatch.match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) ?? [];

    // slugはファイル名から生成（例: 2026-04-04-tenshoku-...md → 2026-04-04-tenshoku-...）
    const fileSlug = file.replace('.md', '');

    return { slug: fileSlug, title, description, category, tags };
  }

  return null;
}

// ========================================
// 投稿テキスト生成
// ========================================
function buildTweetText(article: { slug: string; title: string; description: string; category: string; tags: string[] }): string {
  const url = `${SITE_URL}/articles/${article.slug}`;

  // カテゴリに応じたハッシュタグ
  const categoryTags: Record<string, string> = {
    tenshoku: '#転職',
    saiyo: '#採用',
    nenshu: '#年収',
    career: '#キャリア',
    hatarakikata: '#働き方',
    shinsotsu: '#新卒採用',
    koyo: '#雇用',
    worklife: '#ワークライフバランス',
  };

  const hashtags = [
    categoryTags[article.category] ?? '',
    ...article.tags.slice(0, 2).map(t => `#${t.replace(/\s/g, '')}`),
  ].filter(Boolean).join(' ');

  const text = `📊 ${article.title}\n\n${article.description}\n\n▶ ${url}\n\n${hashtags}`;

  // X の文字制限 (280文字) を超えないようにトリミング
  if (text.length > 280) {
    const descMaxLen = 280 - `📊 ${article.title}\n\n\n\n▶ ${url}\n\n${hashtags}`.length - 3;
    const trimmedDesc = article.description.slice(0, descMaxLen) + '...';
    return `📊 ${article.title}\n\n${trimmedDesc}\n\n▶ ${url}\n\n${hashtags}`;
  }

  return text;
}

// ========================================
// OAuth 1.0a 署名生成
// ========================================
function buildOAuth1Header(method: string, url: string, params: Record<string, string>): string {
  const {
    X_API_KEY: apiKey,
    X_API_SECRET: apiSecret,
    X_ACCESS_TOKEN: accessToken,
    X_ACCESS_SECRET: accessSecret,
  } = process.env;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API の認証情報が未設定です。.envに X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET を追加してください。');
  }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;

  const header = 'OAuth ' + Object.keys(oauthParams)
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return header;
}

// ========================================
// X APIに投稿
// ========================================
async function postToX(text: string): Promise<void> {
  const url = 'https://api.twitter.com/2/tweets';
  const body = JSON.stringify({ text });

  const authHeader = buildOAuth1Header('POST', url, {});

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X API エラー (${res.status}): ${err}`);
  }

  const data = await res.json() as { data: { id: string } };
  console.log(`✅ 投稿成功! Tweet ID: ${data.data.id}`);
  console.log(`   https://x.com/hatarakuinsight/status/${data.data.id}`);
}

// ========================================
// メイン
// ========================================
async function main(): Promise<void> {
  const slug = process.argv[2];

  console.log(`\n=== X投稿スクリプト: ${new Date().toLocaleString('ja-JP')} ===\n`);

  const article = getLatestPublishedArticle(slug);
  if (!article) {
    console.log('投稿対象の公開記事が見つかりませんでした。draft: false の記事があるか確認してください。');
    process.exit(0);
  }

  const text = buildTweetText(article);

  console.log('--- 投稿テキスト ---');
  console.log(text);
  console.log(`--- (${text.length}文字) ---\n`);

  // DRY_RUN モードでは実際に投稿しない
  if (process.env.DRY_RUN === 'true') {
    console.log('[DRY_RUN] 実際の投稿はスキップしました。');
    return;
  }

  await postToX(text);
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
