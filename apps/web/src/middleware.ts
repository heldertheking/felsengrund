import { defineMiddleware } from 'astro:middleware';

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
