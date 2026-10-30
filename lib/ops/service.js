// Workflow commands. Each command runs in one database transaction: it checks permission, validates the
// current state, applies the change, moves stock through the ledger and writes the audit event. A
// failed rule throws OpsError and the whole transaction rolls back.
const crypto = require('node:crypto');
const { OpsError, requirePermission, can, APPROVAL_PERMISSION, ROLES } = require('./rbac');
const { num, round, stockPosition, rankOffers, lineTotals, orderStatus } = require('./rules');
const { hashUserPassword, generatePassword } = require('./auth');
const { slugify } = require('../admin-core');

const bad = (message) => new OpsError(400, message);
const notFound = (what) => new OpsError(404, `${what} not found`);
const conflict = (message) => new OpsError(409, message);

function text(value, label, { required = false, max = 2000 } = {}) {
  const out = String(value ?? '').trim().slice(0, max);
  if (required && !out) throw bad(`${label} is required`);
  return out || null;
}

function qty(value, label = 'Quantity') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw bad(`${label} must be greater than zero`);
  return round(n, 3);
}

function money(value, label, { required = true } = {}) {
  if (!required && (value === null || value === undefined || value === '')) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw bad(`${label} must be zero or more`);
  return round(n, 2);
}

function id(value, label = 'Record') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw bad(`${label} is missing`);
  return n;
}

function date(value, label, { required = false } = {}) {
  if (!value) {
    if (required) throw bad(`${label} is required`);
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw bad(`${label} is not a valid date`);
  return d.toISOString().slice(0, 10);
}

async function one(q, sql, params, what) {
  const rows = await q.query(sql, params);
  if (!rows[0]) throw notFound(what);
  return rows[0];
}

async function nextNumber(q, prefix) {
  const rows = await q.query(
    `INSERT INTO ops_counters (prefix, n) VALUES ($1, 1)
     ON CONFLICT (prefix) DO UPDATE SET n = ops_counters.n + 1 RETURNING n`,
    [prefix],
  );
  return `${prefix}-${String(rows[0].n).padStart(4, '0')}`;
}

async function event(q, ctx, { entityType, entityId, enquiryId = null, action, from = null, to = null, message = null, data = {} }) {
  await q.query(
    `INSERT INTO ops_events (entity_type, entity_id, enquiry_id, action, from_status, to_status, message, data, actor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [entityType, entityId, enquiryId, action, from, to, message, JSON.stringify(data), ctx.actor],
  );
}

// ---------- Stock ledger ----------

async function lockStock(q, itemId) {
  await q.query('INSERT INTO ops_stock (item_id) VALUES ($1) ON CONFLICT (item_id) DO NOTHING', [itemId]);
  return one(q, 'SELECT s.*, i.reorder_level, i.sku, i.name FROM ops_stock s JOIN ops_items i ON i.id = s.item_id WHERE s.item_id = $1 FOR UPDATE OF s', [itemId], 'Item');
}

// The only way stock balances change. Checks the invariants with readable messages before the database
// CHECK constraints would, and records the movement.
async function moveStock(q, ctx, itemId, delta, { kind, refType = null, refId = null, note = null, unitCost = null }) {
  const row = await lockStock(q, itemId);
  const d = { onHand: 0, production: 0, customer: 0, incoming: 0, ...delta };
  const next = {
    onHand: round(num(row.on_hand) + d.onHand, 3),
    production: round(num(row.production_reserved) + d.production, 3),
    customer: round(num(row.customer_reserved) + d.customer, 3),
    incoming: round(num(row.incoming) + d.incoming, 3),
  };
  if (next.onHand < 0) throw conflict(`${row.sku}: not enough stock on hand (${num(row.on_hand)})`);
  if (next.production < 0 || next.customer < 0 || next.incoming < 0) throw conflict(`${row.sku}: reservation would go negative`);
  if (next.production + next.customer > next.onHand) {
    throw conflict(`${row.sku}: only ${round(num(row.on_hand) - num(row.production_reserved) - num(row.customer_reserved), 3)} units are free to promise`);
  }
  let avgCost = row.avg_cost;
  if (unitCost !== null && d.onHand > 0) {
    const prevQty = num(row.on_hand);
    avgCost = round(((prevQty * num(row.avg_cost ?? unitCost)) + d.onHand * unitCost) / (prevQty + d.onHand), 2);
  }
  await q.query(
    `UPDATE ops_stock SET on_hand = $2, production_reserved = $3, customer_reserved = $4, incoming = $5, avg_cost = $6, updated_at = now()
     WHERE item_id = $1`,
    [itemId, next.onHand, next.production, next.customer, next.incoming, avgCost],
  );
  await q.query(
    `INSERT INTO ops_stock_moves (item_id, kind, d_on_hand, d_production, d_customer, d_incoming, ref_type, ref_id, note, actor)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [itemId, kind, d.onHand, d.production, d.customer, d.incoming, refType, refId, note, ctx.actor],
  );
  return { ...row, on_hand: next.onHand, production_reserved: next.production, customer_reserved: next.customer, incoming: next.incoming };
}

// ---------- Shared lookups ----------

async function enquiryFor(q, enquiryId) {
  return one(q, 'SELECT * FROM ops_enquiries WHERE id = $1 FOR UPDATE', [enquiryId], 'Enquiry');
}

async function orderWithLines(q, orderId) {
  const order = await one(q, 'SELECT * FROM ops_orders WHERE id = $1 FOR UPDATE', [orderId], 'Order');
  const lines = await q.query('SELECT * FROM ops_order_lines WHERE order_id = $1 ORDER BY id FOR UPDATE', [orderId]);
  return { order, lines };
}

async function refreshOrderStatus(q, ctx, orderId) {
  const { order, lines } = await orderWithLines(q, orderId);
  const status = orderStatus(order, lines);
  if (status !== order.status) {
    await q.query('UPDATE ops_orders SET status = $2, updated_at = now() WHERE id = $1', [orderId, status]);
    await event(q, ctx, { entityType: 'order', entityId: orderId, enquiryId: order.enquiry_id, action: 'status', from: order.status, to: status, message: `${order.number} is now ${status.replace(/_/g, ' ')}` });
  }
  return status;
}

// Quantity of an order line still to be covered by stock: ordered minus cancelled, reserved, shipped and
// whatever open procurement requests are already bringing in for it.
async function lineUncovered(q, line) {
  const rows = await q.query(
    `SELECT COALESCE(SUM(pr.qty - COALESCE((SELECT SUM(po.received_qty) FROM ops_purchase_orders po WHERE po.pr_id = pr.id AND po.status <> 'cancelled' AND po.status <> 'rejected'), 0)), 0) AS pending
       FROM ops_procurement_requests pr WHERE pr.order_line_id = $1 AND pr.status NOT IN ('cancelled','received')`,
    [line.id],
  );
  const pendingReallocation = await q.query(
    `SELECT COALESCE(SUM((payload->>'qty')::numeric), 0) AS qty FROM ops_approvals
      WHERE kind = 'reallocation' AND status = 'pending' AND (payload->>'orderLineId')::int = $1`,
    [line.id],
  );
  return round(num(line.qty) - num(line.cancelled_qty) - num(line.reserved_qty) - num(line.dispatched_qty) - num(rows[0].pending) - num(pendingReallocation[0].qty), 3);
}

async function createPr(q, ctx, { itemId, qty: amount, reason, enquiryId = null, orderLineId = null, neededBy = null }) {
  const number = await nextNumber(q, 'PR');
  const rows = await q.query(
    `INSERT INTO ops_procurement_requests (number, item_id, qty, reason, enquiry_id, order_line_id, needed_by, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [number, itemId, amount, reason, enquiryId, orderLineId, neededBy, ctx.actor],
  );
  await event(q, ctx, { entityType: 'procurement', entityId: rows[0].id, enquiryId, action: 'created', to: 'open', message: `${number} raised for ${amount} units (${reason.replace(/_/g, ' ')})` });
  return rows[0];
}

async function requestApproval(q, ctx, { kind, refType, refId, summary, payload = {}, enquiryId = null }) {
  const rows = await q.query(
    `INSERT INTO ops_approvals (kind, ref_type, ref_id, payload, summary, requested_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`,
    [kind, refType, refId, JSON.stringify(payload), summary, ctx.actor],
  );
  await event(q, ctx, { entityType: 'approval', entityId: rows[0].id, enquiryId, action: 'requested', to: 'pending', message: summary });
  return rows[0];
}

async function withdrawApprovals(q, ctx, kind, refType, refId, note) {
  await q.query(
    `UPDATE ops_approvals SET status = 'withdrawn', decided_by = $4, decided_at = now(), note = $5
      WHERE kind = $1 AND ref_type = $2 AND ref_id = $3 AND status = 'pending'`,
    [kind, refType, refId, ctx.actor, note],
  );
}

async function reliabilityBySupplier(q) {
  const rows = await q.query(
    `SELECT supplier_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE (SELECT MAX(r.received_at)::date FROM ops_receipts r WHERE r.po_id = po.id) <= COALESCE(po.original_expected_at, po.expected_at))::int AS on_time
       FROM ops_purchase_orders po WHERE po.status = 'received' GROUP BY supplier_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.supplier_id, r.total ? r.on_time / r.total : null]));
}

