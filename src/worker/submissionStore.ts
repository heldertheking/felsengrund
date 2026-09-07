import { Submission, SubmissionCategory } from '../types/types';

const MAX_MESSAGE_LENGTH = 2000;

export class SubmissionStore {
    constructor(private bucket: R2Bucket, private category: SubmissionCategory) {}

    private key(id: string): string {
        return `submissions/${this.category}/${id}.json`;
    }

    async create(input: { message: string; name?: string; isAnonymous?: boolean }): Promise<Submission> {
        const message = input.message.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!message) throw new Error('Message must not be empty');

        const submission: Submission = {
            id: crypto.randomUUID(),
            message,
            name: input.name?.trim() || undefined,
            isAnonymous: input.isAnonymous,
            createdAt: new Date().toISOString(),
        };
        await this.bucket.put(this.key(submission.id), JSON.stringify(submission), {
            httpMetadata: { contentType: 'application/json' },
        });
        return submission;
    }

    async list(): Promise<Submission[]> {
        const { objects } = await this.bucket.list({ prefix: `submissions/${this.category}/` });
        const submissions = await Promise.all(
            objects.map(async (object) => {
                const item = await this.bucket.get(object.key);
                return item?.json<Submission>() ?? null;
            }),
        );
        return submissions
            .filter((s): s is Submission => s !== null)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    async remove(id: string): Promise<void> {
        await this.bucket.delete(this.key(id));
    }
}
