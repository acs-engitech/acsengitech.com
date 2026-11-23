const store = require('../lib/store');
const { parseMultipart, storeFile } = require('../lib/uploads');
const { checkRateLimit, clientIp } = require('../lib/rate-limit');
const { isValidPhone } = require('../lib/phone');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PROFILE_EXT = /\.(pdf|doc|docx|zip)$/i;
const MAX_PROFILE_SIZE = 10 * 1024 * 1024;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function isSafeHttpUrl(candidate) {
  const trimmed = String(candidate || '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function parsePortfolioUrls(value) {
  // Collect candidates from all possible input shapes
  let candidates;
  if (Array.isArray(value)) {
    candidates = value;
  } else if (!value) {
    candidates = [];
  } else {
    try {
      const parsed = JSON.parse(value);
      candidates = Array.isArray(parsed) ? parsed : String(value).split(/[\n,]/);
    } catch {
      candidates = String(value).split(/[\n,]/);
    }
  }
  // Trim, drop empties, and reject any URL whose scheme isn't http/https
  return candidates.map((v) => String(v).trim()).filter((u) => u && isSafeHttpUrl(u));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  if (!checkRateLimit(`partner:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return send(res, 429, { error: 'Too many registrations submitted. Please try again later.' });
  }

  try {
    const { fields, files } = await parseMultipart(req, { fileFields: ['profile'], maxFileSize: MAX_PROFILE_SIZE });

    const name = String(fields.name || '').trim();
    const email = String(fields.email || '').trim();
    const phone = String(fields.phone || '').trim();
    const category = String(fields.category || '').trim();
    const city = String(fields.city || '').trim();
    const entityType = String(fields.entity_type || '').trim();
    const yearsExperience = String(fields.years_experience || '').trim();
    const description = String(fields.description || '').trim();
    const portfolioUrls = parsePortfolioUrls(fields.portfolio_urls);

    if (!name || !email) return send(res, 400, { error: 'Name and email are required.' });
    if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'Enter a valid email address.' });
    if (!isValidPhone(phone)) return send(res, 400, { error: 'Enter a valid 10-digit Indian mobile number.' });

    let profileUrl = null;
    let profileFilename = null;
    let profileSize = null;
    const profile = files.profile;
    if (profile && profile.buffer?.length) {
      if (!ALLOWED_PROFILE_EXT.test(profile.filename || '')) {
        return send(res, 400, { error: 'Profile file must be a PDF, DOC, DOCX, or ZIP file.' });
      }
      if (profile.buffer.length > MAX_PROFILE_SIZE) {
        return send(res, 400, { error: 'Profile file must be under 10MB.' });
      }
      const stored = await storeFile(profile.buffer, profile.filename, 'partners');
      profileUrl = stored.url;
      profileFilename = stored.filename;
      profileSize = stored.size;
    }

    const row = await store.insertPartner({
      category: category || null,
      name,
      email,
      phone: phone || null,
      city: city || null,
      entityType: entityType || null,
      yearsExperience: yearsExperience || null,
      portfolioUrls,
      profileUrl,
      profileFilename,
      profileSize,
      description: description || null,
    });

    return send(res, 200, { ok: true, id: row.id });
  } catch (error) {
    if (error.code === 'FILE_TOO_LARGE') return send(res, 400, { error: 'Profile file must be under 10MB.' });
    return send(res, 500, { error: error.message || 'Could not submit registration.' });
  }
};
