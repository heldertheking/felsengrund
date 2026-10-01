import { OffersRepository } from './offers';
import { PodcastRepository } from './podcast';
import { deleteMedia, formatMarkdocFile, renderMarkdoc, slugify } from './shared';

const StorageUtils = {
  deleteMedia,
  formatMarkdocFile,
  renderMarkdoc,
  slugify,
};

export { StorageUtils, OffersRepository, PodcastRepository };
