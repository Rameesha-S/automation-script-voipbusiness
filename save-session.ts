import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await context.grantPermissions(['microphone', 'camera'], {
    origin: 'https://app.voipbusiness.com',
  });

  await page.goto('https://app.voipbusiness.com/login', {
    waitUntil: 'networkidle',
  });

  // Fill credentials
  const emailInput = page.locator('input').nth(0);
  const passwordInput = page.locator('input').nth(1);

  await emailInput.click();
  await emailInput.clear();
  await emailInput.pressSequentially('testing@786.com', { delay: 80 });
  await page.waitForTimeout(500);

  await passwordInput.click();
  await passwordInput.clear();
  await passwordInput.pressSequentially('Madrid1!!', { delay: 80 });
  await page.waitForTimeout(500);

  await page.locator('button[type="submit"]').click();
  console.log('Log in clicked...');

  // Wait to leave /login
  try {
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 20000 });
    console.log('✅ Left login page. URL:', page.url());
  } catch {
    console.log('⚠️ Still on /login — URL:', page.url());
  }

  await page.waitForTimeout(3000);

  // Handle trusted device prompt
  const trustedSelectors = [
    page.getByRole('button', { name: /^yes$/i }),
    page.getByRole('button', { name: /yes, trust/i }),
    page.getByRole('button', { name: /trust this device/i }),
    page.getByRole('button', { name: /trust/i }),
    page.locator('button').filter({ hasText: /^yes$/i }).first(),
    page.locator('button').filter({ hasText: /yes/i }).first(),
  ];
  for (const sel of trustedSelectors) {
    if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = await sel.textContent();
      console.log(`✅ Trusted device prompt — clicking: "${txt?.trim()}"`);
      await sel.click({ force: true });
      await page.waitForTimeout(4000);
      break;
    }
  }

  // Handle sign out of other device
  const signOutBtn = page.locator('button').filter({ hasText: /sign out/i }).first();
  if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Sign out button found — waiting to become enabled...');
     try {
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
          const signOut = btns.find(b =>
            b.textContent?.toLowerCase().includes('sign out')
          );
          return signOut !== undefined && !signOut.disabled;
        },
        { timeout: 10000 }
      );
      console.log('✅ Sign out enabled — clicking');
    } catch {
      console.log('⚠️ Still disabled — force clicking');
    }
    await signOutBtn.click({ force: true });
    await page.waitForTimeout(4000);
  }

  // Wait for dashboard to confirm we are fully logged in
  try {
    await page.waitForSelector('text=Enter number', { timeout: 20000 });
    console.log('✅ Dashboard loaded — session is valid');
  } catch {
    console.log('⚠️ Dashboard not confirmed — saving session anyway');
  }

  // Save session
  await context.storageState({ path: 'session.json' });
  console.log('✅ Session saved to session.json');

  await browser.close();
})();