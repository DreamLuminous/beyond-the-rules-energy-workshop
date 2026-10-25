const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Game = require('./engine.js');
const staticFiles = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'], ['/theme.css', 'theme.css'],
  ['/engine.js', 'engine.js'], ['/growth.js', 'growth.js'], ['/app.js', 'app.js'], ['/c-worker.js', 'c-worker.js'], ['/c-run-worker.js', 'c-run-worker.js'],
]);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function response(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function endpoint(value) {
  let url;
  try { url = new URL(String(value || 'https://api.openai.com/v1/chat/completions').trim()); }
  catch { throw Error('API 地址格式不正确，请填写 https:// 开头的地址。'); }
  if (url.username || url.password || url.hash || url.search ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))))
    throw Error('API 地址必须是 HTTPS，或本机 HTTP，且不能包含密钥或查询参数。');
  const pathname = url.pathname.replace(/\/+$/, '');
  if (/\/responses$/.test(pathname)) throw Error('这里需要 Chat Completions 地址，请将 /responses 改为 /chat/completions。');
  url.pathname = !pathname ? '/v1/chat/completions' : /\/chat\/completions$/.test(pathname) ? pathname : pathname + '/chat/completions';
  return url.href;
}
function createAI(env = process.env, fetcher = fetch) {
  let configured = null;
  const active = () => configured || {
    url: env.RULES_AI_URL || 'https://api.openai.com/v1/chat/completions',
    model: env.RULES_AI_MODEL || '', key: env.RULES_AI_KEY || '', source: 'environment',
  };
  const status = () => { const cfg = active(); return { configured: !!(cfg.model && cfg.key), url: cfg.url, model: cfg.model, source: configured ? 'memory' : 'environment' }; };
  const configure = input => {
    if (!input || typeof input.model !== 'string' || typeof input.key !== 'string' || input.model.length > 100 || input.key.length > 500 ||
      !input.model.trim()) throw Error('请输入模型名称和 API 密钥。');
    const url = endpoint(input.url), previous = active();
    const key = input.key.trim() || (new URL(url).origin === new URL(endpoint(previous.url)).origin ? previous.key : '');
    if (!key) throw Error('请填写 API 密钥，再测试连接。');
    configured = { url, model: input.model.trim(), key, source: 'memory' };
    return status();
  };
  const clear = () => { configured = null; return status(); };
  async function call(messages, maxTokens = 350) {
    const cfg = active();
    if (!cfg.model || !cfg.key) throw Object.assign(Error('请先在主界面设置模型 API。'), { status: 503 });
    let url; try { url = endpoint(cfg.url); } catch (error) { throw Object.assign(error, { status: 400 }); }
    let upstream;
    try {
      upstream = await fetcher(url, { method: 'POST', signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, stream: false, messages }) });
    } catch (error) { throw Object.assign(Error(error.name === 'TimeoutError' ? '模型服务在 45 秒内未响应，请稍后重试。' : '无法连接模型服务。请检查 API 地址和本机网络或代理。'), { status: 502 }); }
    let data;
    try { data = await upstream.json(); }
    catch { throw Object.assign(Error(`服务返回 ${upstream.status}，内容不是 JSON。请检查是否填写了模型接口地址。`), { status: 502 }); }
    if (!upstream.ok) {
      const hint = { 400: '模型名称或请求参数不被支持', 401: 'API 密钥无效或已过期', 403: '当前密钥没有访问权限', 404: '接口地址或模型名称不存在', 429: '额度不足或请求过于频繁' }[upstream.status] || '模型服务暂时不可用';
      let detail = typeof data.error?.message === 'string' ? data.error.message : typeof data.message === 'string' ? data.message : '';
      detail = detail.split(cfg.key).join('[密钥]').replace(/sk-[\w-]+/g, '[密钥]').slice(0, 220);
      throw Object.assign(Error(`${hint}（${upstream.status}）${detail ? '：' + detail : '。'}`), { status: 502 });
    }
    let content = data.choices?.[0]?.message?.content;
    if (Array.isArray(content)) content = content.map(item => item.text || '').join('');
    if (typeof content !== 'string' || !content.trim()) throw Object.assign(Error('模型没有返回可用内容。'), { status: 502 });
    return content.trim();
  }
  const test = async () => { await call([{ role: 'user', content: '只回复四个字：连接成功。' }], 256); return { connected: true }; };
  async function propose(input) {
    const level = Number(input?.level);
    if (!Number.isInteger(level) || !Game.levels[level] || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000)
      throw Object.assign(Error('请选择关卡并输入想法。'), { status: 400 });
    const messages = Array.isArray(input.messages) ? input.messages.slice(-6).filter(m =>
      ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 1000) })) : [];
    const latest = input.lastRun && { success: !!input.lastRun.success, reason: String(input.lastRun.reason || '').slice(0, 250), steps: Number(input.lastRun.steps) || 0 };
    const schema = '只输出 JSON 对象 {"reply":"不超过100字的教学回应","program":null或规则程序}。规则程序为 {"version":2,"type":"sequence","steps":[节点]}。节点仅可为 {"type":"deliver_next","color":"red或blue","route":"safe或direct"}、{"type":"repeat","until":"no_remaining","body":[节点]}、{"type":"if_color","color":"red","then":[节点],"else":[节点]}。先考虑玩家实际写下的策略；条件、循环或绕行没写明时，不替玩家偷偷补全，可返回 program:null 并用问题引导。不要声称已执行。';
    const extraSchema = '还支持 {"type":"deliver_id","id":0,"color":"red","route":"safe"}（编号从0起）、{"type":"def","name":"技能名","body":[节点]}、{"type":"call","name":"技能名"}。数组关按编号递增；函数关使用def/call。投递节点可选targetColor表示玩家明确指定的目标颜色，不得偷偷修正错误策略。';
    const content = await call([{ role: 'system', content: `你是规则游戏的对话编译助手。当前关卡：${Game.levels[level].title}；目标：${Game.levels[level].goal}；晶体颜色：${Game.levels[level].items.map(i => i[2]).join(',')}。本关用词：${Game.themeOf(level).cargo}、${Game.themeOf(level).facility}。${schema}${extraSchema}` },
      ...messages, { role: 'user', content: JSON.stringify({ idea: input.text, lastRun: latest }) }], 1400);
    let parsed;
    try { const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(); parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)); }
    catch { throw Object.assign(Error('AI 回复格式无法解析，请重试或使用本地输入。'), { status: 502 }); }
    if (!parsed || typeof parsed.reply !== 'string' || parsed.reply.length > 500)
      throw Object.assign(Error('AI 回复缺少可用说明。'), { status: 502 });
    if (parsed.program != null) {
      try { Game.validate(parsed.program); }
      catch { throw Object.assign(Error('AI 生成了未开放的规则，请修改提问后重试。'), { status: 422 }); }
    }
    return { reply: parsed.reply, program: parsed.program || null };
  }
  return { status, configure, clear, test, propose };
}
function createServer(env = process.env, fetcher = fetch) {
  const ai = createAI(env, fetcher);
  return http.createServer(async (req, res) => {
    const host = req.headers.host || '';
    if (![ `localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}` ].includes(host)) return response(res, 403, { error: '仅限本机访问。' });
    try { if (req.headers.origin && new URL(req.headers.origin).host !== host) return response(res, 403, { error: '请求来源不匹配。' }); }
    catch { return response(res, 403, { error: '请求来源无效。' }); }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      try {
        if (pathname === '/api/config' && req.method === 'GET') return response(res, 200, ai.status());
        if (pathname === '/api/config' && req.method === 'DELETE') return response(res, 200, ai.clear());
        if (req.method !== 'POST' && req.method !== 'PUT') return response(res, 405, { error: '请求方法不支持。' });
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return response(res, 415, { error: '请发送 JSON。' });
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 16000) return response(res, 413, { error: '请求过长。' }); }
        let input; try { input = JSON.parse(body); } catch { return response(res, 400, { error: 'JSON 格式错误。' }); }
        if (pathname === '/api/config' && req.method === 'PUT') return response(res, 200, ai.configure(input));
        if (pathname === '/api/test' && req.method === 'POST') return response(res, 200, await ai.test());
        if (pathname === '/api/propose' && req.method === 'POST') return response(res, 200, await ai.propose(input));
        return response(res, 404, { error: '接口不存在。' });
      } catch (error) { return response(res, error.status || 400, { error: error.message }); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return response(res, 405, { error: '仅支持 GET。' });
    const file = staticFiles.get(pathname); if (!file) return response(res, 404, { error: '页面不存在。' });
    fs.readFile(path.join(__dirname, file), (error, data) => {
      if (error) return response(res, 500, { error: '文件读取失败。' });
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store',
        'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}
if (require.main === module) createServer().listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
module.exports = { createAI, createServer, endpoint };
