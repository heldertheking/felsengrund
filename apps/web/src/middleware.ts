import { defineMiddleware } from 'astro:middleware';

// Mirrors the rewrites in apps/web/public/.htaccess, which only apply on the Apache-hosted
// production build. `astro dev` never reads .htaccess, so without this, any /angebote/<slug> or
// /podcast/<slug> URL — freshly created offers/episodes included — hits Astro's own 404 instead
// of the client-rendered detail shell that fetches the content from the API.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (/^\/angebote\/[a-z0-9-]+\/?$/.test(pathname) && !/^\/angebote\/detail\/?$/.test(pathname)) {
    return context.rewrite('/angebote/detail');
  }

  if (/^\/podcast\/[a-z0-9-]+\/?$/.test(pathname) && !/^\/podcast\/detail\/?$/.test(pathname)) {
    return context.rewrite('/podcast/detail');
  }

  return next();
});
