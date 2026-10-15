import { expect, test, type Page, type Request } from '@playwright/test';
import { API_URL } from '../env.mjs';

export { expect, test };

/** Waits until every React island on the page is interactive; filling a controlled input earlier gets lost. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const islands = Array.from(document.querySelectorAll('astro-island'));
    return islands.length > 0 && islands.every((island) => !island.hasAttribute('ssr'));
  });
}

/** Resolves with the next `POST /forms` request the page makes. */
export function waitForFormRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => request.url() === `${API_URL}/forms` && request.method() === 'POST');
}
