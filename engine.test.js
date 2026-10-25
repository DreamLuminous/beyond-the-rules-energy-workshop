const assert = require('node:assert/strict');
const Game = require('./engine.js');
const ideas = [
  '找到红色晶体，送到红色发电炉，绕开障碍',
  '重复把所有红色晶体送到发电炉，绕开障碍',
  '重复根据颜色分别把红蓝晶体送到对应发电炉，绕开障碍',
  '按编号从小到大依次遍历所有红色卷宗，送到归档柜，绕开障碍',
  '定义一个技能，把红色药剂送到蒸馏器，然后调用三次，绕开障碍',
];
const pseudo = [
  '找到 红色晶体\n拾取\n绕开障碍\n移动到 红色发电炉\n投递',
  '重复直到 没有晶体\n找到 红色晶体\n拾取\n绕开障碍\n移动到 红色发电炉\n投递\n结束重复',
  '重复直到 没有晶体\n如果 晶体是红色\n找到 红色晶体\n拾取\n绕开障碍\n移动到 红色发电炉\n投递\n否则\n找到 蓝色晶体\n拾取\n绕开障碍\n移动到 蓝色发电炉\n投递\n结束如果\n结束重复',
  '卷宗数组 编号 0 到 4\n重复直到 没有卷宗\n按编号 找到下一卷红色卷宗\n拾取\n绕开障碍\n移动到 红色归档柜\n投递\n结束重复',
  '定义 技能 投递红色\n找到 红色药剂\n拾取\n绕开障碍\n移动到 红色蒸馏器\n投递\n结束定义\n调用 投递红色\n调用 投递红色\n调用 投递红色',
];
/* 五关 × 三难度全部通关 */
for (let level = 0; level < Game.levels.length; level++) {
  const natural = Game.execute(level, Game.natural(ideas[level], level));
  const logic = Game.execute(level, Game.pseudo(pseudo[level], level));
  const actions = Game.levels[level].items.map((item, id) => ({ id, color: item[2] }));
  const code = Game.execute(level, Game.fromActions(actions));
  for (const [stage, run] of [['natural', natural], ['pseudo', logic], ['code', code]]) {
    assert.equal(run.success, true, `${level + 1}:${stage} ${run.reason}`);
    assert.equal(run.state.delivered, Game.levels[level].quota);
  }
}
/* 第一章保持原有错误路径 */
const blocked = Game.execute(0, Game.natural('把红色晶体送进发电炉', 0));
assert.equal(blocked.success, false);
assert.match(blocked.reason, /障碍/);
assert.throws(() => Game.natural('红色晶体送到发电炉', 1), /重复/);
assert.throws(() => Game.natural('重复把所有红色晶体送到发电炉', 2), /颜色/);
assert.throws(() => Game.pseudo('投递', 0), /第 1 行/);
const wrongFurnace = Game.execute(2, Game.fromActions([{ id: 0, color: 'blue' }]));
assert.equal(wrongFurnace.success, false);
assert.match(wrongFurnace.reason, /不能放进/);
assert.throws(() => Game.fromActions([{ id: 0, color: 'green' }]), /未知/);
const leftover = Game.execute(1, Game.fromActions([{ id: 0, color: 'red' }]));
assert.match(leftover.reason, /还有 2 颗晶体未送达/);

/* 第四关 · 数组：必须按编号递增 */
assert.throws(() => Game.natural('重复把所有红色卷宗送到归档柜，绕开障碍', 3), /编号/);
const wrongOrder = Game.execute(3, Game.fromActions(Game.levels[3].items.map((item, id) => ({ id: (id + 1) % 5, color: 'red' }))));
assert.equal(wrongOrder.success, false);
assert.match(wrongOrder.reason, /当前应处理编号 0 的卷宗/);

/* 第五关 · 函数：未定义先调用、次数不足 */
const noDef = Game.execute(4, { version: 2, type: 'sequence', steps: [{ type: 'call', name: '投递红色' }] });
assert.equal(noDef.success, false);
assert.match(noDef.reason, /还没有定义/);
assert.throws(() => Game.natural('定义技能把红色药剂送到蒸馏器，绕开障碍', 4), /调用/);
assert.throws(() => Game.natural('调用三次，把红色药剂送到蒸馏器，绕开障碍', 4), /定义/);
const skillShort = Game.execute(4, Game.natural('定义技能，调用两次，把红色药剂送到蒸馏器，绕开障碍', 4));
assert.equal(skillShort.success, false);
assert.match(skillShort.reason, /还有 1 瓶药剂未送达/);

/* 题材一致性：三套主题互不相同，新关提示使用本关词汇 */
assert.equal(Game.themeOf(0).label, '能源工坊');
assert.equal(Game.themeOf(3).label, '古籍档案馆');
assert.equal(Game.themeOf(4).label, '秘方蒸馏所');
const labels = Game.levels.map((_, i) => Game.themeOf(i).label);
assert.equal(new Set(labels).size, 3, '三套主题应互不相同');
const actors = Object.values(Game.themes).map(t => t.icons.actor);
assert.equal(new Set(actors).size, actors.length, '每套主题角色图标应不同');
for (const level of [3, 4]) {
  const theme = Game.themeOf(level);
  const short = Game.execute(level, Game.fromActions([{ id: 0, color: 'red' }]));
  const words = [short.reason, ...short.events.map(e => e.message)].join(' ');
  assert.ok(words.includes(theme.cargo) || words.includes(theme.facility), `${theme.label} 提示未使用本关词汇`);
}

/* 章节与关卡布局 */
assert.deepEqual(Game.chapters.map(c => c.name), ['新手引导', 'C 语言之路']);
assert.deepEqual(Game.chapters.flatMap(c => c.levels), [0, 1, 2, 3, 4]);
console.log('五关 × 三难度引擎、章节布局、题材一致性与错误路径通过');
