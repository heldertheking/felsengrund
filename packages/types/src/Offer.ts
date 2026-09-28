interface CategoryDetails {
  label: string;
  index: number; // Used for sorting
}

type Category = 'gottesdienst' | 'kinder-jugend' | 'gemeinschaft' | 'senioren' | 'hilfe-service' | 'sonstiges';

const CATEGORY_DETAILS: Record<Category, CategoryDetails> = {
  gottesdienst: { label: 'Gottesdienst', index: 1 },
  'kinder-jugend': { label: 'Kinder & Jugend', index: 2 },
  gemeinschaft: { label: 'Gemeinschaft', index: 3 },
  senioren: { label: 'Senioren', index: 4 },
  'hilfe-service': { label: 'Hilfe & Service', index: 6 },
  sonstiges: { label: 'Sonstiges', index: 7 },
};

interface OfferOrganizer {
  name: string;
  role?: string;
  contact?: string;
}

/** Metadata stored in the mdoc file's frontmatter. */
interface Frontmatter {
  title: string; // Displayed as h1 on the page
  intro?: string; // Subtitle / card text
  cardImage?: string;
  category: Category;
  targetAudience?: string; // e.g. All, Kids, Teenies
  schedule?: string; // e.g. "Every second Sunday"
  location?: string;
  mapsLink?: string; // Google Maps link the "Ort" section links out to
  googleMapsIframeLink?: string; // Google Maps embed URL rendered as an <iframe>
  organizers?: OfferOrganizer[];
  registration?: string; // e.g. "Send email to xxx@mail.com"
}

interface Offer {
  slug: string; // Derived from the title; requires recreation to modify
  data: Frontmatter;
  body: string; // Markdown text, no images
}

interface OfferDetailResponse extends Offer {
  bodyHtml: string;
}

export { CATEGORY_DETAILS };
export type { OfferDetailResponse, Offer, Frontmatter as OfferFrontmatter, OfferOrganizer, Category, CategoryDetails };
