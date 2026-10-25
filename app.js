const $ = id => document.getElementById(id);
const storage = (() => { try { return localStorage; } catch { return { getItem: () => null, setItem: () => {} }; } })();
const save = Growth.load(storage);
const names = { red: '红色', blue: '蓝色' };
const stageNames = { natural: '自然语言', pseudo: '伪代码', code: 'C 代码' };
/* 伪代码与 C 模板按关卡题材即时生成：档案馆说卷宗、蒸馏所说药剂。
   引擎的 pseudo() 会把题材词还原为基础词，同一套解析器就能读懂所有关卡。 */
function pseudoScaffold(index) {
  const t = Game.themeOf(index), c = t.cargo, f = t.facility;
  return [
    `找到 红色${c}\n拾取\n[填写路线策略]\n移动到 红色${f}\n投递`,
    `重复直到 [填写结束条件]\n  找到 红色${c}\n  拾取\n  绕开障碍\n  移动到 红色${f}\n  投递\n结束重复`,
    `重复直到 没有${c}\n  如果 [填写颜色条件]\n    找到 红色${c}\n    拾取\n    绕开障碍\n    移动到 红色${f}\n    投递\n  否则\n    找到 蓝色${c}\n    拾取\n    绕开障碍\n    移动到 蓝色${f}\n    投递\n  结束如果\n结束重复`,
    `${c}数组 编号 [填写起始编号] 到 [填写结束编号]\n重复直到 [填写结束条件]\n  按编号 找到下一${t.measure}红色${c}\n  拾取\n  绕开障碍\n  移动到 红色${f}\n  投递\n结束重复`,
    `定义 技能 投递红色\n  找到 红色${c}\n  拾取\n  绕开障碍\n  移动到 红色${f}\n  投递\n结束定义\n调用 投递红色\n[技能要调用几次？照上一行再写几行]`,
  ][index];
}
function codeScaffold(index) {
  const t = Game.themeOf(index), c = t.cargo, f = t.facility;
  return [
    `#include "workshop.h"\n\nint main(void) {\n    /* TODO: 把编号 0 的${c}送进红色${f} */\n    return 0;\n}`,
    `#include "workshop.h"\n\nint main(void) {\n    /* TODO: 使用循环处理所有${c} */\n    return 0;\n}`,
    `#include "workshop.h"\n\nint main(void) {\n    /* TODO: 遍历所有${c}，并根据颜色选择${f} */\n    return 0;\n}`,
    `#include "workshop.h"\n\nint main(void) {\n    /* TODO: 用 for 循环按下标遍历${c}数组，依次投递 */\n    return 0;\n}`,
    `#include "workshop.h"\n\n/* 函数：把投递一${t.measure}${c}的步骤封装起来，供 main 反复调用 */\nvoid deliver_red(int id) {\n    deliver(id, RED);\n}\n\nint main(void) {\n    /* TODO: 调用 deliver_red 投递编号 0、1、2 */\n    return 0;\n}`,
  ][index];
}
let level = 0, stage = Growth.STAGES.includes(save.stage) ? save.stage : 'natural', world = Game.create(0), timer = null, worker = null, workerBusy = false, workerTimer = null,
  runWorker = null, runTimer = null;
let hintStage = 0, exportChoice = 0, proposedProgram = null, chatHistory = [],
  currentRun = null, activeView = 'home', logIndex = 0, aiUsedRun = false;
