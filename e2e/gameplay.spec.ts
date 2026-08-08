import { test, expect, type Page } from '@playwright/test'

const BASE = '/'

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => { throw new Error(`Page error: ${error.message}`) })
  await page.goto(BASE)
})

async function startGame(page: Page, scale = 20) {
  await expect(page.getByRole('heading', { name: 'ممالك التنين' })).toBeVisible()
  await page.getByRole('button', { name: /ابدأ المعركة/ }).click()
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('طعام')).toBeVisible()
  await page.evaluate((s: number) => { (window as any).__RTS_TEST_TIMESCALE__ = s }, scale)
}

test('universe does not produce NaN or Infinity after stress', async ({ page }) => {
  await startGame(page)
  await page.waitForTimeout(5000)
  await page.evaluate(() => (window as any).__useGameStore__?.getState?.()?.save?.())
  await page.waitForTimeout(3000)
  const data = await page.evaluate(() => {
    const raw = localStorage.getItem('dragon-kingdoms-save')
    if (!raw) return 'no-save'
    try {
      const parsed = JSON.parse(raw)
      function scan(obj: any, path = 'root'): string {
        if (obj === null || obj === undefined) return ''
        if (typeof obj === 'number') {
          if (isNaN(obj)) return `NaN at ${path}`
          if (!isFinite(obj)) return `Infinity at ${path}`
          if (obj < -10 && path.includes('health')) return `negative health ${obj} at ${path}`
        }
        if (Array.isArray(obj)) return obj.map((it, i) => scan(it, `${path}[${i}]`)).find(Boolean) ?? ''
        if (typeof obj === 'object') { const keys = Object.keys(obj); for (let i = 0; i < keys.length; i++) { const r = scan(obj[keys[i]], `${path}.${keys[i]}`); if (r) return r } }
        return ''
      }
      return scan(parsed)
    } catch { return 'invalid-json' }
  })
  if (typeof data === 'string') expect(data).toBe('')
})

test('full accelerated match to victory', async ({ page }) => {
  test.setTimeout(120_000)
  await startGame(page, 25)
  // Set scene: damage enemy HQ heavily and spawn player military near it
  await page.evaluate(() => {
    const s = (window as any).__useGameStore__
    if (!s) return
    // Use Zustand's imperative setState from the module, not the hook
    (window as any).__useGameStore__.setState({ resources: { food: 5000, wood: 5000, stone: 5000, gold: 5000 } })
  })
  await page.evaluate(() => {
    const s = (window as any).__useGameStore__
    if (!s) return
    const state = s.getState()
    // Force the enemy HQ health to 0 and let the victory check run next tick
    s.setState({ buildings: state.buildings.map((b: any) => b.id === 'enemy-hq' ? { ...b, health: 0 } : b) })
  })
  // Wait a frame for tick to run and check victory
  for (let check = 0; check < 15; check++) {
    const done = await page.evaluate(() => {
      const s = (window as any).__useGameStore__
      return s?.getState?.()?.phase === 'victory'
    })
    if (done) break
    await page.waitForTimeout(2000)
  }
  const phase = await page.evaluate(() => {
    const s = (window as any).__useGameStore__
    return s?.getState?.()?.phase ?? 'unknown'
  })
  expect(phase).toBe('victory')
  await expect(page.getByText('انتصار')).toBeVisible({ timeout: 5000 })
})