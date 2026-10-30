import { groupedBars, lineChart, stockBar, compact } from './charts.js';

const SESSION_KEY = 'acsOpsSession';
const ADMIN_SESSION_KEY = 'acsAdminSession';
const POLL_MS = 30000;

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const STAGE_TONE = { new: 'info', sourcing: 'wait', quoting: 'wait', awaiting_customer: 'info', order_confirmation: 'signal', procuring: 'wait', ready_to_dispatch: 'ok', in_transit: 'info', delivered: 'ok', closed: '', preparing_quote: 'wait' };
const STATUS_TONE = {
  draft: '', in_review: 'wait', approved: 'info', sent: 'info', accepted: 'ok', rejected: 'bad', revision_requested: 'signal', superseded: '',
  open: 'info', rfq: 'wait', quoted: 'wait', selected: 'info', ordered: 'info', received: 'ok', cancelled: '',
  pending_approval: 'signal', partially_received: 'wait',
  pending_confirmation: 'signal', confirmed: 'wait', ready: 'ok', partially_dispatched: 'info', dispatched: 'info', delivered: 'ok',
  planned: '', packed: 'wait', shipped: 'info', exception: 'bad',
  pending: 'signal', withdrawn: '', won: 'ok', lost: '', on_hold: 'wait',
};

