/**
 * 初期50本一括生成スクリプト
 * 実行: npx tsx scripts/batch-generate.ts [start_id] [end_id]
 * 例:   npx tsx scripts/batch-generate.ts 1 10   # ID1〜10を生成
 *       npx tsx scripts/batch-generate.ts         # 全未処理を順次生成
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TOPICS_FILE = path.join(process.cwd(), 'data/topics.json');

interface Topic {
  id: number;
  title: string;
  done?: boolean;
}

async function main(): Promise<void> {
  const startId = process.argv[2] ? parseInt(process.argv[2]) : undefined;
  const endId = process.argv[3] ? parseInt(process.argv[3]) : undefined;

  const topics: Topic[] = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  const targets = topics.filter(t => {
    if (t.done) return false;
    if (startId !== undefined && t.id < startId) return false;
    if (endId !== undefined && t.id > endId) return false;
    return true;
  });

  console.log(`\n=== 一括生成: ${targets.length}件 ===\n`);

  for (const topic of targets) {
    console.log(`\n[${topic.id}/${topics.length}] "${topic.title}" を生成中...`);

    try {
      execSync(`npx tsx scripts/generate-article.ts ${topic.id}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      // API負荷軽減のため3秒待機
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`❌ ID=${topic.id} の生成に失敗:`, err);
      console.log('次のトピックに進みます...');
    }
  }

  console.log('\n=== 一括生成完了 ===');
  console.log('npx tsx scripts/publish-article.ts で未公開記事の一覧を確認できます。');
}

main().catch(console.error);
