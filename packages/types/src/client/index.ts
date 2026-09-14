import type { ApiClientOptions } from './BaseClient';
import { OffersClient } from './OffersClient';
import { PodcastClient } from './PodcastClient';
import { NavClient } from './NavClient';
import { FormsClient } from './FormsClient';
import { AdminClient } from './AdminClient';

export * from './BaseClient';
export { OffersClient } from './OffersClient';
export { PodcastClient } from './PodcastClient';
export { NavClient } from './NavClient';
export { FormsClient } from './FormsClient';
export { AdminClient } from './AdminClient';

export interface ApiClient {
  offers: OffersClient;
  podcast: PodcastClient;
  nav: NavClient;
  forms: FormsClient;
  admin: AdminClient;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return {
    offers: new OffersClient(options),
    podcast: new PodcastClient(options),
    nav: new NavClient(options),
    forms: new FormsClient(options),
    admin: new AdminClient(options),
  };
}
