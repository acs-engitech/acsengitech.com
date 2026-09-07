const { Readable } = require('node:stream');

// Builds a minimal fake HTTP request carrying a multipart/form-data body, for exercising
// busboy-based handlers (api/apply.js, api/partner.js) without a real HTTP server.
function buildMultipartRequest({ fields = {}, files = {}, socket = { remoteAddress: '127.0.0.1' } } = {}) {
  const boundary = '----acsTestBoundary';
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  for (const [name, file] of Object.entries(files)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`);
    parts.push(file.content);
    parts.push('\r\n');
  }
  parts.push(`--${boundary}--\r\n`);

  const buffer = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
  const req = Readable.from([buffer]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
  req.socket = socket;
  req.method = 'POST';
  return req;
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    end(payload) { this.body = payload ? JSON.parse(payload) : null; },
  };
  return res;
}

module.exports = { buildMultipartRequest, fakeResponse };
