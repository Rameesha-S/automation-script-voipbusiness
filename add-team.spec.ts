import { expect, test, type Locator, type Page } from '@playwright/test';

const TEAM_WORDS = [
  'Sales', 'Support', 'Billing', 'Operations', 'Dispatch',
  'Success', 'Admin', 'Service', 'Voice', 'Desk'
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

async function getAppFrame(page: Page) {
  const h1IframeBox = await page.locator('iframe[src*="h1-lara"]').first().boundingBox().catch(() => null);
  const iframeBox = h1IframeBox ?? await page.locator('iframe').first().boundingBox().catch(() => null);
  const frame =
    page.frames().find(candidate => candidate.url().includes('h1-lara.0p.network')) ??
    page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url().includes('voipbusiness')) ??
    page.frames().find(candidate => candidate !== page.mainFrame() && candidate.parentFrame() === page.mainFrame()) ??
    page.frames().find(candidate => candidate !== page.mainFrame());

  return { frame, iframeBox };
}

async function clickVisualPoint(page: Page, x: number, y: number, label: string) {
  const { frame, iframeBox } = await getAppFrame(page);
  const inIframe =
    Boolean(frame && iframeBox) &&
    x >= iframeBox!.x &&
    y >= iframeBox!.y &&
    x <= iframeBox!.x + iframeBox!.width &&
    y <= iframeBox!.y + iframeBox!.height;

  const clickInDocument = ({ x: px, y: py, scope }: { x: number; y: number; scope: string }) => {
    function clickInDocument(doc: Document, pointX: number, pointY: number, scope: string) {
      const element = doc.elementFromPoint(pointX, pointY) as HTMLElement | null;
      const clickable =
        element?.closest<HTMLElement>('button, a, [role="button"], [tabindex], li, [class*="cursor"], [class*="menu"]') ??
        element;

      clickable?.click();

      return {
        clicked: Boolean(clickable),
        scope,
        tagName: element?.tagName,
        className: typeof element?.className === 'string' ? element.className : '',
        text: element?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? '',
        clickableTagName: clickable?.tagName,
        clickableClassName: typeof clickable?.className === 'string' ? clickable.className : '',
        clickableText: clickable?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? '',
      };
    }

    return clickInDocument(document, px, py, scope);
  };

  const clicked =
    inIframe && frame && iframeBox
      ? await frame.evaluate(clickInDocument, {
          x: x - iframeBox.x,
          y: y - iframeBox.y,
          scope: 'iframe',
        })
      : await page.evaluate(clickInDocument, { x, y, scope: 'page' });

  console.log(`${label} coordinate element:`, JSON.stringify(clicked));

  if (!clicked.clicked) {
    await page.mouse.click(x, y, { delay: 100 });
  }
}

async function clickBottomLeftSettingsIcon(page: Page) {
  await page.screenshot({ path: 'team-before-settings-click.png' });

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

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const coordinateCandidates = [
    { x: 30, y: viewport.height - 122 },
    { x: 30, y: 598 },
    { x: 30, y: 441 },
  ];

  for (const point of coordinateCandidates) {
    const x = Math.min(point.x, viewport.width - 1);
    const y = Math.min(point.y, viewport.height - 1);

    console.log(`Clicking Settings fallback coordinate: x=${x}, y=${y}`);
    await page.mouse.move(x, y);
    await page.screenshot({ path: 'team-settings-icon-before-click.png' });
    await clickVisualPoint(page, x, y, 'Settings');
    await page.waitForTimeout(1000);

    const { frame } = await getAppFrame(page);
    if (frame?.url().includes('/settings')) {
      console.log('Settings page opened');
      return;
    }
  }

  console.log('Settings route was not detected after coordinate clicks; continuing to Settings menu click');
}

