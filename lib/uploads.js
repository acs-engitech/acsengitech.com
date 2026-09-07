const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Busboy = require('busboy');

function sanitizeFilename(name) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-140) || 'file';
}

// Parses a multipart/form-data request into { fields, files: { [fieldName]: {buffer, filename, mimetype, size} } }.
// `fileFields` lists which multipart field names should be captured as files (others are ignored).
function parseMultipart(req, { fileFields = [], maxFileSize = 10 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: maxFileSize } });
    const fields = {};
    const files = {};
    let fileTooLarge = false;

    busboy.on('field', (name, value) => {
      if (fields[name] === undefined) {
        fields[name] = value;
      } else if (Array.isArray(fields[name])) {
        fields[name].push(value);
      } else {
        fields[name] = [fields[name], value];
      }
    });

    busboy.on('file', (name, stream, info) => {
      if (!fileFields.includes(name)) {
        stream.resume();
        return;
      }
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => { fileTooLarge = true; });
      stream.on('end', () => {
        if (!chunks.length && !info.filename) return;
        files[name] = {
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          mimetype: info.mimeType || info.mimetype,
        };
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (fileTooLarge) return reject(Object.assign(new Error('File too large'), { code: 'FILE_TOO_LARGE' }));
      resolve({ fields, files });
    });

    req.pipe(busboy);
  });
}

// Stores a file to Vercel Blob (production) or a local stub path (dev without BLOB_READ_WRITE_TOKEN).
async function storeFile(buffer, originalFilename, folder) {
  const safeName = sanitizeFilename(originalFilename);
  const key = `${folder}/${crypto.randomUUID()}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = require('@vercel/blob');
    const blob = await put(key, buffer, { access: 'public' });
    return { url: blob.url, filename: safeName, size: buffer.length };
  }

  console.warn(`[uploads] BLOB_READ_WRITE_TOKEN not set - saving "${key}" as a local stub, no file written to disk.`);
  return { url: `/uploads/${key}`, filename: safeName, size: buffer.length };
}

module.exports = { parseMultipart, storeFile, sanitizeFilename };
