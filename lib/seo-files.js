// robots.txt, llms.txt and sitemap.xml, served from one function (the Vercel Hobby plan allows 12 per deployment).
const { getPublicData } = require('./store');
const { buildLlmsTxt, buildSitemap } = require('./admin-core');
const { DEFAULT_SETTINGS, PAGE_DEFAULTS } = require('./acs-defaults');

function sendText(res, type, body) {
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
  res.end(body);
}

const fallbackData = () => ({ settings: DEFAULT_SETTINGS, pages: PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} })), posts: [] });

async function robots(res) {
  let body;
  try {
    const data = await getPublicData();
    body = data.settings?.robotsTxt || DEFAULT_SETTINGS.robotsTxt;
  } catch (error) {
    body = DEFAULT_SETTINGS.robotsTxt;
  }
  sendText(res, 'text/plain; charset=utf-8', body);
}

async function llms(res) {
  let body;
  try {
    body = buildLlmsTxt(await getPublicData());
  } catch (error) {
    body = buildLlmsTxt(fallbackData());
  }
  sendText(res, 'text/plain; charset=utf-8', body);
}

async function sitemap(res) {
  let body;
  try {
    body = buildSitemap(await getPublicData());
  } catch (error) {
    body = buildSitemap(fallbackData());
  }
  sendText(res, 'application/xml; charset=utf-8', body);
}

module.exports = { robots, llms, sitemap };
