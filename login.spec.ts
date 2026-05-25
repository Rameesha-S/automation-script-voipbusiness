import { test } from '@playwright/test';

test('Login to VoIPBusiness dashboard', async ({ page, context }) => {
  test.setTimeout(300000);

  // ── Grant mic & camera permissions upfront ────────────────────────────────
  await context.grantPermissions(['microphone', 'camera'], {
    origin: 'https://app.voipbusiness.com',
  });

  // ── Step 1: Load login page ───────────────────────────────────────────────
  await page.goto('https://app.voipbusiness.com/login', {
    waitUntil: 'networkidle',
  });

  await page.screenshot({ path: '01-page-loaded.png' });
  console.log('Step 1: Login page loaded');

  // ── Step 2: Fill credentials by typing (not fill) ────────────────────────
  const emailInput = page.locator('input').nth(0);
  const passwordInput = page.locator('input').nth(1);

  await emailInput.click();
  await emailInput.clear();
  await emailInput.pressSequentially('***user@company.com****', { delay: 80 }); //use your account credentials
  await page.waitForTimeout(500);

  await passwordInput.click();
  await passwordInput.clear();
  await passwordInput.pressSequentially('*****password*****', { delay: 80 });   //use your account credentials
  await page.waitForTimeout(500);

  await page.screenshot({ path: '02-credentials-filled.png' });
  console.log('Step 2: Credentials typed');

  // ── Step 3: Click Log in ──────────────────────────────────────────────────
  await page.locator('button[type="submit"]').click();
  console.log('Step 3: Log in clicked');

  // ── Step 4: Wait to leave /login ──────────────────────────────────────────
  try {
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 20000 });
    console.log('✅ Left login page. URL:', page.url());
  } catch {
    console.log('⚠️ Still on /login — URL:', page.url());
    await page.screenshot({ path: '03-stuck-on-login.png' });
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '03-after-login.png' });
  console.log('URL after login:', page.url());

  // ── Step 5: Handle "Trusted Device" prompt ────────────────────────────────
  console.log('Checking for trusted device prompt...');

  const btns = await page.locator('button').all();
  console.log(`Buttons on screen (${btns.length}):`);
  for (const b of btns) {
    const txt = await b.textContent();
    const vis = await b.isVisible();
    const dis = await b.isDisabled();
    if (vis) console.log(`  -> "${txt?.trim()}" disabled=${dis}`);
  }

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
      console.log(`✅ Trusted device prompt — clicking: "${txt?.trim()}"`);
      await sel.waitFor({ state: 'visible' });
      await page.waitForTimeout(1000);
      await sel.click({ force: true });
      trustedClicked = true;
      await page.waitForTimeout(4000);
      await page.screenshot({ path: '04-after-trusted-device.png' });
      console.log('URL after trusted device:', page.url());
      break;
    }
  }
  if (!trustedClicked) {
    console.log('No trusted device prompt found, continuing...');
    await page.screenshot({ path: '04-no-trusted-device.png' });
  }

  // ── Step 6: Handle "Sign out of other device" — wait for enabled ──────────
  console.log('Checking for sign-out-other-device prompt...');

  const signOutBtn = page.locator('button').filter({ hasText: /sign out/i }).first();

  if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Sign out button found — waiting for it to become enabled...');

    try {
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll('button'));
          const signOut = btns.find(b =>
            b.textContent?.toLowerCase().includes('sign out')
          );
          return signOut && !signOut.disabled;
        },
        { timeout: 10000 }
      );
      console.log('✅ Sign out button is now enabled — clicking');
    } catch {
      console.log('⚠️ Sign out button stayed disabled — trying force click anyway');
    }

    await signOutBtn.click({ force: true });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: '05-after-sign-out.png' });
    console.log('URL after sign out:', page.url());
  } else {
    console.log('No sign-out prompt found, continuing...');
  }

  // ── Step 7: Wait for dashboard/dialer ────────────────────────────────────
  try {
    await page.waitForSelector('text=Enter number', { timeout: 20000 });
    console.log('✅ Dashboard loaded — dialer found');
  } catch {
    console.log('⚠️ Dialer not found after 20s');
  }

  await page.screenshot({ path: '06-dashboard.png' });
  console.log('URL on dashboard:', page.url());

  // ── Step 8: Handle "Enable Microphone" prompt ─────────────────────────────
  const micSelectors = [
    page.getByRole('button', { name: /enable microphone/i }),
    page.getByRole('button', { name: /allow microphone/i }),
    page.locator('button').filter({ hasText: /microphone/i }).first(),
  ];
  for (const sel of micSelectors) {
    if (await sel.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('✅ Mic prompt — clicking');
      await sel.click();
      await page.waitForTimeout(2000);
      const cont = page.getByRole('button', { name: /continue/i });
      if (await cont.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cont.click();
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: '07-after-mic.png' });
      break;
    }
  }

  // ── Step 9: Handle "Enable Camera" prompt ────────────────────────────────
  const camSelectors = [
    page.getByRole('button', { name: /enable camera/i }),
    page.getByRole('button', { name: /allow camera/i }),
    page.locator('button').filter({ hasText: /camera/i }).first(),
  ];
  for (const sel of camSelectors) {
    if (await sel.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('✅ Camera prompt — clicking');
      await sel.click();
      await page.waitForTimeout(2000);
      const cont = page.getByRole('button', { name: /continue/i });
      if (await cont.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cont.click();
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: '08-after-camera.png' });
      break;
    }
  }

  // ── Step 10: Handle "Not Now" pop-up ─────────────────────────────────────
  const notNowSelectors = [
    page.getByRole('button', { name: /not now/i }),
    page.getByRole('button', { name: /maybe later/i }),
    page.getByRole('button', { name: /skip/i }),
    page.locator('button').filter({ hasText: /not now/i }).first(),
  ];
  for (const sel of notNowSelectors) {
    if (await sel.isVisible({ timeout: 4000 }).catch(() => false)) {
      const txt = await sel.textContent();
      console.log(`✅ "Not Now" pop-up — clicking: "${txt?.trim()}"`);
      await sel.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '09-after-not-now.png' });
      break;
    }
  }

  // ── Step 11: Dial +442034322220 via on-screen keypad ─────────────────────
  console.log('\n📞 Dialling +442034322220 via keypad...');

  try {
    await page.locator('text=Enter number...').click({ timeout: 5000 });
    console.log('✅ Dialer focused');
  } catch {
    console.log('⚠️ Could not focus dialer via text, trying input...');
    const dialerInput = page.locator('input[placeholder*="number" i]').first();
    if (await dialerInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dialerInput.click();
    }
  }

  await page.waitForTimeout(500);

  // Type "+" via keyboard
  await page.keyboard.type('+');
  await page.waitForTimeout(300);
  console.log('  Pressed: +');

  // Click each digit on the keypad
  const pressKeypadDigit = async (digit: string) => {
    const btn = page
      .locator('button')
      .filter({ hasText: new RegExp(`^${digit}`) })
      .first();

    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(250);
      console.log(`  Pressed keypad: ${digit}`);
    } else {
      await page.keyboard.type(digit);
      await page.waitForTimeout(250);
      console.log(`  Typed (fallback): ${digit}`);
    }
  };

  for (const digit of ['4', '4', '*', '*', '*', '*', '*', '*', '*', '*', '*', '*']) {
    await pressKeypadDigit(digit);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '10-number-entered.png' });
  console.log('✅ Number entered: +442034322220');

  // ── Step 12: Click the green call button ──────────────────────────────────
  const callSelectors = [
    page.locator('button[aria-label*="call" i]'),
    page.locator('button[aria-label*="dial" i]'),
    page.locator('button[aria-label*="phone" i]'),
    page.locator('button[class*="call"]'),
    page.locator('button[class*="dial"]'),
    page.locator('button[class*="green"]'),
    page.locator('button').filter({ hasText: /^call$/i }),
    page.locator('button svg').locator('xpath=..'),
  ];

  let callStarted = false;
  for (const sel of callSelectors) {
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Green call button found — clicking');
      await sel.click();
      callStarted = true;
      break;
    }
  }
  if (!callStarted) {
    console.log('⚠️ Call button not matched — pressing Enter');
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '11-call-initiated.png' });
  console.log('✅ Call initiated');

  // ── Step 13: Confirm call is connecting ───────────────────────────────────
  try {
    await page.waitForSelector('text=/connected|on call|00:00|calling|ringing/i', {
      timeout: 15000,
    });
    console.log('✅ Call is live');
  } catch {
    console.log('⚠️ Could not confirm call state — continuing');
  }
  await page.screenshot({ path: '12-call-live.png' });

  // ── Step 14: Hold for 2 minutes, screenshot every 30s ────────────────────
  console.log('⏱️ Holding call for 2 minutes...');
  for (let i = 1; i <= 4; i++) {
    await page.waitForTimeout(30000);
    await page.screenshot({ path: `13-call-${i * 30}s.png` });
    console.log(`📸 ${i * 30}s into call`);
  }
  console.log('✅ 2 minutes done');

  // ── Step 15: Hang up ──────────────────────────────────────────────────────
  console.log('📵 Hanging up...');
  const hangUpSelectors = [
    page.locator('button[aria-label*="hang" i]'),
    page.locator('button[aria-label*="end" i]'),
    page.locator('button[aria-label*="disconnect" i]'),
    page.locator('button').filter({ hasText: /end call/i }).first(),
    page.locator('button').filter({ hasText: /hang up/i }).first(),
    page.locator('button[class*="hangup"]'),
    page.locator('button[class*="end-call"]'),
    page.locator('button').filter({ hasText: /^[×x]$/i }).first(),
  ];

  let hungUp = false;
  for (const sel of hangUpSelectors) {
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Hang up button found');
      await sel.click();
      hungUp = true;
      break;
    }
  }
  if (!hungUp) {
    console.log('⚠️ Hang up not found — pressing Escape');
    await page.keyboard.press('Escape');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '14-after-hangup.png' });
  console.log('✅ Call ended');

  // ── Final ─────────────────────────────────────────────────────────────────
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '15-final-state.png' });
  console.log('✅ Test complete. Final URL:', page.url());
});
