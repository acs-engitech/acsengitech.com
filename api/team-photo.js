const store = require('./_store');

// Serves team photos uploaded in the admin. Every upload gets a new id, so a response never changes and is cached hard.
module.exports = async function handler(req, res) {
  try {
    const id = String(req.query?.id || '');
    const photo = /^[\w-]{8,64}$/.test(id) ? await store.getTeamPhoto(id) : null;
    if (!photo) {
      res.statusCode = 404;
      res.setHeader('Cache-Control', 'no-store');
      return res.end('Not found');
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Content-Length', photo.buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(photo.buffer);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Cache-Control', 'no-store');
    return res.end('Photo unavailable');
  }
};
