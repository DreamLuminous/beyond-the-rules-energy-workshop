/* Browser checks that do not need the C toolchain: flows, records, exports, layout. */
const { chromium } = require('C:/Users/wangy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOTS = path.join(__dirname, '.qa');
const URL = 'http://127.0.0.1:4173/';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300));
}
const overflow = page => page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
const pickStage = (page, stage) => page.locator('#game-settings').click()
  .then(() => page.locator(`#game-stages button[data-stage="${stage}"]`).click())
  .then(() => page.locator('#close-game-settings').click());

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });

  /* ---------- fresh player: navigation, settings, three difficulties, export ---------- */
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)); });
  await page.goto(URL);

  const rail = await page.$$eval('.rail-nav button', buttons => buttons.map(button => button.textContent.replace(/\s*→\s*$/, '').trim()));
  check('主界面左侧依次为五个入口', JSON.stringify(rail) === JSON.stringify(['继续游戏', '关卡选择', '成长档案', '可选连接', '更多设置']), rail);
  check('主界面无控制台错误', problems.length === 0, problems);
  let box = await overflow(page);
  check('桌面主界面无横向溢出', box.scroll <= box.inner, box);
  await page.screenshot({ path: path.join(SHOTS, 'home-desktop.png'), fullPage: true });

  await page.locator('[data-home="levels"]').click();
  check('关卡选择展示两个章节卡', await page.locator('#chapter-list .chapter-tile').count() === 2);
  await page.locator('#chapter-list .chapter-tile').first().click();
  check('章节二级入口列出三关', await page.locator('#level-cards article').count() === 3);
  await page.locator('#chapter-back').click();
  await page.locator('#chapter-list .chapter-tile').nth(1).click();
  check('第二章展示数组与函数两关', await page.locator('#level-cards article').count() === 2
    && (await page.locator('#level-cards article').first().textContent()).includes('古籍档案馆'));
  await page.locator('[data-home="growth"]').click();
  check('成长档案在独立面板', await page.locator('#home-xp').isVisible());
  await page.locator('[data-home="connect"]').click();
  check('可选连接在独立面板', await page.locator('#api-status').isVisible());

  await page.locator('[data-home="settings"]').click();
  check('更多设置含音效与两项偏好', await page.locator('#toggle-sound').isVisible() && await page.locator('#home-modes').isVisible() && await page.locator('#home-stages').isVisible());
  await page.locator('#toggle-sound').click();
  await page.locator('#home-modes button[data-mode="learning"]').click();
  await page.locator('#home-stages button[data-stage="pseudo"]').click();
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('beyond-rules-save-v3')));
  check('设置写入本机存档', stored.sound === false && stored.mode === 'learning' && stored.stage === 'pseudo', stored);
  await page.reload();
  await page.locator('[data-home="settings"]').click();
  check('刷新后音效与偏好保留',
    await page.locator('#toggle-sound').getAttribute('aria-checked') === 'false' &&
    await page.locator('#home-modes button[data-mode="learning"]').getAttribute('aria-pressed') === 'true' &&
    await page.locator('#home-stages button[data-stage="pseudo"]').getAttribute('aria-pressed') === 'true');
  await page.locator('#toggle-sound').click();
  await page.locator('#home-modes button[data-mode="entertainment"]').click();
  await page.locator('#home-stages button[data-stage="natural"]').click();

  // Continue game jumps straight into the first unfinished level.
  await page.locator('[data-home="continue"]').click();
  check('继续游戏直接进入未完成关卡', await page.locator('#game-title').textContent() === '第一颗能源核心');
  const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: innerHeight }));
  check('关卡页桌面一屏显示', fit.scroll <= fit.inner, fit);
  await page.screenshot({ path: path.join(SHOTS, 'game-desktop.png'), fullPage: true });

  // Difficulty and play mode live in the in-game settings dialog.
  await page.locator('#game-settings').click();
  await page.locator('#game-stages button[data-stage="pseudo"]').click();
  const pseudoStart = await page.locator('#input').inputValue();
  check('关卡内切换为伪代码', pseudoStart.includes('拾取') && /逐行/.test(await page.locator('#editor-help').textContent()), pseudoStart.slice(0, 30));
  await page.locator('#game-stages button[data-stage="natural"]').click();
  check('关卡内切回自然语言', await page.locator('#input').inputValue() === '');
  await page.locator('#game-modes button[data-mode="learning"]').click();
  check('关卡内学习模式显示提示', await page.locator('#hint-box').isVisible());
  await page.locator('#game-modes button[data-mode="entertainment"]').click();
  check('切回娱乐模式隐藏提示', !(await page.locator('#hint-box').isVisible()));
  await page.locator('#close-game-settings').click();

  await page.locator('#input').fill('找到红色晶体，送到红色发电炉，绕开障碍。');
  await page.locator('#run').click();
  await page.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout: 15000 });
  const state = await page.evaluate(() => ({
    reward: document.querySelector('#reward-line').textContent,
    boardHidden: getComputedStyle(document.querySelector('.game-layout')).display === 'none',
    stage: document.querySelector('#game-stages button[aria-pressed="true"]').dataset.stage,
    xp: document.querySelector('#home-xp').textContent,
  }));
  check('第一关自然语言通关', /表达者徽章/.test(state.reward), state.reward);
  check('通关解锁普通成就', /初试锋芒/.test(state.reward), state.reward);
  check('通关页只保留结果', state.boardHidden, state);
  check('通关后积分入账', state.xp === '100 XP', state.xp);
  check('难度控件显示当前难度', state.stage === 'natural', state.stage);

  await page.locator('#retry-complete').click();
  await page.locator('#run').click();
  await page.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout: 15000 });
  const second = await page.locator('#reward-line').textContent();
  check('重复通关不重复发奖', /已记录/.test(second), second);

  // Second level, pseudocode chosen inside the level.
  await page.locator('#back-home').click();
  await page.locator('[data-home="levels"]').click();
  await page.locator('#chapter-list .chapter-tile').first().click();
  await page.locator('#level-cards article').nth(1).locator('button').click();
  await pickStage(page, 'pseudo');
  await page.locator('#input').fill('重复直到 没有晶体\n找到 红色晶体\n拾取\n绕开障碍\n移动到 红色发电炉\n投递\n结束重复');
  await page.locator('#run').click();
  await page.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout: 20000 });
  const pseudoReward = await page.locator('#reward-line').textContent();
  check('第二关伪代码通关并发循环徽章', /循环设计者徽章/.test(pseudoReward), pseudoReward);
  await page.screenshot({ path: path.join(SHOTS, 'complete-desktop.png') });

  await page.locator('#retry-complete').click();
  await page.locator('#input').fill('重复直到 没有晶体\n找到 红色晶体\n拾取\n投递\n结束重复');
  await page.locator('#run').click();
  const pseudoError = await page.locator('#feedback').textContent();
  check('伪代码错误指出具体行', /第 \d 行应为/.test(pseudoError), pseudoError);

  // One draft per difficulty inside the level.
  const pseudoDraft = await page.locator('#input').inputValue();
  await pickStage(page, 'natural');
  await page.locator('#input').fill('关卡内的自然语言草稿');
  await pickStage(page, 'pseudo');
  check('切回伪代码恢复该难度草稿', await page.locator('#input').inputValue() === pseudoDraft);
  await pickStage(page, 'natural');
  check('切回自然语言恢复草稿', await page.locator('#input').inputValue() === '关卡内的自然语言草稿');

  await pickStage(page, 'code');
  const codeHelp = await page.locator('#editor-help').textContent();
  const codeInput = await page.locator('#input').inputValue();
  check('C 编辑区给出 workshop.h 说明与模板', /workshop\.h/.test(codeHelp) && codeInput.includes('#include "workshop.h"'), { codeHelp: codeHelp.slice(0, 40) });
  await pickStage(page, 'natural');
  await page.locator('#input').fill('');

  // Export: generate, hand-write, save, then add a new run and merge.
  await page.locator('#back-home').click();
  await page.locator('[data-home="growth"]').click();
  check('成长档案列出徽章', (await page.locator('#badge-list .badge.earned').count()) >= 2);
  check('成长档案展示全部十五枚徽章', await page.locator('#badge-list .badge').count() === 15
    && /XP$/.test(await page.locator('#xp-bar-note').textContent()));
  const achSummary = await page.locator('#ach-normal-count').textContent();
  check('成就墙默认折叠并计数', /^\d+ \/ 6$/.test(achSummary) && (await page.locator('#ach-normal').getAttribute('open')) === null, achSummary);
  await page.locator('#open-export').click();
  await page.locator('#export-list button').first().click();
  await page.locator('#generate-export').click();
  await page.locator('#export-text').fill('# 我的记录\n\n这是玩家手写的段落。\n');
  await page.locator('#save-export').click();
  await page.waitForFunction(() => /已保存|新建议/.test(document.querySelector('#export-note').textContent));

  await page.locator('#export-back').click();
  await page.locator('[data-home="levels"]').click();
  await page.locator('#chapter-list .chapter-tile').first().click();
  await page.locator('#level-cards article').first().locator('button').click();
  await page.locator('#input').fill('红色晶体送到发电炉');
  await page.locator('#run').click();
  await page.waitForFunction(() => !document.querySelector('#run').disabled && /障碍/.test(document.querySelector('#feedback').textContent), undefined, { timeout: 15000 });
  await page.locator('#back-home').click();
  await page.locator('[data-home="growth"]').click();
  await page.locator('#open-export').click();
  await page.locator('#export-list button').first().click();
  const updateVisible = await page.locator('#export-update').isVisible();
  const kept = await page.locator('#export-text').inputValue();
  check('新记录提示可合并', updateVisible, await page.locator('#export-update').textContent());
  check('重新打开不覆盖手写内容', kept.includes('这是玩家手写的段落'), kept.slice(0, 60));
  await page.locator('#merge-update').click();
  const merged = await page.locator('#export-text').inputValue();
  check('合并保留手写并追加新事实', merged.includes('这是玩家手写的段落') && /新的运行记录/.test(merged), merged.slice(-160));

  await page.locator('#export-list button').last().click();
  await page.locator('#generate-export').click();
  const combinedBody = await page.locator('#export-text').inputValue();
  check('成长总报告引用真实记录', /成长记录/.test(combinedBody) && /成长积分：\d+ XP/.test(combinedBody), combinedBody.slice(0, 80));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-export').click()]);
  check('Markdown 可下载', /\.md$/.test(download.suggestedFilename()), download.suggestedFilename());

  // Mobile layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#export-back').click();
  box = await overflow(page);
  check('手机主界面无横向溢出', box.scroll <= box.inner, box);
  await page.screenshot({ path: path.join(SHOTS, 'home-mobile.png'), fullPage: true });
  await page.locator('[data-home="levels"]').click();
  box = await overflow(page);
  check('手机关卡选择无横向溢出', box.scroll <= box.inner, box);
  await page.locator('#chapter-list .chapter-tile').first().click();
  box = await overflow(page);
  check('手机章节二级入口无横向溢出', box.scroll <= box.inner, box);
  await page.locator('#level-cards article').nth(2).locator('button').click();
  box = await overflow(page);
  check('手机关卡页无横向溢出', box.scroll <= box.inner, box);
  await page.screenshot({ path: path.join(SHOTS, 'game-mobile.png'), fullPage: true });
  await page.locator('#back-home').click();
  await page.locator('[data-home="growth"]').click();
  await page.locator('#open-export').click();
  box = await overflow(page);
  check('手机导出页无横向溢出', box.scroll <= box.inner, box);
  await page.screenshot({ path: path.join(SHOTS, 'export-mobile.png'), fullPage: true });
  check('全流程无控制台错误', problems.length === 0, problems);
  await context.close();

  /* ---------- AI fallback when the model is unavailable ---------- */
  const offline = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await offline.newPage();
  let offlineRequests = 0;
  await page2.route('**/api/propose', route => { offlineRequests++; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '请先在主界面设置模型 API。' }) }); });
  await page2.goto(URL);
  await page2.locator('[data-home="continue"]').click();
  await page2.locator('#open-chat').click();
  const chatBox = await page2.locator('#chat-panel').boundingBox();
  check('AI 对话使用小窗', !!chatBox && chatBox.width <= 460, chatBox);
  await page2.locator('#chat-input').fill('把它带到右边的机器');
  await page2.locator('#send-chat').click();
  await page2.waitForFunction(() => /本地规则/.test(document.querySelector('#chat-messages').textContent), undefined, { timeout: 10000 });
  const fallback = await page2.locator('#chat-messages').textContent();
  check('模型不可用时提示原因并保留本地玩法', /本地规则/.test(fallback), fallback);
  check('未配置 API 时对话识别不发送模型请求', offlineRequests === 0);
  await page2.locator('#chat-input').fill('再绕开墙壁');
  await page2.locator('#send-chat').click();
  await page2.waitForFunction(() => document.querySelector('#proposal-text').textContent.includes('绕开障碍'));
  check('本地对话支持补充上一条策略', await page2.locator('#proposal-label').textContent() === '本地识别的规则');
  await page2.locator('#accept-proposal').click();
  await page2.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout: 15000 });
  check('不连接 API 也可从对话预览确认并通关', true);
  await page2.locator('#retry-complete').click();
  await page2.locator('#input').fill('找到红色晶体，送到红色发电炉，绕开障碍。');
  await page2.locator('#run').click();
  await page2.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout: 15000 });
  check('AI 故障时本地自然语言仍可通关', true);
  await offline.close();

  /* ---------- AI proposal: preview, no map change, then confirm ---------- */
  const ai = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page3 = await ai.newPage();
  await page3.route('**/api/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, model: 'mock-model' }) }));
  await page3.route('**/api/propose', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ reply: '先绕开障碍，再投递。', program: { version: 2, type: 'sequence', steps: [{ type: 'deliver_next', color: 'red', route: 'safe' }] } }) }));
  await page3.goto(URL);
  await page3.locator('[data-home="continue"]').click();
  const before = await page3.locator('#stats').textContent();
  await page3.locator('#open-chat').click();
  await page3.locator('#chat-input').fill('先绕开障碍再投递');
  await page3.locator('#send-chat').click();
  await page3.locator('#accept-proposal').waitFor({ state: 'visible' });
  const unchanged = await page3.locator('#stats').textContent();
  check('确认前地图保持原状', before === unchanged, { before, unchanged });
  await page3.locator('#accept-proposal').click();
  await page3.waitForFunction(() => !document.querySelector('#complete').hidden, undefined, { timeout: 15000 });
  check('确认后 AI 规则由本地引擎执行并通关', true);
  await page3.screenshot({ path: path.join(SHOTS, 'ai-confirm.png') });
  await page3.locator('#retry-complete').click();
  await page3.route('**/api/propose', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '模型服务暂时不可用' }) }));
  await page3.locator('#open-chat').click();
  await page3.locator('#chat-input').fill('把红色水晶送到发电炉，绕开障碍');
  await page3.locator('#send-chat').click();
  await page3.waitForFunction(() => document.querySelector('#proposal-label').textContent === '本地识别的规则');
  check('已配置模型故障时自动退回本地预览', (await page3.locator('#chat-messages').textContent()).includes('暂时不可用'));
  await ai.close();

  /* ---------- v2 save migration keeps progress, 100 XP, badge and article ---------- */
  const migrated = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page4 = await migrated.newPage();
  await page4.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('beyond-rules-save-v2', JSON.stringify({ version: 2, mode: 'learning', progress: 1, xp: 100,
      badges: ['expression'], runs: [{ id: 'old', level: 0, text: '旧规则', success: true, steps: 13, delivered: 1, at: '2026-10-24' }],
      article: { body: '玩家自己写的文章', updatedAt: '2026-10-24' } }));
  });
  await page4.goto(URL);
  const migratedState = await page4.evaluate(() => ({
    xp: document.querySelector('#home-xp').textContent,
    progress: document.querySelector('#home-progress').textContent,
    save: JSON.parse(localStorage.getItem('beyond-rules-save-v3') || 'null'),
  }));
  check('旧存档迁移保留 XP 与进度', migratedState.xp === '100 XP' && /1 \/ 5/.test(migratedState.progress), migratedState);
  check('旧存档徽章与文章保留', migratedState.save?.badges.includes('0:natural') && migratedState.save.articles['0']?.body === '玩家自己写的文章',
    { badges: migratedState.save?.badges, articles: Object.keys(migratedState.save?.articles || {}) });
  check('旧存档补充音效默认值', migratedState.save?.sound === true);
  await migrated.close();

  /* ---------- API settings dialog: save, test, clear, and the key never comes back ---------- */
  const settings = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page5 = await settings.newPage();
  let stored5 = null;
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page5.route('**/api/config', async route => {
    const method = route.request().method();
    if (method === 'PUT') { const input = JSON.parse(route.request().postData()); stored5 = { model: input.model, key: input.key || stored5?.key }; return json(route, { configured: true, url: input.url, model: input.model, source: 'memory' }); }
    if (method === 'DELETE') { stored5 = null; return json(route, { configured: false, url: '', model: '', source: 'none' }); }
    return json(route, { configured: !!stored5, url: stored5 ? 'https://example.com/v1/chat/completions' : '', model: stored5?.model || '', source: stored5 ? 'memory' : 'none' });
  });
  await page5.route('**/api/test', route => stored5 ? json(route, { connected: true }) : route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '请先在主界面设置模型 API。' }) }));
  await page5.goto(URL);
  await page5.locator('[data-home="connect"]').click();
  await page5.locator('#ai-presets button').first().click();
  check('常用模型模板预填 API 设置', /api\./.test(await page5.locator('#api-url').inputValue())
    && (await page5.locator('#api-model').inputValue()).length > 0);
  await page5.locator('#close-settings').click();
  await page5.locator('[data-home="connect"]').click();
  await page5.locator('#open-settings').click();
  await page5.locator('#api-url').fill('https://example.com/v1/chat/completions');
  await page5.locator('#api-model').fill('demo-model');
  await page5.locator('#api-key').fill('sk-secret-value');
  await page5.locator('#test-config').click();
  await page5.waitForFunction(() => /连接成功/.test(document.querySelector('#config-feedback').textContent));
  check('API 设置保存后清空密钥输入', await page5.locator('#api-key').inputValue() === '');
  check('API 设置只留在本机进程', stored5?.key === 'sk-secret-value');
  await page5.locator('#test-config').click();
  await page5.waitForFunction(() => /连接成功/.test(document.querySelector('#config-feedback').textContent));
  check('API 连接测试成功', true);
  await page5.waitForFunction(() => /demo-model/.test(document.querySelector('#api-status').textContent));
  check('可选连接显示已配置的模型', true);
  await page5.locator('#clear-config').click();
  await page5.waitForFunction(() => /已清除/.test(document.querySelector('#config-feedback').textContent));
  check('API 设置可清除', stored5 === null);
  await page5.locator('#close-settings').click();
  await settings.close();

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} browser cases passed`);
  if (failed.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
