// Read models for each workspace. Everything is computed from the transactional tables on request, so
// every figure on screen traces back to records; supplier costs are stripped unless the role may see them.
const { OpsError, requirePermission, can, permissionsFor, ROLES } = require('./rbac');
const { num, round, stockPosition, fulfilmentOptions, rankOffers, lineTotals, enquiryStage, STAGES } = require('./rules');

const DAY = 86400000;
const iso = (d) => (d ? new Date(d).toISOString() : null);
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

function byId(rows, key = 'id') {
  return new Map(rows.map((row) => [row[key], row]));
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

function itemView(row) {
  return { id: row.id, sku: row.sku, name: row.name, brand: row.brand, category: row.category, uom: row.uom, reorderLevel: num(row.reorder_level), standardCost: row.standard_cost === null ? null : num(row.standard_cost) };
}

function customerView(row) {
  return row && { id: row.id, name: row.name, company: row.company, email: row.email, phone: row.phone, gstin: row.gstin, city: row.city, portalSlug: row.portal_slug, label: row.company || row.name };
}

function quoteLineView(row, items, withCost) {
  const line = { id: row.id, itemId: row.item_id, item: items.get(row.item_id) ? itemView(items.get(row.item_id)) : null, qty: num(row.qty), unitPrice: num(row.unit_price), taxRate: num(row.tax_rate), source: row.source, amount: round(num(row.qty) * num(row.unit_price)) };
  if (withCost) line.unitCost = row.unit_cost === null ? null : num(row.unit_cost);
  return line;
}

function quotationView(row, lines, items, withCost) {
  return {
    id: row.id, number: row.number, enquiryId: row.enquiry_id, version: row.version, status: row.status,
    validUntil: row.valid_until ? dayKey(row.valid_until) : null, currency: row.currency, notes: row.notes,
    reviewNote: withCost ? row.review_note : undefined, customerComment: row.customer_comment,
    createdBy: withCost ? row.created_by : undefined, approvedBy: withCost ? row.approved_by : undefined,
    sentAt: iso(row.sent_at), decidedAt: iso(row.decided_at), createdAt: iso(row.created_at),
    lines: lines.map((l) => quoteLineView(l, items, withCost)),
    totals: lineTotals(lines, { withCost }),
  };
}

function eventView(row) {
  return { id: row.id, entityType: row.entity_type, entityId: row.entity_id, enquiryId: row.enquiry_id, action: row.action, from: row.from_status, to: row.to_status, message: row.message, actor: row.actor, at: iso(row.created_at) };
}

async function loadItems(db) {
  const rows = await db.query('SELECT i.*, s.on_hand, s.production_required, s.production_reserved, s.customer_reserved, s.incoming, s.avg_cost FROM ops_items i LEFT JOIN ops_stock s ON s.item_id = i.id ORDER BY i.sku');
  return byId(rows);
}

async function reliability(db) {
  const rows = await db.query(
    `SELECT po.supplier_id,
            COUNT(*)::int AS received,
            COUNT(*) FILTER (WHERE (SELECT MAX(r.received_at)::date FROM ops_receipts r WHERE r.po_id = po.id) <= COALESCE(po.original_expected_at, po.expected_at))::int AS on_time,
            AVG((SELECT MAX(r.received_at)::date FROM ops_receipts r WHERE r.po_id = po.id) - po.created_at::date)::float AS avg_days
       FROM ops_purchase_orders po WHERE po.status = 'received' GROUP BY po.supplier_id`,
  );
  return new Map(rows.map((r) => [r.supplier_id, { received: r.received, onTime: r.received ? r.on_time / r.received : null, avgDays: r.avg_days === null ? null : round(r.avg_days, 1) }]));
}

// ---------- Pipeline (shared by trading and the command center) ----------

async function pipeline(db, { customerId = null } = {}) {
  const params = customerId ? [customerId] : [];
  const where = customerId ? 'WHERE e.customer_id = $1' : '';
  const enquiries = await db.query(`SELECT e.*, c.company, c.name AS customer_name FROM ops_enquiries e JOIN ops_customers c ON c.id = e.customer_id ${where} ORDER BY e.created_at DESC`, params);
  if (!enquiries.length) return [];
  const ids = enquiries.map((e) => e.id);
  const [quotes, quoteLines, prs, orders, orderLines, lastEvents, pendingApprovals] = await Promise.all([
    db.query('SELECT * FROM ops_quotations WHERE enquiry_id = ANY($1) ORDER BY version DESC', [ids]),
    db.query('SELECT ql.* FROM ops_quotation_lines ql JOIN ops_quotations q ON q.id = ql.quotation_id WHERE q.enquiry_id = ANY($1)', [ids]),
    db.query("SELECT enquiry_id, COUNT(*)::int AS n FROM ops_procurement_requests WHERE enquiry_id = ANY($1) AND order_line_id IS NULL AND status IN ('open','rfq','quoted') GROUP BY enquiry_id", [ids]),
    db.query('SELECT * FROM ops_orders WHERE enquiry_id = ANY($1)', [ids]),
    db.query('SELECT l.* FROM ops_order_lines l JOIN ops_orders o ON o.id = l.order_id WHERE o.enquiry_id = ANY($1)', [ids]),
    db.query('SELECT enquiry_id, MAX(created_at) AS at FROM ops_events WHERE enquiry_id = ANY($1) GROUP BY enquiry_id', [ids]),
    db.query(`SELECT a.*, COALESCE(q.enquiry_id, o.enquiry_id) AS enquiry_id FROM ops_approvals a
                LEFT JOIN ops_quotations q ON a.ref_type = 'quotation' AND q.id = a.ref_id
                LEFT JOIN ops_order_lines l ON a.ref_type = 'order_line' AND l.id = a.ref_id
                LEFT JOIN ops_orders o ON o.id = l.order_id
               WHERE a.status = 'pending'`),
  ]);
  const latestQuote = new Map();
  for (const q of quotes) if (!latestQuote.has(q.enquiry_id)) latestQuote.set(q.enquiry_id, q);
  const qLines = groupBy(quoteLines, 'quotation_id');
  const sourcing = new Map(prs.map((r) => [r.enquiry_id, r.n]));
  const orderBy = byId(orders, 'enquiry_id');
  const oLines = groupBy(orderLines, 'order_id');
  const touched = new Map(lastEvents.map((r) => [r.enquiry_id, r.at]));
  const approvalsBy = groupBy(pendingApprovals.filter((a) => a.enquiry_id), 'enquiry_id');

  return enquiries.map((e) => {
    const quote = latestQuote.get(e.id);
    const order = orderBy.get(e.id);
    const lines = order ? oLines.get(order.id) || [] : [];
    const stage = enquiryStage({ enquiry: e, latestQuotation: quote, openSourcing: sourcing.get(e.id) || 0, order, orderLines: lines });
    const value = order ? lineTotals(lines).subtotal : quote ? lineTotals(qLines.get(quote.id) || []).subtotal : null;
    const lastTouched = touched.get(e.id) || e.updated_at;
    return {
      id: e.id, number: e.number, title: e.title, status: e.status, source: e.source, owner: e.owner,
      customer: { id: e.customer_id, label: e.company || e.customer_name },
      stage, value, dueAt: iso(e.due_at), createdAt: iso(e.created_at), lastActivityAt: iso(lastTouched),
      quotation: quote ? { id: quote.id, number: quote.number, status: quote.status, validUntil: quote.valid_until ? dayKey(quote.valid_until) : null } : null,
      order: order ? { id: order.id, number: order.number, status: order.status } : null,
      pendingApprovals: (approvalsBy.get(e.id) || []).length,
      idleDays: Math.floor((Date.now() - new Date(lastTouched).getTime()) / DAY),
    };
  });
}

// ---------- Views ----------

const views = {};
function view(name, permission, run) {
  views[name] = { permission, run };
}

view('me', null, async (db, user) => ({
  user: { id: user.id, email: user.email, name: user.name, role: user.role, roleLabel: ROLES[user.role].label, customerId: user.customerId },
  permissions: permissionsFor(user.role),
  home: ROLES[user.role].home,
}));

view('catalog', null, async (db, user) => {
  if (user.role === 'customer') throw new OpsError(403, 'Not allowed');
  const [items, customers, suppliers] = await Promise.all([
    db.query('SELECT * FROM ops_items WHERE active ORDER BY sku'),
    can(user, 'view.trading') || can(user, 'view.dispatch') ? db.query('SELECT * FROM ops_customers ORDER BY coalesce(company, name)') : [],
    can(user, 'view.purchase') ? db.query('SELECT * FROM ops_suppliers ORDER BY name') : [],
  ]);
  return { items: items.map(itemView), customers: customers.map(customerView), suppliers: suppliers.map(supplierView) };
});

function supplierView(row, stats) {
  return { id: row.id, name: row.name, contact: row.contact, email: row.email, phone: row.phone, gstin: row.gstin, brands: row.brands, paymentTerms: row.payment_terms, leadTimeDays: row.lead_time_days, active: row.active, ...(stats ? { stats } : {}) };
}

view('trading', 'view.trading', async (db) => {
  const [enquiries, inbox, customers] = await Promise.all([
    pipeline(db),
    db.query('SELECT w.* FROM acs_enquiries w LEFT JOIN ops_enquiries e ON e.legacy_enquiry_id = w.id WHERE e.id IS NULL ORDER BY w.created_at DESC LIMIT 50'),
    db.query('SELECT c.*, (SELECT COUNT(*)::int FROM ops_enquiries e WHERE e.customer_id = c.id) AS enquiries, (SELECT COUNT(*)::int FROM ops_users u WHERE u.customer_id = c.id) AS portal_users FROM ops_customers c ORDER BY coalesce(c.company, c.name)'),
  ]);
  return {
    enquiries,
    inbox: inbox.map((w) => ({ id: Number(w.id), name: `${w.first_name} ${w.last_name}`.trim(), email: w.email, subject: w.subject, message: w.message, status: w.status, createdAt: iso(w.created_at) })),
    customers: customers.map((c) => ({ ...customerView(c), enquiries: c.enquiries, portalUsers: c.portal_users })),
  };
});

// Full lifecycle of one enquiry: lines with stock options, sourcing, quotations, order, shipments, history.
async function enquiryDetail(db, user, enquiryId, { customerScope = null } = {}) {
  const withCost = can(user, 'cost.view');
  const enquiry = (await db.query('SELECT * FROM ops_enquiries WHERE id = $1', [enquiryId]))[0];
  if (!enquiry || (customerScope && enquiry.customer_id !== customerScope)) throw new OpsError(404, 'Enquiry not found');
  const items = await loadItems(db);
  const [customer, lines, quotes, quoteLines, prs, offers, order, events, comments, approvals] = await Promise.all([
    db.query('SELECT * FROM ops_customers WHERE id = $1', [enquiry.customer_id]),
    db.query('SELECT * FROM ops_enquiry_lines WHERE enquiry_id = $1 ORDER BY id', [enquiry.id]),
    db.query('SELECT * FROM ops_quotations WHERE enquiry_id = $1 ORDER BY version DESC', [enquiry.id]),
    db.query('SELECT ql.* FROM ops_quotation_lines ql JOIN ops_quotations q ON q.id = ql.quotation_id WHERE q.enquiry_id = $1 ORDER BY ql.id', [enquiry.id]),
    db.query('SELECT pr.* FROM ops_procurement_requests pr LEFT JOIN ops_order_lines l ON l.id = pr.order_line_id LEFT JOIN ops_orders o ON o.id = l.order_id WHERE pr.enquiry_id = $1 OR o.enquiry_id = $1 ORDER BY pr.id', [enquiry.id]),
    db.query('SELECT o.*, s.name AS supplier_name FROM ops_supplier_offers o JOIN ops_suppliers s ON s.id = o.supplier_id JOIN ops_procurement_requests pr ON pr.id = o.pr_id LEFT JOIN ops_order_lines l ON l.id = pr.order_line_id LEFT JOIN ops_orders od ON od.id = l.order_id WHERE pr.enquiry_id = $1 OR od.enquiry_id = $1', [enquiry.id]),
    db.query('SELECT * FROM ops_orders WHERE enquiry_id = $1', [enquiry.id]),
    db.query('SELECT * FROM ops_events WHERE enquiry_id = $1 ORDER BY created_at DESC, id DESC', [enquiry.id]),
    db.query("SELECT * FROM ops_comments WHERE entity_type = 'enquiry' AND entity_id = $1 ORDER BY created_at", [enquiry.id]),
    db.query(`SELECT a.* FROM ops_approvals a
               LEFT JOIN ops_quotations q ON a.ref_type = 'quotation' AND q.id = a.ref_id
               LEFT JOIN ops_order_lines l ON a.ref_type = 'order_line' AND l.id = a.ref_id
               LEFT JOIN ops_orders o ON o.id = l.order_id
               LEFT JOIN ops_purchase_orders po ON a.ref_type = 'purchase_order' AND po.id = a.ref_id
               LEFT JOIN ops_procurement_requests pr ON pr.id = po.pr_id
              WHERE q.enquiry_id = $1 OR o.enquiry_id = $1 OR pr.enquiry_id = $1 ORDER BY a.requested_at DESC`, [enquiry.id]),
  ]);
  const qLines = groupBy(quoteLines, 'quotation_id');
  const offersByPr = groupBy(offers, 'pr_id');
  const rel = await reliability(db);
  const relMap = Object.fromEntries([...rel].map(([k, v]) => [k, v.onTime]));
  const orderRow = order[0];
  const visibleQuotes = customerScope ? quotes.filter((q) => !['draft', 'in_review', 'approved'].includes(q.status)) : quotes;

  const result = {
    enquiry: { id: enquiry.id, number: enquiry.number, title: enquiry.title, status: enquiry.status, source: enquiry.source, notes: enquiry.notes, lostReason: enquiry.lost_reason, owner: enquiry.owner, dueAt: iso(enquiry.due_at), createdAt: iso(enquiry.created_at), legacyEnquiryId: enquiry.legacy_enquiry_id ? Number(enquiry.legacy_enquiry_id) : null },
    customer: customerView(customer[0]),
    quotations: visibleQuotes.map((q) => quotationView(q, qLines.get(q.id) || [], items, withCost && !customerScope)),
    comments: comments.filter((c) => !customerScope || !c.internal).map((c) => ({ id: c.id, body: c.body, internal: c.internal, author: c.author, at: iso(c.created_at) })),
  };

  if (customerScope) {
    result.enquiry.owner = undefined;
    result.timeline = events
      .filter((e) => ['enquiry', 'order', 'shipment'].includes(e.entity_type) || (e.entity_type === 'quotation' && ['sent', 'accepted', 'rejected', 'revision_requested'].includes(e.to_status)))
      .map(eventView).map(({ actor, ...rest }) => rest);
  } else {
    result.lines = lines.map((l) => {
      const item = items.get(l.item_id);
      const position = stockPosition(item);
      const itemPrs = prs.filter((p) => p.item_id === l.item_id && p.status !== 'cancelled');
      const ranked = itemPrs.flatMap((p) => rankOffers(offersByPr.get(p.id) || [], { qty: p.qty, reliability: relMap }));
      const selected = itemPrs.map((p) => ranked.find((o) => o.id === p.selected_offer_id)).find(Boolean) || ranked[0];
      return {
        id: l.id, itemId: l.item_id, item: itemView(item), qty: num(l.qty), targetPrice: l.target_price === null ? null : num(l.target_price),
        stock: position,
        options: fulfilmentOptions(position, l.qty, { leadTimeDays: selected ? selected.lead_time_days : null, supplierName: selected?.supplier_name }),
        costHint: withCost ? (selected ? { source: `${selected.supplier_name} offer`, unitCost: selected.landedUnitCost, leadTimeDays: selected.lead_time_days } : item.avg_cost !== null ? { source: 'stock average', unitCost: num(item.avg_cost) } : item.standard_cost !== null ? { source: 'standard cost', unitCost: num(item.standard_cost) } : null) : undefined,
      };
    });
    result.sourcing = prs.map((p) => ({
      id: p.id, number: p.number, itemId: p.item_id, item: itemView(items.get(p.item_id)), qty: num(p.qty), reason: p.reason, status: p.status, orderLineId: p.order_line_id,
      offers: withCost ? rankOffers(offersByPr.get(p.id) || [], { qty: p.qty, reliability: relMap }).map((o) => offerView(o, p.selected_offer_id)) : [],
    }));
    result.approvals = approvals.map(approvalView);
    result.timeline = events.map(eventView);
  }

  if (orderRow) result.order = await orderDetail(db, orderRow, items, { customerScope });
  return result;
}

function offerView(o, selectedId) {
  return { id: o.id, supplierId: o.supplier_id, supplier: o.supplier_name, unitPrice: num(o.unit_price), freight: num(o.freight), taxRate: num(o.tax_rate), leadTimeDays: o.lead_time_days, availableQty: o.available_qty === null ? null : num(o.available_qty), validUntil: o.valid_until ? dayKey(o.valid_until) : null, landedUnitCost: o.landedUnitCost, landedTotal: o.landedTotal, score: o.score, rank: o.rank, parts: o.parts, flags: o.flags, remarks: o.notes, selected: o.id === selectedId };
}

function approvalView(a) {
  return { id: a.id, kind: a.kind, refType: a.ref_type, refId: a.ref_id, status: a.status, summary: a.summary, payload: a.payload, requestedBy: a.requested_by, requestedAt: iso(a.requested_at), decidedBy: a.decided_by, decidedAt: iso(a.decided_at), note: a.note, ageHours: Math.round((Date.now() - new Date(a.requested_at).getTime()) / 3600000) };
}

async function orderDetail(db, order, items, { customerScope = null } = {}) {
  const [lines, shipments, shipmentLines, inbound] = await Promise.all([
    db.query('SELECT * FROM ops_order_lines WHERE order_id = $1 ORDER BY id', [order.id]),
    db.query('SELECT * FROM ops_shipments WHERE order_id = $1 ORDER BY id', [order.id]),
    db.query('SELECT sl.* FROM ops_shipment_lines sl JOIN ops_shipments s ON s.id = sl.shipment_id WHERE s.order_id = $1', [order.id]),
    // What is already on its way to each line: open purchase requests (less what was received) and pending reallocations.
    db.query(`SELECT l.id,
                COALESCE((SELECT SUM(pr.qty - COALESCE((SELECT SUM(po.received_qty) FROM ops_purchase_orders po WHERE po.pr_id = pr.id AND po.status NOT IN ('cancelled','rejected')), 0))
                            FROM ops_procurement_requests pr WHERE pr.order_line_id = l.id AND pr.status NOT IN ('cancelled','received')), 0)
              + COALESCE((SELECT SUM((a.payload->>'qty')::numeric) FROM ops_approvals a WHERE a.kind = 'reallocation' AND a.status = 'pending' AND (a.payload->>'orderLineId')::int = l.id), 0) AS inbound
                FROM ops_order_lines l WHERE l.order_id = $1`, [order.id]),
  ]);
  const inboundBy = new Map(inbound.map((r) => [r.id, num(r.inbound)]));
  const slBy = groupBy(shipmentLines, 'shipment_id');
  const planned = new Map();
  for (const s of shipments.filter((s) => ['planned', 'packed'].includes(s.status))) {
    for (const sl of slBy.get(s.id) || []) planned.set(sl.order_line_id, (planned.get(sl.order_line_id) || 0) + num(sl.qty));
  }
  return {
    id: order.id, number: order.number, status: order.status, quotationId: order.quotation_id, enquiryId: order.enquiry_id, customerId: order.customer_id,
    confirmationNote: customerScope ? undefined : order.confirmation_note, confirmedAt: iso(order.confirmed_at), cancelledReason: order.cancelled_reason, createdAt: iso(order.created_at),
    lines: lines.map((l) => ({
      id: l.id, itemId: l.item_id, item: itemView(items.get(l.item_id)), qty: num(l.qty), unitPrice: num(l.unit_price), taxRate: num(l.tax_rate), source: l.source,
      reserved: num(l.reserved_qty), dispatched: num(l.dispatched_qty), delivered: num(l.delivered_qty), cancelled: num(l.cancelled_qty),
      freeToDispatch: round(num(l.reserved_qty) - (planned.get(l.id) || 0), 3),
      outstanding: round(num(l.qty) - num(l.cancelled_qty) - num(l.reserved_qty) - num(l.dispatched_qty), 3),
      uncovered: customerScope ? undefined : round(num(l.qty) - num(l.cancelled_qty) - num(l.reserved_qty) - num(l.dispatched_qty) - (inboundBy.get(l.id) || 0), 3),
    })),
    totals: lineTotals(lines),
    shipments: shipments.map((s) => shipmentView(s, slBy.get(s.id) || [], lines, items, customerScope)),
  };
}

function shipmentView(s, sLines, orderLines, items, customerScope) {
  const oLines = byId(orderLines);
  return {
    id: s.id, number: s.number, orderId: s.order_id, status: s.status, warehouse: customerScope ? undefined : s.warehouse, carrier: s.carrier, trackingNo: s.tracking_no,
    plannedAt: s.planned_at ? dayKey(s.planned_at) : null, shippedAt: iso(s.shipped_at), deliveredAt: iso(s.delivered_at), receivedBy: s.received_by,
    exceptionNote: s.exception_note, exceptionFrom: s.exception_from, createdAt: iso(s.created_at),
    lines: sLines.map((sl) => ({ orderLineId: sl.order_line_id, qty: num(sl.qty), item: itemView(items.get(oLines.get(sl.order_line_id)?.item_id)) })),
  };
}

view('enquiry', 'view.trading', async (db, user, params) => enquiryDetail(db, user, Number(params.id)));

view('purchase', 'view.purchase', async (db) => {
  const items = await loadItems(db);
  const rel = await reliability(db);
  const relMap = Object.fromEntries([...rel].map(([k, v]) => [k, v.onTime]));
  const [prs, offers, rfqs, pos, suppliers, spend] = await Promise.all([
    db.query(`SELECT pr.*, e.number AS enquiry_number, o.number AS order_number FROM ops_procurement_requests pr
               LEFT JOIN ops_enquiries e ON e.id = pr.enquiry_id
               LEFT JOIN ops_order_lines l ON l.id = pr.order_line_id LEFT JOIN ops_orders o ON o.id = l.order_id
              ORDER BY CASE WHEN pr.status IN ('received','cancelled') THEN 1 ELSE 0 END, pr.created_at DESC`),
    db.query('SELECT o.*, s.name AS supplier_name FROM ops_supplier_offers o JOIN ops_suppliers s ON s.id = o.supplier_id'),
    db.query('SELECT r.*, s.name AS supplier_name FROM ops_rfqs r JOIN ops_suppliers s ON s.id = r.supplier_id'),
    db.query('SELECT po.*, s.name AS supplier_name, pr.number AS pr_number FROM ops_purchase_orders po JOIN ops_suppliers s ON s.id = po.supplier_id JOIN ops_procurement_requests pr ON pr.id = po.pr_id ORDER BY po.created_at DESC'),
    db.query('SELECT * FROM ops_suppliers ORDER BY name'),
    db.query("SELECT supplier_id, SUM(qty * landed_unit_cost)::float AS value, COUNT(*)::int AS orders FROM ops_purchase_orders WHERE status NOT IN ('rejected','cancelled','pending_approval') GROUP BY supplier_id"),
  ]);
  const offersBy = groupBy(offers, 'pr_id');
  const rfqBy = groupBy(rfqs, 'pr_id');
  const spendBy = byId(spend, 'supplier_id');
  const today = dayKey(Date.now());
  return {
    requests: prs.map((p) => ({
      id: p.id, number: p.number, item: itemView(items.get(p.item_id)), stock: stockPosition(items.get(p.item_id)), qty: num(p.qty), reason: p.reason, status: p.status,
      enquiryId: p.enquiry_id, enquiryNumber: p.enquiry_number, orderNumber: p.order_number, neededBy: p.needed_by ? dayKey(p.needed_by) : null, requestedBy: p.requested_by, createdAt: iso(p.created_at), selectionNote: p.selection_note,
      rfqs: (rfqBy.get(p.id) || []).map((r) => ({ supplierId: r.supplier_id, supplier: r.supplier_name, sentAt: iso(r.sent_at) })),
      offers: rankOffers(offersBy.get(p.id) || [], { qty: p.qty, reliability: relMap }).map((o) => offerView(o, p.selected_offer_id)),
    })),
    orders: pos.map((po) => ({
      id: po.id, number: po.number, prId: po.pr_id, prNumber: po.pr_number, supplierId: po.supplier_id, supplier: po.supplier_name, item: itemView(items.get(po.item_id)), qty: num(po.qty), received: num(po.received_qty),
      unitPrice: num(po.unit_price), landedUnitCost: num(po.landed_unit_cost), value: round(num(po.qty) * num(po.landed_unit_cost)), taxRate: num(po.tax_rate), status: po.status,
      expectedAt: po.expected_at ? dayKey(po.expected_at) : null, originalExpectedAt: po.original_expected_at ? dayKey(po.original_expected_at) : null, delayNote: po.delay_note,
      overdue: ['approved', 'partially_received'].includes(po.status) && po.expected_at && dayKey(po.expected_at) < today,
      approvedBy: po.approved_by, createdAt: iso(po.created_at),
    })),
    suppliers: suppliers.map((s) => supplierView(s, { ...(rel.get(s.id) || { received: 0, onTime: null, avgDays: null }), spend: spendBy.get(s.id)?.value || 0, orders: spendBy.get(s.id)?.orders || 0 })),
  };
});

view('inventory', 'view.inventory', async (db, user) => {
  const items = await loadItems(db);
  const moves = await db.query('SELECT m.*, i.sku FROM ops_stock_moves m JOIN ops_items i ON i.id = m.item_id ORDER BY m.created_at DESC, m.id DESC LIMIT 200');
  const withCost = can(user, 'cost.view');
  return {
    items: [...items.values()].map((row) => ({ ...itemView(row), standardCost: withCost ? itemView(row).standardCost : undefined, avgCost: withCost && row.avg_cost !== null ? num(row.avg_cost) : undefined, stock: stockPosition(row) })),
    moves: moves.map((m) => ({ id: m.id, itemId: m.item_id, sku: m.sku, kind: m.kind, onHand: num(m.d_on_hand), production: num(m.d_production), customer: num(m.d_customer), incoming: num(m.d_incoming), refType: m.ref_type, refId: m.ref_id, note: m.note, actor: m.actor, at: iso(m.created_at) })),
  };
});

view('dispatch', 'view.dispatch', async (db) => {
  const items = await loadItems(db);
  const orders = await db.query("SELECT o.*, c.company, c.name AS customer_name, c.city FROM ops_orders o JOIN ops_customers c ON c.id = o.customer_id WHERE o.status <> 'pending_confirmation' ORDER BY o.created_at DESC");
  const details = await Promise.all(orders.map(async (o) => ({ ...(await orderDetail(db, o, items)), customer: { id: o.customer_id, label: o.company || o.customer_name, city: o.city } })));
  return { orders: details };
});

view('users', 'user.manage', async (db) => {
  const rows = await db.query('SELECT u.id, u.email, u.name, u.role, u.customer_id, u.active, u.last_login_at, u.created_at, c.company, c.name AS customer_name FROM ops_users u LEFT JOIN ops_customers c ON c.id = u.customer_id ORDER BY u.role, u.email');
  return { users: rows.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, customerId: u.customer_id, customer: u.customer_id ? (u.company || u.customer_name) : null, active: u.active, lastLoginAt: iso(u.last_login_at), createdAt: iso(u.created_at) })), roles: ROLES };
});

