import type { ApiClientOptions } from './BaseClient';
import { OffersClient } from './OffersClient';
import { PodcastClient } from './PodcastClient';
import { NavClient } from './NavClient';
import { AdminClient } from './AdminClient';

export * from './BaseClient';
export { OffersClient } from './OffersClient';
export { PodcastClient } from './PodcastClient';
export { NavClient } from './NavClient';
export { AdminClient } from './AdminClient';

export interface ApiClient {
  offers: OffersClient;
  podcast: PodcastClient;
  nav: NavClient;
  admin: AdminClient;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return {
    offers: new OffersClient(options),
    podcast: new PodcastClient(options),
    nav: new NavClient(options),
    admin: new AdminClient(options),
  };
}
