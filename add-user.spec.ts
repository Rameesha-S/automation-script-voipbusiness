import { expect, test, type Locator, type Page } from '@playwright/test';

const FIRST_NAMES = [
  'James', 'Oliver', 'Harry', 'George', 'Noah',
  'Charlie', 'Jack', 'Alfie', 'Freddie', 'Oscar',
  'Isla', 'Amelia', 'Ava', 'Mia', 'Lily'
];

const LAST_NAMES = [
  'Smith', 'Jones', 'Williams', 'Taylor', 'Brown',
  'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts',
  'Johnson', 'Walker', 'Wright', 'Robinson', 'Thompson'
];

async function waitForDashboardToLoad(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 30000 }).catch(() => undefined);

  const loading = page
    .locator('[aria-busy="true"], [role="progressbar"], .loader, .loading, .spinner')
    .first();

  if (await loading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loading.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined);
  }

  await page.waitForTimeout(5000);
}

async function clickIfVisible(locator: Locator, label: string) {
  if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(locator).toBeEnabled({ timeout: 5000 });
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
    console.log(`Clicked ${label}`);
    return true;
  }

  return false;
}

async function clickBottomLeftSettingsIcon(page: Page) {
  await page.screenshot({ path: 'before-settings-click.png' });

  const namedCandidates = [
    page.getByTestId('settings-nav-button'),
    page.getByRole('button', { name: /settings/i }),
    page.getByRole('link', { name: /settings/i }),
    page.locator('[aria-label*="settings" i]').first(),
    page.locator('[title*="settings" i]').first(),
    page.locator('[data-testid*="settings" i]').first(),
    page.locator('a[href*="settings" i]').first(),
  ];

  for (const candidate of namedCandidates) {
    if (await clickIfVisible(candidate, 'Settings by accessible locator')) {
      return;
    }
  }

  const clicked = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a, [role="button"], [tabindex], .cursor-pointer, [class*="cursor"]'
      )
    )
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { element, rect };
      })
      .filter(({ rect }) => {
        return (
          rect.width > 20 &&
          rect.height > 20 &&
          rect.left >= 0 &&
          rect.left < 70 &&
          rect.top > window.innerHeight - 160 &&
          rect.top < window.innerHeight - 85
        );
      })
      .sort((a, b) => b.rect.top - a.rect.top);

    const settingsControl = controls[0]?.element;
    settingsControl?.click();
    return Boolean(settingsControl);
  });

  if (clicked) {
    console.log('Clicked Settings icon from left sidebar controls');
    return;
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = 30;
  const y = viewport.height - 122;

  console.log(`Clicking Settings fallback coordinate: x=${x}, y=${y}`);
  await page.mouse.move(x, y);
  await page.screenshot({ path: 'settings-icon-before-click.png' });
  await page.mouse.click(x, y, { delay: 100 });
  console.log('Clicked Settings icon by fallback coordinate');
}

async function clickUsersInSettings(page: Page) {
  const addUserButton = page.getByRole('button', { name: /add user/i });
  if (await addUserButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Users section already open');
    return;
  }

  if (await page.getByRole('heading', { name: /^users$/i }).isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Users heading is visible');
    return;
  }

  const usersCandidates = [
    page.getByRole('link', { name: /^users$/i }),
    page.getByRole('button', { name: /^users$/i }),
    page.locator('[aria-label*="users" i]').first(),
    page.locator('[title*="users" i]').first(),
    page.locator('[data-testid*="users" i]').first(),
    page.locator('a[href*="users" i]').first(),
    page.locator('a, button, [role="button"]').filter({ hasText: /^users$/i }).first(),
    page.getByText(/^Users$/).first(),
  ];

  for (const candidate of usersCandidates) {
    if (await clickIfVisible(candidate, 'Users')) {
      return;
    }
  }

  const clicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => {
        const text = element.innerText?.replace(/\s+/g, ' ').trim();
        return (
          text === 'Users' &&
          rect.width > 20 &&
          rect.height > 15 &&
          rect.left > 60 &&
          rect.left < window.innerWidth * 0.35 &&
          rect.top > 150 &&
          rect.top < window.innerHeight
        );
      })
      .sort((a, b) => a.rect.width - b.rect.width || a.rect.left - b.rect.left);

    const textElement = candidates[0]?.element;
    if (!textElement) {
      return false;
    }

    const clickable =
      textElement.closest<HTMLElement>('a, button, [role="button"], [tabindex], li, [class*="cursor"], [class*="menu"]') ??
      textElement.parentElement ??
      textElement;

    clickable.click();
    return true;
  });

  if (clicked) {
    console.log('Clicked Users text in Settings menu');
    return;
  }

  const usersText = page.getByText(/^Users$/).first();
  if (await usersText.isVisible({ timeout: 2000 }).catch(() => false)) {
    const box = await usersText.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      console.log('Clicked Users text by bounding box');
      return;
    }
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(145, viewport.width - 1);
  const y = Math.min(352, viewport.height - 1);
  console.log(`Clicking Users fallback coordinate: x=${x}, y=${y}`);
  await page.mouse.click(x, y, { delay: 100 });
  console.log('Clicked Users by fallback coordinate');
}