view('approvals', null, async (db, user) => {
  const rows = await db.query("SELECT * FROM ops_approvals WHERE status = 'pending' ORDER BY requested_at");
  const kinds = { quotation: 'quotation.approve', reallocation: 'reallocation.approve', purchase_order: 'po.approve' };
  return { approvals: rows.filter((a) => can(user, kinds[a.kind])).map(approvalView) };
});

// ---------- Director command center ----------

function weekStart(d) {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - day);
  return dayKey(date);
}

view('command', 'view.command', async (db, user, params) => {
  const to = params.to ? new Date(`${params.to}T23:59:59Z`) : new Date();
  const from = params.from ? new Date(`${params.from}T00:00:00Z`) : new Date(to.getTime() - 89 * DAY);
  const span = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - span);
  const today = dayKey(Date.now());

  const [deals, items, approvals, pos, shipments, quotes, quoteLines, events, rel, suppliers, enqCounts, orders] = await Promise.all([
    pipeline(db),
    loadItems(db),
    db.query("SELECT * FROM ops_approvals WHERE status = 'pending' ORDER BY requested_at"),
    db.query("SELECT po.*, s.name AS supplier_name FROM ops_purchase_orders po JOIN ops_suppliers s ON s.id = po.supplier_id WHERE po.status NOT IN ('rejected','cancelled')"),
    db.query('SELECT s.*, o.number AS order_number, o.enquiry_id FROM ops_shipments s JOIN ops_orders o ON o.id = s.order_id'),
    db.query('SELECT * FROM ops_quotations WHERE sent_at IS NOT NULL'),
    db.query('SELECT ql.* FROM ops_quotation_lines ql JOIN ops_quotations q ON q.id = ql.quotation_id WHERE q.sent_at IS NOT NULL'),
    db.query('SELECT * FROM ops_events ORDER BY created_at DESC, id DESC LIMIT 40'),
    reliability(db),
    db.query('SELECT id, name FROM ops_suppliers'),
    db.query('SELECT created_at, status FROM ops_enquiries'),
    db.query('SELECT o.*, (SELECT SUM(qty)::float FROM ops_order_lines WHERE order_id = o.id) AS qty, (SELECT SUM(reserved_qty + dispatched_qty)::float FROM ops_order_lines WHERE order_id = o.id) AS covered FROM ops_orders o'),
  ]);
  const qLines = groupBy(quoteLines, 'quotation_id');
  const inRange = (d, a = from, b = to) => d && new Date(d) >= a && new Date(d) <= b;
  const supplierName = byId(suppliers);

  // KPIs, each with the previous period of equal length for comparison.
  const kpi = (a, b) => ({ value: round(a), previous: round(b), change: b ? round(((a - b) / b) * 100, 1) : null });
  const sentValue = (a, b) => quotes.filter((q) => inRange(q.sent_at, a, b)).reduce((s, q) => s + lineTotals(qLines.get(q.id) || []).subtotal, 0);
  const wonValue = (a, b) => quotes.filter((q) => q.status === 'accepted' && inRange(q.decided_at, a, b)).reduce((s, q) => s + lineTotals(qLines.get(q.id) || []).subtotal, 0);
  const decided = (a, b) => quotes.filter((q) => ['accepted', 'rejected'].includes(q.status) && inRange(q.decided_at, a, b));
  const conversion = (a, b) => { const d = decided(a, b); return d.length ? (d.filter((q) => q.status === 'accepted').length / d.length) * 100 : 0; };
  const spendIn = (a, b) => pos.filter((p) => p.approved_at && inRange(p.approved_at, a, b)).reduce((s, p) => s + num(p.qty) * num(p.landed_unit_cost), 0);
  const delivered = (a, b) => shipments.filter((s) => s.status === 'delivered' && inRange(s.delivered_at, a, b)).length;

  const kpis = {
    enquiries: kpi(enqCounts.filter((e) => inRange(e.created_at)).length, enqCounts.filter((e) => inRange(e.created_at, prevFrom, from)).length),
    quotedValue: kpi(sentValue(from, to), sentValue(prevFrom, from)),
    wonValue: kpi(wonValue(from, to), wonValue(prevFrom, from)),
    conversionPct: { ...kpi(conversion(from, to), conversion(prevFrom, from)), basis: decided(from, to).length },
    procurementSpend: kpi(spendIn(from, to), spendIn(prevFrom, from)),
    deliveries: kpi(delivered(from, to), delivered(prevFrom, from)),
  };

  // Weekly series across the selected range.
  const weeks = [];
  for (let w = new Date(weekStart(from)); w <= to; w = new Date(w.getTime() + 7 * DAY)) weeks.push(dayKey(w));
  const series = weeks.map((week) => {
    const a = new Date(week);
    const b = new Date(a.getTime() + 7 * DAY - 1);
    return { week, enquiries: enqCounts.filter((e) => inRange(e.created_at, a, b)).length, quoted: round(sentValue(a, b)), won: round(wonValue(a, b)), spend: round(spendIn(a, b)) };
  });

  // Pipeline: count, value and stuck items per stage.
  const stages = STAGES.map((s) => {
    const cards = deals.filter((d) => d.stage === s.key);
    return { ...s, count: cards.length, value: round(cards.reduce((sum, d) => sum + (d.value || 0), 0)), cards };
  });
  const funnel = ['new', 'quoting', 'awaiting_customer', 'order_confirmation', 'delivered'].map((key) => ({ key, label: STAGES.find((s) => s.key === key).label }));
  const reached = (deal, key) => STAGES.findIndex((s) => s.key === deal.stage) >= STAGES.findIndex((s) => s.key === key) && deal.stage !== 'closed';
  const rangeDeals = deals.filter((d) => inRange(d.createdAt));
  funnel.forEach((f) => { f.count = rangeDeals.filter((d) => reached(d, f.key)).length; });

  // Stock health
  const stock = [...items.values()].map((row) => ({ ...itemView(row), stock: stockPosition(row) }));
  const stockHealth = {
    totals: stock.reduce((acc, i) => ({ onHand: acc.onHand + i.stock.onHand, production: acc.production + i.stock.productionReserved, customer: acc.customer + i.stock.customerReserved, free: acc.free + Math.max(0, i.stock.atp), incoming: acc.incoming + i.stock.incoming }), { onHand: 0, production: 0, customer: 0, free: 0, incoming: 0 }),
    items: stock.filter((i) => i.stock.onHand || i.stock.incoming || i.stock.productionRequired || i.reorderLevel).sort((a, b) => b.stock.onHand - a.stock.onHand).slice(0, 12),
    low: stock.filter((i) => i.stock.lowStock || i.stock.productionShortfall > 0),
  };

  // Supplier performance from actual purchase orders.
  const supplierPerf = [...rel].map(([sid, r]) => ({ supplierId: sid, supplier: supplierName.get(sid)?.name, ...r, spend: round(pos.filter((p) => p.supplier_id === sid && p.approved_at).reduce((s, p) => s + num(p.qty) * num(p.landed_unit_cost), 0)) }))
    .concat(suppliers.filter((s) => !rel.has(s.id) && pos.some((p) => p.supplier_id === s.id)).map((s) => ({ supplierId: s.id, supplier: s.name, received: 0, onTime: null, avgDays: null, spend: round(pos.filter((p) => p.supplier_id === s.id && p.approved_at).reduce((sum, p) => sum + num(p.qty) * num(p.landed_unit_cost), 0)) })))
    .sort((a, b) => b.spend - a.spend);

  // Fulfilment
  const activeOrders = orders.filter((o) => !['cancelled', 'pending_confirmation'].includes(o.status));
  const fulfilment = {
    byStatus: ['pending_confirmation', 'confirmed', 'ready', 'partially_dispatched', 'dispatched', 'delivered', 'cancelled'].map((status) => ({ status, count: orders.filter((o) => o.status === status).length })),
    fillRatePct: activeOrders.length ? round((activeOrders.reduce((s, o) => s + num(o.covered), 0) / Math.max(1, activeOrders.reduce((s, o) => s + num(o.qty), 0))) * 100, 1) : null,
  };

  // Exceptions that need a person.
  const alerts = [];
  for (const a of approvals) {
    const hours = (Date.now() - new Date(a.requested_at).getTime()) / 3600000;
    if (hours >= 24) alerts.push({ severity: hours >= 72 ? 'high' : 'medium', type: 'approval_overdue', module: a.kind === 'purchase_order' ? 'purchase' : 'trading', message: `${a.summary} — waiting ${Math.round(hours)} h`, ref: { type: 'approval', id: a.id } });
  }
  for (const p of pos.filter((p) => ['approved', 'partially_received'].includes(p.status) && p.expected_at && dayKey(p.expected_at) < today)) {
    alerts.push({ severity: 'high', type: 'supplier_late', module: 'purchase', message: `${p.number} from ${p.supplier_name} was due ${dayKey(p.expected_at)} (${num(p.received_qty)}/${num(p.qty)} received)`, ref: { type: 'purchase_order', id: p.id } });
  }
  for (const p of pos.filter((p) => p.original_expected_at && p.expected_at && dayKey(p.expected_at) > dayKey(p.original_expected_at) && !['received'].includes(p.status))) {
    alerts.push({ severity: 'medium', type: 'supplier_delay', module: 'purchase', message: `${p.number}: ${p.supplier_name} moved delivery ${dayKey(p.original_expected_at)} → ${dayKey(p.expected_at)}${p.delay_note ? ` (${p.delay_note})` : ''}`, ref: { type: 'purchase_order', id: p.id } });
  }
  for (const i of stockHealth.low) {
    if (i.stock.productionShortfall > 0) alerts.push({ severity: 'high', type: 'production_shortfall', module: 'inventory', message: `${i.sku}: production short by ${i.stock.productionShortfall} ${i.uom}`, ref: { type: 'item', id: i.id } });
    else alerts.push({ severity: 'medium', type: 'low_stock', module: 'inventory', message: `${i.sku}: ${i.stock.atp} free + ${i.stock.incoming} incoming, below reorder level ${i.reorderLevel}`, ref: { type: 'item', id: i.id } });
  }
  for (const s of shipments.filter((s) => s.status === 'exception')) alerts.push({ severity: 'high', type: 'dispatch_exception', module: 'dispatch', message: `${s.number} (${s.order_number}): ${s.exception_note}`, ref: { type: 'enquiry', id: s.enquiry_id } });
  for (const s of shipments.filter((s) => ['planned', 'packed'].includes(s.status) && s.planned_at && dayKey(s.planned_at) < today)) alerts.push({ severity: 'medium', type: 'dispatch_late', module: 'dispatch', message: `${s.number} (${s.order_number}) was planned for ${dayKey(s.planned_at)} and has not left`, ref: { type: 'enquiry', id: s.enquiry_id } });
  for (const d of deals.filter((d) => d.quotation?.status === 'sent' && d.quotation.validUntil && d.quotation.validUntil <= dayKey(Date.now() + 3 * DAY))) {
    alerts.push({ severity: d.quotation.validUntil < today ? 'medium' : 'low', type: 'quote_expiring', module: 'trading', message: `${d.quotation.number} for ${d.customer.label} ${d.quotation.validUntil < today ? 'expired' : 'expires'} ${d.quotation.validUntil}`, ref: { type: 'enquiry', id: d.id } });
  }
  for (const d of deals.filter((d) => ['new', 'quoting', 'sourcing', 'order_confirmation'].includes(d.stage) && d.status === 'open' && d.idleDays >= 3)) {
    alerts.push({ severity: d.idleDays >= 7 ? 'medium' : 'low', type: 'stalled', module: 'trading', message: `${d.number} (${d.customer.label}) idle ${d.idleDays} days at “${STAGES.find((s) => s.key === d.stage).label}”`, ref: { type: 'enquiry', id: d.id } });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // Where work is waiting: average days items have sat idle per stage.
  const bottlenecks = stages.filter((s) => !['delivered', 'closed'].includes(s.key) && s.count).map((s) => ({ key: s.key, label: s.label, module: s.module, count: s.count, avgIdleDays: round(s.cards.reduce((sum, c) => sum + c.idleDays, 0) / s.count, 1) })).sort((a, b) => b.avgIdleDays - a.avgIdleDays);

  // HR data lives in the existing admin tables; absent on a database the public site has never written to.
  let hr = null;
  try {
    const [apps, recent, positions] = await Promise.all([
      db.query('SELECT status, COUNT(*)::int AS n FROM acs_applications GROUP BY status ORDER BY status'),
      db.query('SELECT COUNT(*)::int AS n FROM acs_applications WHERE created_at >= $1 AND created_at <= $2', [from.toISOString(), to.toISOString()]),
      db.query("SELECT value FROM acs_admin_data WHERE key = 'positions'"),
    ]);
    hr = { applicationsByStatus: apps.map((a) => ({ status: a.status, count: a.n })), applicationsInRange: recent[0].n, openPositions: (positions[0]?.value || []).filter((p) => p.status !== 'closed').length };
  } catch {
    hr = null;
  }

  return {
    generatedAt: new Date().toISOString(),
    hr,
    range: { from: dayKey(from), to: dayKey(to), previousFrom: dayKey(prevFrom) },
    kpis, series, stages, funnel, stockHealth, supplierPerf, fulfilment, alerts, bottlenecks,
    approvals: approvals.map(approvalView),
    activity: events.map(eventView),
    modules: {
      trading: { open: deals.filter((d) => d.status === 'open').length, awaitingCustomer: stages.find((s) => s.key === 'awaiting_customer').count, toConfirm: stages.find((s) => s.key === 'order_confirmation').count },
      purchase: { openRequests: (await db.query("SELECT COUNT(*)::int AS n FROM ops_procurement_requests WHERE status IN ('open','rfq','quoted','selected')"))[0].n, openOrders: pos.filter((p) => ['pending_approval', 'approved', 'partially_received'].includes(p.status)).length, late: alerts.filter((a) => a.type === 'supplier_late').length },
      inventory: { items: stock.length, low: stockHealth.low.length, incoming: round(stockHealth.totals.incoming, 3) },
      dispatch: { ready: stages.find((s) => s.key === 'ready_to_dispatch').count, inTransit: shipments.filter((s) => s.status === 'shipped').length, exceptions: shipments.filter((s) => s.status === 'exception').length },
    },
  };
});