// ---------- Commands ----------

const commands = {};
function command(name, permission, run) {
  commands[name] = { permission, run };
}

// Masters
command('item.save', 'item.manage', async (q, input, ctx) => {
  const sku = text(input.sku, 'SKU', { required: true, max: 64 }).toUpperCase();
  const fields = [sku, text(input.name, 'Name', { required: true, max: 200 }), text(input.brand, 'Brand'), text(input.category, 'Category'), text(input.uom, 'Unit') || 'nos', money(input.reorderLevel ?? 0, 'Reorder level'), money(input.standardCost, 'Standard cost', { required: false })];
  const dup = await q.query('SELECT id FROM ops_items WHERE sku = $1 AND id <> $2', [sku, Number(input.id) || 0]);
  if (dup[0]) throw conflict(`SKU ${sku} already exists`);
  if (input.id) {
    const rows = await q.query('UPDATE ops_items SET sku=$2, name=$3, brand=$4, category=$5, uom=$6, reorder_level=$7, standard_cost=$8 WHERE id=$1 RETURNING *', [id(input.id), ...fields]);
    if (!rows[0]) throw notFound('Item');
    return rows[0];
  }
  const rows = await q.query('INSERT INTO ops_items (sku, name, brand, category, uom, reorder_level, standard_cost) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', fields);
  await q.query('INSERT INTO ops_stock (item_id) VALUES ($1)', [rows[0].id]);
  await event(q, ctx, { entityType: 'item', entityId: rows[0].id, action: 'created', message: `${sku} added to the catalogue` });
  return rows[0];
});