const NAV = [
  { key: 'command', label: 'Command center', href: '/admin/command', perm: 'view.command', icon: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z' },
  { key: 'trading', label: 'Trading', href: '/ops/trading', perm: 'view.trading', icon: 'M4 6h16M4 12h10M4 18h7' },
  { key: 'purchase', label: 'Purchasing', href: '/ops/purchase', perm: 'view.purchase', icon: 'M5 7h14l-1.5 9h-11zM9 7V5h6v2' },
  { key: 'inventory', label: 'Inventory', href: '/ops/inventory', perm: 'view.inventory', icon: 'M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9' },
  { key: 'dispatch', label: 'Dispatch', href: '/ops/dispatch', perm: 'view.dispatch', icon: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01' },
  { key: 'sales', label: 'Sales', href: '/ops/sales', perm: 'view.sales', icon: 'M4 18l5-6 4 3 7-9' },
  { key: 'people', label: 'People & access', href: '/ops/people', perm: 'user.manage', icon: 'M9 11a3 3 0 1 0 0-.01M3 20c0-3 3-5 6-5s6 2 6 5M17 8a2.5 2.5 0 1 0 0-.01M15.5 14c3 0 5.5 1.6 5.5 4.5' },
];

function parseRoute(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] === 'admin' && parts[1] === 'command') return { ws: 'command' };
  if (parts[0] === 'portal') return { ws: 'portal', slug: parts[1] || null, id: parts[2] ? Number(parts[2]) : null };
  if (parts[0] === 'ops' && parts[1]) return { ws: parts[1], id: parts[2] ? Number(parts[2]) : null };
  return { ws: 'home' };
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function opsApp() {
  return {
    token: null,
    me: null,
    perms: [],
    route: parseRoute(location.pathname),
    loading: false,
    signingIn: false,
    loginError: '',
    login: { email: '', password: '' },
    toast: null,
    railOpen: false,
    lastRefreshed: null,
    clock: Date.now(),

    catalog: { items: [], customers: [], suppliers: [] },
    command: null,
    trading: null,
    enquiry: null,
    purchase: null,
    inventory: null,
    dispatch: null,
    people: null,
    approvals: [],
    portal: null,
    portalEnquiry: null,

    tab: { command: 'pipeline', trading: 'enquiries', purchase: 'requests', inventory: 'stock', dispatch: 'ready' },
    filter: { search: '', stage: '', status: '' },
    range: { from: plusDays(-89), to: today() },
    expanded: null,
    drawer: null,
    modal: null,
    quote: null,

    // ---------- lifecycle ----------
    async init() {
      this.token = this.storedToken();
      window.addEventListener('popstate', () => { this.route = parseRoute(location.pathname); this.load(); });
      setInterval(() => { this.clock = Date.now(); }, 5000);
      setInterval(() => { if (this.me && !document.hidden && !this.modal && !this.quote && ['command', 'dispatch', 'purchase', 'trading'].includes(this.route.ws)) this.load({ quiet: true }); }, POLL_MS);
      if (this.token) await this.boot();
    },

    storedToken() {
      try {
        const own = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        if (own && own.expiresAt > Date.now()) return own.token;
        // A director coming from /admin keeps their session.
        const admin = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null');
        if (admin && admin.expiresAt > Date.now()) return admin.token;
      } catch {}
      return null;
    },

    async boot() {
      try {
        const me = await this.get('me');
        this.me = me.user;
        this.perms = me.permissions;
        if (this.route.ws === 'home' || (this.route.ws !== 'portal' && this.me.role === 'customer')) return this.go(me.home === '/portal' ? '/portal' : me.home, true);
        if (this.me.role !== 'customer') this.catalog = await this.get('catalog');
        await this.load();
      } catch (error) {
        if (error.status === 401) this.signOut(false);
        else this.notify(error.message, true);
      }
    },

    async signIn() {
      this.signingIn = true;
      this.loginError = '';
      try {
        const res = await fetch('/api/ops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'auth.login', ...this.login }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sign in failed');
        this.token = data.token;
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt })); } catch {}
        this.login.password = '';
        await this.boot();
      } catch (error) {
        this.loginError = error.message;
      } finally {
        this.signingIn = false;
      }
    },

    signOut(manual = true) {
      try { sessionStorage.removeItem(SESSION_KEY); if (manual) sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch {}
      this.token = null;
      this.me = null;
      if (manual) this.notify('Signed out.');
    },

    go(href, replace = false) {
      if (replace) history.replaceState({}, '', href); else history.pushState({}, '', href);
      this.route = parseRoute(location.pathname);
      this.railOpen = false;
      this.drawer = null;
      this.expanded = null;
      this.quote = null;
      window.scrollTo(0, 0);
      return this.load();
    },

    can(perm) { return this.perms.includes(perm); },
    nav() { return NAV.filter((n) => this.can(n.perm)); },

    // ---------- API ----------
    async get(view, params = {}) {
      const qs = new URLSearchParams({ view, ...params }).toString();
      const res = await fetch(`/api/ops?${qs}`, { headers: { 'x-ops-session': this.token || '' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
      return data;
    },

    async act(action, input, message) {
      this.loading = true;
      try {
        const res = await fetch('/api/ops', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ops-session': this.token || '' }, body: JSON.stringify({ action, input }) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { this.signOut(false); throw new Error(data.error); }
        if (!res.ok) throw new Error(data.error || 'That did not work');
        if (message) this.notify(typeof message === 'function' ? message(data.result) : message);
        await this.load({ quiet: true });
        if (this.drawer) await this.openDrawer(this.drawer.id);
        return data.result;
      } catch (error) {
        this.notify(error.message, true);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async load({ quiet = false } = {}) {
      if (!this.me) return;
      const r = this.route;
      if (!quiet) this.loading = true;
      try {
        if (r.ws === 'command') {
          [this.command] = await Promise.all([this.get('command', this.range)]);
        } else if (r.ws === 'trading') {
          if (r.id) this.enquiry = await this.get('enquiry', { id: r.id });
          else this.trading = await this.get('trading');
        } else if (r.ws === 'purchase') {
          this.purchase = await this.get('purchase');
        } else if (r.ws === 'inventory') {
          this.inventory = await this.get('inventory');
        } else if (r.ws === 'dispatch') {
          this.dispatch = await this.get('dispatch');
        } else if (r.ws === 'people') {
          this.people = await this.get('users');
        } else if (r.ws === 'portal') {
          this.portal = await this.get('portal');
          const slug = this.portal.customer.portalSlug;
          if (r.slug !== slug) history.replaceState({}, '', `/portal/${slug}${r.id ? `/${r.id}` : ''}`);
          this.portalEnquiry = r.id ? await this.get('portalEnquiry', { id: r.id }) : null;
        }
        if (this.me.role !== 'customer' && (this.can('quotation.approve') || this.can('po.approve'))) this.approvals = (await this.get('approvals')).approvals;
        this.lastRefreshed = Date.now();
      } catch (error) {
        if (error.status === 401) this.signOut(false);
        else this.notify(error.message, true);
      } finally {
        this.loading = false;
      }
    },

    notify(text, error = false) {
      this.toast = { text, error };
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast = null; }, error ? 7000 : 3500);
    },

    // ---------- formatting ----------
    inr(n) { return n === null || n === undefined ? '—' : `₹${inrFmt.format(n)}`; },
    short(n) { return n === null || n === undefined ? '—' : `₹${compact(n)}`; },
    qty(n) { return n === null || n === undefined ? '—' : qtyFmt.format(n); },
    date(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; },
    time(d) { return d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; },
    ago(d) {
      if (!d) return '—';
      const s = Math.max(0, (this.clock - new Date(d).getTime()) / 1000);
      if (s < 60) return `${Math.round(s)}s ago`;
      if (s < 3600) return `${Math.round(s / 60)}m ago`;
      if (s < 86400) return `${Math.round(s / 3600)}h ago`;
      return `${Math.round(s / 86400)}d ago`;
    },
    label(s) { return String(s || '').replace(/_/g, ' '); },
    tone(s) { return STATUS_TONE[s] ?? ''; },
    stageTone(s) { return STAGE_TONE[s] ?? ''; },
    pct(n) { return n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`; },
    delta(k) {
      if (!k || k.change === null) return { text: 'no prior data', cls: '' };
      return { text: `${k.change > 0 ? '+' : ''}${k.change}% vs prior`, cls: k.change > 0 ? 'up' : k.change < 0 ? 'down' : '' };
    },
    stockBar,
    groupedBars,
    lineChart,
    itemName(id) { const i = this.catalog.items.find((x) => x.id === Number(id)); return i ? `${i.sku} — ${i.name}` : ''; },

    // ---------- What / Why / How for each stage ----------
    guide(detail) {
      const q = detail.quotations?.[0];
      const o = detail.order;
      const e = detail.enquiry;
      if (e.status === 'lost') return { what: 'Enquiry closed as lost.', why: e.lostReason || 'No reason recorded.', how: 'Nothing to do. Reopen it if the customer comes back.' };
      if (o?.status === 'cancelled') return { what: `${o.number} was cancelled.`, why: o.cancelledReason || '', how: 'Reservations were released; any purchase already placed arrives as free stock.' };
      if (o) {
        const outstanding = o.lines.reduce((s, l) => s + l.outstanding, 0);
        if (o.status === 'pending_confirmation') return { what: `Customer accepted ${q?.number}; ${o.number} is waiting for confirmation.`, why: 'Confirmation reserves stock and starts procurement, so it should follow verified payment or terms.', how: 'Confirm the order with a note on the payment/terms check.' };
        if (o.status === 'delivered') return { what: `${o.number} delivered in full.`, why: 'Lifecycle complete.', how: 'No action needed.' };
        if (['dispatched', 'partially_dispatched'].includes(o.status)) return { what: `${o.number} is ${this.label(o.status)}.`, why: 'Goods are with the transporter.', how: 'Dispatch records delivery when the customer confirms receipt.' };
        if (o.status === 'ready') return { what: `All stock for ${o.number} is reserved.`, why: 'The customer is waiting for goods that are already on the shelf.', how: 'Dispatch plans, packs and ships it.' };
        return { what: `${o.number} confirmed; ${this.qty(outstanding)} units not yet in stock.`, why: 'Waiting on a production reallocation decision or a supplier delivery.', how: 'Follow the procurement requests below; Purchasing receives goods and they are reserved for this order automatically.' };
      }
      if (q?.status === 'revision_requested') return { what: `Customer asked for changes to ${q.number}.`, why: q.customerComment || '', how: 'Create a new revision. The old version is superseded automatically.' };
      if (q?.status === 'sent') return { what: `${q.number} is with the customer.`, why: `Valid until ${this.date(q.validUntil)}.`, how: 'Follow up, or record the customer’s decision if they replied offline.' };
      if (q?.status === 'approved') return { what: `${q.number} is approved.`, why: 'Approved quotations are not visible to the customer until sent.', how: 'Send it to the customer portal.' };
      if (q?.status === 'in_review') return { what: `${q.number} is waiting for director review.`, why: 'Every customer price is checked for margin before it leaves ACS.', how: 'A director approves or returns it with a note.' };
      if (q?.status === 'draft') return { what: `${q.number} is a draft.`, why: q.reviewNote ? `Returned: ${q.reviewNote}` : 'Not yet reviewed.', how: 'Check prices against cost, then submit for review.' };
      if (q?.status === 'rejected') return { what: `Customer declined ${q.number}.`, why: q.customerComment || 'No reason given.', how: 'Send a new revision or mark the enquiry lost.' };
      if (detail.sourcing?.some((s) => ['open', 'rfq', 'quoted'].includes(s.status))) return { what: 'Purchasing is collecting supplier prices.', why: 'Quotes on items ACS does not stock need confirmed cost and lead time.', how: 'Once a supplier offer is selected its landed cost fills in here automatically.' };
      return { what: 'New enquiry; nothing quoted yet.', why: 'The customer is waiting for a price.', how: 'Check each line’s options, request sourcing for gaps, then draft a quotation.' };
    },

    lifecycle(detail) {
      const q = detail.quotations?.find((x) => x.status === 'accepted') || detail.quotations?.[0];
      const o = detail.order;
      const shipped = o?.shipments?.filter((s) => ['shipped', 'delivered'].includes(s.status)) || [];
      const steps = [
        { label: 'Enquiry', ref: detail.enquiry.number, done: true },
        { label: 'Sourcing', ref: (detail.sourcing || []).map((s) => s.number).join(', ') || 'not needed', done: (detail.sourcing || []).some((s) => ['selected', 'ordered', 'received'].includes(s.status)) || !!q },
        { label: 'Quotation', ref: q ? `${q.number} · ${this.label(q.status)}` : '—', done: ['sent', 'accepted'].includes(q?.status) },
        { label: 'Order', ref: o ? `${o.number} · ${this.label(o.status)}` : '—', done: !!o && o.status !== 'pending_confirmation' },
        { label: 'Allocation', ref: o ? `${this.qty(o.lines.reduce((s, l) => s + l.reserved + l.dispatched, 0))}/${this.qty(o.lines.reduce((s, l) => s + l.qty - l.cancelled, 0))} units` : '—', done: !!o && o.lines.every((l) => l.outstanding <= 0) },
        { label: 'Dispatch', ref: shipped.map((s) => s.number).join(', ') || '—', done: !!o && ['dispatched', 'delivered'].includes(o.status) },
        { label: 'Delivered', ref: o?.status === 'delivered' ? 'complete' : '—', done: o?.status === 'delivered' },
      ];
      const now = steps.findIndex((s) => !s.done);
      return steps.map((s, i) => ({ ...s, state: s.done ? 'done' : i === now ? 'now' : '' }));
    },

    // ---------- command center ----------
    setRange(days) { this.range = { from: plusDays(-(days - 1)), to: today() }; this.load(); },
    stale() { return this.lastRefreshed && this.clock - this.lastRefreshed > POLL_MS * 2; },
    async openDrawer(id) {
      try {
        const detail = await this.get('enquiry', { id });
        this.drawer = { id, detail };
      } catch (error) { this.notify(error.message, true); }
    },
    alertTarget(alert) {
      if (alert.ref.type === 'enquiry') return this.openDrawer(alert.ref.id);
      if (alert.ref.type === 'purchase_order') return this.go('/ops/purchase');
      if (alert.ref.type === 'item') return this.go('/ops/inventory');
      if (alert.ref.type === 'approval') { this.tab.command = 'pipeline'; document.getElementById('approvals')?.scrollIntoView({ behavior: 'smooth' }); }
      return null;
    },
    maxOf(list, key) { return Math.max(1, ...list.map((x) => Number(x[key]) || 0)); },

    decide(approval, decision) {
      if (decision === 'approve') return this.act('approval.decide', { id: approval.id, decision }, 'Approved.');
      return this.ask({ title: 'Reject', intro: approval.summary, fields: [{ name: 'note', label: 'Reason (shared with the requester)', type: 'textarea', required: true }], submit: 'Reject', run: (v) => this.act('approval.decide', { id: approval.id, decision, note: v.note }, 'Rejected and returned.') });
    },

    // ---------- trading ----------
    filteredDeals() {
      const list = this.trading?.enquiries || [];
      const s = this.filter.search.toLowerCase();
      return list.filter((d) => (!this.filter.stage || d.stage === this.filter.stage) && (!s || `${d.number} ${d.title} ${d.customer.label}`.toLowerCase().includes(s)));
    },
    stageCounts() {
      const counts = {};
      for (const d of this.trading?.enquiries || []) counts[d.stage] = (counts[d.stage] || 0) + 1;
      return counts;
    },
    newEnquiry(customerId = '') {
      this.modal = { kind: 'enquiry', data: { customerId, title: '', dueAt: plusDays(3), notes: '', source: 'manual', lines: [{ itemId: '', qty: 1 }] } };
    },
    async saveEnquiry() {
      const d = this.modal.data;
      const created = await this.act('enquiry.create', { ...d, lines: d.lines.filter((l) => l.itemId) }, (r) => `${r.number} created.`);
      this.modal = null;
      this.go(`/ops/trading/${created.id}`);
    },
    importWeb(web) {
      return this.act('enquiry.importWeb', { legacyId: web.id }, (r) => `Moved to trading as ${r.number}.`).then((r) => this.go(`/ops/trading/${r.id}`));
    },
    editLines() {
      const e = this.enquiry;
      this.modal = { kind: 'lines', data: { id: e.enquiry.id, lines: e.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, targetPrice: l.targetPrice })) } };
      if (!this.modal.data.lines.length) this.modal.data.lines.push({ itemId: '', qty: 1 });
    },
    async saveLines() {
      await this.act('enquiry.update', { id: this.modal.data.id, lines: this.modal.data.lines.filter((l) => l.itemId) }, 'Lines updated.');
      this.modal = null;
    },
    requestSourcing() {
      const lines = this.enquiry.lines.map((l) => ({ itemId: l.itemId, label: `${l.item.sku} — ${l.item.name}`, qty: Math.max(l.qty - Math.max(0, l.stock.atp), 0) || l.qty, pick: l.stock.atp < l.qty }));
      this.modal = { kind: 'sourcing', data: { reason: lines.some((l) => l.pick) ? 'shortfall' : 'pricing', neededBy: plusDays(7), lines } };
    },
    async saveSourcing() {
      const d = this.modal.data;
      await this.act('sourcing.request', { enquiryId: this.enquiry.enquiry.id, reason: d.reason, neededBy: d.neededBy, lines: d.lines.filter((l) => l.pick) }, 'Sent to Purchasing.');
      this.modal = null;
    },
    startQuote(from) {
      const lines = from
        ? from.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unitPrice: l.unitPrice, unitCost: l.unitCost ?? '', taxRate: l.taxRate, source: l.source }))
        : this.enquiry.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unitPrice: l.targetPrice ?? '', unitCost: l.costHint?.unitCost ?? '', taxRate: 18, source: l.options.find((o) => o.feasible)?.key || 'procure' }));
      this.quote = { id: from?.status === 'draft' ? from.id : null, enquiryId: this.enquiry.enquiry.id, validUntil: from?.status === 'draft' ? from.validUntil : plusDays(15), notes: from?.notes || '', lines };
    },
    quoteTotals() {
      const lines = this.quote?.lines || [];
      let sub = 0; let tax = 0; let cost = 0; let known = true;
      for (const l of lines) {
        const amount = Number(l.qty) * Number(l.unitPrice || 0);
        sub += amount; tax += amount * Number(l.taxRate || 0) / 100;
        if (l.unitCost === '' || l.unitCost === null) known = false; else cost += Number(l.qty) * Number(l.unitCost);
      }
      return { sub, tax, total: sub + tax, margin: known ? sub - cost : null, marginPct: known && sub ? ((sub - cost) / sub) * 100 : null };
    },
    async saveQuote(submit = false) {
      const saved = await this.act('quotation.save', this.quote, (r) => `${r.number} saved.`);
      if (submit) await this.act('quotation.submit', { id: saved.id }, 'Submitted for director review.');
      this.quote = null;
    },
    customerDecision(q) {
      this.ask({
        title: `Record customer decision · ${q.number}`,
        intro: 'Use this when the customer replied by phone or email instead of the portal.',
        fields: [{ name: 'decision', label: 'Decision', type: 'select', options: [['accept', 'Accepted'], ['revise', 'Wants changes'], ['reject', 'Declined']], required: true }, { name: 'comment', label: 'Customer’s words / reference', type: 'textarea' }],
        submit: 'Record',
        run: (v) => this.act('quotation.decide', { id: q.id, ...v }, 'Decision recorded.'),
      });
    },
    confirmOrder(o) {
      this.ask({
        title: `Confirm ${o.number}`,
        intro: 'Confirming reserves free stock now, asks a director to approve any production reallocation, and raises purchase requests for the rest.',
        fields: [{ name: 'note', label: 'Payment / terms check', type: 'textarea', required: true, placeholder: 'e.g. 30% advance received, UTR …' }],
        submit: 'Confirm order',
        run: (v) => this.act('order.confirm', { id: o.id, note: v.note }, 'Order confirmed.'),
      });
    },
    cancelOrder(o) {
      this.ask({ title: `Cancel ${o.number}`, intro: 'Releases reserved stock and cancels purchase requests not yet ordered. Shipped quantities stay shipped.', fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], submit: 'Cancel order', danger: true, run: (v) => this.act('order.cancel', { id: o.id, reason: v.reason }, 'Order cancelled.') });
    },
    markLost(e) {
      this.ask({ title: `Close ${e.number} as lost`, fields: [{ name: 'reason', label: 'Why was it lost?', type: 'textarea', required: true }], submit: 'Mark lost', danger: true, run: (v) => this.act('enquiry.setStatus', { id: e.id, status: 'lost', reason: v.reason }, 'Marked lost.') });
    },
    addComment(entityId, internal = true) {
      this.ask({ title: internal ? 'Internal note' : 'Message to ACS', fields: [{ name: 'body', label: internal ? 'Visible to ACS staff only' : 'Your message', type: 'textarea', required: true }], submit: 'Add', run: (v) => this.act('comment.add', { entityType: 'enquiry', entityId, body: v.body, internal }, 'Added.') });
    },

    // ---------- masters ----------
    editCustomer(c = {}) {
      this.ask({ title: c.id ? 'Edit customer' : 'New customer', fields: [
        { name: 'company', label: 'Company', value: c.company }, { name: 'name', label: 'Contact person', required: true, value: c.name },
        { name: 'email', label: 'Email', type: 'email', value: c.email }, { name: 'phone', label: 'Phone', value: c.phone },
        { name: 'gstin', label: 'GSTIN', value: c.gstin }, { name: 'city', label: 'City', value: c.city }],
      submit: 'Save', run: async (v) => { const r = await this.act('customer.save', { id: c.id, ...v }, 'Customer saved.'); this.catalog = await this.get('catalog'); return r; } });
    },
    invite(c) {
      this.ask({ title: `Portal access · ${c.label}`, intro: 'Creates a customer login. The password is shown once; share it with the customer securely.', fields: [{ name: 'email', label: 'Login email', type: 'email', required: true, value: c.email }, { name: 'name', label: 'Name', value: c.name }], submit: 'Create login', run: async (v) => { const r = await this.act('customer.invite', { customerId: c.id, ...v }); this.modal = { kind: 'secret', data: { title: 'Portal login created', lines: [['Portal', `${location.origin}/portal/${r.portalSlug}`], ['Email', r.email], ['Password', r.password]] } }; return 'keep'; } });
    },
    editItem(i = {}) {
      this.ask({ title: i.id ? `Edit ${i.sku}` : 'New catalogue item', fields: [
        { name: 'sku', label: 'SKU / part number', required: true, value: i.sku }, { name: 'name', label: 'Description', required: true, value: i.name },
        { name: 'brand', label: 'Brand', value: i.brand }, { name: 'category', label: 'Category', value: i.category },
        { name: 'uom', label: 'Unit', value: i.uom || 'nos' }, { name: 'reorderLevel', label: 'Reorder level', type: 'number', value: i.reorderLevel ?? 0 },
        { name: 'standardCost', label: 'Standard cost (₹)', type: 'number', value: i.standardCost ?? '' }],
      submit: 'Save', run: async (v) => { const r = await this.act('item.save', { id: i.id, ...v }, 'Item saved.'); this.catalog = await this.get('catalog'); return r; } });
    },
    editSupplier(s = {}) {
      this.ask({ title: s.id ? `Edit ${s.name}` : 'New supplier', fields: [
        { name: 'name', label: 'Supplier', required: true, value: s.name }, { name: 'contact', label: 'Contact', value: s.contact },
        { name: 'email', label: 'Email', type: 'email', value: s.email }, { name: 'phone', label: 'Phone', value: s.phone },
        { name: 'gstin', label: 'GSTIN', value: s.gstin }, { name: 'brands', label: 'Brands / lines carried', value: s.brands },
        { name: 'paymentTerms', label: 'Payment terms', value: s.paymentTerms }, { name: 'leadTimeDays', label: 'Usual lead time (days)', type: 'number', value: s.leadTimeDays ?? '' }],
      submit: 'Save', run: async (v) => { const r = await this.act('supplier.save', { id: s.id, active: s.active !== false, ...v }, 'Supplier saved.'); this.catalog = await this.get('catalog'); return r; } });
    },
    editUser(u = {}) {
      const roles = Object.entries(this.people?.roles || {}).map(([k, r]) => [k, r.label]);
      this.ask({ title: u.id ? `Edit ${u.email}` : 'New person', intro: u.id ? '' : 'A password is generated and shown once.', fields: [
        { name: 'name', label: 'Name', required: true, value: u.name }, { name: 'email', label: 'Email', type: 'email', required: true, value: u.email },
        { name: 'role', label: 'Role', type: 'select', options: roles, required: true, value: u.role || 'trading' },
        { name: 'customerId', label: 'Customer (customer role only)', type: 'select', options: [['', '—'], ...this.catalog.customers.map((c) => [c.id, c.label])], value: u.customerId || '' },
        ...(u.id ? [{ name: 'active', label: 'Account active', type: 'checkbox', value: u.active !== false }, { name: 'resetPassword', label: 'Generate a new password', type: 'checkbox', value: false }] : [])],
      submit: 'Save', run: async (v) => { const r = await this.act('user.save', { id: u.id, ...v }, 'Saved.'); if (r.password) { this.modal = { kind: 'secret', data: { title: 'Share this password once', lines: [['Email', r.email], ['Password', r.password], ['Sign in at', `${location.origin}${this.people.roles[r.role].home}`]] } }; return 'keep'; } return r; } });
    },

    // ---------- purchasing ----------
    prFor(id) { return this.purchase?.requests.find((r) => r.id === id); },
    filteredRequests() {
      const list = this.purchase?.requests || [];
      return list.filter((r) => !this.filter.status || (this.filter.status === 'active' ? !['received', 'cancelled'].includes(r.status) : r.status === this.filter.status));
    },
    sendRfq(pr) {
      const sent = new Set(pr.rfqs.map((r) => r.supplierId));
      this.ask({ title: `RFQ · ${pr.number}`, intro: `${this.qty(pr.qty)} × ${pr.item.sku}. Records which suppliers were asked; send the request by your usual channel.`, fields: [{ name: 'supplierIds', label: 'Suppliers', type: 'checks', options: this.catalog.suppliers.filter((s) => s.active).map((s) => [s.id, `${s.name}${s.brands ? ` · ${s.brands}` : ''}`]), value: [...sent], required: true }], submit: 'Record RFQ', run: (v) => this.act('pr.rfq', { prId: pr.id, supplierIds: v.supplierIds }, 'RFQ recorded.') });
    },
    recordOffer(pr) {
      this.ask({ title: `Supplier offer · ${pr.number}`, intro: `${this.qty(pr.qty)} × ${pr.item.sku} — ${pr.item.name}`, fields: [
        { name: 'supplierId', label: 'Supplier', type: 'select', required: true, options: [['', 'Choose…'], ...this.catalog.suppliers.filter((s) => s.active).map((s) => [s.id, s.name])], value: pr.rfqs[0]?.supplierId || '' },
        { name: 'unitPrice', label: 'Unit price excl. tax (₹)', type: 'number', required: true }, { name: 'freight', label: 'Freight / packing total (₹)', type: 'number', value: 0 },
        { name: 'taxRate', label: 'GST %', type: 'number', value: 18 }, { name: 'leadTimeDays', label: 'Lead time (days)', type: 'number', required: true },
        { name: 'availableQty', label: 'Quantity they can supply', type: 'number', value: pr.qty }, { name: 'validUntil', label: 'Offer valid until', type: 'date', value: plusDays(15) },
        { name: 'notes', label: 'Terms / notes', type: 'textarea' }],
      submit: 'Record offer', run: (v) => this.act('offer.record', { prId: pr.id, ...v }, 'Offer recorded.') });
    },
    selectOffer(pr, offer) {
      if (offer.rank === 1) return this.act('pr.select', { prId: pr.id, offerId: offer.id }, `${offer.supplier} selected.`);
      return this.ask({ title: `Choose rank #${offer.rank}?`, intro: `${offer.supplier} is not the best-scoring offer. The reason is kept in the audit trail.`, fields: [{ name: 'note', label: 'Reason', type: 'textarea', required: true }], submit: 'Select offer', run: (v) => this.act('pr.select', { prId: pr.id, offerId: offer.id, note: v.note }, `${offer.supplier} selected.`) });
    },
    createPo(pr) {
      const offer = pr.offers.find((o) => o.selected);
      this.ask({ title: `Purchase order · ${pr.number}`, intro: `${this.qty(pr.qty)} × ${pr.item.sku} from ${offer.supplier} at landed ${this.inr(offer.landedUnitCost)}/unit (${this.inr(offer.landedTotal)}). A director approves it before it counts as incoming stock.`, fields: [{ name: 'expectedAt', label: 'Expected delivery', type: 'date', value: plusDays(offer.leadTimeDays) }], submit: 'Create & request approval', run: (v) => this.act('po.create', { prId: pr.id, ...v }, (r) => `${r.number} sent for approval.`) });
    },
    receivePo(po) {
      this.ask({ title: `Goods receipt · ${po.number}`, intro: `${this.qty(po.qty - po.received)} of ${this.qty(po.qty)} outstanding. Received units go straight to the order or production they were bought for.`, fields: [{ name: 'qty', label: 'Quantity received', type: 'number', required: true, value: po.qty - po.received }, { name: 'note', label: 'Challan / invoice ref, condition', type: 'textarea' }], submit: 'Receive into stock', run: (v) => this.act('po.receive', { poId: po.id, ...v }, (r) => `Received${r.allocated ? `, ${r.allocated} allocated` : ''}.`) });
    },
    delayPo(po) {
      this.ask({ title: `Supplier delay · ${po.number}`, fields: [{ name: 'expectedAt', label: 'New expected date', type: 'date', required: true, value: po.expectedAt }, { name: 'note', label: 'What the supplier said', type: 'textarea', required: true }], submit: 'Record delay', run: (v) => this.act('po.delay', { poId: po.id, ...v }, 'Delay recorded.') });
    },
    cancelPo(po) {
      this.ask({ title: `Cancel ${po.number}`, fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], submit: 'Cancel PO', danger: true, run: (v) => this.act('po.cancel', { poId: po.id, ...v }, 'PO cancelled.') });
    },

    // ---------- inventory ----------
    filteredStock() {
      const s = this.filter.search.toLowerCase();
      return (this.inventory?.items || []).filter((i) => (!s || `${i.sku} ${i.name} ${i.brand || ''}`.toLowerCase().includes(s)) && (!this.filter.status || (this.filter.status === 'low' ? i.stock.lowStock || i.stock.productionShortfall > 0 : true)));
    },
    countStock(i) {
      this.ask({ title: `Stock count · ${i.sku}`, intro: `System shows ${this.qty(i.stock.onHand)} on hand, ${this.qty(i.stock.productionReserved + i.stock.customerReserved)} reserved.`, fields: [{ name: 'onHand', label: 'Counted on hand', type: 'number', required: true, value: i.stock.onHand }, { name: 'note', label: 'Reason (opening balance, recount, damage…)', type: 'textarea', required: true }], submit: 'Record count', run: (v) => this.act('stock.adjust', { itemId: i.id, ...v }, 'Stock updated.') });
    },
    planProduction(i) {
      this.ask({ title: `Production requirement · ${i.sku}`, intro: 'Free stock is allocated to production up to this quantity. Anything short shows as a production shortfall.', fields: [{ name: 'required', label: 'Units production needs', type: 'number', required: true, value: i.stock.productionRequired }, { name: 'note', label: 'Job / panel reference', type: 'text' }], submit: 'Save', run: (v) => this.act('production.plan', { itemId: i.id, ...v }, (r) => (r.shortfall ? `Allocated ${r.allocated}; short ${r.shortfall}.` : `Allocated ${r.allocated}.`)) });
    },

    // ---------- dispatch ----------
    readyOrders() { return (this.dispatch?.orders || []).filter((o) => o.lines.some((l) => l.freeToDispatch > 0)); },
    shipmentsBy(status) { return (this.dispatch?.orders || []).flatMap((o) => o.shipments.map((s) => ({ ...s, order: o }))).filter((s) => (Array.isArray(status) ? status.includes(s.status) : s.status === status)); },
    planShipment(o) {
      this.modal = { kind: 'shipment', data: { orderId: o.id, number: o.number, customer: o.customer, warehouse: 'Main store', carrier: '', plannedAt: today(), lines: o.lines.filter((l) => l.freeToDispatch > 0).map((l) => ({ orderLineId: l.id, label: `${l.item.sku} — ${l.item.name}`, max: l.freeToDispatch, ordered: l.qty, qty: l.freeToDispatch })) } };
    },
    async saveShipment() {
      await this.act('shipment.create', this.modal.data, (r) => `${r.number} planned.`);
      this.modal = null;
    },
    ship(s) {
      this.ask({ title: `Ship ${s.number}`, intro: 'Stock leaves the warehouse: on-hand and the customer reservation both go down.', fields: [{ name: 'carrier', label: 'Carrier / transporter', required: true, value: s.carrier }, { name: 'trackingNo', label: 'LR / AWB / tracking number' }], submit: 'Mark shipped', run: (v) => this.act('shipment.ship', { id: s.id, ...v }, 'Shipped.') });
    },
    deliver(s) {
      this.ask({ title: `Delivered · ${s.number}`, fields: [{ name: 'receivedBy', label: 'Received by (name / stamp)' }], submit: 'Confirm delivery', run: (v) => this.act('shipment.deliver', { id: s.id, ...v }, 'Delivery recorded.') });
    },
    exception(s) {
      this.ask({ title: `Exception · ${s.number}`, fields: [{ name: 'note', label: 'What happened', type: 'textarea', required: true }], submit: 'Flag exception', danger: true, run: (v) => this.act('shipment.exception', { id: s.id, ...v }, 'Exception flagged.') });
    },

    // ---------- portal ----------
    portalDecision(q, decision) {
      const titles = { accept: 'Accept quotation', revise: 'Request changes', reject: 'Decline quotation' };
      const fields = decision === 'accept' ? [{ name: 'comment', label: 'Your PO number or note (optional)' }] : [{ name: 'comment', label: decision === 'revise' ? 'What should we change?' : 'Reason (optional, helps us improve)', type: 'textarea', required: decision === 'revise' }];
      this.ask({ title: `${titles[decision]} · ${q.number}`, intro: decision === 'accept' ? `Total ${this.inr(q.totals.total)} incl. GST. ACS confirms the order after checking payment terms.` : '', fields, submit: titles[decision], run: (v) => this.act('quotation.decide', { id: q.id, decision, ...v }, decision === 'accept' ? 'Thank you — your order is placed.' : 'Sent to ACS.') });
    },
    portalNewEnquiry() {
      this.ask({ title: 'New enquiry', fields: [{ name: 'title', label: 'What do you need?', required: true, placeholder: 'e.g. 4 × Siemens S7-1200 CPU 1214C' }, { name: 'details', label: 'Part numbers, quantities, delivery location, timeline', type: 'textarea' }], submit: 'Send to ACS', run: async (v) => { const r = await this.act('portal.enquiry', v, 'Enquiry sent. We will reply with a quotation.'); return r; } });
    },
    portalStage(s) {
      return { new: 'Received', preparing_quote: 'Preparing quotation', awaiting_customer: 'Quotation ready for you', order_confirmation: 'Order placed — confirming', procuring: 'Being arranged', ready_to_dispatch: 'Ready to dispatch', in_transit: 'On the way', delivered: 'Delivered', closed: 'Closed' }[s] || this.label(s);
    },

    // ---------- generic form modal ----------
    ask({ title, intro = '', fields, submit = 'Save', danger = false, run }) {
      const values = {};
      for (const f of fields) values[f.name] = f.value ?? (f.type === 'checks' ? [] : f.type === 'checkbox' ? false : '');
      this.modal = { kind: 'form', title, intro, fields, submit, danger, run, values, busy: false, error: '' };
    },
    async submitForm() {
      const m = this.modal;
      const missing = m.fields.find((f) => f.required && (Array.isArray(m.values[f.name]) ? !m.values[f.name].length : m.values[f.name] === '' || m.values[f.name] === null));
      if (missing) { m.error = `${missing.label} is required.`; return; }
      m.busy = true;
      m.error = '';
      try {
        const out = await m.run({ ...m.values });
        if (out !== 'keep' && this.modal === m) this.modal = null;
      } catch (error) {
        m.error = error.message;
      } finally {
        m.busy = false;
      }
    },
    toggleCheck(name, id) {
      const list = this.modal.values[name];
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1); else list.push(id);
    },

    exportCsv(name, rows, columns) {
      const lines = [columns.map((c) => csvCell(c[0])).join(','), ...rows.map((r) => columns.map((c) => csvCell(c[1](r))).join(','))];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
  };
}
