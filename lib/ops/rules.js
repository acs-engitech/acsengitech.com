// Pure business rules: stock positions, fulfilment options, supplier ranking, totals and lifecycle
// stages. No I/O here so every rule is unit-tested directly.

const num = (value) => (value === null || value === undefined || value === '' ? 0 : Number(value));
const round = (value, places = 2) => Math.round(num(value) * 10 ** places) / 10 ** places;

// on_hand is physical stock. Available-to-promise is what is neither allocated to production nor to customers.
function stockPosition(row = {}) {
  const onHand = num(row.on_hand ?? row.onHand);
  const productionRequired = num(row.production_required ?? row.productionRequired);
  const productionReserved = num(row.production_reserved ?? row.productionReserved);
  const customerReserved = num(row.customer_reserved ?? row.customerReserved);
  const incoming = num(row.incoming);
  const reorderLevel = num(row.reorder_level ?? row.reorderLevel);
  const atp = round(onHand - productionReserved - customerReserved, 3);
  const productionShortfall = round(Math.max(0, productionRequired - productionReserved), 3);
  const reorderRequirement = round(Math.max(0, reorderLevel + productionShortfall - atp - incoming), 3);
  return {
    onHand,
    productionRequired,
    productionReserved,
    customerReserved,
    incoming,
    reorderLevel,
    atp,
    productionShortfall,
    projected: round(atp + incoming, 3),
    reorderRequirement,
    lowStock: reorderLevel > 0 && atp + incoming < reorderLevel,
  };
}

// The three ways to serve a customer quantity, with the effect of each on production and who must approve.
function fulfilmentOptions(position, qty, { leadTimeDays = null, supplierName = null } = {}) {
  const wanted = num(qty);
  const fromStock = Math.min(position.atp, wanted);
  const gap = round(wanted - Math.max(0, fromStock), 3);
  const reallocatable = Math.min(gap, position.productionReserved);
  return [
    {
      key: 'stock',
      label: 'Serve from free stock',
      feasible: position.atp >= wanted,
      coversQty: Math.max(0, fromStock),
      effect: position.atp >= wanted
        ? `Uses ${wanted} of ${position.atp} free units. Production allocation unchanged.`
        : `Only ${Math.max(0, position.atp)} free units; ${gap} short.`,
      approval: 'Trading confirms the order',
    },
    {
      key: 'reallocate',
      label: 'Reallocate from production',
      feasible: gap > 0 && reallocatable >= gap,
      coversQty: round(Math.max(0, fromStock) + reallocatable, 3),
      effect: gap > 0
        ? `Moves ${reallocatable} units from production (allocated ${position.productionReserved} → ${round(position.productionReserved - reallocatable, 3)}) and raises a ${reallocatable}-unit production replenishment.`
        : 'Not needed: free stock covers the quantity.',
      leadTimeDays,
      approval: 'Director approves the reallocation',
    },
    {
      key: 'procure',
      label: 'Procure from supplier',
      feasible: true,
      coversQty: wanted,
      effect: gap > 0
        ? `Buys ${gap} units${supplierName ? ` (best offer: ${supplierName})` : ''}. Production allocation untouched.`
        : `Optional: buy ${wanted} units instead of using stock.`,
      leadTimeDays,
      approval: 'Director approves the purchase order',
    },
  ];
}

// Supplier offers are ranked on landed cost, lead time, quantity availability and delivery record,
// not on quoted price alone. Unknown inputs score neutral (0.5) and are reported as unknown.
const WEIGHTS = { cost: 0.5, lead: 0.25, availability: 0.15, reliability: 0.1 };

function rankOffers(offers, { qty, reliability = {} } = {}) {
  if (!offers.length) return [];
  const wanted = num(qty) || 1;
  const enriched = offers.map((offer) => {
    const landedUnitCost = round(num(offer.unit_price ?? offer.unitPrice) + num(offer.freight) / wanted);
    const lead = num(offer.lead_time_days ?? offer.leadTimeDays);
    const availableRaw = offer.available_qty ?? offer.availableQty;
    const available = availableRaw === null || availableRaw === undefined || availableRaw === '' ? null : num(availableRaw);
    const supplierId = offer.supplier_id ?? offer.supplierId;
    const onTime = reliability[supplierId];
    return { offer, landedUnitCost, lead, available, onTime: onTime === undefined ? null : onTime };
  });
  const minCost = Math.min(...enriched.map((e) => e.landedUnitCost));
  const minLead = Math.min(...enriched.map((e) => e.lead));
  return enriched
    .map((e) => {
      const parts = {
        cost: e.landedUnitCost > 0 ? minCost / e.landedUnitCost : 1,
        lead: (minLead + 1) / (e.lead + 1),
        availability: e.available === null ? 0.5 : Math.min(1, e.available / wanted),
        reliability: e.onTime === null ? 0.5 : e.onTime,
      };
      const score = Math.round(Object.entries(WEIGHTS).reduce((sum, [key, w]) => sum + w * parts[key], 0) * 100);
      const notes = [];
      if (e.landedUnitCost === minCost) notes.push('lowest landed cost');
      if (e.lead === minLead) notes.push('fastest');
      if (e.available !== null && e.available < wanted) notes.push(`can supply only ${e.available}`);
      if (e.available === null) notes.push('availability not stated');
      if (e.onTime === null) notes.push('no delivery history');
      return { ...e.offer, landedUnitCost: e.landedUnitCost, landedTotal: round(e.landedUnitCost * wanted), score, parts, flags: notes };
    })
    .sort((a, b) => b.score - a.score || a.landedUnitCost - b.landedUnitCost)
    .map((offer, index) => ({ ...offer, rank: index + 1 }));
}

