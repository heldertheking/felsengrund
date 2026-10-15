import { unseedContent } from './api';

export default async function globalTeardown(): Promise<void> {
  await unseedContent();
}
