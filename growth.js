/* Versioned local progress, evidence-based export drafts, and achievements. */
(function (root) {
  const KEY = 'beyond-rules-save-v3', OLD = 'beyond-rules-save-v2', LEGACY = 'beyond-rules-progress';
  const STAGES = ['natural', 'pseudo', 'code'];
  const XP = { natural: 100, pseudo: 80, code: 120 };
  const TOTAL_XP = 1500;
  const LABEL = { natural: '自然语言', pseudo: '伪代码', code: 'C 代码' };
  const BADGE = [
    { natural: '表达者', pseudo: '顺序设计者', code: '工坊程序员' },
    { natural: '循环表达者', pseudo: '循环设计者', code: '自动化程序员' },
    { natural: '分拣表达者', pseudo: '条件设计者', code: '分拣程序员' },
    { natural: '遍历表达者', pseudo: '数组设计者', code: '档案程序员' },
    { natural: '封装表达者', pseudo: '函数设计者', code: '炼金程序员' },
  ];
  const PACKS = [
    { title: '第一颗能源核心', goal: '投递一颗红色晶体', concept: '顺序执行：明确对象、动作与目标。' },
    { title: '自动搬运系统', goal: '重复投递三颗红色晶体', concept: '循环：重复执行并说明结束条件。' },
    { title: '颜色分拣工坊', goal: '把红蓝晶体送入同色发电炉', concept: '条件判断：根据颜色选择动作分支。' },
    { title: '古籍档案馆', goal: '按编号从 0 到 4 依次归档五卷红色卷宗', concept: '数组与遍历：从下标 0 开始，按顺序访问每个元素，直到数组末尾。' },
    { title: '秘方蒸馏所', goal: '把投递红色药剂封装成技能并调用三次', concept: '函数：把一段常用步骤封装成可复用的技能，定义一次，按需多次调用。' },
  ];
  /* 成就：普通随进度解锁；彩蛋记录特殊经历，解锁前只显示描述。 */
  const ACHIEVEMENTS = {
    first_win: { kind: 'normal', name: '初试锋芒', desc: '完成第一关', test: s => s.completedLevels.includes(0) },
    chapter1: { kind: 'normal', name: '新手毕业', desc: '完成第一章的全部三关', test: s => [0, 1, 2].every(i => s.completedLevels.includes(i)) },
    c_road: { kind: 'normal', name: 'C 语言之路', desc: '通关古籍档案馆或秘方蒸馏所', test: s => s.completedLevels.includes(3) || s.completedLevels.includes(4) },
    all_done: { kind: 'normal', name: '五关全通', desc: '完成全部五个关卡', test: s => s.progress >= 5 },
    polyglot: { kind: 'normal', name: '三语者', desc: '在同一关集齐三种表达方式的徽章', test: s => PACKS.some((_, i) => STAGES.every(k => s.completions[`${i}:${k}`])) },
    collector: { kind: 'normal', name: '全收集者', desc: '集齐全部 15 枚能力徽章', test: s => s.badges.length >= STAGES.length * PACKS.length },
    persist: { kind: 'easter', name: '越挫越勇', desc: '在同一关失败三次之后通关' },
    wall_learner: { kind: 'easter', name: '撞墙之后', desc: '经历过“路线被障碍挡住”，并最终通关这一关' },
    ai_partner: { kind: 'easter', name: 'AI 搭档', desc: '采纳 AI 提议的规则并通关' },
    voice_user: { kind: 'easter', name: '开口说话', desc: '用语音输入写下规则' },
    night_owl: { kind: 'easter', name: '深夜工坊', desc: '在 22:00 到次日 5:00 之间通关' },
  };
  const fresh = () => ({ version: 3, mode: 'entertainment', sound: true, stage: 'natural', progress: 0, completedLevels: [], xp: 0,
    completions: {}, badges: [], runs: [], articles: {}, combinedDraft: null, achievements: {}, marks: { failCount: {}, wallHit: {}, voiceUsed: false } });
  function load(storage) {
    const save = fresh();
    try {
      const current = JSON.parse(storage.getItem(KEY) || 'null');
      if (current?.version === 3) {
        Object.assign(save, current);
        save.runs = Array.isArray(current.runs) ? current.runs.slice(-60) : [];
        save.articles = current.articles && typeof current.articles === 'object' ? current.articles : {};
        save.completions = current.completions && typeof current.completions === 'object' ? current.completions : {};
        save.achievements = current.achievements && typeof current.achievements === 'object' ? current.achievements : {};
        save.marks = { failCount: {}, wallHit: {}, voiceUsed: false, ...(current.marks || {}) };
        save.completedLevels = Array.isArray(current.completedLevels)
          ? [...new Set(current.completedLevels.filter(x => Number.isInteger(x) && PACKS[x]))]
          : [...new Set([...Array(Math.max(0, Math.min(3, Math.floor(Number(current.progress) || 0)))).keys(),
            ...save.runs.filter(r => r.success).map(r => r.level)])];
        save.progress = save.completedLevels.length;
        return save;
      }
      const old = JSON.parse(storage.getItem(OLD) || 'null');
      if (old?.version === 2) {
        save.mode = old.mode === 'learning' ? 'learning' : 'entertainment';
        save.progress = Math.max(0, Math.min(3, Number(old.progress) || 0));
        save.completedLevels = [...Array(save.progress).keys()];
        save.runs = (old.runs || []).map(r => ({ ...r, stage: 'natural', source: r.source || r.text || r.input || '' })).slice(-60);
        if (old.badges?.includes('expression')) {
          save.completions['0:natural'] = true; save.badges.push('0:natural'); save.xp = 100;
        }
        if (old.article && typeof old.article.body === 'string')
          save.articles[0] = { body: old.article.body, updatedAt: old.article.updatedAt || '', sourceRunIds: [] };
        return save;
      }
      const progress = Number(storage.getItem(LEGACY));
      if (Number.isInteger(progress) && progress > 0) { save.progress = Math.min(3, progress); save.completedLevels = [...Array(save.progress).keys()]; }
    } catch { /* Storage may be unavailable; game remains playable. */ }
    return save;
  }
  function persist(storage, save) { try { storage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; } }
  function record(save, input) {
    const run = { id: input.id, level: input.level, stage: input.stage, mode: input.mode,
      source: String(input.source || '').slice(0, 16000), program: input.program || null,
      success: !!input.success, steps: input.steps || 0, delivered: input.delivered || 0,
      reason: input.reason || '', events: (input.events || []).slice(0, 600), at: input.at };
    save.runs.push(run); save.runs = save.runs.slice(-60);
    if (run.success && !save.completedLevels.includes(run.level)) save.completedLevels.push(run.level);
    save.progress = save.completedLevels.length;
    if (!run.success) {
      save.marks.failCount[run.level] = (save.marks.failCount[run.level] || 0) + 1;
      if (/障碍/.test(run.reason || '')) save.marks.wallHit[run.level] = true;
    }
    return run;
  }
  function award(save, level, stage) {
    if (!STAGES.includes(stage) || !PACKS[level]) return null;
    const key = `${level}:${stage}`;
    if (save.completions[key]) return null;
    save.completions[key] = true; save.badges.push(key); save.xp += XP[stage];
    return { xp: XP[stage], badge: BADGE[level][stage] };
  }
  /* 在状态变化或通关事件后调用；返回本次新解锁的成就列表。 */
  function evaluate(save, ctx = {}) {
    const unlocked = [];
    const grant = key => {
      if (save.achievements[key]) return;
      save.achievements[key] = new Date().toISOString();
      unlocked.push({ key, ...ACHIEVEMENTS[key] });
    };
    for (const [key, item] of Object.entries(ACHIEVEMENTS))
      if (item.kind === 'normal' && item.test(save)) grant(key);
    if (ctx.won) {
      if ((save.marks.failCount[ctx.level] || 0) >= 3) grant('persist');
      if (save.marks.wallHit[ctx.level]) grant('wall_learner');
      if (ctx.usedAI) { save.marks.aiAccepted = true; grant('ai_partner'); }
      else if (save.marks.aiAccepted) grant('ai_partner');
      const hour = ctx.hour ?? new Date().getHours();
      if (hour >= 22 || hour < 5) grant('night_owl');
    }
    if (save.marks.voiceUsed) grant('voice_user');
    return unlocked;
  }
  function levelDraft(save, level) {
    const pack = PACKS[level]; if (!pack) return null;
    const runs = save.runs.filter(r => r.level === level);
    if (!runs.length) return null;
    const sections = [`# ${pack.title}：我的探索记录`, '', '## 任务', '', pack.goal, '', '## 尝试轨迹', ''];
    for (const run of runs) sections.push(`- ${LABEL[run.stage] || '自然语言'}：${run.success ? '完成' : '未完成'}，投递 ${run.delivered || 0} 颗，执行 ${run.steps || 0} 步${run.reason ? '；停止原因：' + run.reason : ''}。`);
    sections.push('', '## 最近一次提交');
    for (const stage of STAGES) {
      const relevant = runs.filter(r => r.stage === stage);
      if (!relevant.length) continue;
      const last = relevant[relevant.length - 1];
      sections.push('', `### ${LABEL[stage]}`, '', `提交内容：`, '', '```text', last.source, '```', '',
        `结果：${last.success ? '完成' : '未完成'}；投递 ${last.delivered} 颗；执行 ${last.steps} 步。`);
      if (last.reason) sections.push(`停止原因：${last.reason}`);
    }
    sections.push('', '## 本关知识', '', pack.concept, '', '## 我的补充', '', '[写下自己的观察与思考。]', '');
    return { body: sections.join('\n'), sourceRunIds: runs.map(r => r.id) };
  }
  function combined(save, levels) {
    const selected = [...new Set(levels)].filter(x => Number.isInteger(x) && PACKS[x]);
    if (!selected.length || !save.runs.some(r => selected.includes(r.level))) return null;
    const parts = ['# 我的规则之外：成长记录', '', `已解锁关卡：${save.progress} / ${PACKS.length}；成长积分：${save.xp} XP。`];
    for (const level of selected) {
      const draft = save.articles[level] || levelDraft(save, level);
      if (draft) parts.push('', '---', '', draft.body);
    }
    return { body: parts.join('\n') + '\n', sourceRunIds: save.runs.filter(r => selected.includes(r.level)).map(r => r.id) };
  }
  const api = { KEY, PACKS, STAGES, XP, TOTAL_XP, LABEL, BADGE, ACHIEVEMENTS,
    load, persist, record, award, evaluate, levelDraft, combined };
  root.Growth = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
