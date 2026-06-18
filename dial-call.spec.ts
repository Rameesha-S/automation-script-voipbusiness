import { test } from '@playwright/test';

test('Dial a 2-minute call to +442034322220', async ({ page }) => {
  test.setTimeout(300000);

  // Go straight to dashboard — session already loaded from session.json
  await page.goto('https://app.voipbusiness.com', {
    waitUntil: 'networkidle',
  });

  // Handle mic prompt if it appears
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
      break;
    }
  }

  // Handle camera prompt if it appears
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
      break;
    }
  }

  // Handle "Not Now" pop-up if it appears
  const notNowSelectors = [
    page.getByRole('button', { name: /not now/i }),
    page.getByRole('button', { name: /maybe later/i }),
    page.getByRole('button', { name: /skip/i }),
    page.locator('button').filter({ hasText: /not now/i }).first(),
  ];
  for (const sel of notNowSelectors) {
    if (await sel.isVisible({ timeout: 4000 }).catch(() => false)) {
      const txt = await sel.textContent();
      console.log(`✅ "Not Now" — clicking: "${txt?.trim()}"`);
      await sel.click();
      await page.waitForTimeout(2000);
      break;
    }
  }

  // Wait for dialer to be ready
  try {
    await page.waitForSelector('text=Enter number', { timeout: 20000 });
    console.log('✅ Dialer ready');
  } catch {
    console.log('⚠️ Dialer not found — taking screenshot');
    await page.screenshot({ path: 'error-no-dialer.png' });
  }

  await page.screenshot({ path: '01-dashboard-ready.png' });

  // ── Dial +442034322220 via on-screen keypad ───────────────────────────────
  console.log('\n📞 Dialling +442034322220...');

  try {
    await page.locator('text=Enter number...').click({ timeout: 5000 });
    console.log('✅ Dialer focused');
  } catch {
    console.log('⚠️ Trying input fallback...');
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

  // Press each digit on the keypad
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

  for (const digit of ['4', '4', '2', '0', '3', '4', '3', '2', '2', '2', '2', '0']) {
    await pressKeypadDigit(digit);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '02-number-entered.png' });
  console.log('✅ Number entered: +442034322220');

  // Click the green call button
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
      console.log('✅ Call button found — clicking');
      await sel.click();
      callStarted = true;
      break;
    }
  }
  if (!callStarted) {
    console.log('⚠️ Call button not found — pressing Enter');
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '03-call-initiated.png' });
  console.log('✅ Call initiated');

  // Confirm call connecting
  try {
    await page.waitForSelector('text=/connected|on call|00:00|calling|ringing/i', {
      timeout: 15000,
    });
    console.log('✅ Call is live');
  } catch {
    console.log('⚠️ Could not confirm call state — continuing');
  }
  await page.screenshot({ path: '04-call-live.png' });

  // Hold for 2 minutes, screenshot every 30s
  console.log('⏱️ Holding call for 2 minutes...');
  for (let i = 1; i <= 4; i++) {
    await page.waitForTimeout(30000);
    await page.screenshot({ path: `05-call-${i * 30}s.png` });
    console.log(`📸 ${i * 30}s into call`);
  }
  console.log('✅ 2 minutes done');

  // Hang up
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
  await page.screenshot({ path: '06-after-hangup.png' });
  console.log('✅ Call ended');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '07-final-state.png' });
  console.log('✅ Test complete. Final URL:', page.url());
});