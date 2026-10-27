// Runs only for requests that aren't files (files are served before this ever runs).
export default {
  async fetch(request) {
    const url = new URL(request.url);
    // /keypals2 was the 3D game's test address: send people on to /keypals (temporary, in case it changes again)
    const m = url.pathname.match(/^\/keypals2(\/.*)?$/);
    if (m) return Response.redirect(`${url.origin}/keypals${m[1] || '/'}${url.search}`, 302);
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
};