command('customer.save', 'customer.manage', async (q, input, ctx) => {
  const name = text(input.name, 'Contact name', { required: true, max: 200 });
  const company = text(input.company, 'Company', { max: 200 });
  const values = [name, company, text(input.email, 'Email', { max: 200 })?.toLowerCase() || null, text(input.phone, 'Phone', { max: 40 }), text(input.gstin, 'GSTIN', { max: 20 }), text(input.city, 'City', { max: 80 })];
  if (input.id) {
    const rows = await q.query('UPDATE ops_customers SET name=$2, company=$3, email=$4, phone=$5, gstin=$6, city=$7 WHERE id=$1 RETURNING *', [id(input.id), ...values]);
    if (!rows[0]) throw notFound('Customer');
    return rows[0];
  }
  // The portal slug is readable but carries a random suffix; access still requires the customer's own login.
  const slug = `${slugify(company || name).slice(0, 40) || 'customer'}-${crypto.randomBytes(4).toString('hex')}`;
  const rows = await q.query('INSERT INTO ops_customers (name, company, email, phone, gstin, city, portal_slug) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [...values, slug]);
  await event(q, ctx, { entityType: 'customer', entityId: rows[0].id, action: 'created', message: `Customer ${company || name} added` });
  return rows[0];
});

command('supplier.save', 'supplier.manage', async (q, input, ctx) => {
  const values = [text(input.name, 'Supplier name', { required: true, max: 200 }), text(input.contact, 'Contact'), text(input.email, 'Email')?.toLowerCase() || null, text(input.phone, 'Phone'), text(input.gstin, 'GSTIN'), text(input.brands, 'Brands'), text(input.paymentTerms, 'Payment terms'), input.leadTimeDays === '' || input.leadTimeDays == null ? null : Math.max(0, Math.round(Number(input.leadTimeDays)) || 0), input.active !== false];
  if (input.id) {
    const rows = await q.query('UPDATE ops_suppliers SET name=$2, contact=$3, email=$4, phone=$5, gstin=$6, brands=$7, payment_terms=$8, lead_time_days=$9, active=$10 WHERE id=$1 RETURNING *', [id(input.id), ...values]);
    if (!rows[0]) throw notFound('Supplier');
    return rows[0];
  }
  const rows = await q.query('INSERT INTO ops_suppliers (name, contact, email, phone, gstin, brands, payment_terms, lead_time_days, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', values);
  await event(q, ctx, { entityType: 'supplier', entityId: rows[0].id, action: 'created', message: `Supplier ${values[0]} added` });
  return rows[0];
});

command('user.save', 'user.manage', async (q, input, ctx) => {
  const role = String(input.role || '');
  if (!ROLES[role]) throw bad('Choose a valid role');
  const email = text(input.email, 'Email', { required: true, max: 200 }).toLowerCase();
  const name = text(input.name, 'Name', { required: true, max: 120 });
  const customerId = role === 'customer' ? id(input.customerId, 'Customer') : null;
  const dup = await q.query('SELECT id FROM ops_users WHERE lower(email) = $1 AND id <> $2', [email, Number(input.id) || 0]);
  if (dup[0]) throw conflict(`${email} already has an account`);
  if (input.id) {
    const rows = await q.query('UPDATE ops_users SET email=$2, name=$3, role=$4, customer_id=$5, active=$6 WHERE id=$1 RETURNING id, email, name, role, customer_id, active', [id(input.id), email, name, role, customerId, input.active !== false]);
    if (!rows[0]) throw notFound('User');
    await event(q, ctx, { entityType: 'user', entityId: rows[0].id, action: 'updated', message: `${email}: ${role}${input.active === false ? ' (deactivated)' : ''}` });
    let password;
    if (input.resetPassword) {
      password = generatePassword();
      await q.query('UPDATE ops_users SET password_hash = $2 WHERE id = $1', [rows[0].id, hashUserPassword(password)]);
    }
    return { ...rows[0], password };
  }
  const password = input.password ? String(input.password) : generatePassword();
  if (password.length < 10) throw bad('Password must be at least 10 characters');
  const rows = await q.query('INSERT INTO ops_users (email, name, role, customer_id, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, customer_id, active', [email, name, role, customerId, hashUserPassword(password)]);
  await event(q, ctx, { entityType: 'user', entityId: rows[0].id, action: 'created', message: `${email} added as ${role}` });
  // The generated password is returned once so it can be handed over; only its hash is stored.
  return { ...rows[0], password: input.password ? undefined : password };
});

command('customer.invite', 'customer.manage', async (q, input, ctx) => {
  const customer = await one(q, 'SELECT * FROM ops_customers WHERE id = $1', [id(input.customerId, 'Customer')], 'Customer');
  const email = text(input.email || customer.email, 'Email', { required: true }).toLowerCase();
  const dup = await q.query('SELECT id FROM ops_users WHERE lower(email) = $1', [email]);
  if (dup[0]) throw conflict(`${email} already has an account`);
  const password = generatePassword();
  const rows = await q.query("INSERT INTO ops_users (email, name, role, customer_id, password_hash) VALUES ($1,$2,'customer',$3,$4) RETURNING id, email, name, role, customer_id", [email, text(input.name, 'Name') || customer.name, customer.id, hashUserPassword(password)]);
  await event(q, ctx, { entityType: 'customer', entityId: customer.id, action: 'portal_invited', message: `Portal access created for ${email}` });
  return { ...rows[0], password, portalSlug: customer.portal_slug };
});

// Inventory
command('stock.adjust', 'stock.adjust', async (q, input, ctx) => {
  const itemId = id(input.itemId, 'Item');
  const counted = money(input.onHand, 'Counted quantity');
  const note = text(input.note, 'Reason', { required: true });
  const row = await lockStock(q, itemId);
  const reserved = num(row.production_reserved) + num(row.customer_reserved);
  if (counted < reserved) throw conflict(`${row.sku}: ${reserved} units are reserved. Release reservations before recording a count below that.`);
  const delta = round(counted - num(row.on_hand), 3);
  if (delta === 0) return row;
  await moveStock(q, ctx, itemId, { onHand: delta }, { kind: 'adjustment', note });
  await event(q, ctx, { entityType: 'item', entityId: itemId, action: 'stock_adjusted', message: `${row.sku} counted at ${counted} (${delta > 0 ? '+' : ''}${delta}): ${note}` });
  return { itemId, delta };
});

// Production demand: allocate free stock up to the requirement, or release allocation above it.
command('production.plan', 'production.plan', async (q, input, ctx) => {
  const itemId = id(input.itemId, 'Item');
  const required = money(input.required, 'Production requirement');
  const row = await lockStock(q, itemId);
  const position = stockPosition(row);
  const target = Math.min(required, position.productionReserved + Math.max(0, position.atp));
  const delta = round(target - position.productionReserved, 3);
  await q.query('UPDATE ops_stock SET production_required = $2 WHERE item_id = $1', [itemId, required]);
  if (delta !== 0) await moveStock(q, ctx, itemId, { production: delta }, { kind: delta > 0 ? 'production_allocate' : 'production_release', note: text(input.note, 'Note') });
  await event(q, ctx, { entityType: 'item', entityId: itemId, action: 'production_planned', message: `${row.sku}: production needs ${required}, allocated ${target}` });
  return { itemId, required, allocated: target, shortfall: round(required - target, 3) };
});

command('production.replenish', 'production.plan', async (q, input, ctx) => {
  const itemId = id(input.itemId, 'Item');
  const row = await lockStock(q, itemId);
  const open = await q.query("SELECT COALESCE(SUM(qty),0) AS qty FROM ops_procurement_requests WHERE item_id = $1 AND reason = 'replenish_production' AND status NOT IN ('received','cancelled')", [itemId]);
  const need = round(stockPosition(row).productionShortfall - num(open[0].qty), 3);
  if (need <= 0) throw conflict(`${row.sku}: production shortfall is already covered by open requests`);
  return createPr(q, ctx, { itemId, qty: need, reason: 'replenish_production' });
});

// Trading: enquiries
async function writeEnquiryLines(q, enquiryId, lines) {
  if (!Array.isArray(lines)) return;
  await q.query('DELETE FROM ops_enquiry_lines WHERE enquiry_id = $1', [enquiryId]);
  for (const line of lines) {
    await q.query('INSERT INTO ops_enquiry_lines (enquiry_id, item_id, qty, target_price) VALUES ($1,$2,$3,$4)', [enquiryId, id(line.itemId, 'Item'), qty(line.qty), money(line.targetPrice, 'Target price', { required: false })]);
  }
}

async function insertEnquiry(q, ctx, { customerId, title, source, legacyId = null, notes = null, dueAt = null, lines = [] }) {
  const number = await nextNumber(q, 'ENQ');
  const rows = await q.query(
    `INSERT INTO ops_enquiries (number, customer_id, title, source, legacy_enquiry_id, notes, owner, due_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [number, customerId, title, source, legacyId, notes, ctx.user.role === 'customer' ? null : ctx.actor, dueAt],
  );
  await writeEnquiryLines(q, rows[0].id, lines);
  await event(q, ctx, { entityType: 'enquiry', entityId: rows[0].id, enquiryId: rows[0].id, action: 'created', to: 'open', message: `${number} received via ${source}` });
  return rows[0];
}

command('enquiry.create', 'enquiry.manage', async (q, input, ctx) => {
  const customer = await one(q, 'SELECT id FROM ops_customers WHERE id = $1', [id(input.customerId, 'Customer')], 'Customer');
  return insertEnquiry(q, ctx, {
    customerId: customer.id,
    title: text(input.title, 'Title', { required: true, max: 200 }),
    source: ['manual', 'email', 'phone', 'website', 'portal'].includes(input.source) ? input.source : 'manual',
    notes: text(input.notes, 'Notes', { max: 5000 }),
    dueAt: date(input.dueAt, 'Due date'),
    lines: input.lines || [],
  });
});

// Contact-form messages become trading enquiries; the customer is matched on email or created.
command('enquiry.importWeb', 'enquiry.manage', async (q, input, ctx) => {
  const web = await one(q, 'SELECT * FROM acs_enquiries WHERE id = $1', [id(input.legacyId, 'Website enquiry')], 'Website enquiry');
  const existing = await q.query('SELECT id, number FROM ops_enquiries WHERE legacy_enquiry_id = $1', [web.id]);
  if (existing[0]) throw conflict(`Already moved to trading as ${existing[0].number}`);
  let customer = (await q.query('SELECT * FROM ops_customers WHERE lower(email) = lower($1) ORDER BY id LIMIT 1', [web.email]))[0];
  if (!customer) customer = await commands['customer.save'].run(q, { name: `${web.first_name} ${web.last_name}`.trim(), email: web.email }, ctx);
  const enquiry = await insertEnquiry(q, ctx, { customerId: customer.id, title: web.subject, source: 'website', legacyId: web.id, notes: web.message });
  await q.query("UPDATE acs_enquiries SET admin_notes = trim(both from concat(admin_notes, E'\\n', $2::text)), updated_at = now() WHERE id = $1", [web.id, `Moved to Trading as ${enquiry.number}`]);
  return enquiry;
});

command('enquiry.update', 'enquiry.manage', async (q, input, ctx) => {
  const enquiry = await enquiryFor(q, id(input.id, 'Enquiry'));
  if (enquiry.status === 'won') throw conflict(`${enquiry.number} already has an order; change the order instead`);
  await q.query('UPDATE ops_enquiries SET title = COALESCE($2, title), notes = $3, due_at = $4, updated_at = now() WHERE id = $1', [enquiry.id, text(input.title, 'Title', { max: 200 }), text(input.notes, 'Notes', { max: 5000 }), date(input.dueAt, 'Due date')]);
  if (input.lines) await writeEnquiryLines(q, enquiry.id, input.lines);
  await event(q, ctx, { entityType: 'enquiry', entityId: enquiry.id, enquiryId: enquiry.id, action: 'updated', message: `${enquiry.number} details updated` });
  return enquiry;
});

command('enquiry.setStatus', 'enquiry.manage', async (q, input, ctx) => {
  const enquiry = await enquiryFor(q, id(input.id, 'Enquiry'));
  const status = String(input.status);
  if (!['open', 'on_hold', 'lost'].includes(status)) throw bad('Status must be open, on hold or lost');
  if (enquiry.status === 'won') throw conflict(`${enquiry.number} has an order; cancel the order instead`);
  const reason = text(input.reason, 'Reason');
  if (status === 'lost' && !reason) throw bad('Say why the enquiry was lost');
  await q.query('UPDATE ops_enquiries SET status = $2, lost_reason = $3, updated_at = now() WHERE id = $1', [enquiry.id, status, status === 'lost' ? reason : null]);
  if (status === 'lost') {
    await q.query("UPDATE ops_procurement_requests SET status = 'cancelled', updated_at = now() WHERE enquiry_id = $1 AND order_line_id IS NULL AND status IN ('open','rfq','quoted','selected')", [enquiry.id]);
  }
  await event(q, ctx, { entityType: 'enquiry', entityId: enquiry.id, enquiryId: enquiry.id, action: 'status', from: enquiry.status, to: status, message: reason || null });
  return { id: enquiry.id, status };
});

// Trading asks Purchasing for supplier prices or stock it does not have.
command('sourcing.request', 'procurement.request', async (q, input, ctx) => {
  const enquiry = await enquiryFor(q, id(input.enquiryId, 'Enquiry'));
  if (enquiry.status !== 'open') throw conflict(`${enquiry.number} is ${enquiry.status}`);
  const reason = input.reason === 'pricing' ? 'pricing' : 'shortfall';
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (!lines.length) throw bad('Choose at least one line to source');
  const created = [];
  for (const line of lines) {
    const itemId = id(line.itemId, 'Item');
    const dup = await q.query("SELECT number FROM ops_procurement_requests WHERE enquiry_id = $1 AND item_id = $2 AND order_line_id IS NULL AND status NOT IN ('cancelled','received')", [enquiry.id, itemId]);
    if (dup[0]) throw conflict(`${dup[0].number} is already sourcing this item for ${enquiry.number}`);
    created.push(await createPr(q, ctx, { itemId, qty: qty(line.qty), reason, enquiryId: enquiry.id, neededBy: date(input.neededBy, 'Needed by') }));
  }
  return created;
});

// Trading: quotations
async function defaultUnitCost(q, enquiryId, itemId) {
  const offer = await q.query(
    `SELECT o.unit_price, o.freight, pr.qty FROM ops_procurement_requests pr JOIN ops_supplier_offers o ON o.id = pr.selected_offer_id
      WHERE pr.enquiry_id = $1 AND pr.item_id = $2 AND pr.status <> 'cancelled' ORDER BY pr.id DESC LIMIT 1`,
    [enquiryId, itemId],
  );
  if (offer[0]) return round(num(offer[0].unit_price) + num(offer[0].freight) / Math.max(1, num(offer[0].qty)));
  const stock = await q.query('SELECT s.avg_cost, i.standard_cost FROM ops_items i LEFT JOIN ops_stock s ON s.item_id = i.id WHERE i.id = $1', [itemId]);
  const value = stock[0]?.avg_cost ?? stock[0]?.standard_cost;
  return value === null || value === undefined ? null : num(value);
}

command('quotation.save', 'quotation.manage', async (q, input, ctx) => {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (!lines.length) throw bad('A quotation needs at least one line');
  let quotation;
  let enquiry;
  if (input.id) {
    quotation = await one(q, 'SELECT * FROM ops_quotations WHERE id = $1 FOR UPDATE', [id(input.id)], 'Quotation');
    if (quotation.status !== 'draft') throw conflict(`${quotation.number} is ${quotation.status}; create a new revision instead`);
    enquiry = await enquiryFor(q, quotation.enquiry_id);
    await q.query('UPDATE ops_quotations SET valid_until = $2, notes = $3, updated_at = now() WHERE id = $1', [quotation.id, date(input.validUntil, 'Valid until', { required: true }), text(input.notes, 'Notes', { max: 5000 })]);
    await q.query('DELETE FROM ops_quotation_lines WHERE quotation_id = $1', [quotation.id]);
  } else {
    enquiry = await enquiryFor(q, id(input.enquiryId, 'Enquiry'));
    if (enquiry.status !== 'open') throw conflict(`${enquiry.number} is ${enquiry.status.replace('_', ' ')}`);
    const live = await q.query("SELECT id, number, status FROM ops_quotations WHERE enquiry_id = $1 AND status IN ('draft','in_review','approved','sent','revision_requested')", [enquiry.id]);
    for (const old of live) {
      await q.query("UPDATE ops_quotations SET status = 'superseded', updated_at = now() WHERE id = $1", [old.id]);
      await withdrawApprovals(q, ctx, 'quotation', 'quotation', old.id, 'Superseded by a new revision');
      await event(q, ctx, { entityType: 'quotation', entityId: old.id, enquiryId: enquiry.id, action: 'status', from: old.status, to: 'superseded', message: `${old.number} superseded` });
    }
    const version = num((await q.query('SELECT COALESCE(MAX(version),0) AS v FROM ops_quotations WHERE enquiry_id = $1', [enquiry.id]))[0].v) + 1;
    const number = `${enquiry.number.replace(/^ENQ/, 'QT')}-R${version}`;
    quotation = (await q.query(
      'INSERT INTO ops_quotations (number, enquiry_id, version, valid_until, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [number, enquiry.id, version, date(input.validUntil, 'Valid until', { required: true }), text(input.notes, 'Notes', { max: 5000 }), ctx.actor],
    ))[0];
    await event(q, ctx, { entityType: 'quotation', entityId: quotation.id, enquiryId: enquiry.id, action: 'created', to: 'draft', message: `${number} drafted` });
  }
  for (const line of lines) {
    const itemId = id(line.itemId, 'Item');
    const source = ['stock', 'reallocate', 'procure'].includes(line.source) ? line.source : 'stock';
    const unitCost = line.unitCost === '' || line.unitCost == null ? await defaultUnitCost(q, enquiry.id, itemId) : money(line.unitCost, 'Unit cost');
    await q.query(
      'INSERT INTO ops_quotation_lines (quotation_id, item_id, qty, unit_price, unit_cost, tax_rate, source) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [quotation.id, itemId, qty(line.qty), money(line.unitPrice, 'Unit price'), unitCost, money(line.taxRate ?? 18, 'Tax rate'), source],
    );
  }
  return quotation;
});

async function lockedQuotation(q, quotationId) {
  const quotation = await one(q, 'SELECT * FROM ops_quotations WHERE id = $1 FOR UPDATE', [quotationId], 'Quotation');
  const lines = await q.query('SELECT * FROM ops_quotation_lines WHERE quotation_id = $1 ORDER BY id', [quotation.id]);
  return { quotation, lines };
}

async function setQuotationStatus(q, ctx, quotation, to, extra = {}, message = null) {
  const sets = ['status = $2', 'updated_at = now()'];
  const params = [quotation.id, to];
  for (const [column, value] of Object.entries(extra)) {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  await q.query(`UPDATE ops_quotations SET ${sets.join(', ')} WHERE id = $1`, params);
  await event(q, ctx, { entityType: 'quotation', entityId: quotation.id, enquiryId: quotation.enquiry_id, action: 'status', from: quotation.status, to, message: message || `${quotation.number} ${to.replace(/_/g, ' ')}` });
}

command('quotation.submit', 'quotation.manage', async (q, input, ctx) => {
  const { quotation, lines } = await lockedQuotation(q, id(input.id, 'Quotation'));
  if (quotation.status !== 'draft') throw conflict(`${quotation.number} is ${quotation.status}`);
  const totals = lineTotals(lines, { withCost: true });
  await setQuotationStatus(q, ctx, quotation, 'in_review');
  const marginText = totals.marginPct === null ? 'cost incomplete' : `margin ${totals.marginPct}%`;
  await requestApproval(q, ctx, { kind: 'quotation', refType: 'quotation', refId: quotation.id, enquiryId: quotation.enquiry_id, summary: `${quotation.number}: ₹${totals.total.toLocaleString('en-IN')} incl. tax, ${marginText}`, payload: { total: totals.total, marginPct: totals.marginPct } });
  return quotation;
});

command('quotation.send', 'quotation.manage', async (q, input, ctx) => {
  const { quotation } = await lockedQuotation(q, id(input.id, 'Quotation'));
  if (quotation.status !== 'approved') throw conflict(`${quotation.number} must be approved before it is sent (it is ${quotation.status.replace('_', ' ')})`);
  await setQuotationStatus(q, ctx, quotation, 'sent', { sent_at: new Date().toISOString() }, `${quotation.number} sent to customer`);
  return quotation;
});

// Customer decision: from the portal (the customer's own quotation only) or recorded by Trading for an
// offline reply. Acceptance creates exactly one order per enquiry.
command('quotation.decide', null, async (q, input, ctx) => {
  const { quotation, lines } = await lockedQuotation(q, id(input.id, 'Quotation'));
  const enquiry = await enquiryFor(q, quotation.enquiry_id);
  if (ctx.user.role === 'customer') {
    if (enquiry.customer_id !== ctx.user.customerId) throw notFound('Quotation');
  } else {
    requirePermission(ctx.user, 'quotation.manage');
  }
  if (quotation.status !== 'sent') throw conflict(`${quotation.number} is ${quotation.status.replace('_', ' ')} and cannot be answered`);
  const decision = String(input.decision);
  const comment = text(input.comment, 'Comment', { max: 2000 });
  if (decision === 'revise') {
    if (!comment) throw bad('Tell us what to change');
    await setQuotationStatus(q, ctx, quotation, 'revision_requested', { customer_comment: comment, decided_at: new Date().toISOString() }, `Revision requested: ${comment}`);
    return { status: 'revision_requested' };
  }
  if (decision === 'reject') {
    await setQuotationStatus(q, ctx, quotation, 'rejected', { customer_comment: comment, decided_at: new Date().toISOString() }, `${quotation.number} declined${comment ? `: ${comment}` : ''}`);
    return { status: 'rejected' };
  }
  if (decision !== 'accept') throw bad('Decision must be accept, reject or revise');
  if (quotation.valid_until && new Date(quotation.valid_until) < new Date(new Date().toISOString().slice(0, 10))) throw conflict(`${quotation.number} expired on ${new Date(quotation.valid_until).toISOString().slice(0, 10)}; request a revision`);
  const existing = await q.query('SELECT number FROM ops_orders WHERE enquiry_id = $1', [enquiry.id]);
  if (existing[0]) throw conflict(`${enquiry.number} already has order ${existing[0].number}`);
  await setQuotationStatus(q, ctx, quotation, 'accepted', { customer_comment: comment, decided_at: new Date().toISOString() }, `${quotation.number} accepted`);
  const number = await nextNumber(q, 'SO');
  const order = (await q.query('INSERT INTO ops_orders (number, quotation_id, enquiry_id, customer_id) VALUES ($1,$2,$3,$4) RETURNING *', [number, quotation.id, enquiry.id, enquiry.customer_id]))[0];
  for (const line of lines) {
    await q.query('INSERT INTO ops_order_lines (order_id, item_id, qty, unit_price, tax_rate, source) VALUES ($1,$2,$3,$4,$5,$6)', [order.id, line.item_id, line.qty, line.unit_price, line.tax_rate, line.source]);
  }
  await q.query("UPDATE ops_enquiries SET status = 'won', updated_at = now() WHERE id = $1", [enquiry.id]);
  await event(q, ctx, { entityType: 'order', entityId: order.id, enquiryId: enquiry.id, action: 'created', to: 'pending_confirmation', message: `${number} created from ${quotation.number}` });
  return order;
});

// Approvals: one decision endpoint, permission depends on what is being approved.
command('approval.decide', null, async (q, input, ctx) => {
  const approval = await one(q, 'SELECT * FROM ops_approvals WHERE id = $1 FOR UPDATE', [id(input.id, 'Approval')], 'Approval');
  requirePermission(ctx.user, APPROVAL_PERMISSION[approval.kind]);
  if (approval.status !== 'pending') throw conflict(`Already ${approval.status}`);
  const approve = input.decision === 'approve';
  if (!approve && input.decision !== 'reject') throw bad('Decision must be approve or reject');
  const note = text(input.note, 'Note');
  if (!approve && !note) throw bad('Give a reason for rejecting');
  let enquiryId = null;

  if (approval.kind === 'quotation') {
    const { quotation } = await lockedQuotation(q, approval.ref_id);
    enquiryId = quotation.enquiry_id;
    if (quotation.status !== 'in_review') throw conflict(`${quotation.number} is no longer in review`);
    if (approve) await setQuotationStatus(q, ctx, quotation, 'approved', { approved_by: ctx.actor, review_note: note }, `${quotation.number} approved by ${ctx.actor}`);
    else await setQuotationStatus(q, ctx, quotation, 'draft', { review_note: note }, `${quotation.number} returned for changes: ${note}`);
  }

  if (approval.kind === 'reallocation') {
    const { orderLineId, itemId, qty: amount } = approval.payload;
    const line = await one(q, 'SELECT * FROM ops_order_lines WHERE id = $1 FOR UPDATE', [orderLineId], 'Order line');
    const order = await one(q, 'SELECT * FROM ops_orders WHERE id = $1', [line.order_id], 'Order');
    enquiryId = order.enquiry_id;
    if (approve) {
      if (order.status === 'cancelled') throw conflict(`${order.number} was cancelled`);
      const stock = await lockStock(q, itemId);
      if (num(stock.production_reserved) < amount) throw conflict(`${stock.sku}: only ${num(stock.production_reserved)} units are allocated to production now`);
      await moveStock(q, ctx, itemId, { production: -amount, customer: amount }, { kind: 'reallocation', refType: 'order_line', refId: line.id, note: `Production → ${order.number}` });
      await q.query('UPDATE ops_order_lines SET reserved_qty = reserved_qty + $2 WHERE id = $1', [line.id, amount]);
      await createPr(q, ctx, { itemId, qty: amount, reason: 'replenish_production' });
      await refreshOrderStatus(q, ctx, order.id);
    }
  }

  if (approval.kind === 'purchase_order') {
    const po = await one(q, 'SELECT * FROM ops_purchase_orders WHERE id = $1 FOR UPDATE', [approval.ref_id], 'Purchase order');
    const pr = await one(q, 'SELECT * FROM ops_procurement_requests WHERE id = $1 FOR UPDATE', [po.pr_id], 'Procurement request');
    enquiryId = await enquiryOfPr(q, pr);
    if (po.status !== 'pending_approval') throw conflict(`${po.number} is ${po.status}`);
    if (approve) {
      await q.query("UPDATE ops_purchase_orders SET status = 'approved', approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1", [po.id, ctx.actor]);
      await q.query("UPDATE ops_procurement_requests SET status = 'ordered', updated_at = now() WHERE id = $1", [pr.id]);
      await moveStock(q, ctx, po.item_id, { incoming: num(po.qty) }, { kind: 'po_incoming', refType: 'purchase_order', refId: po.id });
    } else {
      await q.query("UPDATE ops_purchase_orders SET status = 'rejected', updated_at = now() WHERE id = $1", [po.id]);
    }
    await event(q, ctx, { entityType: 'purchase_order', entityId: po.id, enquiryId, action: 'status', from: po.status, to: approve ? 'approved' : 'rejected', message: `${po.number} ${approve ? 'approved' : `rejected: ${note}`}` });
  }

  await q.query('UPDATE ops_approvals SET status = $2, decided_by = $3, decided_at = now(), note = $4 WHERE id = $1', [approval.id, approve ? 'approved' : 'rejected', ctx.actor, note]);
  await event(q, ctx, { entityType: 'approval', entityId: approval.id, enquiryId, action: 'decided', from: 'pending', to: approve ? 'approved' : 'rejected', message: `${approval.summary} — ${approve ? 'approved' : 'rejected'}${note ? `: ${note}` : ''}` });
  return { id: approval.id, status: approve ? 'approved' : 'rejected' };
});

async function enquiryOfPr(q, pr) {
  if (pr.enquiry_id) return pr.enquiry_id;
  if (!pr.order_line_id) return null;
  const rows = await q.query('SELECT o.enquiry_id FROM ops_order_lines l JOIN ops_orders o ON o.id = l.order_id WHERE l.id = $1', [pr.order_line_id]);
  return rows[0]?.enquiry_id ?? null;
}

// Orders
async function sourceLine(q, ctx, order, line, mode) {
  const need = await lineUncovered(q, line);
  if (need <= 0) return null;
  if (mode === 'reallocate') {
    return requestApproval(q, ctx, {
      kind: 'reallocation', refType: 'order_line', refId: line.id, enquiryId: order.enquiry_id,
      summary: `Reallocate ${need} units of item #${line.item_id} from production to ${order.number}`,
      payload: { orderLineId: line.id, itemId: line.item_id, qty: need },
    });
  }
  // Reuse the enquiry's sourcing request for this item if Purchasing has not ordered it yet.
  const reusable = (await q.query(
    "SELECT * FROM ops_procurement_requests WHERE enquiry_id = $1 AND item_id = $2 AND order_line_id IS NULL AND status IN ('open','rfq','quoted','selected') ORDER BY id LIMIT 1 FOR UPDATE",
    [order.enquiry_id, line.item_id],
  ))[0];
  if (reusable) {
    await q.query("UPDATE ops_procurement_requests SET order_line_id = $2, qty = $3, reason = 'shortfall', updated_at = now() WHERE id = $1", [reusable.id, line.id, need]);
    await event(q, ctx, { entityType: 'procurement', entityId: reusable.id, enquiryId: order.enquiry_id, action: 'linked', message: `${reusable.number} now buys ${need} units for ${order.number}` });
    return reusable;
  }
  return createPr(q, ctx, { itemId: line.item_id, qty: need, reason: 'shortfall', enquiryId: order.enquiry_id, orderLineId: line.id });
}