async function clickTeamsInSettings(page: Page) {
  const addTeamButton = page.getByRole('button', { name: /add team/i });
  if (await addTeamButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Teams section already open');
    return;
  }

  const teamCandidates = [
    page.getByRole('link', { name: /^teams$/i }),
    page.getByRole('button', { name: /^teams$/i }),
    page.locator('[aria-label*="teams" i]').first(),
    page.locator('[title*="teams" i]').first(),
    page.locator('[data-testid*="teams" i]').first(),
    page.locator('a[href*="teams" i]').first(),
    page.locator('a, button, [role="button"]').filter({ hasText: /^teams$/i }).first(),
    page.getByText(/^Teams$/).first(),
  ];

  for (const candidate of teamCandidates) {
    if (await clickIfVisible(candidate, 'Teams')) {
      return;
    }
  }

  const clicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => {
        const text = element.innerText?.replace(/\s+/g, ' ').trim();
        return (
          text === 'Teams' &&
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
    console.log('Clicked Teams text in Settings menu');
    return;
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(145, viewport.width - 1);
  const y = Math.min(405, viewport.height - 1);
  console.log(`Clicking Teams fallback coordinate: x=${x}, y=${y}`);
  await clickVisualPoint(page, x, y, 'Teams');
  console.log('Clicked Teams by fallback coordinate');
}

async function waitForTeamsPage(page: Page) {
  const { frame } = await getAppFrame(page);
  const addTeamButton = frame?.getByRole('button', { name: /add team/i }) ?? page.getByRole('button', { name: /add team/i });

  try {
    await addTeamButton.waitFor({
      state: 'visible',
      timeout: 5000,
    });
  } catch {
    await page.screenshot({ path: 'teams-page-timeout.png', fullPage: true }).catch(() => undefined);
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    console.log('Add team button did not appear. URL:', page.url());
    console.log(bodyText.substring(0, 1000));
    console.log('Continuing with visual Add team fallback');
  }
}

async function isAddTeamModalOpen(page: Page) {
  const { frame } = await getAppFrame(page);
  const source = frame ?? page;
  return source
    .locator('[data-modal="AddTeamModal"], .vm--modal')
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
}

async function assertNotStillOnDialer(page: Page, screenshotPath: string) {
  const title = await page.screenshot({ path: screenshotPath });
  const pngSignature = title.subarray(0, 8).toString('hex');
  if (pngSignature !== '89504e470d0a1a0a') {
    throw new Error(`Could not verify screenshot ${screenshotPath}`);
  }

  const dialerVisible = await page.getByText(/Enter number/i).isVisible({ timeout: 1000 }).catch(() => false);
  if (dialerVisible) {
    throw new Error('Still on the dialer/activity screen; Settings > Teams did not open.');
  }
}

async function clickAddTeam(page: Page) {
  const { frame } = await getAppFrame(page);
  const addTeamCandidates = [
    frame?.getByRole('button', { name: /add team/i }),
    frame?.locator('button').filter({ hasText: /add team/i }).first(),
    frame?.getByText(/^Add team$/i).first(),
    page.getByRole('button', { name: /add team/i }),
    page.locator('button').filter({ hasText: /add team/i }).first(),
    page.getByText(/^Add team$/i).first(),
  ];

  for (const candidate of addTeamCandidates) {
    if (candidate && await clickIfVisible(candidate, 'Add team')) {
      await page.waitForTimeout(1000);
      if (await isAddTeamModalOpen(page)) {
        console.log('Add team modal opened');
        return;
      }
      console.log('Add team click did not open modal; trying next fallback');
    }
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const x = Math.min(1108, viewport.width - 1);
    const y = Math.min(73, viewport.height - 1);
    console.log(`Clicking Add team fallback coordinate: x=${x}, y=${y}, attempt=${attempt}`);
    await clickVisualPoint(page, x, y, 'Add team');
    await page.waitForTimeout(1000);
    if (await isAddTeamModalOpen(page)) {
      console.log('Add team modal opened by fallback coordinate');
      return;
    }
  }

  throw new Error('Add team modal did not open');
}

async function fillInputWithFallback(
  page: Page,
  locator: Locator,
  value: string,
  fallback: { x: number; y: number },
  label: string
) {
  if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
    await locator.fill(value, { force: true, timeout: 5000 });
    console.log(`${label}: ${value}`);
    return;
  }

  console.log(`Filling ${label} by fallback coordinate: x=${fallback.x}, y=${fallback.y}`);
  await clickVisualPoint(page, fallback.x, fallback.y, label);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value, { delay: 80 });
  console.log(`${label}: ${value}`);
}

async function fillTeamNameIfPresent(page: Page, teamName: string) {
  const { frame } = await getAppFrame(page);
  const source = frame ?? page;
  const teamNameInput = source
    .locator('[data-modal="AddTeamModal"] input, .vm--modal input')
    .first();

  try {
    await teamNameInput.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    await page.screenshot({ path: 'team-name-input-timeout.png', fullPage: true }).catch(() => undefined);
    throw error;
  }

  await fillInputWithFallback(page, teamNameInput, teamName, { x: 635, y: 388 }, 'Team name');
}

