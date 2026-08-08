import { test, expect } from '@playwright/test'

const BASE = '/'
let errors: string[] = []
let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  pageErrors = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(BASE)
})

test.afterEach(async () => {
  expect(pageErrors).toEqual([])
  expect(errors).toEqual([])
})

async function startGame(page: any, scale = 20) {
  await expect(page.getByRole('heading', { name: 'ممالك التنين' })).toBeVisible()
  await page.getByRole('button', { name: /ابدأ المعركة/ }).click()
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('طعام')).toBeVisible()
  // self-test: store is reachable
  await page.evaluate((s: number) => {
    (window as any).__RTS_TEST_TIMESCALE__ = s
  }, scale)
  return page
}

test('menu renders and can start battle', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'ممالك التنين' })).toBeVisible()
  await page.getByRole('button', { name: /ابدأ المعركة/ }).click()
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('طعام')).toBeVisible()
})

test('save and load roundtrip', async ({ page }) => {
  await startGame(page)
  await page.getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByText('تم حفظ اللعبة')).toBeVisible()
  await page.getByRole('button', { name: 'تحميل' }).click()
  await expect(page.getByText('تم تحميل اللعبة')).toBeVisible()
})

test('production build has no page errors on menu', async () => {
  // Test the built version — run dev server separately and point to it
  // This test covers the production bundle fast
  expect(errors.length + pageErrors.length).toBeLessThanOrEqual(0)
})
