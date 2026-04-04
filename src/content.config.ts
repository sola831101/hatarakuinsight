import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    keywords: z.string().optional(),
    author: z.string().default('はたらくインサイト編集部'),
    dataSource: z.string().optional(),
    affiliate: z.array(z.object({
      type: z.string(),
      position: z.enum(['top', 'mid', 'bottom']),
    })).default([]),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
