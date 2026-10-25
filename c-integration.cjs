/* End-to-end C difficulty check: real Clang → Wasm in a worker, run and aborted by the game. */
const { chromium } = require('C:/Users/wangy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
const os = require('node:os');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PROFILE = path.join(os.tmpdir(), 'rules-edge-profile');
const SHOTS = path.join(__dirname, '.qa');

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE, { executablePath: EDGE, headless: true, viewport: { width: 1280, height: 900 } });
  const page = context.pages()[0] || await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/panicked at/.test(m.text())) problems.push('console ' + m.text().slice(0, 200)); });
  page.on('worker', w => w.on('close', () => console.log('  · C worker closed')));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('crossOriginIsolated', await page.evaluate(() => crossOriginIsolated));

  await page.locator('[data-home="continue"]').click();
  await page.locator('#game-settings').click();
  await page.locator('#game-stages button[data-stage="code"]').click();
  await page.locator('#close-game-settings').click();

  let lastFeedback = '';
  const watch = setInterval(async () => {
    try {
      const text = await page.locator('#feedback').textContent();
      if (text && text !== lastFeedback) { lastFeedback = text; console.log('  feedback:', text); }
    } catch {}
  }, 2000);

  async function run(code, { timeout = 5400000, waitSuccess = false } = {}) {
    await page.locator('#input').fill(code);
    const started = Date.now();
    await page.locator('#run').click();
    if (waitSuccess) {
      await page.locator('#complete').waitFor({ state: 'attached', timeout });
      await page.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout });
    }
    await page.waitForFunction(() => !document.querySelector('#run').disabled, undefined, { timeout });
    const result = await page.evaluate(() => ({
      feedback: document.querySelector('#feedback').textContent,
      success: !document.querySelector('#complete').hidden,
      reward: document.querySelector('#reward-line').textContent,
      logs: document.querySelectorAll('#logs li').length,
      preview: document.querySelector('#program-preview').textContent.slice(0, 120),
    }));
    result.seconds = Math.round((Date.now() - started) / 1000);
    return result;
  }

  const results = [];
  const check = (name, actual, ok) => { results.push({ name, ok, actual }); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(actual)); };

  const hello = '#include "workshop.h"\nint main(void){ deliver(0, RED); return 0; }';

  // 1. First run pays the one-time toolchain download.
  let r = await run(hello, { waitSuccess: true });
  check('第一关 C 真实编译并通关', r, r.success);
  await page.screenshot({ path: path.join(SHOTS, 'c-level1-success.png') });

  // 2. Compile diagnostic.
  await page.locator('#retry-complete').click();
  r = await run('#include "workshop.h"\nint main(void){ deliver(0, RED) return 0; }', { timeout: 120000 });
  check('编译错误显示诊断且不算通关', r, !r.success && /error|错误|expected|编译失败/i.test(r.feedback));

  // 3. Wrong furnace reaching the shared engine.
  r = await run('#include "workshop.h"\nint main(void){ deliver(0, BLUE); return 0; }', { timeout: 120000 });
  check('无效投递被引擎拒绝', r, !r.success && /不能放进/.test(r.feedback));

  // 4. Same session must reuse the downloaded toolchain.
  r = await run(hello, { waitSuccess: true, timeout: 120000 });
  check('同一会话再次编译并可通关', r, r.success && r.seconds < 60);
  check('重复通关不重复发奖', r, /已记录/.test(r.reward));

  // 5. Second level: loop over every crystal.
  await page.locator('#next-level').click();
  r = await run('#include "workshop.h"\nint main(void){ for(int i=0;i<crystal_count();i++) deliver(i, RED); return 0; }', { waitSuccess: true, timeout: 180000 });
  check('第二关 C 通关', r, r.success);

  // 6. Third level: colour condition.
  await page.locator('#next-level').click();
  r = await run('#include "workshop.h"\nint main(void){ for(int i=0;i<crystal_count();i++) deliver(i, crystal_color(i)==RED ? RED : BLUE); return 0; }', { waitSuccess: true, timeout: 180000 });
  check('第三关 C 通关', r, r.success);
  await page.screenshot({ path: path.join(SHOTS, 'c-level3-success.png') });

  // 7. Infinite loop is aborted by the app-side watchdog.
  await page.locator('#retry-complete').click();
  r = await run('#include "workshop.h"\nint main(void){ for(;;){} }', { timeout: 180000 });
  check('无限循环被中止', r, !r.success && /超时|中止/.test(r.feedback));

  // 8. The abort must not take the compiler down with it.
  r = await run('#include "workshop.h"\nint main(void){ for(int i=0;i<crystal_count();i++) deliver(i, crystal_color(i)==RED ? RED : BLUE); return 0; }', { waitSuccess: true, timeout: 120000 });
  check('中止后仍可继续编译运行', r, r.success && r.seconds < 60);

  clearInterval(watch);
  const failed = results.filter(x => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} C cases passed`);
  if (problems.length) console.log('browser problems:', problems.slice(0, 10));
  await context.close();
  if (failed.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
