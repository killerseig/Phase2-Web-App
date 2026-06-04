import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __PHASE2_E2E__?: unknown
  }
}

const SHOP_ORDER_APP_FIXTURE = {
  now: '2026-06-04T09:00:00-06:00',
  auth: {
    user: {
      uid: 'foreman-e2e',
      email: 'cj@example.com',
      displayName: 'Chris (CJ) Larsen',
    },
    profile: {
      id: 'foreman-e2e',
      email: 'cj@example.com',
      firstName: 'Chris',
      lastName: '(CJ) Larsen',
      role: 'foreman',
      active: true,
      assignedJobIds: ['job-e2e'],
    },
  },
  jobs: [
    {
      id: 'job-e2e',
      name: 'Phase 2 Company Acoustical remodel',
      code: '1A',
      gc: 'Phase 2',
      type: 'acoustics',
      active: true,
      assignedForemanIds: ['foreman-e2e'],
      notificationRecipients: {
        dailyLogs: [],
        timecards: [],
        shopOrders: [],
      },
    },
  ],
  shopCategories: [
    { id: 'cat-drywall', name: 'Drywall Mud', parentId: null, active: true },
    { id: 'cat-all-purpose', name: 'All Purpose Mud', parentId: 'cat-drywall', active: true },
    { id: 'cat-anchors', name: 'Anchors', parentId: null, active: true },
    { id: 'cat-concrete-wedge', name: 'Concrete Wedge Anchors', parentId: 'cat-anchors', active: true },
  ],
  shopCatalogItems: [
    { id: 'item-box', description: 'Box', categoryId: 'cat-all-purpose', sku: null, price: null, active: true },
    { id: 'item-bucket', description: 'Bucket', categoryId: 'cat-all-purpose', sku: null, price: null, active: true },
    { id: 'item-half-inch', description: '1/2"', categoryId: 'cat-concrete-wedge', sku: null, price: null, active: true },
  ],
  shopOrders: [
    {
      id: 'order-draft',
      jobId: 'job-e2e',
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      orderNumber: '20260604163341',
      orderDate: '2026-06-04T16:33:41.000Z',
      deliveryDate: '2026-06-11',
      status: 'draft',
      comments: '',
      foremanUserId: 'foreman-e2e',
      foremanName: 'Chris (CJ) Larsen',
      items: [],
      createdAt: '2026-06-04T16:33:41.000Z',
      updatedAt: '2026-06-04T16:33:41.000Z',
      submittedAt: null,
    },
    {
      id: 'order-submitted-1',
      jobId: 'job-e2e',
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      orderNumber: '20260604145900',
      orderDate: '2026-06-04T14:59:00.000Z',
      deliveryDate: '2026-06-11',
      status: 'submitted',
      comments: 'Previous order',
      foremanUserId: 'foreman-e2e',
      foremanName: 'Chris (CJ) Larsen',
      items: [
        {
          id: 'submitted-item-1',
          sourceType: 'catalog',
          catalogItemId: 'item-box',
          description: 'Drywall Mud / All Purpose Mud / Box',
          quantity: 2,
          note: '',
          categoryId: 'cat-all-purpose',
          sku: null,
        },
      ],
      createdAt: '2026-06-04T14:45:00.000Z',
      updatedAt: '2026-06-04T14:59:00.000Z',
      submittedAt: '2026-06-04T14:59:00.000Z',
    },
    {
      id: 'order-submitted-2',
      jobId: 'job-e2e',
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      orderNumber: '20260604141400',
      orderDate: '2026-06-04T14:14:00.000Z',
      deliveryDate: '2026-06-11',
      status: 'submitted',
      comments: '',
      foremanUserId: 'foreman-e2e',
      foremanName: 'Chris (CJ) Larsen',
      items: [
        {
          id: 'submitted-item-2',
          sourceType: 'catalog',
          catalogItemId: 'item-bucket',
          description: 'Drywall Mud / All Purpose Mud / Bucket',
          quantity: 1,
          note: '',
          categoryId: 'cat-all-purpose',
          sku: null,
        },
      ],
      createdAt: '2026-06-04T14:00:00.000Z',
      updatedAt: '2026-06-04T14:14:00.000Z',
      submittedAt: '2026-06-04T14:14:00.000Z',
    },
  ],
} as const

export async function gotoShopOrderApp(page: Page) {
  await page.addInitScript((fixture) => {
    window.__PHASE2_E2E__ = structuredClone(fixture)
    window.confirm = () => true
  }, SHOP_ORDER_APP_FIXTURE)

  await page.goto('/jobs/job-e2e/shop-orders')
}
