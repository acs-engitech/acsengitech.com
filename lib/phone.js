// India-only phone validation, shared by api/apply.js and api/partner.js.
// Phone is always optional: empty string is valid. When provided, it must be
// a full E.164-ish Indian mobile number (+91 followed by a 10-digit number
// starting 6-9), matching what the client always sends once the +91 prefix
// and 10-digit input are filled in.
const INDIA_MOBILE_RE = /^\+91[6-9]\d{9}$/;

function isValidPhone(value) {
  const trimmed = String(value || '').trim();
  return trimmed === '' || INDIA_MOBILE_RE.test(trimmed);
}

module.exports = { INDIA_MOBILE_RE, isValidPhone };
