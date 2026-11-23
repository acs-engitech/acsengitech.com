const store = require('../lib/store');
const { parseMultipart, storeFile } = require('../lib/uploads');
const { checkRateLimit, clientIp } = require('../lib/rate-limit');
const { isValidPhone } = require('../lib/phone');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_RESUME_EXT = /\.(pdf|doc|docx)$/i;
const MAX_RESUME_SIZE = 5 * 1024 * 1024;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  if (!checkRateLimit(`apply:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return send(res, 429, { error: 'Too many applications submitted. Please try again later.' });
  }

  try {
    const { fields, files } = await parseMultipart(req, { fileFields: ['resume'], maxFileSize: MAX_RESUME_SIZE });

    const name = String(fields.name || '').trim();
    const email = String(fields.email || '').trim();
    const phone = String(fields.phone || '').trim();
    const positionId = String(fields.position_id || '').trim();
    const positionTitle = String(fields.position_title || '').trim();
    const yearsExperience = String(fields.years_experience || '').trim();
    const message = String(fields.message || '').trim();

    if (!name || !email) return send(res, 400, { error: 'Name and email are required.' });
    if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'Enter a valid email address.' });
    if (!isValidPhone(phone)) return send(res, 400, { error: 'Enter a valid 10-digit Indian mobile number.' });

    let resumeUrl = null;
    let resumeFilename = null;
    let resumeSize = null;
    const resume = files.resume;
    if (resume && resume.buffer?.length) {
      if (!ALLOWED_RESUME_EXT.test(resume.filename || '')) {
        return send(res, 400, { error: 'Resume must be a PDF, DOC, or DOCX file.' });
      }
      if (resume.buffer.length > MAX_RESUME_SIZE) {
        return send(res, 400, { error: 'Resume must be under 5MB.' });
      }
      const stored = await storeFile(resume.buffer, resume.filename, 'applications');
      resumeUrl = stored.url;
      resumeFilename = stored.filename;
      resumeSize = stored.size;
    }

    const row = await store.insertApplication({
      positionId: positionId || null,
      positionTitle: positionTitle || null,
      name,
      email,
      phone: phone || null,
      yearsExperience: yearsExperience || null,
      message: message || null,
      resumeUrl,
      resumeFilename,
      resumeSize,
    });

    return send(res, 200, { ok: true, id: row.id });
  } catch (error) {
    if (error.code === 'FILE_TOO_LARGE') return send(res, 400, { error: 'Resume must be under 5MB.' });
    return send(res, 500, { error: error.message || 'Could not submit application.' });
  }
};