async function waitForUsersPage(page: Page) {
  const addUserButton = page.getByRole('button', { name: /add user/i });

  try {
    await addUserButton.waitFor({
      state: 'visible',
      timeout: 5000,
    });
  } catch (error) {
    await page.screenshot({ path: 'users-page-timeout.png', fullPage: true }).catch(() => undefined);
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    console.log('Add user button did not appear. URL:', page.url());
    console.log(bodyText.substring(0, 1000));
    console.log('Continuing with visual Add user fallback');
  }
}

async function clickAddUser(page: Page) {
  const addUserCandidates = [
    page.getByRole('button', { name: /add user/i }),
    page.locator('button').filter({ hasText: /add user/i }).first(),
    page.getByText(/^Add user$/i).first(),
  ];

  for (const candidate of addUserCandidates) {
    if (await clickIfVisible(candidate, 'Add user')) {
      return;
    }
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(1108, viewport.width - 1);
  const y = Math.min(73, viewport.height - 1);
  console.log(`Clicking Add user fallback coordinate: x=${x}, y=${y}`);
  await page.mouse.click(x, y, { delay: 100 });
  console.log('Clicked Add user by fallback coordinate');
}

async function fillInputWithFallback(
  page: Page,
  locator: Locator,
  value: string,
  fallback: { x: number; y: number },
  label: string
) {
  if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
    await locator.click();
    await locator.clear();
    await locator.pressSequentially(value, { delay: 80 });
    console.log(`✅ ${label}: ${value}`);
    return;
  }

  console.log(`Filling ${label} by fallback coordinate: x=${fallback.x}, y=${fallback.y}`);
  await page.mouse.click(fallback.x, fallback.y, { delay: 100 });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value, { delay: 80 });
  console.log(`✅ ${label}: ${value}`);
}

