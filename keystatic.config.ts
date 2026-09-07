import { config, fields, collection } from '@keystatic/core'
import { block } from '@keystatic/core/content-components'

const gallery = block({
  label: 'Bildergalerie',
  schema: {
    images: fields.array(
      fields.image({
        label: 'Bild',
        directory: 'public/images/gallery',
        publicPath: '/images/gallery/',
      }),
      {
        label: 'Bilder',
      },
    ),
    caption: fields.text({ label: 'Bildunterschrift', multiline: true }),
  },
})

// Local checkouts (and anywhere else that doesn't explicitly opt in) edit content directly on
// disk. Set KEYSTATIC_STORAGE=github in the deployed environment to switch to GitHub-backed
// storage instead, so staff can edit content on the live site through GitHub's OAuth login
// rather than needing a local checkout. That mode requires a Keystatic GitHub App installed on
// this repo, plus KEYSTATIC_GITHUB_CLIENT_ID / KEYSTATIC_GITHUB_CLIENT_SECRET set wherever the
// site actually runs (e.g. `wrangler secret put` for a Cloudflare deployment) — see
// https://keystatic.com/docs (docs site was unreachable when this was written; confirm the exact
// env var names there before relying on this comment alone).
const storage =
  import.meta.env.KEYSTATIC_STORAGE === 'github'
    ? ({ kind: 'github', repo: 'heldertheking/felsengrund' } as const)
    : ({ kind: 'local' } as const)

export default config({
  storage,
  collections: {
    offers: collection({
      label: 'Angebote',
      slugField: 'title',
      path: 'src/content/offers/*',
      format: { contentField: 'description' },
      schema: {
        title: fields.slug({ name: { label: 'Titel' } }),
        intro: fields.text({ label: 'Kurzbeschreibung', multiline: true }),
        cardImage: fields.image({
          label: 'Vorschaubild',
          directory: 'public/images/offers',
          publicPath: '/images/offers/',
        }),
        category: fields.select({
          label: 'Kategorie',
          options: [
            { label: 'Gottesdienst', value: 'gottesdienst' },
            { label: 'Kinder & Jugend', value: 'kinder-jugend' },
            { label: 'Gemeinschaft', value: 'gemeinschaft' },
            { label: 'Senioren', value: 'senioren' },
            { label: 'Hilfe & Service', value: 'hilfe-service' },
          ],
          defaultValue: 'gottesdienst',
        }),
        targetAudience: fields.text({ label: 'Zielgruppe' }),
        schedule: fields.text({ label: 'Zeitplan (z. B. "Sonntags, 9:45 Uhr")' }),
        location: fields.text({ label: 'Ort' }),
        mapsLink: fields.url({ label: 'Wegbeschreibung-Link' }),
        organizers: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            role: fields.text({ label: 'Rolle' }),
            contact: fields.text({ label: 'Kontakt' }),
          }),
          {
            label: 'Organisatoren',
            itemLabel: (props) => props.fields.name.value || 'Organisator',
          },
        ),
        registration: fields.text({ label: 'Anmeldung (Link oder Hinweis)' }),
        description: fields.markdoc({
          label: 'Beschreibung',
          options: {
            image: {
              directory: 'public/images/offers',
              publicPath: '/images/offers/',
            },
          },
          components: { gallery },
        }),
      },
    }),
    podcast: collection({
      label: 'Podcast-Episoden',
      slugField: 'title',
      path: 'src/content/podcast/*',
      format: { contentField: 'shownotes' },
      schema: {
        title: fields.slug({ name: { label: 'Titel' } }),
        episodeNumber: fields.number({ label: 'Episodennummer' }),
        publishDate: fields.date({ label: 'Veröffentlichungsdatum' }),
        audioUrl: fields.url({ label: 'Audio-URL (R2)' }),
        duration: fields.text({ label: 'Dauer (z. B. "32:10")' }),
        coverImage: fields.image({
          label: 'Cover',
          directory: 'public/images/podcast',
          publicPath: '/images/podcast/',
        }),
        shownotes: fields.markdoc({
          label: 'Shownotes',
          options: {
            image: {
              directory: 'public/images/podcast',
              publicPath: '/images/podcast/',
            },
          },
        }),
      },
    }),
  },
})