command('order.confirm', 'order.confirm', async (q, input, ctx) => {
  const { order, lines } = await orderWithLines(q, id(input.id, 'Order'));
  if (order.status !== 'pending_confirmation') throw conflict(`${order.number} is already ${order.status.replace(/_/g, ' ')}`);
  const note = text(input.note, 'Confirmation note', { required: true });
  await q.query("UPDATE ops_orders SET status = 'confirmed', confirmation_note = $2, confirmed_by = $3, confirmed_at = now(), updated_at = now() WHERE id = $1", [order.id, note, ctx.actor]);
  await event(q, ctx, { entityType: 'order', entityId: order.id, enquiryId: order.enquiry_id, action: 'status', from: order.status, to: 'confirmed', message: `${order.number} confirmed: ${note}` });
  const outcome = [];
  for (const line of lines) {
    let reserved = 0;
    if (line.source !== 'procure') {
      const position = stockPosition(await lockStock(q, line.item_id));
      reserved = round(Math.min(Math.max(0, position.atp), num(line.qty)), 3);
      if (reserved > 0) {
        await moveStock(q, ctx, line.item_id, { customer: reserved }, { kind: 'reserve_customer', refType: 'order_line', refId: line.id, note: order.number });
        await q.query('UPDATE ops_order_lines SET reserved_qty = reserved_qty + $2 WHERE id = $1', [line.id, reserved]);
        line.reserved_qty = num(line.reserved_qty) + reserved;
      }
    }
    const sourced = await sourceLine(q, ctx, order, line, line.source === 'reallocate' ? 'reallocate' : 'procure');
    outcome.push({ lineId: line.id, reserved, sourcedBy: sourced ? (sourced.kind ? 'reallocation approval' : sourced.number) : null });
  }
  await refreshOrderStatus(q, ctx, order.id);
  return { id: order.id, lines: outcome };
});

