import { Offer, OfferSummary } from './types';

/**
 * Handles reading/writing an offer's raw markdown file (YAML frontmatter + description body)
 * to/from R2, plus the "offers/index.json" manifest used to list offers without reading every
 * offer's file.
 * E.g., saved at: "offers/<guid>.md"
 */
export interface IOfferRepository {
    getOfferRaw(guid: string): Promise<string | null>;
    getOffer(guid: string): Promise<Offer | null>;
    saveOfferRaw(guid: string, raw: string): Promise<Offer>;
    deleteOffer(guid: string): Promise<void>;
    listSummaries(): Promise<OfferSummary[]>;
}

/**
 * Handles raw image uploads.
 * E.g., saved at: "offers/<guid>/<image_guid>.<ext>"
 */
export interface IImageRepository {
    /**
     * Uploads an image. Accepts a File (browser) or ArrayBuffer/ReadableStream (Worker).
     * Returns the final absolute or relative URL path of the uploaded image.
     */
    uploadImage(offerGuid: string, imageGuid: string, data: Blob | ArrayBuffer, contentType: string): Promise<string>;
    deleteImage(offerGuid: string, imageGuid: string, extension: string): Promise<void>;
}