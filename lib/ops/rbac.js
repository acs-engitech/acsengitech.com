// Role-based access for the operations platform. The server checks every command and every view
// against this table; the UI only uses it to decide what to show.
const ROLES = {
  director: { label: 'Director', home: '/admin/command' },
  trading: { label: 'Trading', home: '/ops/trading' },
  purchase: { label: 'Purchasing', home: '/ops/purchase' },
  dispatch: { label: 'Dispatch', home: '/ops/dispatch' },
  hr: { label: 'HR', home: '/admin/' },
  content: { label: 'Content & SEO', home: '/admin/' },
  customer: { label: 'Customer', home: '/portal' },
};

const PERMISSIONS = {
  'view.command': ['director'],
  'view.trading': ['director', 'trading'],
  'view.purchase': ['director', 'purchase'],
  'view.dispatch': ['director', 'dispatch'],
  'view.inventory': ['director', 'trading', 'purchase', 'dispatch'],
  'view.sales': ['director'],
  'cost.view': ['director', 'trading', 'purchase'],
  'enquiry.manage': ['director', 'trading'],
  'quotation.manage': ['director', 'trading'],
  'quotation.approve': ['director'],
  'procurement.request': ['director', 'trading'],
  'procurement.manage': ['director', 'purchase'],
  'po.approve': ['director'],
  'po.receive': ['director', 'purchase'],
  'order.confirm': ['director', 'trading'],
  'reallocation.approve': ['director'],
  'stock.adjust': ['director', 'purchase'],
  'production.plan': ['director'],
  'dispatch.manage': ['director', 'dispatch'],
  'customer.manage': ['director', 'trading'],
  'supplier.manage': ['director', 'purchase'],
  'item.manage': ['director', 'trading', 'purchase'],
  'user.manage': ['director'],
  // Existing /admin areas.
  'admin.content': ['director', 'content'],
  'admin.hr': ['director', 'hr'],
  'admin.partners': ['director', 'purchase'],
  'portal.use': ['customer'],
};

const APPROVAL_PERMISSION = {
  quotation: 'quotation.approve',
  reallocation: 'reallocation.approve',
  purchase_order: 'po.approve',
};

class OpsError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function can(user, permission) {
  return Boolean(user && user.active !== false && PERMISSIONS[permission]?.includes(user.role));
}

function require_(user, permission) {
  if (!user) throw new OpsError(401, 'Sign in required');
  if (!can(user, permission)) throw new OpsError(403, `Your role (${user.role}) cannot do this (${permission})`);
}

function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((key) => PERMISSIONS[key].includes(role));
}

module.exports = { ROLES, PERMISSIONS, APPROVAL_PERMISSION, OpsError, can, requirePermission: require_, permissionsFor };
