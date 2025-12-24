import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Fleet/)
  })

  test('should have navigation', async ({ page }) => {
    await page.goto('/')
    // Test will be updated once auth is implemented
    await expect(page.locator('body')).toBeVisible()
  })
})
