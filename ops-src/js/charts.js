// Small SVG charts drawn from real series. No chart library: each chart is a few dozen lines and
// inherits the platform's type and colour tokens.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e7) return `${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (Math.abs(v) >= 1e5) return `${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(v * 10) / 10);
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

// Grouped weekly bars, e.g. quoted vs won value. series: [{ key, label, color }]
export function groupedBars(rows, series, { height = 180, format = compact, xKey = 'week' } = {}) {
  if (!rows.length) return '<div class="empty">No data in this range.</div>';
  const W = 640;
  const H = height;
  const pad = { l: 40, r: 8, t: 10, b: 22 };
  const max = niceMax(Math.max(...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0))));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const band = iw / rows.length;
  const bw = Math.max(2, Math.min(18, (band * 0.72) / series.length));
  const y = (v) => pad.t + ih - (v / max) * ih;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.label).join(' and '))} by week">`;
  for (let i = 0; i <= 4; i += 1) {
    const v = (max / 4) * i;
    out += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pad.l - 6}" y="${y(v) + 3}" text-anchor="end">${esc(format(v))}</text>`;
  }
  const every = Math.ceil(rows.length / 8);
  rows.forEach((r, i) => {
    const x0 = pad.l + band * i + (band - bw * series.length) / 2;
    series.forEach((s, j) => {
      const v = Number(r[s.key]) || 0;
      out += `<rect x="${x0 + j * bw}" y="${y(v)}" width="${bw - 1}" height="${Math.max(0, pad.t + ih - y(v))}" fill="${s.color}"><title>${esc(r[xKey])} · ${esc(s.label)}: ${esc(format(v))}</title></rect>`;
    });
    if (i % every === 0) out += `<text class="axis" x="${pad.l + band * i + band / 2}" y="${H - 6}" text-anchor="middle">${esc(String(r[xKey]).slice(5))}</text>`;
  });
  return `${out}</svg>`;
}

// Single line with area, for counts over time.
export function lineChart(rows, key, { height = 120, color = 'var(--ink-2)', xKey = 'week' } = {}) {
  if (!rows.length) return '<div class="empty">No data in this range.</div>';
  const W = 640;
  const H = height;
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const max = niceMax(Math.max(...rows.map((r) => Number(r[key]) || 0)));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (rows.length === 1 ? iw / 2 : (iw * i) / (rows.length - 1));
  const y = (v) => pad.t + ih - (v / max) * ih;
  const pts = rows.map((r, i) => `${x(i)},${y(Number(r[key]) || 0)}`).join(' ');
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(key)} by week">`;
  for (let i = 0; i <= 2; i += 1) out += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y((max / 2) * i)}" y2="${y((max / 2) * i)}"/><text class="axis" x="${pad.l - 6}" y="${y((max / 2) * i) + 3}" text-anchor="end">${esc(compact((max / 2) * i))}</text>`;
  out += `<polygon points="${pad.l},${pad.t + ih} ${pts} ${x(rows.length - 1)},${pad.t + ih}" fill="${color}" opacity="0.08"/>`;
  out += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
  rows.forEach((r, i) => { out += `<circle cx="${x(i)}" cy="${y(Number(r[key]) || 0)}" r="2.2" fill="${color}"><title>${esc(r[xKey])}: ${esc(r[key])}</title></circle>`; });
  const every = Math.ceil(rows.length / 8);
  rows.forEach((r, i) => { if (i % every === 0) out += `<text class="axis" x="${x(i)}" y="${H - 5}" text-anchor="middle">${esc(String(r[xKey]).slice(5))}</text>`; });
  return `${out}</svg>`;
}

// Stock composition bar for one item: production | customer | free (+ incoming as a ghost segment).
export function stockBar(stock) {
  const free = Math.max(0, stock.atp);
  const total = Math.max(1, stock.onHand + stock.incoming);
  const seg = (v, color, label) => (v > 0 ? `<span style="width:${(v / total) * 100}%;background:${color}" title="${label}: ${v}"></span>` : '');
  return `<div class="stockbar" role="img" aria-label="On hand ${stock.onHand}: production ${stock.productionReserved}, customer ${stock.customerReserved}, free ${free}; incoming ${stock.incoming}">${seg(stock.productionReserved, 'var(--c-prod)', 'Production')}${seg(stock.customerReserved, 'var(--c-cust)', 'Customer')}${seg(free, 'var(--c-free)', 'Free')}${seg(stock.incoming, 'var(--c-incoming)', 'Incoming')}</div>`;
}