async function clickCreateTeam(page: Page) {
  const { frame } = await getAppFrame(page);
  const createTeamCandidates = [
    frame?.locator('[data-modal="AddTeamModal"] button').filter({ hasText: /create team/i }).first(),
    frame?.locator('.vm--modal button').filter({ hasText: /create team/i }).first(),
    frame?.getByRole('button', { name: /^create team$/i }),
    frame?.locator('button').filter({ hasText: /create team/i }).first(),
    page.getByRole('button', { name: /^create team$/i }),
    page.locator('button').filter({ hasText: /create team/i }).first(),
    page.getByText(/^Create team$/i).first(),
  ];

  for (const candidate of createTeamCandidates) {
    if (candidate && await clickIfVisible(candidate, 'Create team')) {
      return;
    }
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(635, viewport.width - 1);
  const y = Math.min(478, viewport.height - 1);
  console.log(`Clicking Create team fallback coordinate: x=${x}, y=${y}`);
  await clickVisualPoint(page, x, y, 'Create team');
  console.log('Clicked Create team by fallback coordinate');
}

async function ensureLoggedIn(page: Page) {
  await page.goto('https://app.voipbusiness.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  if (page.url().includes('/login')) {
    console.log('Session expired - logging in manually...');

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
      console.log('Logged in. URL:', page.url());
    } catch {
      console.log('Still on login after 20s');
    }

    await page.waitForTimeout(3000);

    const trustedSelectors = [
      page.getByRole('button', { name: /^yes$/i }),
      page.getByRole('button', { name: /yes, trust/i }),
      page.getByRole('button', { name: /trust/i }),
      page.locator('button').filter({ hasText: /^yes$/i }).first(),
    ];
    for (const sel of trustedSelectors) {
      if (await sel.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Trusted device - clicking Yes');
        await sel.click({ force: true });
        await page.waitForTimeout(4000);
        break;
      }
    }

    const signOutBtn = page.locator('button').filter({ hasText: /sign out/i }).first();
    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Sign out other device - waiting to enable...');
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
        console.log('Still disabled - force clicking');
      }
      await signOutBtn.click({ force: true });
      await page.waitForTimeout(4000);
    }

    await page.waitForTimeout(3000);
  }

  await waitForDashboardToLoad(page);

  console.log('On dashboard. URL:', page.url());
}

test('Add a new team via Settings', async ({ page }) => {
  test.setTimeout(420000);

  await ensureLoggedIn(page);
  await page.screenshot({ path: 'team-01-dashboard.png' });

  const word = TEAM_WORDS[Math.floor(Math.random() * TEAM_WORDS.length)];
  const teamName = `${word} Team ${Date.now().toString().slice(-4)}`;
  console.log(`Creating team: ${teamName}`);

  console.log('Navigating to Settings > Teams...');
  await waitForDashboardToLoad(page);
  await clickBottomLeftSettingsIcon(page);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'team-02-settings-page.png' });
  console.log('URL after Settings click:', page.url());

  await clickTeamsInSettings(page);
  await waitForTeamsPage(page);
  await page.screenshot({ path: 'team-03-teams-page.png' });
  await assertNotStillOnDialer(page, 'team-03-teams-page-verified.png');
  console.log('Teams section ready. URL:', page.url());

  await clickAddTeam(page);
  console.log('Add team clicked');

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'team-04-create-team-modal.png' });

  await fillTeamNameIfPresent(page, teamName);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'team-05-form-filled.png' });

  await clickCreateTeam(page);
  console.log('Create team clicked');

  const { frame: frameAfterCreate } = await getAppFrame(page);
  const sourceAfterCreate = frameAfterCreate ?? page;
  await sourceAfterCreate
    .locator('[data-modal="AddTeamModal"], .vm--modal')
    .first()
    .waitFor({ state: 'hidden', timeout: 90000 })
    .catch(() => console.log('Add team modal did not close within 90s; checking list anyway'));

  await page.screenshot({ path: 'team-06-after-create.png' });
  const { frame } = await getAppFrame(page);
  const teamInList = frame?.getByText(teamName, { exact: true }) ?? page.getByText(teamName, { exact: true });
  await expect(teamInList).toBeVisible({ timeout: 30000 });
  console.log(`Team "${teamName}" creation flow completed`);
  console.log('Final URL:', page.url());
});
