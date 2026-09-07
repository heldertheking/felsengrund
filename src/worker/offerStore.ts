import { IOfferRepository } from '../types/repositories';
import { Offer, OfferSummary } from '../types/types';
import { blankOfferTemplate, parseOfferMarkdown, serializeOffer, toSummary } from '../shared/offerMarkdown';

const MANIFEST_KEY = 'offers/index.json';

function offerKey(guid: string): string {
    return `offers/${guid}.md`;
}

export class OfferStore implements IOfferRepository {
    constructor(private bucket: R2Bucket) {}

    async getOfferRaw(guid: string): Promise<string | null> {
        const object = await this.bucket.get(offerKey(guid));
        return object ? object.text() : null;
    }

    async getOffer(guid: string): Promise<Offer | null> {
        const raw = await this.getOfferRaw(guid);
        return raw === null ? null : parseOfferMarkdown(guid, raw);
    }

    async saveOfferRaw(guid: string, raw: string): Promise<Offer> {
        const parsed = parseOfferMarkdown(guid, raw); // validates + normalizes before writing
        const offer: Offer = { ...parsed, meta: { ...parsed.meta, updatedAt: new Date().toISOString() } };
        await this.bucket.put(offerKey(guid), serializeOffer(offer), {
            httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
        });
        await this.upsertSummary(toSummary(offer));
        return offer;
    }

    async deleteOffer(guid: string): Promise<void> {
        await this.bucket.delete(offerKey(guid));
        await this.removeSummary(guid);
    }

    async listSummaries(): Promise<OfferSummary[]> {
        const object = await this.bucket.get(MANIFEST_KEY);
        return object ? object.json<OfferSummary[]>() : [];
    }

    blankTemplate(guid: string): string {
        return blankOfferTemplate(guid);
    }

    private async upsertSummary(summary: OfferSummary): Promise<void> {
        const summaries = await this.listSummaries();
        await this.writeManifest([...summaries.filter((s) => s.guid !== summary.guid), summary]);
    }

    private async removeSummary(guid: string): Promise<void> {
        const summaries = await this.listSummaries();
        await this.writeManifest(summaries.filter((s) => s.guid !== guid));
    }

    private async writeManifest(summaries: OfferSummary[]): Promise<void> {
        await this.bucket.put(MANIFEST_KEY, JSON.stringify(summaries), {
            httpMetadata: { contentType: 'application/json' },
        });
    }
}
