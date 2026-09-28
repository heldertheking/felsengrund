// Mirrors apps/web's --color-kf-* tokens and fonts, so emails match the site's branding.
export const emailTheme = {
  colors: {
    accent: '#a31366',
    accentSoft: '#fda1d5',
    ink: '#22181e',
    inkMuted: '#5c4f57',
    surface: '#ffffff',
    surfaceSunken: '#fbf3f8',
    edge: '#ecdce6',
  },
  fonts: {
    heading: "'Raleway', Arial, sans-serif",
    body: "'Open Sans', Arial, sans-serif",
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Raleway:wght@600;700&display=swap',
  },
  brand: {
    name: 'Kirche Felsengrund',
    tagline: 'Kirche, die verändert',
    url: 'https://kirche-felsengrund.ch',
  },
} as const;
