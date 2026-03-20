export const e2eProjectId = 'demo-phase2'
export const e2ePassword = 'Phase2-E2E-Password1!'

export const seededUsers = {
  admin: {
    uid: 'e2e-admin',
    email: 'admin@phase2.test',
    password: e2ePassword,
    firstName: 'Ada',
    lastName: 'Admin',
    role: 'admin',
  },
  controller: {
    uid: 'e2e-controller',
    email: 'controller@phase2.test',
    password: e2ePassword,
    firstName: 'Casey',
    lastName: 'Controller',
    role: 'controller',
  },
  foreman: {
    uid: 'e2e-foreman',
    email: 'foreman@phase2.test',
    password: e2ePassword,
    firstName: 'Frank',
    lastName: 'Foreman',
    role: 'foreman',
  },
}

export const seededJobs = {
  active: {
    id: 'job-e2e-active',
    name: 'E2E Active Job',
    code: '1001',
  },
  archived: {
    id: 'job-e2e-archived',
    name: 'E2E Archived Job',
    code: '1999',
  },
}

export const seededRoster = {
  primary: {
    id: 'roster-e2e-primary',
    employeeNumber: '1001',
    firstName: 'Sam',
    lastName: 'Stone',
    occupation: 'Ironworker',
  },
  subcontractor: {
    id: 'roster-e2e-subcontractor',
    employeeNumber: '1002',
    firstName: 'Taylor',
    lastName: 'Trade',
    occupation: 'Welder',
  },
}

export const seededCatalog = {
  rootCategory: {
    id: 'category-e2e-tools',
    name: 'Tools',
  },
  childCategory: {
    id: 'category-e2e-fasteners',
    name: 'Fasteners',
    parentId: 'category-e2e-tools',
  },
  hammer: {
    id: 'catalog-e2e-hammer',
    description: 'Framing Hammer',
    sku: 'HAM-001',
    price: 24.99,
    categoryId: 'category-e2e-tools',
  },
  bolts: {
    id: 'catalog-e2e-bolts',
    description: 'Anchor Bolts',
    sku: 'BOLT-050',
    price: 11.5,
    categoryId: 'category-e2e-fasteners',
  },
}

export const seededRecipients = {
  office: 'office@phase2.test',
  timecards: 'timecards@phase2.test',
  shopOrders: 'shoporders@phase2.test',
  dailyLogs: 'dailylogs@phase2.test',
}
