// End-to-end business workflows against a real Postgres engine (PGlite, in memory).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createPgliteDriver, useDriver } = require('../lib/ops/db');
const { execute } = require('../lib/ops/service');
const { read } = require('../lib/ops/queries');

let db;
const director = { id: 0, email: 'director@acs.test', role: 'director', active: true };
const trader = { id: 11, email: 'trader@acs.test', role: 'trading', active: true };
const buyer = { id: 12, email: 'buyer@acs.test', role: 'purchase', active: true };
const dispatcher = { id: 13, email: 'dispatch@acs.test', role: 'dispatch', active: true };
const hr = { id: 14, email: 'hr@acs.test', role: 'hr', active: true };
const run = (user, action, input) => execute(db, user, action, input);
const view = (user, name, params) => read(db, user, name, params);
const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

async function stockOf(itemId) {
  const inv = await view(director, 'inventory');
  return inv.items.find((i) => i.id === itemId).stock;
}

let siemens;
let hmi;
let supplierA;
let supplierB;
let customer;

before(async () => {
  db = await useDriver(createPgliteDriver());
  siemens = await run(trader, 'item.save', { sku: 'S7-1200-1214C', name: 'Siemens S7-1200 CPU 1214C', brand: 'Siemens', reorderLevel: 2, standardCost: 30000 });
  hmi = await run(buyer, 'item.save', { sku: 'KTP700', name: 'Siemens KTP700 Basic HMI', brand: 'Siemens' });
  supplierA = await run(buyer, 'supplier.save', { name: 'Alpha Automation', leadTimeDays: 7 });
  supplierB = await run(buyer, 'supplier.save', { name: 'Beta Controls', leadTimeDays: 3 });
  customer = await run(trader, 'customer.save', { name: 'R. Mehta', company: 'Mehta Chemicals', email: 'buyer@mehta.test' });
  // ACS holds 15 units, all needed for production.
  await run(director, 'stock.adjust', { itemId: siemens.id, onHand: 15, note: 'Opening count' });
  await run(director, 'production.plan', { itemId: siemens.id, required: 15 });
});

after(async () => db.close?.());

test('production allocation leaves nothing free to promise', async () => {
  const s = await stockOf(siemens.id);
  assert.equal(s.onHand, 15);
  assert.equal(s.productionReserved, 15);
  assert.equal(s.atp, 0);
});

test('roles are enforced server-side', async () => {
  await assert.rejects(run(hr, 'enquiry.create', { customerId: customer.id, title: 'x' }), { status: 403 });
  await assert.rejects(run(dispatcher, 'stock.adjust', { itemId: siemens.id, onHand: 99, note: 'x' }), { status: 403 });
  await assert.rejects(run(trader, 'production.plan', { itemId: siemens.id, required: 0 }), { status: 403 });
  await assert.rejects(view(dispatcher, 'command'), { status: 403 });
  await assert.rejects(view(trader, 'purchase'), { status: 403 });
});