// After a rejected reallocation or a supplier failure, Trading re-sources what is still uncovered.
command('order.sourceLine', 'order.confirm', async (q, input, ctx) => {
  const line = await one(q, 'SELECT * FROM ops_order_lines WHERE id = $1 FOR UPDATE', [id(input.lineId, 'Order line')], 'Order line');
  const { order } = await orderWithLines(q, line.order_id);
  if (['pending_confirmation', 'cancelled'].includes(order.status)) throw conflict(`${order.number} is ${order.status.replace(/_/g, ' ')}`);
  const result = await sourceLine(q, ctx, order, line, input.mode === 'reallocate' ? 'reallocate' : 'procure');
  if (!result) throw conflict('Nothing left to source on this line');
  return result;
});

command('order.cancel', 'order.confirm', async (q, input, ctx) => {
  const { order, lines } = await orderWithLines(q, id(input.id, 'Order'));
  if (['cancelled', 'delivered', 'dispatched'].includes(order.status)) throw conflict(`${order.number} is ${order.status}`);
  const reason = text(input.reason, 'Reason', { required: true });
  const active = await q.query("SELECT number FROM ops_shipments WHERE order_id = $1 AND status IN ('shipped','exception')", [order.id]);
  if (active[0] && lines.every((l) => num(l.dispatched_qty) === 0)) throw conflict(`${active[0].number} is on its way; resolve it first`);
  for (const line of lines) {
    const reserved = num(line.reserved_qty);
    if (reserved > 0) await moveStock(q, ctx, line.item_id, { customer: -reserved }, { kind: 'release', refType: 'order_line', refId: line.id, note: `${order.number} cancelled` });
    const remaining = round(num(line.qty) - num(line.dispatched_qty) - num(line.cancelled_qty), 3);
    await q.query('UPDATE ops_order_lines SET reserved_qty = 0, cancelled_qty = cancelled_qty + $2 WHERE id = $1', [line.id, remaining]);
    await q.query("UPDATE ops_procurement_requests SET status = 'cancelled', updated_at = now() WHERE order_line_id = $1 AND status IN ('open','rfq','quoted','selected')", [line.id]);
    // Purchases already placed still arrive; they become free stock instead of being allocated to this order.
    await q.query("UPDATE ops_procurement_requests SET order_line_id = NULL, reason = 'reorder', updated_at = now() WHERE order_line_id = $1 AND status = 'ordered'", [line.id]);
    await withdrawApprovals(q, ctx, 'reallocation', 'order_line', line.id, `${order.number} cancelled`);
  }
  await q.query("UPDATE ops_shipments SET status = 'cancelled', updated_at = now() WHERE order_id = $1 AND status IN ('planned','packed')", [order.id]);
  const shippedAny = lines.some((l) => num(l.dispatched_qty) > 0);
  await q.query('UPDATE ops_orders SET status = $2, cancelled_reason = $3, updated_at = now() WHERE id = $1', [order.id, shippedAny ? order.status : 'cancelled', reason]);
  await event(q, ctx, { entityType: 'order', entityId: order.id, enquiryId: order.enquiry_id, action: shippedAny ? 'cancelled_remainder' : 'status', from: order.status, to: shippedAny ? order.status : 'cancelled', message: `${order.number} ${shippedAny ? 'remaining quantity cancelled' : 'cancelled'}: ${reason}` });
  if (shippedAny) await refreshOrderStatus(q, ctx, order.id);
  return { id: order.id };
});