let aiConfig = null;
let hostedAISecret = null;
const hostedRuntime = location.protocol === 'https:' && !['127.0.0.1', 'localhost'].includes(location.hostname);
const drafts = {};
const AI_PRESETS = [
  { name: 'OpenAI · GPT', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  { name: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.5' },
  { name: 'Kimi', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
  { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
  { name: '自定义…', url: '', model: '' },
];
function persist() { $('save-status').textContent = Growth.persist(storage, save) ? '进度已保存' : '浏览器未能保存进度'; }
function show(name) {
  activeView = name;
  document.body.dataset.view = name;
  for (const id of ['home', 'game', 'export']) $(`${id}-view`).hidden = id !== name;
  window.scrollTo(0, 0);
}
function latestRun() { return [...save.runs].reverse().find(r => r.level === level) || null; }
function nextLevelIndex() { for (let i = 0; i < Game.levels.length; i++) if (!save.completedLevels.includes(i)) return i; return 0; }
const homePanels = ['cover', 'levels', 'growth', 'connect', 'settings'];
function showHomePanel(name) {
  const panel = homePanels.includes(name) ? name : 'cover';
  for (const section of document.querySelectorAll('.home-panel')) section.hidden = section.dataset.panel !== panel;
  for (const button of document.querySelectorAll('.rail-nav button'))
    button.setAttribute('aria-current', String(button.dataset.home === (panel === 'cover' ? 'continue' : panel)));
  if (panel === 'levels' && openChapter !== -1) { openChapter = -1; renderChapters(nextLevelIndex()); }
  window.scrollTo(0, 0);
}
function stageCount(index) { return Growth.STAGES.filter(key => save.completions[`${index}:${key}`]).length; }
const CN_NUM = '一二三四五六七八九十';
let openChapter = -1;
function statTile(label, value) {
  const tile = document.createElement('div'); tile.className = 'stat-tile';
  const small = document.createElement('small'); small.textContent = label;
  const strong = document.createElement('strong'); strong.textContent = value;
  tile.append(small, strong); return tile;
}
function levelRow(index) {
  const finished = save.completedLevels.includes(index);
  const card = document.createElement('article'); card.className = 'level-card';
  const num = document.createElement('span'); num.className = 'level-num'; num.textContent = finished ? '✓' : `0${index + 1}`;
  const concept = document.createElement('p'); concept.className = 'concept'; concept.textContent = `学习 · ${Game.levels[index].concept}`;
  const title = document.createElement('h3'); title.textContent = Game.levels[index].title;
  const goal = document.createElement('p'); goal.textContent = Game.levels[index].goal;
  const done = document.createElement('p'); done.className = 'level-state';
  done.textContent = finished ? `已通关 · 难度 ${stageCount(index)} / 3` : '尚未完成';
  const button = document.createElement('button'); button.textContent = finished ? '再次挑战 →' : '进入关卡 →';
  button.onclick = () => openLevel(index);
  card.append(num, concept, title, goal, done, button);
  return card;
}
function renderChapters(next) {
  const list = $('chapter-list'), detail = $('chapter-detail');
  if (openChapter >= 0 && Game.chapters[openChapter]) {
    list.hidden = true; detail.hidden = false; detail.replaceChildren();
    const chapter = Game.chapters[openChapter];
    const back = document.createElement('button'); back.id = 'chapter-back'; back.className = 'back'; back.textContent = '← 全部章节';
    back.onclick = () => { openChapter = -1; renderChapters(next); window.scrollTo(0, 0); };
    const card = document.createElement('section'); card.className = 'chapter-card';
    const head = document.createElement('header'); head.className = 'chapter-head';
    const headText = document.createElement('div');
    const kicker = document.createElement('p'); kicker.className = 'section-kicker'; kicker.textContent = `第${CN_NUM[openChapter]}章`;
    const h3 = document.createElement('h3'); h3.textContent = chapter.name;
    const state = document.createElement('span'); state.className = 'chapter-state';
    state.textContent = `已完成 ${chapter.levels.filter(i => save.completedLevels.includes(i)).length} / ${chapter.levels.length} 关`;
    headText.append(kicker, h3); head.append(headText, state);
    const desc = document.createElement('p'); desc.className = 'chapter-desc'; desc.textContent = chapter.brief;
    const cards = document.createElement('div'); cards.id = 'level-cards'; cards.className = 'level-cards';
    for (const index of chapter.levels) cards.append(levelRow(index));
    card.append(head, desc, cards);
    detail.append(back, card);
    return;
  }
  list.hidden = false; detail.hidden = true; list.replaceChildren();
  Game.chapters.forEach((chapter, ci) => {
    const done = chapter.levels.filter(i => save.completedLevels.includes(i)).length;
    const complete = done === chapter.levels.length;
    const active = !complete && chapter.levels.includes(next);
    const tile = document.createElement('button');
    tile.className = 'chapter-tile' + (complete ? ' done' : '') + (active ? ' current' : '');
    const num = document.createElement('span'); num.className = 'num'; num.textContent = `第${CN_NUM[ci]}章`;
    const info = document.createElement('span'); info.className = 'meta';
    const name = document.createElement('b'); name.textContent = chapter.name;
    const brief = document.createElement('small'); brief.textContent = chapter.brief;
    info.append(name, brief);
    const state = document.createElement('em'); state.className = 'state';
    state.textContent = complete ? '已完成' : active ? '进行中' : `${done} / ${chapter.levels.length} 关`;
    const go = document.createElement('span'); go.className = 'go'; go.textContent = '→'; go.setAttribute('aria-hidden', 'true');
    tile.append(num, info, state, go);
    tile.onclick = () => { openChapter = ci; renderChapters(next); window.scrollTo(0, 0); };
    list.append(tile);
  });
}
function renderAchievements() {
  for (const kind of ['normal', 'easter']) {
    const items = Object.entries(Growth.ACHIEVEMENTS).filter(([, item]) => item.kind === kind);
    const unlocked = items.filter(([key]) => save.achievements[key]).length;
    $(`ach-${kind}-count`).textContent = `${unlocked} / ${items.length}`;
    const list = $(`ach-${kind}-list`); list.replaceChildren();
    for (const [key, item] of items) {
      const got = !!save.achievements[key];
      const row = document.createElement('div'); row.className = `ach-item${got ? ' on' : ''}`;
      const name = document.createElement('b'); name.textContent = got || kind === 'normal' ? item.name : '？？？';
      const desc = document.createElement('small'); desc.textContent = item.desc;
      row.append(name, desc); list.append(row);
    }
  }
}
function renderRoad(next) {
  const wrap = $('road-steps'); wrap.replaceChildren();
  Game.chapters.forEach(chapter => {
    const row = document.createElement('div'); row.className = 'road-chapter';
    const name = document.createElement('span'); name.className = 'road-name'; name.textContent = chapter.name;
    const dots = document.createElement('div'); dots.className = 'road-dots';
    for (const index of chapter.levels) {
      const finished = save.completedLevels.includes(index);
      const current = !finished && save.progress < Game.levels.length && index === next;
      const step = document.createElement('button');
      step.className = 'road-step' + (finished ? ' done' : '') + (current ? ' current' : '');
      const num = document.createElement('span'); num.className = 'num'; num.textContent = finished ? '✓' : `0${index + 1}`;
      const meta = document.createElement('span'); meta.className = 'meta';
      const title = document.createElement('strong'); title.textContent = Game.levels[index].title;
      const state = document.createElement('small');
      state.textContent = finished ? `难度 ${stageCount(index)} / 3` : current ? '下一站' : Game.levels[index].concept;
      meta.append(title, state);
      const go = document.createElement('span'); go.className = 'go'; go.textContent = '→'; go.setAttribute('aria-hidden', 'true');
      step.append(num, meta, go);
      step.onclick = () => openLevel(index);
      dots.append(step);
    }
    row.append(name, dots); wrap.append(row);
  });
}
function renderHome() {
  const total = Game.levels.length;
  $('home-progress').textContent = save.progress >= total ? `全部关卡完成 · ${total} / ${total} 关` : `已完成 ${save.progress} / ${total} 关`;
  const bar = $('rail-bar'); bar.replaceChildren();
  bar.setAttribute('aria-valuenow', String(save.progress));
  bar.setAttribute('aria-valuemax', String(total));
  for (let i = 0; i < total; i++) {
    const seg = document.createElement('i');
    if (i < save.progress) seg.className = 'done';
    else if (i === save.progress) seg.className = 'current';
    bar.append(seg);
  }
  $('home-xp').textContent = `${save.xp} XP`;
  $('xp-bar').style.width = `${Math.min(100, Math.round((save.xp / Growth.TOTAL_XP) * 100))}%`;
  $('xp-bar-note').textContent = `${save.xp} / ${Growth.TOTAL_XP} XP`;
  $('home-badges').textContent = save.badges.length ? `已获得 ${save.badges.length} 枚能力徽章 · 记录了 ${save.runs.length} 次尝试。` : '完成挑战，点亮徽章与成就。';
  const next = nextLevelIndex();
  $('hero-continue-label').textContent = save.progress >= total ? '再次挑战 · 01' : save.progress === 0 ? '开始第一关' : `继续 · 0${next + 1} ${Game.levels[next].title}`;
  $('continue-note').textContent = save.progress >= total
    ? `五关都已通关 · 当前 ${stageNames[stage]}难度`
    : `下一站 · 0${next + 1} ${Game.levels[next].title} · ${stageNames[stage]}难度`;
  $('home-current').textContent = `当前：${save.mode === 'learning' ? '学习' : '娱乐'} · ${stageNames[stage]}`;
  $('game-pref-brief').textContent = `${save.mode === 'learning' ? '学习' : '娱乐'} · ${stageNames[stage]}`;
  $('growth-stats').replaceChildren();
  const chapterDone = Game.chapters.filter(c => c.levels.every(i => save.completedLevels.includes(i))).length;
  $('growth-stats').append(
    statTile('通关关卡', `${save.progress} / ${total}`),
    statTile('完成章节', `${chapterDone} / ${Game.chapters.length}`),
    statTile('能力徽章', `${save.badges.length} / ${Growth.STAGES.length * Growth.PACKS.length}`),
    statTile('成就', `${Object.keys(save.achievements).length} / ${Object.keys(Growth.ACHIEVEMENTS).length}`),
    statTile('尝试次数', `${save.runs.length} 次`));
  $('badge-list').replaceChildren();
  Growth.PACKS.forEach((pack, index) => {
    for (const key of Growth.STAGES) {
      const earned = save.badges.includes(`${index}:${key}`);
      const badge = document.createElement('span'); badge.className = `badge ${earned ? 'earned' : 'locked'}`;
      const name = document.createElement('b'); name.textContent = Growth.BADGE[index][key];
      const detail = document.createElement('small'); detail.textContent = `第${CN_NUM[index]}关 · ${Growth.LABEL[key]} · ${Growth.XP[key]} XP`;
      badge.append(name, detail); $('badge-list').append(badge);
    }
  });
  renderAchievements();
  renderChapters(next);
  renderRoad(next);
  $('toggle-sound').setAttribute('aria-checked', String(!!save.sound));
  $('toggle-sound').textContent = save.sound ? '开启' : '关闭';
  for (const button of document.querySelectorAll('#home-modes button')) button.setAttribute('aria-pressed', String(button.dataset.mode === save.mode));
  for (const button of document.querySelectorAll('#home-stages button')) button.setAttribute('aria-pressed', String(button.dataset.stage === stage));
  for (const button of document.querySelectorAll('#game-modes button')) button.setAttribute('aria-pressed', String(button.dataset.mode === save.mode));
  for (const button of document.querySelectorAll('#game-stages button')) button.setAttribute('aria-pressed', String(button.dataset.stage === stage));
}
const Sound = (() => {
  let context = null;
  function audio() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      context = new Audio();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }
  function tone(frequency, delay, length, gain, type = 'sine') {
    const audioContext = audio(); if (!audioContext) return;
    const oscillator = audioContext.createOscillator(), volume = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start(start); oscillator.stop(start + length + 0.02);
  }
  const cues = {
    run: [[440, 0, 0.09, 0.03]],
    deliver: [[660, 0, 0.08, 0.032], [880, 0.07, 0.1, 0.026]],
    win: [[523, 0, 0.14, 0.035], [659, 0.1, 0.16, 0.035], [784, 0.2, 0.24, 0.032]],
    error: [[196, 0, 0.16, 0.035, 'triangle'], [147, 0.1, 0.22, 0.03, 'triangle']],
  };
  return { play(name) { if (!save.sound || !cues[name]) return; cues[name].forEach(([frequency, delay, length, gain, type]) => tone(frequency, delay, length, gain, type)); } };
})();
async function api(path, method = 'GET', value) {
  if (location.protocol === 'file:') throw Error('AI 连接需要本机服务。请双击“启动游戏.cmd”，并使用它自动打开的页面。');
  if (hostedRuntime && path === '/api/config' && method === 'GET' && hostedAISecret)
    return { configured: true, url: hostedAISecret.url, model: hostedAISecret.model, source: 'page-memory' };
  if (hostedRuntime && path === '/api/config' && method === 'DELETE') hostedAISecret = null;
  let requestValue = value;
  if (hostedRuntime && path === '/api/config' && method === 'PUT') {
    requestValue = { ...value };
    if (!requestValue.key?.trim() && hostedAISecret) {
      try {
        if (new URL(requestValue.url).origin === new URL(hostedAISecret.url).origin) requestValue.key = hostedAISecret.key;
      } catch {}
    }
  }
  else if (hostedRuntime && method === 'POST' && hostedAISecret) requestValue = { ...(value || {}), __config: hostedAISecret };
  const request = async retry => {
    const join = path.includes('?') ? '&' : '?';
    const target = retry ? `${path}${join}_=${Date.now()}` : path;
    return fetch(target, {
      method, cache: 'no-store',
      headers: requestValue === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: requestValue === undefined ? undefined : JSON.stringify(requestValue)
    });
  };
  let response;
  try { response = await request(false); }
  catch { throw Error('游戏服务未连接。请重新双击“启动游戏.cmd”；本地规则仍可运行。'); }
  let raw = await response.text(), result;
  try { result = JSON.parse(raw.replace(/^\uFEFF/, '')); }
  catch {
    try { response = await request(true); raw = await response.text(); result = JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch {
      throw Error('当前端口返回的不是游戏接口。请关闭这个页面，重新双击“启动游戏.cmd”后再设置 API。');
    }
  }
  if (!response.ok) throw Error(result.error || `服务返回 ${response.status}`);
  if (hostedRuntime && path === '/api/config' && method === 'PUT')
    hostedAISecret = { url: result.url, model: result.model, key: requestValue.key };
  return result;
}
async function configStatus() {
  try { const info = await api('/api/config'); aiConfig = info; $('api-status').textContent = info.configured ? `已配置 ${info.model} · 可测试连接` : '本地规则可直接游玩，AI 连接可选。'; return info; }
  catch { aiConfig = null; $('api-status').textContent = '当前使用本地规则；连接 AI 需要启动游戏服务。'; return null; }
}
function updateBoard(state = world) {
  world = state; const board = $('board'); board.replaceChildren();
  const theme = Game.themeOf(level), icon = theme.icons, hasBlue = Game.levels[level].items.some(item => item[2] === 'blue');
  board.dataset.theme = Game.levels[level].theme;
  $('world-name').textContent = theme.label;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 11; x++) {
    const cell = document.createElement('div'); cell.className = 'cell'; let label = '地面';
    if (Game.wall(x, y, level)) { cell.classList.add('wall'); cell.textContent = icon.wall; label = '障碍'; }
    if (x === 9 && (y === 2 || (hasBlue && y === 5))) {
      const color = y === 2 ? 'red' : 'blue'; cell.classList.add('furnace', color);
      cell.textContent = color === 'red' ? icon.facilityRed : icon.facilityBlue;
      label = names[color] + theme.facility;
    }
    const item = state.items.find(i => i.x === x && i.y === y);
    if (item) { cell.classList.add(item.color); cell.textContent = icon.cargo; label = names[item.color] + theme.cargo + '，编号 ' + item.id; }
    if (state.x === x && state.y === y) {
      cell.classList.add('robot'); if (state.carry) cell.classList.add('carry');
      cell.textContent = state.carry ? icon.carry : icon.actor; label = theme.actor;
    }
    cell.title = `${label} (${x}, ${y})`; cell.setAttribute('aria-label', label); board.append(cell);
  }
  $('stats').textContent = `投递 ${state.delivered}/${Game.levels[level].quota} · ${state.steps} 步`;
  $('legend').textContent = theme.legend;
}
function rememberDraft() { if (activeView === 'game') drafts[`${level}:${stage}`] = $('input').value; }
function applyStageChrome() {
  const theme = Game.themeOf(level);
  $('input-label').textContent = stage === 'natural' ? '写下你的规则' : stage === 'pseudo' ? '写下伪代码' : '编写 C 程序';
  $('editor-kicker').textContent = stage === 'natural' ? '想法 → 行动' : stage === 'pseudo' ? '逻辑 → 行动' : '程序 → 行动';
  $('editor-title').textContent = stage === 'natural' ? `告诉${theme.actor}怎么做` : stage === 'pseudo' ? '整理行动逻辑' : '亲自编写程序';
  const objects = Game.levels[level].items.map((item, id) => `#${id} ${names[item[2]]}(${item[0]},${item[1]})`).join('、');
  $('editor-help').textContent = stage === 'natural'
    ? save.mode === 'learning' ? '本地可运行。说清对象、目标和路线；批量任务加入重复，分拣任务加入颜色条件。' : `本地识别，无需 API。用自己的话安排${theme.actor}行动。`
    : stage === 'pseudo' ? '逐行修改方括号里的内容；系统会指出第一处不符合规则的行。'
    : `workshop.h · 地图 11 × 8，左上角 (0,0)。${theme.cargo}编号 0～${Game.levels[level].items.length - 1}。\nint crystal_count(void); int crystal_color(int id);\nvoid deliver(int id, int furnace_color); 常量 RED、BLUE。deliver 自动寻找合法路线。\n本关对象：${objects}。${Game.levels[level].ordered ? '本关必须按编号从小到大依次投递。' : ''}`;
  $('voice').hidden = stage !== 'natural'; $('open-chat').hidden = stage !== 'natural';
  $('hint-box').hidden = save.mode !== 'learning';
}
function loadStageDraft() {
  const key = `${level}:${stage}`;
  $('input').value = drafts[key] ?? (stage === 'natural' ? '' : stage === 'pseudo' ? pseudoScaffold(level) : codeScaffold(level));
  $('input').classList.toggle('code', stage === 'code');
  $('input').placeholder = stage === 'natural' ? `例如：找到红色${Game.themeOf(level).cargo}，把它送进${Game.themeOf(level).facility}；遇到障碍就绕开。` : '';
}
function setStage(next) {
  if (!stageNames[next] || next === stage) return;
  if (activeView === 'game') drafts[`${level}:${stage}`] = $('input').value;
  stage = next; save.stage = next; persist();
  renderHome();
  if (activeView !== 'game') return;
  applyStageChrome(); loadStageDraft();
  renderPreview('切换表达方式后，需要重新运行。'); $('logs').replaceChildren();
  $('program-box').open = false; $('log-box').open = false; $('feedback').textContent = '已切换为' + stageNames[stage] + '难度。';
}
function setMode(next) {
  if (!['entertainment', 'learning'].includes(next) || next === save.mode) return;
  save.mode = next; persist(); renderHome();
  if (activeView === 'game') applyStageChrome();
}
function openLevel(index) {
  rememberDraft(); level = index; world = Game.create(index); clearInterval(timer); stopRunWorker(); if (workerBusy && worker) { clearTimeout(workerTimer); worker.terminate(); worker = null; workerBusy = false; }
  $('game-view').classList.remove('completed');
  hintStage = 0; chatHistory = []; proposedProgram = null; aiUsedRun = false;
  $('game-title').textContent = Game.levels[index].title;
  $('game-goal').textContent = Game.levels[index].goal;
  $('game-concept').textContent = `0${index + 1} / 0${Game.levels.length} · ${Game.levels[index].concept}`;
  applyStageChrome(); loadStageDraft();
  $('hint-count').textContent = '0 / 3'; $('hint-text').textContent = '先尝试写下你的想法。'; $('hint-next').disabled = false; $('hint-next').textContent = '查看第 1 级提示';
  $('hint-box').open = false; $('program-box').open = false; $('log-box').open = false;
  renderPreview('运行前暂无规则。'); $('logs').replaceChildren();  $('complete').hidden = true; $('run').disabled = false; $('input').disabled = false;
  $('feedback').textContent = `${Game.themeOf(index).actor}已就绪。`; updateBoard(); show('game');
}
function reset() { const value = $('input').value; openLevel(level); $('input').value = value; }
function log(message) {
  const li = document.createElement('li');
  const index = document.createElement('span'); index.className = 'log-n'; index.textContent = String(++logIndex);
  const text = document.createElement('span');
  text.className = 'log-t ' + (message.startsWith('送达') ? 'hit' : message.startsWith('取起') ? 'pick'
    : message.startsWith('任务完成') ? 'win' : /障碍|不能|超时|失败|错误|未成功/.test(message) ? 'err' : '');
  text.textContent = message;
  li.append(index, text); $('logs').prepend(li);
}
function describeProgram(program) {
  const theme = Game.themeOf(level), measure = theme.measure || '件';
  const describe = node => node.type === 'deliver_next' ? `找到下一${measure}${names[node.color]}${theme.cargo}，${node.route === 'safe' ? '绕开障碍后送入' : '直接送入'}${names[node.targetColor || node.color]}${theme.facility}`
    : node.type === 'deliver_id' ? `投递编号 ${node.id} 的${theme.cargo}到${names[node.targetColor || node.color]}${theme.facility}`
      : node.type === 'repeat' ? `重复直到没有${theme.cargo}：\n${node.body.map(describe).join('\n')}`
        : node.type === 'def' ? `定义技能「${node.name}」：\n${node.body.map(describe).join('\n')}`
          : node.type === 'call' ? `调用技能「${node.name}」`
            : `如果下一${measure}是红色：\n${node.then.map(describe).join('\n')}\n否则：\n${node.else.map(describe).join('\n')}`;
  return program.steps.map(describe).join('\n');
}
function programLines(steps, depth, out) {
  const theme = Game.themeOf(level), measure = theme.measure || '件';
  for (const node of steps) {
    if (node.type === 'repeat') { out.push({ depth, text: `重复直到没有${theme.cargo}：` }); programLines(node.body, depth + 1, out); }
    else if (node.type === 'def') { out.push({ depth, text: `定义技能「${node.name}」：` }); programLines(node.body, depth + 1, out); }
    else if (node.type === 'call') out.push({ depth, text: `调用技能「${node.name}」` });
    else if (node.type === 'if_color') {
      out.push({ depth, text: `如果下一${measure}是红色：` }); programLines(node.then, depth + 1, out);
      out.push({ depth, text: '否则：' }); programLines(node.else, depth + 1, out);
    } else out.push({ depth, text: node.type === 'deliver_next'
      ? `找到下一${measure}${names[node.color]}${theme.cargo}，${node.route === 'safe' ? '绕开障碍后送入' : '直接送入'}${names[node.targetColor || node.color]}${theme.facility}`
      : `投递编号 ${node.id} 的${theme.cargo}到${names[node.targetColor || node.color]}${theme.facility}` });
  }
  return out;
}
function renderPreview(input) {
  const box = $('program-preview'); box.replaceChildren();
  const lines = typeof input === 'string' ? input.split('\n').map(text => ({ depth: 0, text })) : programLines(input.steps, 0, []);
  lines.forEach(({ depth, text }) => {
    const row = document.createElement('span'); row.className = 'pl';
    row.style.paddingLeft = `${8 + depth * 20}px`; row.textContent = text;
    box.append(row, document.createTextNode('\n'));
  });
}
function recordFailure(source, reason) {
  Growth.record(save, { id: crypto.randomUUID?.() || String(Date.now()), level, stage, mode: save.mode,
    source, program: null, success: false, steps: 0, delivered: 0, reason, events: [reason], at: new Date().toISOString() });
  persist(); Sound.play('error');
}
function finishRun(result, source, program) {
  currentRun = Growth.record(save, { id: crypto.randomUUID?.() || String(Date.now()), level, stage, mode: save.mode,
    source, program, success: result.success, steps: result.state.steps, delivered: result.state.delivered,
    reason: result.reason, events: result.events.map(e => e.message), at: new Date().toISOString() });
  const reward = result.success ? Growth.award(save, level, stage) : null;
  const unlocked = result.success ? Growth.evaluate(save, { won: true, level, usedAI: aiUsedRun, hour: new Date().getHours() }) : [];
  aiUsedRun = false;
  persist(); renderHome();
  $('run').disabled = false; $('input').disabled = false;
  Sound.play(result.success ? 'win' : 'error');
  if (result.success) {
    $('complete').hidden = false;
    let line = reward ? `首次完成此难度 · +${reward.xp} XP · ${reward.badge}徽章` : '挑战完成 · 已记录这次运行';
    if (unlocked.length) line += ` · 解锁成就「${unlocked.map(item => item.name).join('」「')}」`;
    $('reward-line').textContent = line;
    $('next-level').textContent = level === Game.levels.length - 1 ? '返回主界面 →' : '继续主线 →';
    $('game-view').classList.add('completed'); window.scrollTo(0, 0);
  } else { $('program-box').open = true; $('log-box').open = true; }
}
function play(program, source) {
  let result;
  try { result = Game.execute(level, program); }
  catch (error) { $('feedback').textContent = error.message; recordFailure(source, error.message); $('run').disabled = false; $('input').disabled = false; return; }
  renderPreview(program);
  $('logs').replaceChildren(); logIndex = 0; $('run').disabled = true; $('input').disabled = true; $('complete').hidden = true;
  Sound.play('run');
  let step = 0; clearInterval(timer);
  timer = setInterval(() => {
    const event = result.events[step++];
    if (!event) { clearInterval(timer); finishRun(result, source, program); return; }
    updateBoard(event.state); $('feedback').textContent = event.message; log(event.message);
    if (event.message.startsWith('送达')) Sound.play('deliver');
    if (step >= result.events.length) { clearInterval(timer); finishRun(result, source, program); }
  }, 125);
}
function stopRunWorker() { clearTimeout(runTimer); runTimer = null; if (runWorker) { runWorker.terminate(); runWorker = null; } }
function cFailure(message, source, showPreview = false) {
  $('feedback').textContent = message; recordFailure(source, message);
  $('run').disabled = false; $('input').disabled = false;
  if (showPreview) { $('program-box').open = true; renderPreview(message); }
}
function runWasm(wasm, token, source) {
  stopRunWorker();
  runWorker = new Worker('c-run-worker.js', { type: 'module' });
  runTimer = setTimeout(() => { stopRunWorker(); cFailure('C 程序运行超时，可能存在无限循环。', source); }, 30000);
  runWorker.onerror = () => { stopRunWorker(); cFailure('C 运行环境加载失败。请检查网络和浏览器支持。', source); };
  runWorker.onmessage = event => {
    const data = event.data;
    if (data.type === 'status') {
      $('feedback').textContent = data.value;
      if (/正在运行/.test(data.value)) { clearTimeout(runTimer); runTimer = setTimeout(() => { stopRunWorker(); cFailure('C 程序运行超时，可能存在无限循环。', source); }, 10000); }
    } else if (data.type === 'error') { stopRunWorker(); cFailure(data.message, source); }
    else if (data.type === 'stdout') {
      stopRunWorker();
      const actions = [];
      for (const line of String(data.output || '').split(/\r?\n/)) {
        const match = new RegExp(`^ACTION ${token} (-?\\d+) (-?\\d+)$`).exec(line.trim());
        if (!match) continue;
        actions.push({ id: Number(match[1]), color: match[2] === '1' ? 'red' : match[2] === '2' ? 'blue' : 'invalid' });
        if (actions.length > 100) break;
      }
      try { play(Game.fromActions(actions), source); }
      catch (error) { cFailure(error.message, source); }
    }
  };
  runWorker.postMessage({ wasm, token });
}
function codeRun(source) {
  if (!source.trim() || source.length > 16000) { $('feedback').textContent = '请输入不超过 16000 字的 C 程序。'; recordFailure(source, $('feedback').textContent); return; }
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    $('feedback').textContent = '当前浏览器缺少 C 运行所需的隔离能力。请通过本机服务在 Edge 或 Chrome 打开游戏。';
    recordFailure(source, $('feedback').textContent); return;
  }
  stopRunWorker();
  $('run').disabled = true; $('input').disabled = true; $('feedback').textContent = '正在准备 C 编译环境…';
  if (!worker) worker = new Worker('c-worker.js', { type: 'module' });
  workerBusy = true;
  let settled = false;
  const compileStall = () => {
    clearTimeout(workerTimer);
    workerTimer = setTimeout(() => { settled = true; const dying = worker; worker = null; workerBusy = false; if (dying) { dying.onmessage = null; dying.terminate(); } cFailure('C 编译器加载或编译超时。检查网络后重试。', source); }, 300000);
  };
  compileStall();
  worker.onerror = () => {
    const pending = workerBusy && !settled;
    const dying = worker;
    worker = null; workerBusy = false; clearTimeout(workerTimer);
    if (dying) { dying.onmessage = null; dying.terminate(); }
    if (pending) cFailure('C 编译器加载失败。请检查网络和浏览器支持。', source);
  };
  worker.onmessage = event => {
    const data = event.data;
    if (data.type === 'status') { $('feedback').textContent = data.value; compileStall(); }
    else if (data.type === 'error') { settled = true; clearTimeout(workerTimer); workerBusy = false; cFailure(data.message, source, true); }
    else if (data.type === 'compiled') { settled = true; clearTimeout(workerTimer); workerBusy = false; runWasm(data.wasm, data.token, source); }
  };
  worker.postMessage({ code: source, colors: Game.levels[level].items.map(i => i[2]) });
}
function runInput() {
  const source = $('input').value;
  if (stage === 'code') { codeRun(source); return; }
  try { play(stage === 'natural' ? Game.natural(source, level) : Game.pseudo(source, level), source); }
  catch (error) {
    $('feedback').textContent = error.message; renderPreview('输入尚未形成可执行规则。');
    recordFailure(source, error.message); $('program-box').open = true;
  }
}
function hint() {
  hintStage = Math.min(3, hintStage + 1); $('hint-count').textContent = `${hintStage} / 3`;
  $('hint-next').textContent = hintStage < 3 ? `查看第 ${hintStage + 1} 级提示` : '提示已全部查看';
  $('hint-next').disabled = hintStage === 3;
  const concept = Game.levels[level].concept, theme = Game.themeOf(level), count = Game.levels[level].items.length;
  const run = latestRun();
  $('hint-text').textContent = hintStage === 1 ? `观察地图：${theme.actor}、${theme.cargo}与${theme.facility}在哪里？这一关练习${concept}。`
    : hintStage === 2 ? stage === 'natural'
      ? level === 3 ? `说清${theme.cargo}数组、编号从小到大的顺序，以及直到没有${theme.cargo}的重复过程。`
        : level === 4 ? `说清三件事：把投递红色${theme.cargo}的步骤定义成技能、要调用几次、以及是否绕开障碍。` : '把目标、重复或分类条件，以及遇到障碍的处理方式分别说清。'
      : stage === 'pseudo'
        ? level === 3 ? '检查起始编号、循环结束条件，以及每轮是否按编号推进。'
          : level === 4 ? `技能只定义一次；每调用一次就写一行「调用」，本关共 ${count} ${theme.measure}${theme.cargo}。` : '检查每一行的顺序、循环结束条件或颜色分支。'
        : level === 3 ? '用 for 循环遍历编号：让下标从 0 开始，逐次增加到 crystal_count() - 1。'
          : level === 4 ? `把 deliver(id, RED) 封装进自己的函数，再在 main 里对编号 0～${count - 1} 各调用一次。` : '先查看 workshop.h 的函数与对象编号，再想想如何用循环和条件减少重复调用。'
    : run ? `最近一次执行：${run.success ? '已完成' : run.reason}。回看提交内容，找出这一结果对应的规则。` : '先运行一次，再用真实反馈决定要改哪里。';
}
function openChat() { chatHistory = []; proposedProgram = null; $('chat-messages').replaceChildren(); $('proposal').hidden = true; $('accept-proposal').hidden = true; $('chat-input').value = $('input').value; $('chat-panel').hidden = false; }
function bubble(text, type) { const div = document.createElement('div'); div.className = 'chat-bubble ' + type; div.textContent = text; $('chat-messages').append(div); $('chat-messages').scrollTop = $('chat-messages').scrollHeight; }
async function sendChat() {
  const text = $('chat-input').value.trim(); if (!text) return;
  bubble(text, 'user'); $('chat-input').value = ''; $('send-chat').disabled = true;
  const localProposal = () => {
    const ideas = [...chatHistory.filter(item => item.role === 'user').map(item => item.content), text].join('；');
    let program;
    try { program = Game.natural(text, level); } catch { program = Game.natural(ideas, level); }
    return { reply: '本地规则已识别。请检查下面的行动预览，确认后再运行。', program, local: true };
  };
  try {
    let result;
    try { result = aiConfig?.configured ? await api('/api/propose', 'POST', { level, text, messages: chatHistory, lastRun: latestRun() }) : localProposal(); }
    catch (error) { bubble(error.message, 'error'); result = localProposal(); }
    bubble(result.reply, 'assistant'); chatHistory.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
    proposedProgram = result.program;
    $('proposal-label').textContent = result.local ? '本地识别的规则' : 'AI 提议的规则';
    $('accept-proposal').dataset.local = String(!!result.local);
    $('proposal').hidden = !proposedProgram; $('accept-proposal').hidden = !proposedProgram;
    if (proposedProgram) $('proposal-text').textContent = describeProgram(proposedProgram);
  } catch (error) { chatHistory.push({ role: 'user', content: text }); bubble(error.message, 'error'); proposedProgram = null; $('proposal').hidden = true; $('accept-proposal').hidden = true; }
  finally { $('send-chat').disabled = false; }
}
function exportLabel(choice) { return choice === 'combined' ? '成长总报告' : Growth.PACKS[choice].title; }
function exportObject(choice) { return choice === 'combined' ? save.combinedDraft : save.articles[choice]; }
function setExportObject(choice, value) { if (choice === 'combined') save.combinedDraft = value; else save.articles[choice] = value; }
function selectedLevels() { return [...document.querySelectorAll('#combine-options input:checked')].map(el => Number(el.value)); }
function exportEvidence(choice) { return choice === 'combined' ? Growth.combined(save, selectedLevels()) : Growth.levelDraft(save, choice); }
function renderExport() {
  $('export-title').textContent = exportLabel(exportChoice);
  for (const button of document.querySelectorAll('#export-list button')) button.setAttribute('aria-current', String(button.dataset.choice === String(exportChoice)));
  const activeChoice = [...document.querySelectorAll('#export-list button')].find(button => button.dataset.choice === String(exportChoice));
  if (activeChoice) requestAnimationFrame(() => activeChoice.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  $('combine-options').hidden = exportChoice !== 'combined';
  const saved = exportObject(exportChoice), evidence = exportEvidence(exportChoice);
  $('export-text').hidden = !saved; $('export-empty').hidden = !!saved;
  $('export-empty').textContent = evidence ? '已有运行记录，点击下方按钮生成草稿。' : '尚无运行记录，先去挑战关卡。';
  $('export-text').value = saved?.body || '';
  $('generate-export').textContent = saved ? '重新生成建议' : '生成草稿';
  $('generate-export').disabled = !evidence;
  $('save-export').hidden = !saved; $('download-export').hidden = !saved;
  const newRuns = evidence && saved ? evidence.sourceRunIds.filter(id => !(saved.sourceRunIds || []).includes(id)) : [];
  $('export-update').hidden = !newRuns?.length;
  if (newRuns?.length) $('export-update').querySelector('p').textContent = `有 ${newRuns.length} 次新尝试可合并：` + save.runs.filter(r => newRuns.includes(r.id)).map(r =>
    `${Growth.PACKS[r.level].title} · ${Growth.LABEL[r.stage]}${r.success ? '完成' : '未完成'}（${r.steps} 步）`).join('；');
  $('export-note').textContent = saved ? '可编辑 · 仅保存在本机' : '';
}
function openExport() {
  $('export-list').replaceChildren();
  for (const choice of [0, 1, 2, 'combined']) {
    const button = document.createElement('button'); button.dataset.choice = String(choice); button.textContent = exportLabel(choice);
    button.onclick = () => { if (exportObject(exportChoice)) saveExport(); exportChoice = choice; renderExport(); }; $('export-list').append(button);
  }
  renderExport(); show('export');
}
function createExport() {
  const evidence = exportEvidence(exportChoice); if (!evidence) return;
  if (exportObject(exportChoice)) {
    $('export-note').textContent = '新建议已准备。旧文字未更改，可使用“把新事实附在文末”。'; return;
  }
  setExportObject(exportChoice, { ...evidence, updatedAt: new Date().toISOString() }); persist(); renderExport();
}
function saveExport() { const item = exportObject(exportChoice); if (!item) return; item.body = $('export-text').value; item.updatedAt = new Date().toISOString(); persist(); $('export-note').textContent = '已保存'; }
function mergeUpdate() {
  const item = exportObject(exportChoice), evidence = exportEvidence(exportChoice); if (!item || !evidence) return;
  const newIds = evidence.sourceRunIds.filter(id => !(item.sourceRunIds || []).includes(id));
  const newRuns = save.runs.filter(r => newIds.includes(r.id));
  if (!newRuns.length) return;
  const addition = newRuns.map(r => `- ${Growth.LABEL[r.stage]}：${r.success ? '完成' : '未完成'}，投递 ${r.delivered} 颗，${r.steps} 步${r.reason ? '；' + r.reason : ''}`).join('\n');
  item.body = $('export-text').value + `\n\n## 新的运行记录\n\n${addition}\n`;
  item.sourceRunIds = [...new Set([...(item.sourceRunIds || []), ...newIds])]; item.updatedAt = new Date().toISOString();
  persist(); renderExport();
}
function download() {
  const item = exportObject(exportChoice); if (!item) return; saveExport();
  const url = URL.createObjectURL(new Blob([item.body], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${exportLabel(exportChoice)}-规则之外.md`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function goHome() { rememberDraft(); renderHome(); showHomePanel('cover'); show('home'); }
$('brand-home').onclick = goHome;
$('back-home').onclick = () => { rememberDraft(); clearInterval(timer); stopRunWorker(); if (workerBusy && worker) { clearTimeout(workerTimer); worker.terminate(); worker = null; workerBusy = false; } goHome(); };
$('export-back').onclick = () => { if (exportObject(exportChoice)) saveExport(); goHome(); };
$('open-export').onclick = openExport;
$('game-settings').onclick = () => $('game-settings-dialog').showModal();
$('close-game-settings').onclick = () => $('game-settings-dialog').close();
async function openSettingsDialog(preset) {
  const info = preset ? null : await configStatus();
  $('api-url').value = preset?.url ?? info?.url ?? '';
  $('api-model').value = preset?.model ?? info?.model ?? '';
  $('api-key').value = '';
  $('config-feedback').textContent = info?.configured ? '已配置。密钥不会显示。' : '尚未配置。';
  $('settings-dialog').showModal();
}
$('open-settings').onclick = () => openSettingsDialog();
for (const preset of AI_PRESETS) {
  const button = document.createElement('button'); button.dataset.preset = preset.name; button.textContent = preset.name;
  button.onclick = () => openSettingsDialog(preset);
  $('ai-presets').append(button);
}
$('close-settings').onclick = () => $('settings-dialog').close();
async function saveConfigForm() {
  const info = await api('/api/config', 'PUT', { url: $('api-url').value, model: $('api-model').value, key: $('api-key').value });
  $('api-key').value = ''; $('api-url').value = info.url; aiConfig = info; await configStatus(); return info;
}
async function configureFromForm(testConnection) {
  $('save-config').disabled = true; $('test-config').disabled = true;
  $('config-feedback').textContent = testConnection ? '正在保存并测试当前配置…' : '正在保存…';
  try { await saveConfigForm(); if (testConnection) await api('/api/test', 'POST', {}); $('config-feedback').textContent = testConnection ? '连接成功，现在可以与 AI 对话。' : '已保存。可以测试连接或直接进入 AI 对话。'; }
  catch (error) { $('config-feedback').textContent = error.message; }
  finally { $('save-config').disabled = false; $('test-config').disabled = false; }
}
$('save-config').onclick = () => configureFromForm(false);
$('test-config').onclick = () => configureFromForm(true);
$('clear-config').onclick = async () => { try { const info = await api('/api/config', 'DELETE'); $('api-key').value = ''; $('config-feedback').textContent = info.configured ? '已恢复启动时的环境变量配置。' : '已清除本次会话配置。'; configStatus(); } catch (error) { $('config-feedback').textContent = error.message; } };
for (const button of document.querySelectorAll('.rail-nav button')) button.onclick = () => {
  if (button.dataset.home === 'continue') { showHomePanel('cover'); openLevel(nextLevelIndex()); return; }
  showHomePanel(button.dataset.home);
};
$('hero-continue').onclick = () => { showHomePanel('cover'); openLevel(nextLevelIndex()); };
for (const button of document.querySelectorAll('#home-modes button, #game-modes button')) button.onclick = () => setMode(button.dataset.mode);
for (const button of document.querySelectorAll('#home-stages button, #game-stages button')) button.onclick = () => setStage(button.dataset.stage);
$('toggle-sound').onclick = () => { save.sound = !save.sound; persist(); renderHome(); if (save.sound) Sound.play('deliver'); };
$('run').onclick = runInput; $('reset').onclick = reset;
$('next-level').onclick = () => { if (level < Game.levels.length - 1) openLevel(level + 1); else goHome(); };
$('retry-complete').onclick = reset;
$('hint-next').onclick = hint;
$('open-chat').onclick = openChat; $('close-chat').onclick = () => { $('chat-panel').hidden = true; };
$('send-chat').onclick = sendChat;
  $('accept-proposal').onclick = () => { if (!proposedProgram) return; const accepted = proposedProgram; aiUsedRun = $('accept-proposal').dataset.local !== 'true'; $('chat-panel').hidden = true; $('input').value = chatHistory.filter(m => m.role === 'user').map(m => m.content).join('\n'); play(accepted, $('input').value); };
$('generate-export').onclick = createExport; $('save-export').onclick = saveExport; $('download-export').onclick = download; $('merge-update').onclick = mergeUpdate;
for (const [index, pack] of Growth.PACKS.entries()) {
  const label = document.createElement('label');
  const box = document.createElement('input'); box.type = 'checkbox'; box.value = String(index); box.checked = true;
  label.append(box, ` 第${CN_NUM[index]}关 · ${pack.title}`);
  $('combine-options').append(label);
  box.onchange = () => { if (exportChoice === 'combined' && exportObject(exportChoice)) saveExport(); renderExport(); };
}
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Speech) {
  const recognition = new Speech(); recognition.lang = 'zh-CN'; let listening = false;
  const stopListen = () => { listening = false; $('voice').classList.remove('listening'); $('voice').textContent = '♪'; };
  recognition.onresult = event => {
    $('input').value += event.results[0][0].transcript;
    save.marks.voiceUsed = true; persist(); renderHome();
  };
  recognition.onerror = () => { stopListen(); $('feedback').textContent = '语音识别未成功，可以继续使用文字。'; };
  recognition.onend = stopListen;
  $('voice').onclick = () => {
    if (listening) { recognition.stop(); return; }
    listening = true; $('voice').classList.add('listening'); $('voice').textContent = '◉'; recognition.start();
  };
}
else { $('voice').hidden = true; }
$('game-view').insertBefore($('complete'), document.querySelector('.game-layout'));
persist(); renderHome(); showHomePanel('cover'); configStatus(); show('home');
