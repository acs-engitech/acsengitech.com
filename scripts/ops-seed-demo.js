// Fills the LOCAL operations database (.data/ops-pglite) with a demo company so every workspace and the
// command center can be walked through. Every record goes through the real workflow commands.
// Refuses to run against Neon: demo data must never reach production.
//
//   npm run ops:seed-demo            (then npm run dev and open /admin/command)
//
// Demo sign-ins (local only), all with password DEMO_PASSWORD below:
//   trading@acs.local, purchase@acs.local, dispatch@acs.local, hr@acs.local, content@acs.local,
//   buyer@mehtachem.local (customer portal). Directors use the normal /admin login.
const path = require('node:path');
const fs = require('node:fs');

const DEMO_PASSWORD = 'acs-demo-2026!';

const root = path.join(__dirname, '..');
for (const file of ['.env', '.env.local']) {
  const full = path.join(root, file);
  if (fs.existsSync(full) && /^(NEON_DATABASE_URL|DATABASE_URL|POSTGRES_URL)=/m.test(fs.readFileSync(full, 'utf8'))) {
    console.error(`Refusing to seed: ${file} configures a Neon database. Demo data is for the local embedded database only.`);
    process.exit(1);
  }
}
if (['NEON_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL'].some((k) => process.env[k])) {
  console.error('Refusing to seed: a Neon connection string is set in the environment.');
  process.exit(1);
}
const dir = path.join(root, '.data', 'ops-pglite');
if (fs.existsSync(dir) && !process.argv.includes('--reset')) {
  console.error(`${dir} already exists. Run with --reset to replace it.`);
  process.exit(1);
}
fs.rmSync(dir, { recursive: true, force: true });
process.env.ACS_OPS_PGLITE_DIR = dir;

const { getDb } = require('../lib/ops/db');
const { execute } = require('../lib/ops/service');
const { superadminUser } = require('../lib/ops/auth');

const days = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

