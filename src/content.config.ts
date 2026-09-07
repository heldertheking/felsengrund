import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const offers = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './src/content/offers' }),
  schema: z.object({
    title: z.string(),
    intro: z.string().optional(),
    cardImage: z.string().optional(),
    category: z.enum(['gottesdienst', 'kinder-jugend', 'gemeinschaft', 'senioren', 'hilfe-service']),
    targetAudience: z.string().optional(),
    schedule: z.string().optional(),
    location: z.string().optional(),
    mapsLink: z.string().optional(),
    organizers: z
      .array(
        z.object({
          name: z.string(),
          role: z.string().optional(),
          contact: z.string().optional(),
        }),
      )
      .optional(),
    registration: z.string().optional(),
  }),
})

const podcast = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './src/content/podcast' }),
  schema: z.object({
    title: z.string(),
    episodeNumber: z.number().optional(),
    publishDate: z.coerce.date(),
    audioUrl: z.string(),
    duration: z.string().optional(),
    coverImage: z.string().optional(),
  }),
})

export const collections = { offers, podcast }