test('enquiry → quotation → approval → customer revision → acceptance → reallocation → dispatch → delivery', async () => {
  const enquiry = await run(trader, 'enquiry.create', { customerId: customer.id, title: 'PLC for evaporator', lines: [{ itemId: siemens.id, qty: 5 }] });
  const detail = await view(trader, 'enquiry', { id: enquiry.id });
  const options = detail.lines[0].options;
  assert.equal(options.find((o) => o.key === 'stock').feasible, false);
  assert.equal(options.find((o) => o.key === 'reallocate').feasible, true);
  assert.match(options.find((o) => o.key === 'reallocate').effect, /15 → 10/);

  const q1 = await run(trader, 'quotation.save', { enquiryId: enquiry.id, validUntil: future, lines: [{ itemId: siemens.id, qty: 5, unitPrice: 42000, source: 'reallocate' }] });
  await assert.rejects(run(trader, 'quotation.send', { id: q1.id }), /must be approved/);
  await run(trader, 'quotation.submit', { id: q1.id });
  const pending = await view(director, 'approvals');
  const approval = pending.approvals.find((a) => a.refId === q1.id && a.kind === 'quotation');
  assert.match(approval.summary, /margin 28\.6%/); // cost defaulted from the standard cost
  await assert.rejects(run(trader, 'approval.decide', { id: approval.id, decision: 'approve' }), { status: 403 });
  await run(director, 'approval.decide', { id: approval.id, decision: 'approve' });
  await run(trader, 'quotation.send', { id: q1.id });
  await run(trader, 'quotation.decide', { id: q1.id, decision: 'revise', comment: 'Need better price' });

  const q2 = await run(trader, 'quotation.save', { enquiryId: enquiry.id, validUntil: future, lines: [{ itemId: siemens.id, qty: 5, unitPrice: 40000, source: 'reallocate' }] });
  assert.equal(q2.version, 2);
  await run(trader, 'quotation.submit', { id: q2.id });
  const a2 = (await view(director, 'approvals')).approvals.find((a) => a.refId === q2.id);
  await run(director, 'approval.decide', { id: a2.id, decision: 'approve' });
  await run(trader, 'quotation.send', { id: q2.id });
  const order = await run(trader, 'quotation.decide', { id: q2.id, decision: 'accept' });
  await assert.rejects(run(trader, 'quotation.decide', { id: q2.id, decision: 'accept' }), /accepted and cannot/);

  // Confirming does not touch production stock until a director approves the reallocation.
  await run(trader, 'order.confirm', { id: order.id, note: 'Advance received' });
  assert.equal((await stockOf(siemens.id)).productionReserved, 15);
  const realloc = (await view(director, 'approvals')).approvals.find((a) => a.kind === 'reallocation');
  assert.equal(realloc.payload.qty, 5);
  await run(director, 'approval.decide', { id: realloc.id, decision: 'approve' });
  let s = await stockOf(siemens.id);
  assert.equal(s.productionReserved, 10);
  assert.equal(s.customerReserved, 5);
  assert.equal(s.productionShortfall, 5);
  const replenish = (await view(buyer, 'purchase')).requests.find((r) => r.reason === 'replenish_production');
  assert.equal(replenish.qty, 5);

  // Partial shipment, then the rest.
  const dispatchView = await view(dispatcher, 'dispatch');
  const line = dispatchView.orders.find((o) => o.id === order.id).lines[0];
  assert.equal(line.freeToDispatch, 5);
  const ship1 = await run(dispatcher, 'shipment.create', { orderId: order.id, lines: [{ orderLineId: line.id, qty: 3 }] });
  await assert.rejects(run(dispatcher, 'shipment.create', { orderId: order.id, lines: [{ orderLineId: line.id, qty: 3 }] }), /Only 2 reserved/);
  await run(dispatcher, 'shipment.ship', { id: ship1.id, carrier: 'VRL Logistics', trackingNo: 'VRL123' });
  const ship2 = await run(dispatcher, 'shipment.create', { orderId: order.id, lines: [{ orderLineId: line.id, qty: 2 }] });
  await run(dispatcher, 'shipment.ship', { id: ship2.id, carrier: 'VRL Logistics' });
  await run(dispatcher, 'shipment.deliver', { id: ship1.id, receivedBy: 'Stores' });
  let finalDetail = await view(director, 'enquiry', { id: enquiry.id });
  assert.equal(finalDetail.order.status, 'dispatched');
  await run(dispatcher, 'shipment.deliver', { id: ship2.id });
  finalDetail = await view(director, 'enquiry', { id: enquiry.id });
  assert.equal(finalDetail.order.status, 'delivered');
  s = await stockOf(siemens.id);
  assert.equal(s.onHand, 10);
  assert.equal(s.customerReserved, 0);
  assert.ok(finalDetail.timeline.length > 10, 'every step is in the audit trail');

  const board = await view(director, 'command');
  assert.equal(board.stages.find((st) => st.key === 'delivered').count, 1);
  assert.ok(board.alerts.some((a) => a.type === 'production_shortfall'));
});

