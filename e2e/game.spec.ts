import { expect, test } from '@playwright/test'

async function dismissTutorial(page: import('@playwright/test').Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Tạo thế giới sống' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).click()
  await expect(dialog).toBeHidden()
}

test('landing opens a playable WebGL world and map tools mutate it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Aetheria: World Shaper' })).toBeVisible()
  await page.locator('a[href="/play"]').first().click()
  await expect(page).toHaveURL(/\/play\?seed=/)

  await dismissTutorial(page)
  const canvas = page.locator('canvas.world-canvas')
  await expect(canvas).toBeVisible()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('World canvas did not provide bounds')
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } })
  await expect(page.getByRole('button', { name: /Hoàn tác/ })).toBeEnabled()
})

test.describe('mobile controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })

  test('has no horizontal overflow and exposes motion, sound, and tutorial controls', async ({ page }) => {
    await page.goto('/play?seed=e2e-mobile')
    await dismissTutorial(page)

    await expect(page.locator('canvas.world-canvas')).toBeVisible()
    await page.locator('button.drawer-toggle-left').click()
    const drawer = page.locator('#world-controls-drawer')
    await expect(drawer).toBeVisible()

    const motion = drawer.locator('#graphics-motion-preference')
    await motion.selectOption('full')
    await expect(motion).toHaveValue('full')
    await expect(drawer.locator('.toggle-field')).toBeVisible()
    await drawer.locator('.graphics-experience-controls .secondary-button').click()
    await expect(page.locator('.tutorial-card')).toBeVisible()

    await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true)
  })
})