// ---------- Customer portal ----------

view('portal', 'portal.use', async (db, user) => {
  const customer = (await db.query('SELECT * FROM ops_customers WHERE id = $1', [user.customerId]))[0];
  if (!customer) throw new OpsError(404, 'Customer not found');
  const deals = await pipeline(db, { customerId: customer.id });
  return {
    customer: { name: customer.name, company: customer.company, portalSlug: customer.portal_slug },
    enquiries: deals.map(({ owner, pendingApprovals, idleDays, ...rest }) => ({
      ...rest,
      // Internal drafts and reviews are not visible to the customer.
      quotation: rest.quotation && !['draft', 'in_review', 'approved'].includes(rest.quotation.status) ? rest.quotation : null,
      stage: ['sourcing', 'quoting'].includes(rest.stage) ? 'preparing_quote' : rest.stage,
    })),
  };
});

view('portalEnquiry', 'portal.use', async (db, user, params) => enquiryDetail(db, user, Number(params.id), { customerScope: user.customerId }));

async function read(db, user, name, params = {}) {
  const entry = views[name];
  if (!entry) throw new OpsError(400, `Unknown view: ${name}`);
  if (!user) throw new OpsError(401, 'Sign in required');
  if (entry.permission) requirePermission(user, entry.permission);
  return entry.run(db, user, params);
}

module.exports = { read, views, pipeline };