function lineTotals(lines, { withCost = false } = {}) {
  let subtotal = 0;
  let tax = 0;
  let cost = 0;
  let costKnown = true;
  for (const line of lines) {
    const amount = num(line.qty) * num(line.unit_price ?? line.unitPrice);
    subtotal += amount;
    tax += amount * num(line.tax_rate ?? line.taxRate) / 100;
    const unitCost = line.unit_cost ?? line.unitCost;
    if (unitCost === null || unitCost === undefined || unitCost === '') costKnown = false;
    else cost += num(line.qty) * num(unitCost);
  }
  const totals = { subtotal: round(subtotal), tax: round(tax), total: round(subtotal + tax) };
  if (withCost) {
    totals.cost = costKnown ? round(cost) : null;
    totals.margin = costKnown ? round(subtotal - cost) : null;
    totals.marginPct = costKnown && subtotal > 0 ? round(((subtotal - cost) / subtotal) * 100, 1) : null;
  }
  return totals;
}

// Order status follows its lines: nothing shipped and all reserved → ready; some shipped → partially
// dispatched; everything shipped → dispatched; everything delivered → delivered.
function orderStatus(order, lines) {
  if (['pending_confirmation', 'cancelled'].includes(order.status)) return order.status;
  const open = lines.map((l) => ({ ...l, need: num(l.qty) - num(l.cancelled_qty) })).filter((l) => l.need > 0);
  if (!open.length) return 'cancelled';
  const all = (fn) => open.every(fn);
  if (all((l) => num(l.delivered_qty) >= l.need)) return 'delivered';
  if (all((l) => num(l.dispatched_qty) >= l.need)) return 'dispatched';
  if (open.some((l) => num(l.dispatched_qty) > 0)) return 'partially_dispatched';
  if (all((l) => num(l.reserved_qty) >= l.need)) return 'ready';
  return 'confirmed';
}

// One stage per enquiry for the cross-module pipeline.
const STAGES = [
  { key: 'new', label: 'New enquiry', module: 'trading' },
  { key: 'sourcing', label: 'Sourcing prices', module: 'purchase' },
  { key: 'quoting', label: 'Quotation in progress', module: 'trading' },
  { key: 'awaiting_customer', label: 'With customer', module: 'trading' },
  { key: 'order_confirmation', label: 'Order to confirm', module: 'trading' },
  { key: 'procuring', label: 'Procuring / allocating', module: 'purchase' },
  { key: 'ready_to_dispatch', label: 'Ready to dispatch', module: 'dispatch' },
  { key: 'in_transit', label: 'In transit', module: 'dispatch' },
  { key: 'delivered', label: 'Delivered', module: 'dispatch' },
  { key: 'closed', label: 'Lost / cancelled', module: 'trading' },
];

function enquiryStage({ enquiry, latestQuotation, openSourcing = 0, order, orderLines = [] }) {
  if (enquiry.status === 'lost' || order?.status === 'cancelled') return 'closed';
  if (order) {
    const status = order.status;
    if (status === 'pending_confirmation') return 'order_confirmation';
    if (status === 'delivered') return 'delivered';
    if (status === 'dispatched' || status === 'partially_dispatched') {
      const undelivered = orderLines.some((l) => num(l.dispatched_qty) > num(l.delivered_qty));
      if (undelivered) return 'in_transit';
      return status === 'dispatched' ? 'delivered' : 'ready_to_dispatch';
    }
    if (status === 'ready') return 'ready_to_dispatch';
    if (orderLines.some((l) => num(l.reserved_qty) > 0)) return 'ready_to_dispatch';
    return 'procuring';
  }
  if (latestQuotation && ['sent', 'revision_requested'].includes(latestQuotation.status)) return 'awaiting_customer';
  if (openSourcing > 0) return 'sourcing';
  if (latestQuotation) return 'quoting';
  return 'new';
}

module.exports = { num, round, stockPosition, fulfilmentOptions, rankOffers, lineTotals, orderStatus, enquiryStage, STAGES, WEIGHTS };
