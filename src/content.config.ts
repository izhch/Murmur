import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
      cover: z.string().optional(),
      url: z.string(),
    }).optional(),
    video: z.object({
      url: z.string(),
      cover: z.string().optional(),
    }).optional(),
    location: z.string().optional(),
  }),
});

export const collections = { moments };