// Purchasing
async function lockedPr(q, prId) {
  return one(q, 'SELECT * FROM ops_procurement_requests WHERE id = $1 FOR UPDATE', [prId], 'Procurement request');
}

command('pr.rfq', 'procurement.manage', async (q, input, ctx) => {
  const pr = await lockedPr(q, id(input.prId, 'Procurement request'));
  if (!['open', 'rfq', 'quoted'].includes(pr.status)) throw conflict(`${pr.number} is ${pr.status}`);
  const supplierIds = (input.supplierIds || []).map((s) => id(s, 'Supplier'));
  if (!supplierIds.length) throw bad('Choose at least one supplier');
  for (const supplierId of supplierIds) {
    await one(q, 'SELECT id FROM ops_suppliers WHERE id = $1 AND active', [supplierId], 'Supplier');
    await q.query('INSERT INTO ops_rfqs (pr_id, supplier_id, sent_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [pr.id, supplierId, ctx.actor]);
  }
  if (pr.status === 'open') await q.query("UPDATE ops_procurement_requests SET status = 'rfq', updated_at = now() WHERE id = $1", [pr.id]);
  await event(q, ctx, { entityType: 'procurement', entityId: pr.id, enquiryId: await enquiryOfPr(q, pr), action: 'rfq', from: pr.status, to: pr.status === 'open' ? 'rfq' : pr.status, message: `${pr.number}: RFQ to ${supplierIds.length} supplier(s)` });
  return { id: pr.id };
});

command('offer.record', 'procurement.manage', async (q, input, ctx) => {
  const pr = await lockedPr(q, id(input.prId, 'Procurement request'));
  if (!['open', 'rfq', 'quoted', 'selected'].includes(pr.status)) throw conflict(`${pr.number} is ${pr.status}`);
  const supplier = await one(q, 'SELECT * FROM ops_suppliers WHERE id = $1', [id(input.supplierId, 'Supplier')], 'Supplier');
  const leadTime = Number(input.leadTimeDays);
  if (!Number.isInteger(leadTime) || leadTime < 0) throw bad('Lead time must be whole days');
  const offer = (await q.query(
    `INSERT INTO ops_supplier_offers (pr_id, supplier_id, unit_price, freight, tax_rate, lead_time_days, available_qty, valid_until, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [pr.id, supplier.id, money(input.unitPrice, 'Unit price'), money(input.freight ?? 0, 'Freight'), money(input.taxRate ?? 18, 'Tax rate'), leadTime, money(input.availableQty, 'Available quantity', { required: false }), date(input.validUntil, 'Valid until'), text(input.notes, 'Notes'), ctx.actor],
  ))[0];
  if (['open', 'rfq'].includes(pr.status)) await q.query("UPDATE ops_procurement_requests SET status = 'quoted', updated_at = now() WHERE id = $1", [pr.id]);
  await event(q, ctx, { entityType: 'procurement', entityId: pr.id, enquiryId: await enquiryOfPr(q, pr), action: 'offer', message: `${pr.number}: offer from ${supplier.name} at ₹${num(offer.unit_price)} / unit, ${leadTime} days` });
  return offer;
});

command('pr.select', 'procurement.manage', async (q, input, ctx) => {
  const pr = await lockedPr(q, id(input.prId, 'Procurement request'));
  if (!['quoted', 'selected'].includes(pr.status)) throw conflict(`${pr.number} is ${pr.status}`);
  const offers = await q.query('SELECT o.*, s.name AS supplier_name FROM ops_supplier_offers o JOIN ops_suppliers s ON s.id = o.supplier_id WHERE o.pr_id = $1', [pr.id]);
  const ranked = rankOffers(offers, { qty: pr.qty, reliability: await reliabilityBySupplier(q) });
  const chosen = ranked.find((o) => o.id === Number(input.offerId));
  if (!chosen) throw notFound('Offer');
  const note = text(input.note, 'Reason');
  // Choosing anything but the top-ranked offer needs a written reason for the audit trail.
  if (chosen.rank !== 1 && !note) throw bad(`This offer ranks #${chosen.rank}; give a reason for choosing it`);
  await q.query("UPDATE ops_procurement_requests SET status = 'selected', selected_offer_id = $2, selection_note = $3, updated_at = now() WHERE id = $1", [pr.id, chosen.id, note]);
  await event(q, ctx, { entityType: 'procurement', entityId: pr.id, enquiryId: await enquiryOfPr(q, pr), action: 'selected', from: pr.status, to: 'selected', message: `${pr.number}: ${chosen.supplier_name} selected at landed ₹${chosen.landedUnitCost} / unit (score ${chosen.score}, rank ${chosen.rank})${note ? ` — ${note}` : ''}` });
  return chosen;
});

command('po.create', 'procurement.manage', async (q, input, ctx) => {
  const pr = await lockedPr(q, id(input.prId, 'Procurement request'));
  if (pr.status !== 'selected') throw conflict(`${pr.number} needs a selected supplier offer first`);
  const active = await q.query("SELECT number FROM ops_purchase_orders WHERE pr_id = $1 AND status NOT IN ('rejected','cancelled')", [pr.id]);
  if (active[0]) throw conflict(`${active[0].number} already exists for ${pr.number}`);
  const offer = await one(q, 'SELECT o.*, s.name AS supplier_name FROM ops_supplier_offers o JOIN ops_suppliers s ON s.id = o.supplier_id WHERE o.id = $1', [pr.selected_offer_id], 'Offer');
  const landed = round(num(offer.unit_price) + num(offer.freight) / Math.max(1, num(pr.qty)));
  const expected = date(input.expectedAt, 'Expected date') || new Date(Date.now() + offer.lead_time_days * 86400000).toISOString().slice(0, 10);
  const number = await nextNumber(q, 'PO');
  const po = (await q.query(
    `INSERT INTO ops_purchase_orders (number, pr_id, offer_id, supplier_id, item_id, qty, unit_price, landed_unit_cost, tax_rate, expected_at, original_expected_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11) RETURNING *`,
    [number, pr.id, offer.id, offer.supplier_id, pr.item_id, pr.qty, offer.unit_price, landed, offer.tax_rate, expected, ctx.actor],
  ))[0];
  const enquiryId = await enquiryOfPr(q, pr);
  await event(q, ctx, { entityType: 'purchase_order', entityId: po.id, enquiryId, action: 'created', to: 'pending_approval', message: `${number} drafted for ${offer.supplier_name}` });
  await requestApproval(q, ctx, { kind: 'purchase_order', refType: 'purchase_order', refId: po.id, enquiryId, summary: `${number}: ${num(pr.qty)} units from ${offer.supplier_name}, ₹${round(landed * num(pr.qty)).toLocaleString('en-IN')} landed`, payload: { value: round(landed * num(pr.qty)) } });
  return po;
});

// Goods receipt is the only purchasing step that changes on-hand stock. Received units go to whatever
// the request was for (a customer order line or production); anything beyond that stays free stock.
command('po.receive', 'po.receive', async (q, input, ctx) => {
  const po = await one(q, 'SELECT * FROM ops_purchase_orders WHERE id = $1 FOR UPDATE', [id(input.poId, 'Purchase order')], 'Purchase order');
  if (!['approved', 'partially_received'].includes(po.status)) throw conflict(`${po.number} is ${po.status.replace('_', ' ')}; it cannot be received`);
  const amount = qty(input.qty, 'Received quantity');
  const outstanding = round(num(po.qty) - num(po.received_qty), 3);
  if (amount > outstanding) throw conflict(`${po.number}: only ${outstanding} units are outstanding`);
  const pr = await lockedPr(q, po.pr_id);
  const note = text(input.note, 'Note');
  await q.query('INSERT INTO ops_receipts (po_id, qty, note, received_by) VALUES ($1,$2,$3,$4)', [po.id, amount, note, ctx.actor]);
  await moveStock(q, ctx, po.item_id, { onHand: amount, incoming: -amount }, { kind: 'receipt', refType: 'purchase_order', refId: po.id, note, unitCost: num(po.landed_unit_cost) });

  let allocated = 0;
  if (pr.reason === 'replenish_production') {
    const position = stockPosition(await lockStock(q, po.item_id));
    allocated = round(Math.min(amount, position.productionShortfall, Math.max(0, position.atp)), 3);
    if (allocated > 0) await moveStock(q, ctx, po.item_id, { production: allocated }, { kind: 'production_allocate', refType: 'purchase_order', refId: po.id });
  } else if (pr.order_line_id) {
    const line = await one(q, 'SELECT * FROM ops_order_lines WHERE id = $1 FOR UPDATE', [pr.order_line_id], 'Order line');
    const need = round(num(line.qty) - num(line.cancelled_qty) - num(line.reserved_qty) - num(line.dispatched_qty), 3);
    allocated = round(Math.min(amount, Math.max(0, need)), 3);
    if (allocated > 0) {
      await moveStock(q, ctx, po.item_id, { customer: allocated }, { kind: 'reserve_customer', refType: 'order_line', refId: line.id, note: po.number });
      await q.query('UPDATE ops_order_lines SET reserved_qty = reserved_qty + $2 WHERE id = $1', [line.id, allocated]);
    }
  }
  const received = round(num(po.received_qty) + amount, 3);
  const status = received >= num(po.qty) ? 'received' : 'partially_received';
  await q.query('UPDATE ops_purchase_orders SET received_qty = $2, status = $3, updated_at = now() WHERE id = $1', [po.id, received, status]);
  if (status === 'received') await q.query("UPDATE ops_procurement_requests SET status = 'received', updated_at = now() WHERE id = $1", [pr.id]);
  const enquiryId = await enquiryOfPr(q, pr);
  await event(q, ctx, { entityType: 'purchase_order', entityId: po.id, enquiryId, action: 'received', from: po.status, to: status, message: `${po.number}: received ${amount} (${received}/${num(po.qty)})${allocated ? `, ${allocated} allocated` : ''}` });
  if (pr.order_line_id) {
    const line = await one(q, 'SELECT order_id FROM ops_order_lines WHERE id = $1', [pr.order_line_id], 'Order line');
    await refreshOrderStatus(q, ctx, line.order_id);
  }
  return { id: po.id, status, allocated };
});

command('po.delay', 'procurement.manage', async (q, input, ctx) => {
  const po = await one(q, 'SELECT * FROM ops_purchase_orders WHERE id = $1 FOR UPDATE', [id(input.poId, 'Purchase order')], 'Purchase order');
  if (!['approved', 'partially_received', 'pending_approval'].includes(po.status)) throw conflict(`${po.number} is ${po.status}`);
  const expected = date(input.expectedAt, 'New expected date', { required: true });
  const note = text(input.note, 'Reason', { required: true });
  await q.query('UPDATE ops_purchase_orders SET expected_at = $2, delay_note = $3, updated_at = now() WHERE id = $1', [po.id, expected, note]);
  const pr = await lockedPr(q, po.pr_id);
  await event(q, ctx, { entityType: 'purchase_order', entityId: po.id, enquiryId: await enquiryOfPr(q, pr), action: 'supplier_delay', message: `${po.number} now expected ${expected}: ${note}`, data: { from: po.expected_at, to: expected } });
  return { id: po.id };
});

command('po.cancel', 'procurement.manage', async (q, input, ctx) => {
  const po = await one(q, 'SELECT * FROM ops_purchase_orders WHERE id = $1 FOR UPDATE', [id(input.poId, 'Purchase order')], 'Purchase order');
  if (!['pending_approval', 'approved'].includes(po.status) || num(po.received_qty) > 0) throw conflict(`${po.number} cannot be cancelled (${po.status.replace('_', ' ')})`);
  const reason = text(input.reason, 'Reason', { required: true });
  if (po.status === 'approved') await moveStock(q, ctx, po.item_id, { incoming: -num(po.qty) }, { kind: 'po_cancelled', refType: 'purchase_order', refId: po.id, note: reason });
  await q.query("UPDATE ops_purchase_orders SET status = 'cancelled', updated_at = now() WHERE id = $1", [po.id]);
  await withdrawApprovals(q, ctx, 'purchase_order', 'purchase_order', po.id, reason);
  const pr = await lockedPr(q, po.pr_id);
  if (pr.status === 'ordered') await q.query("UPDATE ops_procurement_requests SET status = 'selected', updated_at = now() WHERE id = $1", [pr.id]);
  await event(q, ctx, { entityType: 'purchase_order', entityId: po.id, enquiryId: await enquiryOfPr(q, pr), action: 'status', from: po.status, to: 'cancelled', message: `${po.number} cancelled: ${reason}` });
  return { id: po.id };
});

// Dispatch
async function lockedShipment(q, shipmentId) {
  const shipment = await one(q, 'SELECT * FROM ops_shipments WHERE id = $1 FOR UPDATE', [shipmentId], 'Shipment');
  const lines = await q.query('SELECT sl.*, l.item_id FROM ops_shipment_lines sl JOIN ops_order_lines l ON l.id = sl.order_line_id WHERE sl.shipment_id = $1', [shipment.id]);
  const order = await one(q, 'SELECT * FROM ops_orders WHERE id = $1', [shipment.order_id], 'Order');
  return { shipment, lines, order };
}

async function setShipmentStatus(q, ctx, shipment, order, to, extra = {}, message = null) {
  const sets = ['status = $2', 'updated_at = now()'];
  const params = [shipment.id, to];
  for (const [column, value] of Object.entries(extra)) {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  await q.query(`UPDATE ops_shipments SET ${sets.join(', ')} WHERE id = $1`, params);
  await event(q, ctx, { entityType: 'shipment', entityId: shipment.id, enquiryId: order.enquiry_id, action: 'status', from: shipment.status, to, message: message || `${shipment.number} ${to}` });
}

command('shipment.create', 'dispatch.manage', async (q, input, ctx) => {
  const { order, lines } = await orderWithLines(q, id(input.orderId, 'Order'));
  if (['pending_confirmation', 'cancelled', 'delivered', 'dispatched'].includes(order.status)) throw conflict(`${order.number} is ${order.status.replace(/_/g, ' ')}`);
  const picks = (input.lines || []).filter((l) => Number(l.qty) > 0);
  if (!picks.length) throw bad('Choose quantities to dispatch');
  const number = await nextNumber(q, 'DSP');
  const shipment = (await q.query(
    'INSERT INTO ops_shipments (number, order_id, warehouse, carrier, planned_at, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [number, order.id, text(input.warehouse, 'Warehouse') || 'Main store', text(input.carrier, 'Carrier'), date(input.plannedAt, 'Planned date') || new Date().toISOString().slice(0, 10), ctx.actor],
  ))[0];
  for (const pick of picks) {
    const line = lines.find((l) => l.id === Number(pick.orderLineId));
    if (!line) throw notFound('Order line');
    const planned = num((await q.query("SELECT COALESCE(SUM(sl.qty),0) AS qty FROM ops_shipment_lines sl JOIN ops_shipments s ON s.id = sl.shipment_id WHERE sl.order_line_id = $1 AND s.status IN ('planned','packed') AND s.id <> $2", [line.id, shipment.id]))[0].qty);
    const free = round(num(line.reserved_qty) - planned, 3);
    const amount = qty(pick.qty);
    if (amount > free) throw conflict(`Only ${Math.max(0, free)} reserved units of line #${line.id} are free to dispatch`);
    await q.query('INSERT INTO ops_shipment_lines (shipment_id, order_line_id, qty) VALUES ($1,$2,$3)', [shipment.id, line.id, amount]);
  }
  await event(q, ctx, { entityType: 'shipment', entityId: shipment.id, enquiryId: order.enquiry_id, action: 'created', to: 'planned', message: `${number} planned for ${order.number}` });
  return shipment;
});

command('shipment.pack', 'dispatch.manage', async (q, input, ctx) => {
  const { shipment, order } = await lockedShipment(q, id(input.id, 'Shipment'));
  if (shipment.status !== 'planned') throw conflict(`${shipment.number} is ${shipment.status}`);
  await setShipmentStatus(q, ctx, shipment, order, 'packed');
  return { id: shipment.id };
});

command('shipment.ship', 'dispatch.manage', async (q, input, ctx) => {
  const { shipment, lines, order } = await lockedShipment(q, id(input.id, 'Shipment'));
  if (!['planned', 'packed'].includes(shipment.status)) throw conflict(`${shipment.number} is ${shipment.status}`);
  const carrier = text(input.carrier, 'Carrier') || shipment.carrier;
  if (!carrier) throw bad('Carrier / transporter is required');
  for (const sl of lines) {
    const line = await one(q, 'SELECT * FROM ops_order_lines WHERE id = $1 FOR UPDATE', [sl.order_line_id], 'Order line');
    if (num(line.reserved_qty) < num(sl.qty)) throw conflict(`Line #${line.id}: only ${num(line.reserved_qty)} units reserved`);
    await moveStock(q, ctx, line.item_id, { onHand: -num(sl.qty), customer: -num(sl.qty) }, { kind: 'dispatch', refType: 'shipment', refId: shipment.id, note: shipment.number });
    await q.query('UPDATE ops_order_lines SET reserved_qty = reserved_qty - $2, dispatched_qty = dispatched_qty + $2 WHERE id = $1', [line.id, num(sl.qty)]);
  }
  await setShipmentStatus(q, ctx, shipment, order, 'shipped', { carrier, tracking_no: text(input.trackingNo, 'Tracking number'), shipped_at: new Date().toISOString() }, `${shipment.number} shipped via ${carrier}${input.trackingNo ? ` (${input.trackingNo})` : ''}`);
  await refreshOrderStatus(q, ctx, order.id);
  return { id: shipment.id };
});

command('shipment.deliver', 'dispatch.manage', async (q, input, ctx) => {
  const { shipment, lines, order } = await lockedShipment(q, id(input.id, 'Shipment'));
  const shipped = shipment.status === 'shipped' || (shipment.status === 'exception' && shipment.exception_from === 'shipped');
  if (!shipped) throw conflict(`${shipment.number} has not been shipped`);
  for (const sl of lines) await q.query('UPDATE ops_order_lines SET delivered_qty = delivered_qty + $2 WHERE id = $1', [sl.order_line_id, num(sl.qty)]);
  await setShipmentStatus(q, ctx, shipment, order, 'delivered', { delivered_at: new Date().toISOString(), received_by: text(input.receivedBy, 'Received by') }, `${shipment.number} delivered${input.receivedBy ? `, received by ${input.receivedBy}` : ''}`);
  await refreshOrderStatus(q, ctx, order.id);
  return { id: shipment.id };
});

command('shipment.exception', 'dispatch.manage', async (q, input, ctx) => {
  const { shipment, order } = await lockedShipment(q, id(input.id, 'Shipment'));
  if (!['planned', 'packed', 'shipped'].includes(shipment.status)) throw conflict(`${shipment.number} is ${shipment.status}`);
  const note = text(input.note, 'What went wrong', { required: true });
  await setShipmentStatus(q, ctx, shipment, order, 'exception', { exception_note: note, exception_from: shipment.status }, `${shipment.number} exception: ${note}`);
  return { id: shipment.id };
});

command('shipment.resolve', 'dispatch.manage', async (q, input, ctx) => {
  const { shipment, order } = await lockedShipment(q, id(input.id, 'Shipment'));
  if (shipment.status !== 'exception') throw conflict(`${shipment.number} has no open exception`);
  await setShipmentStatus(q, ctx, shipment, order, shipment.exception_from || 'planned', { exception_from: null }, `${shipment.number} exception resolved${input.note ? `: ${input.note}` : ''}`);
  return { id: shipment.id };
});

command('shipment.cancel', 'dispatch.manage', async (q, input, ctx) => {
  const { shipment, order } = await lockedShipment(q, id(input.id, 'Shipment'));
  const unshipped = ['planned', 'packed'].includes(shipment.status) || (shipment.status === 'exception' && shipment.exception_from !== 'shipped');
  if (!unshipped) throw conflict(`${shipment.number} has left the warehouse; record delivery or an exception instead`);
  await setShipmentStatus(q, ctx, shipment, order, 'cancelled');
  return { id: shipment.id };
});

// Comments: staff notes are internal; customers can only comment on their own enquiry.
command('comment.add', null, async (q, input, ctx) => {
  const entityType = ['enquiry', 'quotation', 'order', 'procurement', 'purchase_order', 'shipment'].includes(input.entityType) ? input.entityType : null;
  if (!entityType) throw bad('Unknown record type');
  const entityId = id(input.entityId);
  const body = text(input.body, 'Comment', { required: true, max: 4000 });
  if (ctx.user.role === 'customer') {
    if (entityType !== 'enquiry') throw new OpsError(403, 'Not allowed');
    await one(q, 'SELECT id FROM ops_enquiries WHERE id = $1 AND customer_id = $2', [entityId, ctx.user.customerId], 'Enquiry');
  } else if (!['director', 'trading', 'purchase', 'dispatch'].includes(ctx.user.role)) {
    throw new OpsError(403, 'Not allowed');
  }
  const internal = ctx.user.role === 'customer' ? false : input.internal !== false;
  const rows = await q.query('INSERT INTO ops_comments (entity_type, entity_id, body, internal, author) VALUES ($1,$2,$3,$4,$5) RETURNING *', [entityType, entityId, body, internal, ctx.actor]);
  return rows[0];
});

// Customer portal: a customer raises a new enquiry for themselves.
command('portal.enquiry', 'portal.use', async (q, input, ctx) => {
  return insertEnquiry(q, ctx, {
    customerId: ctx.user.customerId,
    title: text(input.title, 'What do you need', { required: true, max: 200 }),
    source: 'portal',
    notes: text(input.details, 'Details', { max: 5000 }),
  });
});

async function execute(db, user, action, input = {}) {
  const entry = commands[action];
  if (!entry) throw bad(`Unknown action: ${action}`);
  if (!user) throw new OpsError(401, 'Sign in required');
  if (entry.permission) requirePermission(user, entry.permission);
  const ctx = { user, actor: user.email };
  return db.tx((q) => entry.run(q, input || {}, ctx));
}

module.exports = { execute, commands, can };
