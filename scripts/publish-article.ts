/**
 * 記事公開スクリプト
 * draft: true → false に変更してgit pushするワンストップコマンド
 *
 * 実行: npx tsx scripts/publish-article.ts [filename_pattern]
 * 例:   npx tsx scripts/publish-article.ts 2026-04-04
 *       npx tsx scripts/publish-article.ts  # draft記事一覧を表示
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles');

// ========================================
// draft記事を一覧表示
// ========================================
function listDrafts(): { file: string; title: string }[] {
  return fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .filter(file => {
      const content = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');
      return /draft:\s*true/.test(content);
    })
    .map(file => {
      const content = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8');
      const title = content.match(/title:\s*"([^"]+)"/)?.[1] ?? '(タイトル不明)';
      return { file, title };
    });
}

// ========================================
// draft: true → false に変更
// ========================================
function publishArticle(filename: string): void {
  const filePath = path.join(ARTICLES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');

  if (!/draft:\s*true/.test(content)) {
    console.log(`⚠️  ${filename} はすでに公開済みです。`);
    return;
  }

  const updated = content.replace(/draft:\s*true/, 'draft: false');
  fs.writeFileSync(filePath, updated);
  console.log(`✅ draft: false に更新: ${filename}`);
}

// ========================================
// git push でデプロイ
// ========================================
function deploy(filename: string, title: string): void {
  try {
    execSync('git add -A', { cwd: process.cwd(), stdio: 'inherit' });
    execSync(`git commit -m "publish: ${title}"`, { cwd: process.cwd(), stdio: 'inherit' });
    execSync('git push origin main', { cwd: process.cwd(), stdio: 'inherit' });
    console.log('\n🚀 git push 完了。Cloudflare Pagesが自動デプロイします。');
  } catch (err) {
    console.error('git エラー:', err);
    throw err;
  }
}

// ========================================
// メイン
// ========================================
async function main(): Promise<void> {
  const pattern = process.argv[2];

  // パターン指定なし → draft一覧を表示
  if (!pattern) {
    const drafts = listDrafts();
    if (drafts.length === 0) {
      console.log('未公開の記事はありません。');
      return;
    }
    console.log('\n📝 未公開記事 (draft: true) 一覧:\n');
    drafts.forEach(({ file, title }) => {
      console.log(`  ${file}\n  → ${title}\n`);
    });
    console.log(`公開するには: npx tsx scripts/publish-article.ts <ファイル名パターン>`);
    return;
  }

  // 対象ファイルを検索
  const matches = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.md') && f.includes(pattern));

  if (matches.length === 0) {
    console.error(`❌ パターン "${pattern}" にマッチする記事が見つかりません。`);
    process.exit(1);
  }

  for (const filename of matches) {
    const content = fs.readFileSync(path.join(ARTICLES_DIR, filename), 'utf-8');
    const title = content.match(/title:\s*"([^"]+)"/)?.[1] ?? filename;

    console.log(`\n公開対象: ${filename}`);
    console.log(`タイトル: ${title}`);

    publishArticle(filename);
  }

  // git push & deploy
  const firstTitle = fs.readFileSync(
    path.join(ARTICLES_DIR, matches[0]), 'utf-8'
  ).match(/title:\s*"([^"]+)"/)?.[1] ?? matches[0];

  deploy(matches[0], firstTitle);

  // X投稿（オプション）
  if (process.env.POST_TO_X === 'true') {
    console.log('\n📣 X投稿中...');
    const { execSync: exec } = await import('node:child_process');
    exec('npx tsx scripts/post-to-x.ts', { stdio: 'inherit' });
  }
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
