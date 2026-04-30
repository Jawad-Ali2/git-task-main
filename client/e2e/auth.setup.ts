import { test as setup, expect } from '@playwright/test';
// import * as OTPAuth from "otpauth"
import path from 'path';

// TODO: Use a dummy account and setup it's OTP Secret
// const totp = new OTPAuth.TOTP({
//   issuer: "GitHub",
//   label: "Kashaf",
//   algorithm: "SHA1",
//   digits: 6,
//   period: 30,
//   secret: process.env.GITHUB_OTP_SECRET,
// })
const OTPCode = "123456"

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup("authenticate", async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click(); // Q: Can't the button text be changed tho?
    await page.getByRole('link', { name: 'Login with GitHub' }).click();

    await page.getByLabel("Username or email address").click()
    await page
        .getByLabel("Username or email address")
        .fill(process.env.GITHUB_USER!);
    await page.getByLabel("Username or email address").press("Tab");
    await page.getByLabel("Password").fill(process.env.GITHUB_PW!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByPlaceholder("XXXXXX").click();
    // await page.getByPlaceholder("XXXXXX").fill(totp.generate());
    await page.getByPlaceholder("XXXXXX").fill(OTPCode);

    // Wait for the final URL to ensure that the cookies are actually set.
    await page.waitForURL(/dashboard/);
    await expect(page.locator('h2')).toContainText('Dashboard')

    // Save session and cookies
    await page.context().storageState({ path: authFile });
})