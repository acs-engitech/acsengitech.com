// Vercel Routing Middleware: content negotiation for agents. A request for a page that prefers
// `Accept: text/markdown` is rewritten to /api/markdown (same URL for the client, Markdown body,
// `Vary: Accept`); every other request, including normal browsers asking for text/html, passes through.
// Kept dependency-free so it can also be loaded directly by the tests.

export const config = {
  matcher: ['/((?!api/|assets/|admin/|ops/|portal/|_vercel/|.*\\.(?:css|js|mjs|json|xml|txt|md|png|jpe?g|gif|svg|webp|avif|ico|ttf|otf|woff2?|mp4|webm|pdf|glb|gltf|bin|map)$).*)'],
};

const MARKDOWN = new Set(['text/markdown', 'text/x-markdown']);
const HTML = new Set(['text/html', 'application/xhtml+xml']);

// True when the Accept header ranks Markdown above (or, listed first, level with) HTML.
export function prefersMarkdown(accept) {
  let markdown = 0;
  let html = 0;
  let markdownFirst = false;
  for (const part of String(accept || '').split(',')) {
    const [type, ...params] = part.trim().toLowerCase().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const weight = q ? Number(q.slice(2)) : 1;
    if (!Number.isFinite(weight)) continue;
    if (MARKDOWN.has(type.trim()) && weight > markdown) {
      if (!markdown && !html) markdownFirst = true;
      markdown = weight;
    } else if (HTML.has(type.trim()) && weight > html) {
      html = weight;
    }
  }
  return markdown > 0 && (markdown > html || (markdown === html && markdownFirst));
}

export function markdownTarget(requestUrl) {
  const url = new URL(requestUrl);
  const target = new URL('/api/markdown', url);
  target.searchParams.set('path', url.pathname);
  for (const [key, value] of url.searchParams) if (key !== 'path') target.searchParams.set(key, value);
  return target;
}

export default function middleware(request) {
  if (!prefersMarkdown(request.headers.get('accept'))) return undefined;
  return new Response(null, { headers: { 'x-middleware-rewrite': markdownTarget(request.url).toString() } });
}
