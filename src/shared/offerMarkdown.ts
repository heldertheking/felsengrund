import yaml from 'js-yaml';
import { Offer, OfferSummary } from '../types/types';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function defaultOffer(guid: string): Offer {
    const now = new Date().toISOString();
    return {
        guid,
        title: 'Neues Angebot',
        intro: '',
        description: '',
        schedule: { dtStart: now, dtEnd: now, displayTime: '' },
        image: '',
        gallery: [],
        organizers: [],
        registration: { required: false },
        location: { name: '', address: '', mapsLink: '' },
        meta: {
            cardImage: '',
            targetAudience: { ageMin: 0, ageMax: 99 },
            offeredFrom: now,
            createdAt: now,
            updatedAt: now,
            author: '',
        },
    };
}

/**
 * Parses an offer's raw markdown file: YAML frontmatter (delimited by "---") holds every
 * structured field, the remaining body is the description. `guid` always wins over any `guid`
 * present in the frontmatter, since the R2 object key is the source of truth for identity, not
 * the file's own content.
 */
export function parseOfferMarkdown(guid: string, raw: string): Offer {
    const match = FRONTMATTER_PATTERN.exec(raw);
    if (!match) {
        throw new Error('Invalid offer markdown: expected YAML frontmatter delimited by "---"');
    }
    const [, frontmatterYaml, body] = match;
    const frontmatter = (yaml.load(frontmatterYaml) ?? {}) as Partial<Offer>;

    return {
        ...defaultOffer(guid),
        ...frontmatter,
        guid,
        description: body.trim(),
    };
}

/** Inverse of parseOfferMarkdown: everything but `description` becomes frontmatter. */
export function serializeOffer(offer: Offer): string {
    const { description, ...frontmatterFields } = offer;
    const frontmatter = yaml.dump(frontmatterFields, { lineWidth: 100 });
    return `---\n${frontmatter}---\n\n${description.trim()}\n`;
}

export function toSummary(offer: Offer): OfferSummary {
    return {
        guid: offer.guid,
        title: offer.title,
        intro: offer.intro,
        cardImage: offer.meta.cardImage,
        displayTime: offer.schedule.displayTime,
        offeredFrom: offer.meta.offeredFrom,
        offeredUntil: offer.meta.offeredUntil,
        updatedAt: offer.meta.updatedAt,
    };
}

export function blankOfferTemplate(guid: string): string {
    return serializeOffer(defaultOffer(guid));
}
