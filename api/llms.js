const { getAll } = require('./_store');
const { DEFAULT_SETTINGS } = require('../lib/acs-defaults');

module.exports = async function handler(req, res) {
  try {
    const data = await getAll();
    const posts = (data.posts || [])
      .filter((post) => post.status === 'published')
      .map((post) => `- ${post.title}: https://acsengitech.com/blog.html?post=${post.slug}`)
      .join('\n');
    const pages = (data.pages || [])
      .map((page) => `- ${page.label}: https://acsengitech.com${page.path === '/' ? '/' : page.path}`)
      .join('\n');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.end(`${data.settings?.llmsIntro || '# ACS Engitech'}\n\n## Pages\n${pages}\n\n## Published blog posts\n${posts || '- No published posts yet.'}\n`);
  } catch (error) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(DEFAULT_SETTINGS.llmsIntro);
  }
};
