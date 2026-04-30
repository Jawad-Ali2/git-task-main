import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click(); // Q: Can't the button text be changed tho?
  await page.getByRole('link', { name: 'Login with GitHub' }).click();
  
});

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });

 
// test('should navigate to the about page', async ({ page }) => {
//   // Start from the index page (the baseURL is set via the webServer in the playwright.config.ts)
//   await page.goto('http://localhost:3000/')
//   // Find an element with the text 'About' and click on it
//   await page.click('text=Pricing')
//   // The new URL should be "/about" (baseURL is used there)
//   await expect(page).toHaveURL('http://localhost:3000/pricing')
//   // The new page should contain an h1 with "About"
//   // await expect(page.locator('h1')).toContainText('About')
// })