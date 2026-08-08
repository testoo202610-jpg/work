import { test, expect } from '@playwright/test'

test('menu starts a playable battle without runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ممالك التنين' })).toBeVisible()
  await expect(page.getByRole('button', { name: /ابدأ المعركة/ })).toBeVisible()
  await page.getByRole('button', { name: /ابدأ المعركة/ }).click()

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('طعام')).toBeVisible()
  await expect(page.getByText('السكان')).toBeVisible()
  await expect(page.getByText('حفظ')).toBeVisible()
  expect(errors).toEqual([])
})

test('can save and load from the in-game HUD', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /ابدأ المعركة/ }).click()
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByText('تم حفظ اللعبة')).toBeVisible()
  await page.getByRole('button', { name: 'تحميل' }).click()
  await expect(page.getByText('تم تحميل اللعبة')).toBeVisible()
})
