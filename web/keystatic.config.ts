import { config, fields, collection } from '@keystatic/core'
import { block } from '@keystatic/core/content-components'

const gallery = block({
  label: 'Bildergalerie',
  schema: {
    images: fields.array(
      fields.image({
        label: 'Bild',
        directory: 'src/assets/gallery',
        publicPath: '/src/assets/gallery/',
      }),
      {
        label: 'Bilder',
      },
    ),
    caption: fields.text({ label: 'Bildunterschrift', multiline: true }),
  },
})

export default config({
  // NOTE: switch to `{ kind: 'github', repo: 'heldertheking/felsengrund' }` once a
  // Keystatic GitHub App is installed on the repo — that's what lets staff edit
  // content on the deployed site instead of only on a local checkout.
  storage: { kind: 'local' },
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
          directory: 'src/assets/offers',
          publicPath: '/src/assets/offers/',
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
              directory: 'src/assets/offers',
              publicPath: '/src/assets/offers/',
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
          directory: 'src/assets/podcast',
          publicPath: '/src/assets/podcast/',
        }),
        shownotes: fields.markdoc({
          label: 'Shownotes',
          options: {
            image: {
              directory: 'src/assets/podcast',
              publicPath: '/src/assets/podcast/',
            },
          },
        }),
      },
    }),
  },
})
