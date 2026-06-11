// @ts-check

/**
 * 内容集合配置
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 定义 moments 内容集合
const moments = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/moments' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    draft: z.boolean().optional().default(false),
    images: z.array(z.string()).optional(),
    music: z.object({
      title: z.string(),
      artist: z.string(),
      cover: z.string(),
      url: z.string(),
    }).optional(),
    video: z.object({
      url: z.string(),
      cover: z.string(),
    }).optional(),
    location: z.string().optional(),
  }),
});

// 导出内容集合
export const collections = {
  moments,
};
