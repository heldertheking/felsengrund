export interface Organizer {
    name: string;
    image: string;
    role?: string;
    email?: string;
    phone?: string;
}

export interface Schedule {
    dtStart: string; // ISO 8601 UTC String
    dtEnd: string;   // ISO 8601 UTC String
    rRule?: string;  // iCalendar RRULE format
    displayTime: string;
}

export interface Registration {
    required: boolean;
    deadlineMs?: number; // Epoch timestamp
}

export interface Location {
    name: string;
    address: string;
    mapsLink: string;
}

export interface TargetAudience {
    ageMin: number;
    ageMax: number;
}

export interface Meta {
    cardImage: string;
    targetAudience: TargetAudience;
    offeredFrom: string; // ISO 8601 UTC String
    offeredUntil?: string; // ISO 8601 UTC String
    createdAt: string; // ISO 8601 UTC String
    updatedAt: string; // ISO 8601 UTC String
    author: string;
}

export interface Offer {
    guid: string;
    title: string;
    intro: string;
    description: string;
    schedule: Schedule;
    image: string;
    gallery: string[];
    organizers: Organizer[];
    registration: Registration;
    location: Location;
    meta: Meta;
}

/**
 * Lightweight projection of an Offer used for listing.
 * Stored in the R2 manifest ("offers/index.json") so the offer list can be
 * served without reading every offer's full markdown file from R2.
 */
export interface OfferSummary {
    guid: string;
    title: string;
    intro: string;
    cardImage: string;
    displayTime: string;
    offeredFrom: string;
    offeredUntil?: string;
    updatedAt: string;
}

export type SubmissionCategory = 'prayer' | 'feedback';

/** A Gebetswand (prayer wall) or Parkplatz (sermon feedback) submission. */
export interface Submission {
    id: string;
    message: string;
    name?: string;
    /** Only meaningful for prayer-wall submissions: whether to display the name publicly. */
    isAnonymous?: boolean;
    createdAt: string; // ISO 8601 UTC String
}