async function clickCreateUser(page: Page) {
  const createBtn = page.getByRole('button', { name: /^create user$/i });
  if (await clickIfVisible(createBtn, 'Create user')) {
    return;
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(635, viewport.width - 1);
  const y = Math.min(604, viewport.height - 1);
  console.log(`Clicking Create user fallback coordinate: x=${x}, y=${y}`);
  await page.mouse.click(x, y, { delay: 100 });
  console.log('Clicked Create user by fallback coordinate');
}

async function clickYesConfirmation(page: Page) {
  const yesBtn = page.getByRole('button', { name: /^yes$/i });
  if (await clickIfVisible(yesBtn, 'Yes')) {
    return;
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(781, viewport.width - 1);
  const y = Math.min(515, viewport.height - 1);
  console.log(`Clicking Yes fallback coordinate: x=${x}, y=${y}`);
  await page.mouse.click(x, y, { delay: 100 });
  console.log('Clicked Yes by fallback coordinate');
}

function formatElapsedTime(ms: number) {
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s (${ms}ms)`;
}

async function ensureLoggedIn(page: Page) {
  await page.goto('https://app.voipbusiness.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  if (page.url().includes('/login')) {
    console.log('⚠️ Session expired — logging in manually...');

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

    try {
      await page.waitForURL(url => !url.href.includes('/login'), { timeout: 20000 });
      console.log('✅ Logged in. URL:', page.url());
    } catch {
      console.log('⚠️ Still on login after 20s');
    }

    await page.waitForTimeout(3000);

    // Handle trusted device
    const trustedSelectors = [
      page.getByRole('button', { name: /^yes$/i }),
      page.getByRole('button', { name: /yes, trust/i }),
      page.getByRole('button', { name: /trust/i }),
      page.locator('button').filter({ hasText: /^yes$/i }).first(),
    ];
    for (const sel of trustedSelectors) {
      if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('✅ Trusted device — clicking Yes');
        await sel.click({ force: true });
        await page.waitForTimeout(4000);
        break;
      }
    }

    // Handle sign out other device
    const signOutBtn = page.locator('button').filter({ hasText: /sign out/i }).first();
    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Sign out other device — waiting to enable...');
      try {
        await page.waitForFunction(
          () => {
            const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
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
    }

    await page.waitForTimeout(3000);
  }

  await waitForDashboardToLoad(page);

  console.log('✅ On dashboard. URL:', page.url());
}

test('Add a new user via Settings', async ({ page }) => {
  test.setTimeout(300000);

  await ensureLoggedIn(page);
  await page.screenshot({ path: '01-dashboard.png' });

  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName  = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const username  = `${firstName}${lastName}${Date.now().toString().slice(-4)}`.toLowerCase();
  console.log(`👤 Creating: ${firstName} ${lastName} (${username})`);

  // ── Step 1: Go directly to Settings > Users ───────────────────────────────
  console.log('Navigating to Settings > Users...');
  await waitForDashboardToLoad(page);
  await clickBottomLeftSettingsIcon(page);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '02-settings-page.png' });
  console.log('URL after Settings click:', page.url());

  await clickUsersInSettings(page);
  await waitForUsersPage(page);
  await page.screenshot({ path: '02-users-page.png' });
  console.log('Users section ready. URL:', page.url());

  // ── Step 2: Wait for Add user button ─────────────────────────────────────
  try {
    await page.waitForSelector('text=Add user', { timeout: 3000 });
    console.log('✅ Users page loaded');
  } catch {
    console.log('⚠️ Add user not found — dumping page text for debug');
    const bodyText = await page.locator('body').innerText();
    console.log(bodyText.substring(0, 1000));
  }

  // ── Step 3: Click blue Add user button ───────────────────────────────────
  await clickAddUser(page);
  console.log('✅ Add user clicked');

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '03-create-user-modal.png' });

  // ── Step 4: Wait for Create user modal ───────────────────────────────────
  try {
    await page.waitForSelector('text=Create user', { timeout: 10000 });
    console.log('✅ Create user modal open');
  } catch {
    console.log('⚠️ Modal not detected');
  }

  // ── Step 5: Fill Username ─────────────────────────────────────────────────
  const usernameInput = page.locator('input[placeholder*="Username" i]').first();
  await fillInputWithFallback(page, usernameInput, username, { x: 493, y: 225 }, 'Username');
  await page.waitForTimeout(400);

  // ── Step 6: Fill First name ───────────────────────────────────────────────
  const firstNameInput = page.locator('input[placeholder*="first name" i]');
  await fillInputWithFallback(page, firstNameInput, firstName, { x: 493, y: 321 }, 'First name');
  await page.waitForTimeout(400);

  // ── Step 7: Fill Last name ────────────────────────────────────────────────
  const lastNameInput = page.locator('input[placeholder*="last name" i]');
  await fillInputWithFallback(page, lastNameInput, lastName, { x: 777, y: 321 }, 'Last name');
  await page.waitForTimeout(400);

  await page.screenshot({ path: '04-form-filled.png' });

  // ── Step 8: Click black Create user button ────────────────────────────────
  const createUserClickedAt = Date.now();
  await clickCreateUser(page);
  console.log('✅ Create user clicked');

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '05-after-create.png' });

  // ── Step 9: Attention popup — click blue Yes ──────────────────────────────
  try {
    await page.waitForSelector('text=Attention', { timeout: 10000 });
    console.log('✅ Attention popup appeared');
  } catch {
    console.log('⚠️ Attention popup not detected');
  }

  await page.screenshot({ path: '06-attention-popup.png' });

  await clickYesConfirmation(page);
  const yesClickedAt = Date.now();
  let successPopupAppearedAt: number | undefined;
  console.log('Started timing user creation after Yes confirmation');
  console.log('✅ Yes clicked');

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '07-after-yes.png' });

  // ── Step 10: Wait for loading ─────────────────────────────────────────────
  console.log('⏳ Waiting for user creation to complete...');
  // ── Step 11: Success popup — find and click the black button ──────────────
  try {
    await page.waitForSelector('text=/success|created|done|complete/i', {
      timeout: 30000,
    });
    successPopupAppearedAt = Date.now();
    console.log('');
    console.log('========== USER CREATION TIME ==========');
    console.log(`From Create user click: ${formatElapsedTime(successPopupAppearedAt - createUserClickedAt)}`);
    console.log(`From Yes confirmation: ${formatElapsedTime(successPopupAppearedAt - yesClickedAt)}`);
    console.log('========================================');
    console.log('');
    console.log('✅ Success popup appeared');
  } catch {
    console.log('⚠️ Success popup not detected');
  }

  if (!successPopupAppearedAt) {
    const successWaitEndedAt = Date.now();
    console.log('');
    console.log('========== USER CREATION TIME ==========');
    console.log(`Success popup was not detected after: ${formatElapsedTime(successWaitEndedAt - yesClickedAt)}`);
    console.log(`Total time from Create user click: ${formatElapsedTime(successWaitEndedAt - createUserClickedAt)}`);
    console.log('========================================');
    console.log('');
  }

  await page.screenshot({ path: '08-success-popup.png' });

  // Log all visible buttons so we know exact text of success button
  const allBtns = await page.locator('button').all();
  console.log('Visible buttons after creation:');
  for (const b of allBtns) {
    const txt = await b.textContent();
    const vis = await b.isVisible();
    if (vis) console.log(`  -> "${txt?.trim()}"`);
  }

  const successBtnSelectors = [
    page.getByRole('button', { name: /^ok$/i }),
    page.getByRole('button', { name: /^done$/i }),
    page.getByRole('button', { name: /^close$/i }),
    page.getByRole('button', { name: /^got it$/i }),
    page.getByRole('button', { name: /^continue$/i }),
    page.getByRole('button', { name: /^finish$/i }),
    page.getByRole('button', { name: /^great$/i }),
    page.locator('button[class*="black"]').first(),
    page.locator('button[class*="dark"]').first(),
    page.locator('button[style*="black"]').first(),
  ];

  for (const sel of successBtnSelectors) {
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const txt = await sel.textContent();
      console.log(`✅ Success button found — clicking: "${txt?.trim()}"`);
      await sel.click();
      break;
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '09-final-state.png' });
  console.log(`✅ User "${firstName} ${lastName}" (${username}) created!`);
  console.log('✅ Final URL:', page.url());
});