test('shortfall → supplier comparison → PO approval → partial receipts → allocation to the order', async () => {
  const enquiry = await run(trader, 'enquiry.create', { customerId: customer.id, title: 'HMIs', lines: [{ itemId: hmi.id, qty: 4 }] });
  const [pr] = await run(trader, 'sourcing.request', { enquiryId: enquiry.id, reason: 'shortfall', lines: [{ itemId: hmi.id, qty: 4 }] });
  await assert.rejects(run(trader, 'sourcing.request', { enquiryId: enquiry.id, lines: [{ itemId: hmi.id, qty: 4 }] }), /already sourcing/);
  await run(buyer, 'pr.rfq', { prId: pr.id, supplierIds: [supplierA.id, supplierB.id] });
  // Alpha is cheaper per unit but freight makes its landed cost higher; Beta is also faster.
  const offerA = await run(buyer, 'offer.record', { prId: pr.id, supplierId: supplierA.id, unitPrice: 18000, freight: 6000, leadTimeDays: 7, availableQty: 4 });
  const offerB = await run(buyer, 'offer.record', { prId: pr.id, supplierId: supplierB.id, unitPrice: 18500, freight: 0, leadTimeDays: 3, availableQty: 10 });
  const ranked = (await view(buyer, 'purchase')).requests.find((r) => r.id === pr.id).offers;
  assert.equal(ranked[0].id, offerB.id);
  assert.equal(ranked.find((o) => o.id === offerA.id).landedUnitCost, 19500);
  await assert.rejects(run(buyer, 'pr.select', { prId: pr.id, offerId: offerA.id }), /ranks #2/);
  await run(buyer, 'pr.select', { prId: pr.id, offerId: offerB.id });

  // Costs flow back to trading; the customer never sees them.
  const detail = await view(trader, 'enquiry', { id: enquiry.id });
  assert.equal(detail.lines[0].costHint.unitCost, 18500);
  const quote = await run(trader, 'quotation.save', { enquiryId: enquiry.id, validUntil: future, lines: [{ itemId: hmi.id, qty: 4, unitPrice: 24000, source: 'procure' }] });
  await run(trader, 'quotation.submit', { id: quote.id });
  const qa = (await view(director, 'approvals')).approvals.find((a) => a.refId === quote.id);
  await run(director, 'approval.decide', { id: qa.id, decision: 'approve' });
  await run(trader, 'quotation.send', { id: quote.id });

  const portalUser = await run(trader, 'customer.invite', { customerId: customer.id });
  assert.ok(portalUser.password.length >= 10);
  const cust = { id: portalUser.id, email: portalUser.email, role: 'customer', customerId: customer.id, active: true };
  const portalDetail = await view(cust, 'portalEnquiry', { id: enquiry.id });
  assert.equal(JSON.stringify(portalDetail).includes('unitCost'), false);
  assert.equal(portalDetail.quotations[0].totals.cost, undefined);
  assert.equal(portalDetail.sourcing, undefined);
  const order = await run(cust, 'quotation.decide', { id: quote.id, decision: 'accept' });
  await run(trader, 'order.confirm', { id: order.id, note: 'PO received from customer' });

  const req = (await view(buyer, 'purchase')).requests.find((r) => r.id === pr.id);
  assert.equal(req.orderNumber, order.number, 'enquiry sourcing request is reused for the order');
  const po = await run(buyer, 'po.create', { prId: pr.id });
  await assert.rejects(run(buyer, 'po.receive', { poId: po.id, qty: 1 }), /cannot be received/);
  const pa = (await view(director, 'approvals')).approvals.find((a) => a.kind === 'purchase_order');
  await run(director, 'approval.decide', { id: pa.id, decision: 'approve' });
  assert.equal((await stockOf(hmi.id)).incoming, 4);
  await assert.rejects(run(buyer, 'po.receive', { poId: po.id, qty: 5 }), /only 4 units are outstanding/);
  await run(buyer, 'po.receive', { poId: po.id, qty: 3 });
  let s = await stockOf(hmi.id);
  assert.deepEqual([s.onHand, s.customerReserved, s.incoming, s.atp], [3, 3, 1, 0]);
  await run(buyer, 'po.receive', { poId: po.id, qty: 1 });
  s = await stockOf(hmi.id);
  assert.deepEqual([s.onHand, s.customerReserved, s.incoming], [4, 4, 0]);
  const detailAfter = await view(trader, 'enquiry', { id: enquiry.id });
  assert.equal(detailAfter.order.status, 'ready');
});

test('stock rules: no negative availability, no double reservation, counts cannot drop below reservations', async () => {
  await assert.rejects(run(director, 'stock.adjust', { itemId: siemens.id, onHand: 5, note: 'recount' }), /reserved/);
  const other = await run(trader, 'customer.save', { name: 'Other Co' });
  const enquiry = await run(trader, 'enquiry.create', { customerId: other.id, title: 'Spare', lines: [{ itemId: siemens.id, qty: 1 }] });
  const q = await run(trader, 'quotation.save', { enquiryId: enquiry.id, validUntil: future, lines: [{ itemId: siemens.id, qty: 1, unitPrice: 45000, unitCost: 30000, source: 'stock' }] });
  await run(trader, 'quotation.submit', { id: q.id });
  const a = (await view(director, 'approvals')).approvals.find((x) => x.refId === q.id);
  await run(director, 'approval.decide', { id: a.id, decision: 'approve' });
  await run(trader, 'quotation.send', { id: q.id });
  const order = await run(trader, 'quotation.decide', { id: q.id, decision: 'accept', comment: 'by phone' });
  // Nothing is free (all 10 allocated to production), so confirming raises a shortfall request instead of overselling.
  const confirmed = await run(trader, 'order.confirm', { id: order.id, note: 'ok' });
  assert.equal(confirmed.lines[0].reserved, 0);
  assert.match(confirmed.lines[0].sourcedBy, /^PR-/);
  assert.equal((await stockOf(siemens.id)).atp, 0);
  await assert.rejects(run(trader, 'order.confirm', { id: order.id, note: 'again' }), /already confirmed/);

  // Cancelling releases cleanly and cancels the unordered request.
  await run(trader, 'order.cancel', { id: order.id, reason: 'Customer withdrew' });
  const purchase = await view(buyer, 'purchase');
  assert.equal(purchase.requests.find((r) => r.orderNumber === order.number).status, 'cancelled');
  const detail = await view(director, 'enquiry', { id: enquiry.id });
  assert.equal(detail.order.status, 'cancelled');
  assert.equal(detail.order.lines[0].cancelled, 1);
});

test('competing commands on the same stock are serialized without overselling', async () => {
  const item = await run(director, 'item.save', { sku: 'G120-PM240', name: 'G120 power module' });
  await run(director, 'stock.adjust', { itemId: item.id, onHand: 3, note: 'count' });
  const results = await Promise.allSettled([1, 2, 3, 4].map(() => run(director, 'production.plan', { itemId: item.id, required: 2 })));
  assert.ok(results.every((r) => r.status === 'fulfilled'));
  const s = await stockOf(item.id);
  assert.equal(s.productionReserved, 2);
  assert.equal(s.atp, 1);
});

test('command center metrics come from records', async () => {
  const board = await view(director, 'command');
  assert.ok(board.kpis.wonValue.value >= 200000 + 96000);
  assert.ok(board.kpis.procurementSpend.value === 74000);
  assert.ok(board.series.length >= 12);
  assert.ok(board.stages.every((st) => Array.isArray(st.cards)));
  const beta = board.supplierPerf.find((p) => p.supplier === 'Beta Controls');
  assert.equal(beta.received, 1);
  assert.equal(beta.onTime, 1);
});