(async () => {
  const db = await getDb();
  const director = superadminUser();
  const run = (user, action, input) => execute(db, user, action, input);

  const people = {};
  for (const [role, name] of [['trading', 'Neha (Trading)'], ['purchase', 'Arjun (Purchasing)'], ['dispatch', 'Imran (Dispatch)'], ['hr', 'Priya (HR)'], ['content', 'Content & SEO']]) {
    const u = await run(director, 'user.save', { email: `${role}@acs.local`, name, role, password: DEMO_PASSWORD });
    people[role] = { ...u, active: true };
  }
  const T = people.trading;
  const P = people.purchase;
  const D = people.dispatch;

  const catalogue = [
    ['6ES7214-1AG40-0XB0', 'S7-1200 CPU 1214C DC/DC/DC', 'Siemens', 'PLC', 4, 31500],
    ['6ES7515-2AM02-0AB0', 'S7-1500 CPU 1515-2 PN', 'Siemens', 'PLC', 1, 162000],
    ['6AV2123-2GB03-0AX0', 'KTP700 Basic HMI 7"', 'Siemens', 'HMI', 3, 41000],
    ['6SL3210-5BE17-5UV0', 'SINAMICS V20 7.5 kW', 'Siemens', 'Drive', 2, 38500],
    ['6ED1052-1MD08-0BA1', 'LOGO! 12/24RCE', 'Siemens', 'Logic module', 6, 9200],
    ['6ES7155-6AU01-0BN0', 'ET 200SP IM 155-6 PN ST', 'Siemens', 'Distributed I/O', 2, 21800],
  ];
  const items = {};
  for (const [sku, name, brand, category, reorderLevel, standardCost] of catalogue) {
    items[sku] = await run(director, 'item.save', { sku, name, brand, category, reorderLevel, standardCost });
  }
  const [cpu, cpu1500, hmi, v20, logo, et200] = Object.values(items);

  // Opening stock and the production plan (ACS keeps CPUs for its own panels).
  for (const [item, count] of [[cpu, 15], [hmi, 6], [v20, 2], [logo, 20], [et200, 4]]) await run(P, 'stock.adjust', { itemId: item.id, onHand: count, note: 'Opening count' });
  await run(director, 'production.plan', { itemId: cpu.id, required: 15, note: 'Panels for ZLD project' });
  await run(director, 'production.plan', { itemId: hmi.id, required: 4, note: 'Panels for ZLD project' });
  await run(director, 'production.plan', { itemId: et200.id, required: 6, note: 'Rolling mill retrofit' });

  const sup = {};
  for (const [name, brands, lead, terms] of [['Kunal Automation Pvt Ltd', 'Siemens', 6, '30 days'], ['Shree Industrial Supplies', 'Siemens, Schneider', 3, 'Advance'], ['Precision Drives & Controls', 'Siemens drives', 10, '45 days']]) {
    sup[name] = await run(P, 'supplier.save', { name, brands, leadTimeDays: lead, paymentTerms: terms });
  }
  const [kunal, shree, precision] = Object.values(sup);

  const cust = {};
  for (const [company, name, city, email] of [['Mehta Chemicals', 'Rohit Mehta', 'Vapi', 'buyer@mehtachem.local'], ['Sunrise Distillery', 'Anita Rao', 'Nashik', 'purchase@sunrise.local'], ['Gujarat Rolling Mills', 'K. Patel', 'Ahmedabad', 'stores@grm.local'], ['Bharat Water Systems', 'S. Iyer', 'Pune', 'projects@bws.local']]) {
    cust[company] = await run(T, 'customer.save', { company, name, city, email });
  }
  await run(director, 'user.save', { email: 'buyer@mehtachem.local', name: 'Rohit Mehta', role: 'customer', customerId: cust['Mehta Chemicals'].id, password: DEMO_PASSWORD });

  async function quoteAndSend(enquiryId, lines, { approve = true, send = true } = {}) {
    const q = await run(T, 'quotation.save', { enquiryId, validUntil: days(15), notes: 'Ex-works Vapi. 30% advance, balance before dispatch. 12 months warranty.', lines });
    await run(T, 'quotation.submit', { id: q.id });
    if (!approve) return q;
    const approval = (await db.query("SELECT id FROM ops_approvals WHERE kind = 'quotation' AND ref_id = $1 AND status = 'pending'", [q.id]))[0];
    await run(director, 'approval.decide', { id: approval.id, decision: 'approve' });
    if (send) await run(T, 'quotation.send', { id: q.id });
    return q;
  }
  const approvePending = async (kind) => {
    for (const a of await db.query("SELECT id FROM ops_approvals WHERE kind = $1 AND status = 'pending'", [kind])) await run(director, 'approval.decide', { id: a.id, decision: 'approve' });
  };

  // 1. Mehta: 5 CPUs from production stock (the Siemens example), delivered.
  const e1 = await run(T, 'enquiry.create', { customerId: cust['Mehta Chemicals'].id, title: 'S7-1200 CPUs for evaporator skid', source: 'email', lines: [{ itemId: cpu.id, qty: 5 }] });
  const q1 = await quoteAndSend(e1.id, [{ itemId: cpu.id, qty: 5, unitPrice: 39800, source: 'reallocate' }]);
  const o1 = await run(T, 'quotation.decide', { id: q1.id, decision: 'accept', comment: 'PO 4512 by email' });
  await run(T, 'order.confirm', { id: o1.id, note: '30% advance received' });
  await approvePending('reallocation');
  const l1 = (await db.query('SELECT id FROM ops_order_lines WHERE order_id = $1', [o1.id]))[0];
  const s1 = await run(D, 'shipment.create', { orderId: o1.id, lines: [{ orderLineId: l1.id, qty: 5 }], carrier: 'VRL Logistics' });
  await run(D, 'shipment.ship', { id: s1.id, carrier: 'VRL Logistics', trackingNo: 'VRL-88231' });
  await run(D, 'shipment.deliver', { id: s1.id, receivedBy: 'Mehta stores' });

  // 2. Sunrise: HMIs + drives, sourced, accepted, partly received, ready for part dispatch.
  const e2 = await run(T, 'enquiry.create', { customerId: cust['Sunrise Distillery'].id, title: 'HMIs and V20 drives for bottling line', lines: [{ itemId: hmi.id, qty: 4 }, { itemId: v20.id, qty: 3 }] });
  const [pr2] = await run(T, 'sourcing.request', { enquiryId: e2.id, reason: 'shortfall', lines: [{ itemId: v20.id, qty: 3 }] });
  await run(P, 'pr.rfq', { prId: pr2.id, supplierIds: [kunal.id, precision.id] });
  await run(P, 'offer.record', { prId: pr2.id, supplierId: kunal.id, unitPrice: 36200, freight: 1500, leadTimeDays: 6, availableQty: 3 });
  const off2 = await run(P, 'offer.record', { prId: pr2.id, supplierId: precision.id, unitPrice: 35400, freight: 0, leadTimeDays: 4, availableQty: 5 });
  await run(P, 'pr.select', { prId: pr2.id, offerId: off2.id });
  const q2 = await quoteAndSend(e2.id, [{ itemId: hmi.id, qty: 4, unitPrice: 52500, source: 'stock' }, { itemId: v20.id, qty: 3, unitPrice: 46900, source: 'procure' }]);
  const o2 = await run(T, 'quotation.decide', { id: q2.id, decision: 'accept' });
  await run(T, 'order.confirm', { id: o2.id, note: 'LC opened' });
  const po2 = await run(P, 'po.create', { prId: pr2.id });
  await approvePending('purchase_order');
  await run(P, 'po.receive', { poId: po2.id, qty: 2, note: 'Part delivery, challan 7781' });

  // 3. Gujarat Rolling Mills: S7-1500, quotation with the customer.
  const e3 = await run(T, 'enquiry.create', { customerId: cust['Gujarat Rolling Mills'].id, title: 'S7-1500 + ET200SP for mill retrofit', lines: [{ itemId: cpu1500.id, qty: 2 }, { itemId: et200.id, qty: 4 }] });
  await quoteAndSend(e3.id, [{ itemId: cpu1500.id, qty: 2, unitPrice: 198000, unitCost: 162000, source: 'procure' }, { itemId: et200.id, qty: 4, unitPrice: 27500, source: 'procure' }]);

  // 4. Bharat Water: quotation waiting for director review.
  const e4 = await run(T, 'enquiry.create', { customerId: cust['Bharat Water Systems'].id, title: 'LOGO! modules for pump stations', lines: [{ itemId: logo.id, qty: 12 }] });
  await quoteAndSend(e4.id, [{ itemId: logo.id, qty: 12, unitPrice: 11800, source: 'stock' }], { approve: false });

  // 5. Mehta: new enquiry, sourcing in progress.
  const e5 = await run(T, 'enquiry.create', { customerId: cust['Mehta Chemicals'].id, title: 'Spare S7-1500 CPU', lines: [{ itemId: cpu1500.id, qty: 1 }] });
  const [pr5] = await run(T, 'sourcing.request', { enquiryId: e5.id, reason: 'pricing', lines: [{ itemId: cpu1500.id, qty: 1 }] });
  await run(P, 'pr.rfq', { prId: pr5.id, supplierIds: [kunal.id, shree.id] });
  await run(P, 'offer.record', { prId: pr5.id, supplierId: shree.id, unitPrice: 158500, freight: 800, leadTimeDays: 3, availableQty: 1 });

  // 6. A website message waiting in the inbox.
  await db.query("INSERT INTO acs_enquiries (first_name, last_name, email, subject, message) VALUES ('Vikram', 'Shah', 'vikram@shahpharma.local', 'Need MCC panel + VFDs', 'We need a quotation for an MCC panel with 6 VFDs (7.5 kW) for a new reactor house in Ankleshwar. Delivery in 8 weeks.')");

  // Production replenishment PO, delayed by the supplier (shows up as an exception).
  const replenish = (await db.query("SELECT id FROM ops_procurement_requests WHERE reason = 'replenish_production' LIMIT 1"))[0];
  await run(P, 'offer.record', { prId: replenish.id, supplierId: kunal.id, unitPrice: 30900, freight: 600, leadTimeDays: 6, availableQty: 5 });
  await run(P, 'pr.select', { prId: replenish.id, offerId: (await db.query('SELECT id FROM ops_supplier_offers WHERE pr_id = $1', [replenish.id]))[0].id });
  const poR = await run(P, 'po.create', { prId: replenish.id });
  await approvePending('purchase_order');
  await run(P, 'po.delay', { poId: poR.id, expectedAt: days(12), note: 'Siemens allocation delayed at distributor' });

  console.log(`Seeded demo operations data into ${dir}`);
  console.log(`Demo staff logins: trading@ / purchase@ / dispatch@ / hr@ / content@acs.local — password in scripts/ops-seed-demo.js`);
  await db.close?.();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
