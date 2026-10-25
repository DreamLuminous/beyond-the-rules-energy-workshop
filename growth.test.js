const assert = require('node:assert/strict');
const Growth = require('./growth.js');
const { createAI } = require('./server.js');
function memory(values = {}) { const map = new Map(Object.entries(values)); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; }
const old = memory({ 'beyond-rules-save-v2': JSON.stringify({ version: 2, mode: 'learning', progress: 1, xp: 100,
  badges: ['expression'], runs: [{ id: 'old', level: 0, text: '旧规则', success: true, steps: 13, delivered: 1, at: '2026-10-24' }],
  article: { body: '玩家自己写的文章', updatedAt: '2026-10-24' } }) });
const save = Growth.load(old);
assert.equal(save.xp, 100);
assert.equal(save.articles[0].body, '玩家自己写的文章');
assert.equal(Growth.award(save, 0, 'natural'), null);
const freshReward = Growth.award(Growth.load(memory()), 0, 'natural');
assert.equal(freshReward.badge, '表达者');
Growth.record(save, { id: 'new', level: 1, stage: 'pseudo', mode: 'learning', source: '重复直到 没有晶体', success: true, delivered: 3, steps: 61, events: ['投递'], at: '2026-10-25' });
assert.equal(Growth.award(save, 1, 'pseudo').xp, 80);
assert.equal(Growth.award(save, 1, 'pseudo'), null);
const draft = Growth.levelDraft(save, 1);
assert.match(draft.body, /投递 3 颗/);
assert.doesNotMatch(draft.body, /数十次/);
const combined = Growth.combined(save, [0, 1]);
assert.match(combined.body, /玩家自己写的文章/);
assert.match(combined.body, /自动搬运/);
assert.equal(Growth.persist(old, save), true);
assert.equal(Growth.load(old).xp, 180);
const freeChoice = Growth.load(memory());
Growth.record(freeChoice, { id: 'third-first', level: 2, stage: 'natural', success: true });
assert.equal(freeChoice.progress, 1);
assert.deepEqual(freeChoice.completedLevels, [2]);

/* 成就：普通随进度解锁，彩蛋记录特殊经历 */
const achieve = Growth.load(memory());
assert.equal(Growth.evaluate(achieve).length, 0);
Growth.record(achieve, { id: 'f1', level: 0, stage: 'natural', success: false, reason: '路线被障碍挡住。想想如何绕开它。' });
Growth.record(achieve, { id: 'f2', level: 0, stage: 'natural', success: false, reason: '未完成' });
Growth.record(achieve, { id: 'f3', level: 0, stage: 'natural', success: false, reason: '未完成' });
Growth.record(achieve, { id: 'w1', level: 0, stage: 'natural', success: true, at: '2026-10-25' });
const achieveKeys = Growth.evaluate(achieve, { won: true, level: 0, hour: 10 }).map(a => a.key);
assert.ok(achieveKeys.includes('first_win'), '通关第一关应解锁初试锋芒');
assert.ok(achieveKeys.includes('wall_learner'), '撞墙后通关应解锁撞墙之后');
assert.ok(achieveKeys.includes('persist'), '失败三次后通关应解锁越挫越勇');
assert.equal(Growth.evaluate(achieve, { won: true, level: 0, hour: 10 }).length, 0, '成就不重复发放');
const grad = Growth.load(memory());
[0, 1, 2].forEach(i => Growth.record(grad, { id: 'g' + i, level: i, stage: 'natural', success: true }));
const gradKeys = Growth.evaluate(grad).map(a => a.key);
assert.ok(gradKeys.includes('chapter1'));
assert.ok(!gradKeys.includes('all_done'), '五关未全通不应解锁五关全通');
const poly = Growth.load(memory());
for (const stage of ['natural', 'pseudo', 'code']) Growth.award(poly, 0, stage);
assert.ok(Growth.evaluate(poly).some(a => a.key === 'polyglot'));
const owl = Growth.load(memory());
Growth.record(owl, { id: 'n1', level: 0, stage: 'natural', success: true });
assert.ok(Growth.evaluate(owl, { won: true, level: 0, hour: 23, usedAI: true }).some(a => a.key === 'night_owl'));
const legacy3 = Growth.load(memory({ 'beyond-rules-save-v3': JSON.stringify({ version: 3, progress: 1, xp: 100 }) }));
assert.deepEqual(legacy3.achievements, {}, '旧 v3 存档补默认成就字段');
assert.ok(legacy3.marks.failCount);
assert.equal(Growth.TOTAL_XP, 1500);

(async () => {
  let sent;
  const fakeFetch = async (url, options) => { sent = { url, options }; return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: '先考虑路线。', program: { version: 2, type: 'sequence', steps: [{ type: 'deliver_next', color: 'red', route: 'safe' }] } }) } }] }) }; };
  const ai = createAI({}, fakeFetch);
  assert.equal(ai.status().configured, false);
  assert.throws(() => ai.configure({ url: 'http://example.com', model: 'x', key: 'secret' }), /HTTPS/);
  ai.configure({ url: 'https://example.com/v1/chat/completions', model: 'demo', key: 'secret' });
  assert.equal(ai.status().configured, true);
  assert.doesNotMatch(JSON.stringify(ai.status()), /secret/);
  assert.equal((await ai.test()).connected, true);
  const proposal = await ai.propose({ level: 0, text: '把红色晶体送过去，绕开障碍' });
  assert.equal(proposal.program.steps[0].route, 'safe');
  assert.match(sent.options.headers.Authorization, /secret/);
  assert.equal(ai.clear().configured, false);
  console.log('旧存档迁移、按需导出、奖励和 API 设置通过');
})().catch(e => { console.error(e); process.exitCode = 1; });
