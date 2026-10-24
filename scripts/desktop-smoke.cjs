// Launches a packaged desktop app, starts a game, ends a week, quits, relaunches and
// resumes the saved game. Fails on any page error or any request that leaves the disk.
//   node scripts/desktop-smoke.cjs <path to the app executable> [screenshot dir]

const { _electron } = require('playwright-core');

const exe = process.argv[2];
const shots = process.argv[3];
if (!exe) throw new Error('usage: desktop-smoke.cjs <executable> [screenshot dir]');

async function launch() {
  const args = process.platform === 'linux' ? ['--no-sandbox'] : [];
  const app = await _electron.launch({ executablePath: exe, args, timeout: 60000 });
  const win = await app.firstWindow();
  const problems = [];
  win.on('pageerror', (e) => problems.push(`page error: ${e}`));
  win.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  win.on('request', (r) => /^(file|data|blob):/.test(r.url()) || problems.push(`network: ${r.url()}`));
  await win.waitForLoadState('domcontentloaded');
  return { app, win, problems };
}

/** Close help, dawn reports, visitors and aftermaths, taking the last answer each time. */
async function dismiss(win) {
  for (let i = 0; i < 40; i++) {
    const btn = win.locator('.modal-backdrop button.btn--primary, .modal-backdrop .audience-options button').last();
    if (!(await btn.isVisible().catch(() => false))) return;
    await btn.click();
    await win.waitForTimeout(200);
  }
}

const week = (win) => win.locator('.week').first().textContent();

(async () => {
  let { app, win, problems } = await launch();
  console.log('window:', await win.title());
  await win.getByRole('button', { name: /Enter the court/ }).click({ timeout: 30000 });
  await win.locator('.end-week').waitFor({ timeout: 30000 });
  await dismiss(win);
  const before = await week(win);
  await win.locator('.end-week').click();
  await win.waitForTimeout(500);
  await dismiss(win);
  const after = await week(win);
  console.log('played:', before, '->', after);
  if (before === after) throw new Error('the week did not advance');
  if (shots) await win.screenshot({ path: `${shots}/desktop-${process.platform}.png` });
  await app.close();
  const firstRun = problems;

  ({ app, win, problems } = await launch());
  await win.getByRole('button', { name: /Continue your game/ }).click({ timeout: 30000 });
  const resumed = await week(win);
  console.log('resumed:', resumed);
  await app.close();

  if (resumed !== after) throw new Error(`the save did not survive a restart (${resumed})`);
  const all = [...firstRun, ...problems];
  if (all.length) throw new Error(all.join('\n'));
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
