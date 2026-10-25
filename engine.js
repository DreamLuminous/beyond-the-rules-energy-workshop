/* Shared, deterministic world runtime for language, pseudocode, AI and C. */
(function (root) {
  const levels = [
    { id: 'core', title: '第一颗能源核心', concept: '顺序', goal: '把红色晶体送进红色发电炉。', items: [[3, 2, 'red']], quota: 1,
      theme: 'workshop' },
    { id: 'batch', title: '自动搬运系统', concept: '循环', goal: '反复搬运，把三颗红色晶体全部送进发电炉。', items: [[3, 2, 'red'], [2, 5, 'red'], [3, 6, 'red']], quota: 3,
      theme: 'workshop' },
    { id: 'sorting', title: '颜色分拣工坊', concept: '条件', goal: '把红、蓝晶体分别送进同色发电炉。', items: [[3, 2, 'red'], [3, 5, 'blue'], [2, 6, 'red'], [7, 5, 'blue']], quota: 4,
      theme: 'workshop' },
    { id: 'array', title: '古籍档案馆', concept: '数组与遍历', goal: '按编号从 0 到 4 依次归档五卷红色卷宗，完成一次卷宗数组遍历。', items: [[2, 1, 'red'], [3, 3, 'red'], [2, 4, 'red'], [3, 5, 'red'], [2, 6, 'red']], quota: 5, ordered: true,
      theme: 'archive', walls: [[5, 0], [5, 2], [5, 4], [5, 5], [5, 7], [6, 3]] },
    { id: 'skill', title: '秘方蒸馏所', concept: '函数', goal: '把投递红色药剂封装成一个技能，调用三次，完成全部投递。', items: [[2, 1, 'red'], [3, 4, 'red'], [2, 6, 'red']], quota: 3,
      theme: 'alchemy', walls: [[5, 0], [5, 1], [5, 3], [5, 4], [5, 6], [5, 7], [7, 4]] },
  ];
  const chapters = [
    { name: '新手引导', brief: '三关学会顺序、循环与条件，所有的表达方式都从这里开始。', levels: [0, 1, 2] },
    { name: 'C 语言之路', brief: '沿 C 语言学习路线前进：先用数组遍历档案馆，再用函数封装蒸馏流程。', levels: [3, 4] },
  ];
  const colorName = { red: '红色', blue: '蓝色' };
  const themes = {
    workshop: { label: '能源工坊', cargo: '晶体', facility: '发电炉', actor: '墨点', measure: '颗',
      icons: { actor: '▰', carry: '▣', cargo: '◆', facilityRed: '▣', facilityBlue: '▣', wall: '▨' },
      legend: '▰ 墨点　◆ 能源晶体　▣ 发电炉　▨ 障碍' },
    archive: { label: '古籍档案馆', cargo: '卷宗', facility: '归档柜', actor: '整理员', measure: '卷',
      icons: { actor: '⬧', carry: '❏', cargo: '▤', facilityRed: '◫', facilityBlue: '◫', wall: '▦' },
      legend: '⬧ 整理员　▤ 编号卷宗　◫ 归档柜　▦ 书架' },
    alchemy: { label: '秘方蒸馏所', cargo: '药剂', facility: '蒸馏器', actor: '炼金术士', measure: '瓶',
      icons: { actor: '✦', carry: '✧', cargo: '◍', facilityRed: '◇', facilityBlue: '◇', wall: '▨' },
      legend: '✦ 炼金术士　◍ 红色药剂　◇ 蒸馏器　▨ 药草柜' },
  };
  const themeOf = index => themes[levels[index]?.theme] || themes.workshop;
  const defaultWall = (x, y) => x === 5 && y !== 1 && y !== 6;
  function wall(x, y, index) {
    const lvl = typeof index === 'number' ? levels[index] : null;
    if (lvl && Array.isArray(lvl.walls)) return lvl.walls.some(([wx, wy]) => wx === x && wy === y);
    return defaultWall(x, y);
  }
  function create(index) {
    if (!levels[index]) throw Error('关卡不存在。');
    return { index, x: 1, y: 3, items: levels[index].items.map(([x, y, color], id) => ({ id, x, y, color })),
      carry: null, delivered: 0, steps: 0, done: false, error: '' };
  }
  function snapshot(s) { return { ...s, items: s.items.map(i => ({ ...i })), carry: s.carry ? { ...s.carry } : null }; }
  function route(s, target) {
    const queue = [[s.x, s.y, []]], seen = new Set([`${s.x},${s.y}`]);
    while (queue.length) {
      const [x, y, path] = queue.shift();
      if (x === target.x && y === target.y) return path;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (nx < 0 || nx > 10 || ny < 0 || ny > 7 || wall(nx, ny, s.index) || seen.has(key)) continue;
        seen.add(key); queue.push([nx, ny, [...path, [nx, ny]]]);
      }
    }
    return null;
  }
  function validate(program) {
    if (!program || program.version !== 2 || program.type !== 'sequence' || !Array.isArray(program.steps)) throw Error('规则程序格式不正确。');
    let nodes = 0;
    function visit(node, depth) {
      if (++nodes > 40 || depth > 5) throw Error('规则过长或嵌套过深。');
      if (node?.type === 'deliver_next' || node?.type === 'deliver_id') {
        if (!['red', 'blue'].includes(node.color)) throw Error('规则包含未知发电炉。');
        if (node.targetColor !== undefined && !['red', 'blue'].includes(node.targetColor)) throw Error('目标设备颜色无效。');
        if (!['safe', 'direct'].includes(node.route)) throw Error('路线策略无效。');
        if (node.type === 'deliver_id' && (!Number.isInteger(node.id) || node.id < 0 || node.id > 20)) throw Error('晶体编号无效。');
      } else if (node?.type === 'repeat') {
        if (node.until !== 'no_remaining' || !Array.isArray(node.body) || !node.body.length) throw Error('循环需要明确结束条件和内容。');
        node.body.forEach(item => visit(item, depth + 1));
      } else if (node?.type === 'def') {
        if (typeof node.name !== 'string' || !node.name.trim() || node.name.length > 20 || !Array.isArray(node.body) || !node.body.length) throw Error('技能需要名称和至少一个动作。');
        node.body.forEach(item => visit(item, depth + 1));
      } else if (node?.type === 'call') {
        if (typeof node.name !== 'string' || !node.name.trim() || node.name.length > 20) throw Error('调用需要写明技能名称。');
      } else if (node?.type === 'if_color') {
        if (node.color !== 'red' || !Array.isArray(node.then) || !Array.isArray(node.else) || !node.then.length || !node.else.length) throw Error('条件判断需要红色和其他颜色两个分支。');
        [...node.then, ...node.else].forEach(item => visit(item, depth + 1));
      } else throw Error('规则包含未开放的动作。');
    }
    program.steps.forEach(item => visit(item, 1));
    if (!nodes) throw Error('规则还没有动作。');
    return program;
  }
  const single = (color, route, targetColor = color) => ({ type: 'deliver_next', color, route, ...(targetColor !== color ? { targetColor } : {}) });
  function natural(text, level) {
    const t = themeOf(level);
    if (!levels[level]) throw Error('关卡不存在。');
    if (typeof text !== 'string' || !text.trim()) throw Error(`先描述你希望${t.actor}完成什么。`);
    text = text.normalize('NFKC').toLowerCase().replace(/红色的|红的|red/g, '红色').replace(/蓝色的|蓝的|blue/g, '蓝色')
      .replace(/水晶|晶石|能量石|矿石|石头|能量核心/g, '晶体').replace(/物品|东西|它们|这些|它/g, t.cargo)
      .replace(/机器人|小人/g, t.actor).replace(/目的地|终点|目标设备|右边|右侧/g, t.facility)
      .replace(/同色|颜色相同|相同颜色|颜色匹配|对应颜色/g, '按颜色分别红蓝')
      .replace(/反复|一遍遍|一批批|批量|挨个|一个个|一颗颗|一卷卷|一瓶瓶/g, '重复')
      .replace(/发电机/g, '发电炉').replace(/投放|递交|交给|运到|运往|运进|运输|带到|带去|拿到|拿去/g, '送到');
    const hasCargo = /晶体|能源|包裹|果实|卷宗|药剂|货物|物件|核心/.test(text);
    const hasAction = /送|放|投|搬|归|收|deliver|put/.test(text);
    const hasTarget = /炉|装置|窗|筐|柜|设备|蒸馏|机器|归档|furnace/.test(text);
    if (!hasCargo || !hasAction || !hasTarget) throw Error(`本地规则还缺少${!hasCargo ? '搬运对象' : !hasAction ? '投递动作' : '目的地'}。可以写「把${t.cargo}送进${t.facility}」，再补充循环、分类或绕行策略。`);
    const onlyRed = levels[level].items.every(item => item[2] === 'red');
    if (!/红|蓝/.test(text) && onlyRed) text += ' 红色';
    if (!/红/.test(text)) throw Error(`本关需要处理红色${t.cargo}。`);
    const route = /绕|避|躲|安全|寻路|找路|规划路线|上方通道|下方通道/.test(text) && !/不(?:要)?绕|直接|直走/.test(text) ? 'safe' : 'direct';
    const targetMatch = text.match(/(?:送|放|投|搬|归档)[^。；;\n]{0,24}?(红|蓝)色?[^。；;\n]{0,8}(?:炉|柜|装置|机器|蒸馏器)/);
    const correction = [...text.matchAll(/(?:改成|改为|换成)(红|蓝)色?[^。；;\n]{0,8}(?:炉|柜|装置|机器|蒸馏器)/g)].at(-1);
    const target = (correction || targetMatch)?.[1] === '蓝' ? 'blue' : 'red';
    if (level === 0) return validate({ version: 2, type: 'sequence', steps: [single('red', route, target)] });
    if (level === 4) {
      if (!/定义|封装|创建|写|做一个/.test(text) || !/技能|函数|方法/.test(text)) throw Error(`先把投递红色${t.cargo}的步骤定义成一个技能。`);
      const times = text.match(/([一两二三四五]|\d+)\s*次/);
      if (!times || !/调用|使用|执行|运行/.test(text)) throw Error('技能定义好后，请说明要调用几次。');
      const count = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5 }[times[1]] ?? Number(times[1]);
      if (!(count >= 1 && count <= 5)) throw Error('调用次数需要在 1 到 5 之间。');
      const name = '投递红色';
      return validate({ version: 2, type: 'sequence', steps: [{ type: 'def', name, body: [single('red', route)] }, ...Array.from({ length: count }, () => ({ type: 'call', name }))] });
    }
    if (!/重复|循环|持续|不断|所有|全部|每|直到|遍历|依次|逐个|全都|全送|都送|都放|三颗|3颗|三件|三卷/.test(text)) throw Error(`有多件${t.cargo}。请说明怎样重复执行，以及何时结束。`);
    if (level === 1) return validate({ version: 2, type: 'sequence', steps: [{ type: 'repeat', until: 'no_remaining', body: [single('red', route, target)] }] });
    if (level === 3) {
      if (!/数组|编号|下标/.test(text)) throw Error(`请说明要按${t.cargo}数组的编号或下标处理。`);
      if (!/从小到大|递增|依次|顺序|0\s*(?:到|至|～|~|-)\s*4/.test(text)) throw Error('请说明按编号从小到大依次遍历。');
      return validate({ version: 2, type: 'sequence', steps: levels[level].items.map((item, id) => ({ type: 'deliver_id', id, color: item[2], route })) });
    }
    const explicitPairs = [...text.matchAll(/(?:红|蓝)[^。；;\n]{0,15}(?:送|放|投)[^。；;\n]{0,8}(?:红|蓝)[^。；;\n]{0,5}炉/g)].length >= 2;
    if (!/蓝/.test(text) || (!/如果|否则|分别|对应|根据颜色|按颜色/.test(text) && !explicitPairs)) throw Error('红蓝晶体需要不同去向。请补充颜色判断。');
    const destinationFor = source => {
      const pattern = new RegExp(source + '色?(?:晶体|能源|货物)[^。；;\\n]{0,12}?(?:送|放|投)[^。；;\\n]{0,8}?(红|蓝)色?[^。；;\\n]{0,5}炉', 'g');
      const match = [...text.matchAll(pattern)].at(-1);
      return match ? match[1] === '红' ? 'red' : 'blue' : source === '红' ? 'red' : 'blue';
    };
    return validate({ version: 2, type: 'sequence', steps: [{ type: 'repeat', until: 'no_remaining', body: [{ type: 'if_color', color: 'red', then: [single('red', route, destinationFor('红'))], else: [single('blue', route, destinationFor('蓝'))] }] }] });
  }
  function pseudo(text, level) {
    const t = themeOf(level);
    const canonical = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
      .map(line => line.replace(/包裹|果实|卷宗|药剂|晶体/g, '晶体').replace(/收件窗口|果筐|归档柜|蒸馏器|发电炉/g, '发电炉').replace(/[件只卷枚份颗瓶]/g, '颗'));
    const lines = canonical;
    const expected = [
      ['找到 红色晶体', '拾取', '绕开障碍', '移动到 红色发电炉', '投递'],
      ['重复直到 没有晶体', '找到 红色晶体', '拾取', '绕开障碍', '移动到 红色发电炉', '投递', '结束重复'],
      ['重复直到 没有晶体', '如果 晶体是红色', '找到 红色晶体', '拾取', '绕开障碍', '移动到 红色发电炉', '投递', '否则', '找到 蓝色晶体', '拾取', '绕开障碍', '移动到 蓝色发电炉', '投递', '结束如果', '结束重复'],
      ['晶体数组 编号 0 到 4', '重复直到 没有晶体', '按编号 找到下一颗红色晶体', '拾取', '绕开障碍', '移动到 红色发电炉', '投递', '结束重复'],
      ['定义 技能 投递红色', '找到 红色晶体', '拾取', '绕开障碍', '移动到 红色发电炉', '投递', '结束定义', '调用 投递红色', '调用 投递红色', '调用 投递红色'],
    ][level];
    if (!expected) throw Error('关卡不存在。');
    /* 比对永远基于基础词模板；提示玩家时把基础词换回本关题材词，只影响显示不影响判定。 */
    const themed = line => line.replace(/晶体/g, t.cargo).replace(/发电炉/g, t.facility).replace(/颗/g, t.measure || '颗');
    for (let i = 0; i < expected.length; i++) if (lines[i] !== expected[i]) throw Error(`第 ${i + 1} 行应为「${themed(expected[i])}」。`);
    if (lines.length !== expected.length) throw Error('结尾还有未识别的伪代码。');
    return natural(level === 0 ? '红色晶体送到发电炉，绕开障碍' : level === 1 ? '重复把所有红色晶体送到发电炉，绕开障碍' : level === 3 ? '按编号从小到大依次遍历所有红色晶体，送到发电炉，绕开障碍' : level === 4 ? '定义技能，调用三次，把红色晶体送到发电炉，绕开障碍' : '重复根据颜色分别把红蓝晶体送到对应发电炉，绕开障碍', level);
  }
  function fromActions(actions) {
    if (!Array.isArray(actions) || actions.length > 100) throw Error('C 程序输出的动作数量无效。');
    return validate({ version: 2, type: 'sequence', steps: actions.map(a => ({ type: 'deliver_id', id: a.id, color: a.color, route: 'safe' })) });
  }
  function execute(index, program) {
    validate(program);
    const state = create(index), events = [];
    const emit = message => { events.push({ message, state: snapshot(state) }); if (state.steps > 500 || events.length > 600) throw Error('执行步数超限。'); };
    const move = (target, strategy) => {
      const path = strategy === 'safe' ? route(state, target) : [];
      if (strategy === 'direct') {
        let x = state.x, y = state.y;
        while (x !== target.x) { x += Math.sign(target.x - x); path.push([x, y]); }
        while (y !== target.y) { y += Math.sign(target.y - y); path.push([x, y]); }
      }
      if (!path) throw Error('没有可到达的路线。');
      for (const [x, y] of path) {
        if (wall(x, y, index)) throw Error('路线被障碍挡住。想想如何绕开它。');
        state.x = x; state.y = y; state.steps++; emit(`移动到 (${x}, ${y})。`);
      }
    };
    const t = themeOf(index), cargo = t.cargo, facility = t.facility, measure = t.measure || '件';
    const deliver = (item, furnaceColor, strategy) => {
      if (!item) throw Error(`没有符合条件的${cargo}。`);
      if (levels[index].ordered && item.id !== state.delivered) throw Error(`请按编号从小到大依次处理。当前应处理编号 ${state.delivered} 的${cargo}。`);
      move(item, strategy); state.carry = { ...item }; state.items = state.items.filter(i => i.id !== item.id); state.steps++; emit(`取起${colorName[item.color]}${cargo}，编号 ${item.id}。`);
      move({ x: 9, y: furnaceColor === 'red' ? 2 : 5 }, strategy);
      if (item.color !== furnaceColor) throw Error(`${colorName[item.color]}${cargo}不能放进${colorName[furnaceColor]}${facility}。`);
      state.carry = null; state.delivered++; state.steps++; emit(`送达${colorName[item.color]}${cargo}。`);
    };
    let budget = 0;
    const routines = {}; let callDepth = 0;
    const run = steps => { for (const node of steps) {
      if (++budget > 120) throw Error('规则循环超过安全限制。');
      if (node.type === 'deliver_next') deliver(state.items.find(i => i.color === node.color), node.targetColor || node.color, node.route);
      if (node.type === 'deliver_id') deliver(state.items.find(i => i.id === node.id), node.targetColor || node.color, node.route);
      if (node.type === 'repeat') { while (state.items.length) run(node.body); }
      if (node.type === 'def') routines[node.name] = node.body;
      if (node.type === 'call') {
        const body = routines[node.name];
        if (!body) throw Error(`技能「${node.name}」还没有定义。`);
        if (++callDepth > 5) throw Error('技能嵌套调用超过限制。');
        run(body); callDepth--;
      }
      if (node.type === 'if_color') run(state.items[0]?.color === node.color ? node.then : node.else);
    } };
    try {
      run(program.steps);
      if (state.items.length) throw Error(`还有 ${state.items.length} ${measure}${cargo}未送达。`);
      state.done = true; emit('任务完成！');
    } catch (error) { state.error = error.message; emit(error.message); }
    return { state, events, success: state.done, reason: state.error };
  }
  const api = { levels, chapters, themes, themeOf, wall, create, validate, natural, pseudo, fromActions, execute };
  root.Game = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
