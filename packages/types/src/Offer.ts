interface CategoryDetails {
    label: string
    index: number // Used for sorting
}

type Category = 'gottesdienst' | 'kinder-jugend' | 'gemeinschaft' | 'senioren' | 'hilfe-service' | 'sonstiges'

/**
 * Map containing all Categories with index and label.
 */
const CATEGORY_DETAILS: Record<Category, CategoryDetails> = {
    'gottesdienst': {label: 'Gottesdienst', index: 1},
    'kinder-jugend': {label: 'Kinder & Jugend', index: 2},
    'gemeinschaft': {label: 'Gemeinschaft', index: 3},
    'senioren': {label: 'Senioren', index: 4},
    'hilfe-service': {label: 'Hilfe & Service', index: 6},
    'sonstiges': {label: 'Sonstiges', index: 7},
}

interface OfferOrganizer {
    name: string
    role?: string
    contact?: string
}

/**
 * <p>Represents metadata stored in the mdoc files frontmatter.</p>
 *
 * @property title Title displayed as <code>h1</code> on page.
 * @property intro Text used as subtitle and on card.
 * @property cardImage Image used on card in list page or section.
 * @property category {@link Category} used to Identify where Offer belongs.
 * @property targetAudience Target Audience for Offer e.g. All, Kids, Teenies, etc.
 * @property schedule Schedule when Offer happens, e.g. Every second sunday
 * @property location Where the Offer takes place
 * @property mapsLink Google Maps link the "Ort" section's location text links out to.
 * @property googleMapsIframeLink Google Maps embed URL rendered as an <iframe> on the page.
 * @property organizers List of {@link OfferOrganizer}.
 * @property registration What kind of registration process is needed, e.g. Send email to <code>xxx@mail.com</code>
 */
interface Frontmatter {
    title: string
    intro?: string
    cardImage?: string
    category: Category
    targetAudience?: string
    schedule?: string
    location?: string
    mapsLink?: string
    googleMapsIframeLink?: string
    organizers?: OfferOrganizer[]
    registration?: string
}

/**
 * @property slug Slugified version of original Title - requires recreation to modify.
 * @property data {@link Frontmatter} parsed from mdoc file.
 * @property body Markdown text, no images
 */
interface Offer {
    slug: string
    data: Frontmatter
    body: string
}

interface OfferDetailResponse extends Offer {
    bodyHtml: string
}

export {CATEGORY_DETAILS}
export type {OfferDetailResponse, Offer, Frontmatter as OfferFrontmatter, OfferOrganizer, Category, CategoryDetails}