import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  const sorted = articles.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'はたらくインサイト',
    description: '転職・採用・年収・働き方のデータを独自分析。人材・仕事の今をわかりやすく届けます。',
    site: context.site!,
    items: sorted.map(article => ({
      title: article.data.title,
      pubDate: article.data.date,
      description: article.data.description,
      link: `/articles/${article.slug}/`,
    })),
    customData: '<language>ja</language>',
  });
}
