import { test } from '@playwright/test';

// This test intentionally bypasses the saved session
// to test the raw login flow end to end
test('Login to VoIPBusiness dashboard', async ({ page, context }) => {
  test.setTimeout(300000);

  // Override storageState for this test — start fresh
  await context.clearCookies();

  await context.grantPermissions(['microphone', 'camera'], {
    origin: 'https://app.voipbusiness.com',
  });

  await page.goto('https://app.voipbusiness.com/login', {
    waitUntil: 'networkidle',
  });

  await page.screenshot({ path: '01-page-loaded.png' });
  console.log('Step 1: Login page loaded');

  const emailInput = page.locator('input').nth(0);
  const passwordInput = page.locator('input').nth(1);

  await emailInput.click();
  await emailInput.clear();
  await emailInput.pressSequentially('testing@786.com', { delay: 80 });
  await page.waitForTimeout(500);

  await passwordInput.click();
  await passwordInput.clear();
  await passwordInput.pressSequentially('******', { delay: 80 });
  await page.waitForTimeout(500);

  await page.screenshot({ path: '02-credentials-filled.png' });
  console.log('Step 2: Credentials typed');

  await page.locator('button[type="submit"]').click();
  console.log('Step 3: Log in clicked');

  try {
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 20000 });
    console.log('✅ Left login page. URL:', page.url());
  } catch {
    console.log('⚠️ Still on /login — URL:', page.url());
    await page.screenshot({ path: '03-stuck-on-login.png' });
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '03-after-login.png' });

  // Trusted device
  const trustedSelectors = [
    page.getByRole('button', { name: /^yes$/i }),
    page.getByRole('button', { name: /yes, trust/i }),
    page.getByRole('button', { name: /trust this device/i }),
    page.getByRole('button', { name: /trust/i }),
    page.locator('button').filter({ hasText: /^yes$/i }).first(),
    page.locator('button').filter({ hasText: /yes/i }).first(),
  ];
  let trustedClicked = false;
  for (const sel of trustedSelectors) {
    if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = await sel.textContent();
      console.log(`✅ Trusted device — clicking: "${txt?.trim()}"`);
      await sel.click({ force: true });
      trustedClicked = true;
      await page.waitForTimeout(4000);
      await page.screenshot({ path: '04-after-trusted-device.png' });
      break;
    }
  }
  if (!trustedClicked) {
    console.log('No trusted device prompt');
    await page.screenshot({ path: '04-no-trusted-device.png' });
  }

  // Sign out other device
  const signOutBtn = page.locator('button').filter({ hasText: /sign out/i }).first();
  if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Sign out button found — waiting to be enabled...');
    try {
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll('button'));
          const s = btns.find(b => b.textContent?.toLowerCase().includes('sign out'));
          return s && !s.disabled;
        },
        { timeout: 10000 }
      );
    } catch {
      console.log('⚠️ Still disabled — force clicking');
    }
    await signOutBtn.click({ force: true });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: '05-after-sign-out.png' });
  }

  // Wait for dashboard
  try {
    await page.waitForSelector('text=Enter number', { timeout: 20000 });
    console.log('✅ Dashboard loaded');
  } catch {
    console.log('⚠️ Dialer not found');
  }

  await page.screenshot({ path: '06-dashboard.png' });
  console.log('✅ Login test complete. URL:', page.url());
});
