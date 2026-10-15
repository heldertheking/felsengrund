import { seedContent } from './api';

/** Runs once the Worker and the site are up, against the Worker's fresh, empty local storage. */
export default async function globalSetup(): Promise<void> {
  await seedContent();
}
