const test = require('node:test');
const assert = require('node:assert/strict');
const { createAI, endpoint, createServer } = require('./server');

test('DeepSeek base addresses normalize to Chat Completions', () => {
  for (const address of ['https://api.deepseek.com', 'https://api.deepseek.com/', 'https://api.deepseek.com/v1/'])
    assert.equal(endpoint(address), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(endpoint('https://api.deepseek.com/chat/completions'), 'https://api.deepseek.com/chat/completions');
});

test('blank key keeps saved key only for the same service', async () => {
  let request;
  const ai = createAI({}, async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '连接成功' } }] }) };
  });
  ai.configure({ url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', key: 'test-key' });
  ai.configure({ url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', key: '' });
  await ai.test();
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(request.options.body).stream, false);
  assert.throws(() => ai.configure({ url: 'https://other.example/v1', model: 'model', key: '' }), /密钥/);
  assert.doesNotMatch(JSON.stringify(ai.status()), /test-key/);
});

test('upstream errors explain the cause and redact keys', async () => {
  const ai = createAI({}, async () => ({ ok: false, status: 401,
    json: async () => ({ error: { message: 'Invalid sk-secret-test-value' } }) }));
  ai.configure({ url: 'https://api.deepseek.com', model: 'deepseek-chat', key: 'sk-secret-test-value' });
  await assert.rejects(ai.test(), error => /密钥无效/.test(error.message) && !error.message.includes('sk-secret-test-value'));
});

test('HTTP configure then test uses the submitted DeepSeek settings', async () => {
  let target;
  const server = createServer({}, async (url) => {
    target = url;
    return { ok: true, json: async () => ({ choices: [{ message: { content: '连接成功' } }] }) };
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { 'Content-Type': 'application/json' };
    const configured = await fetch(base + '/api/config', { method: 'PUT', headers,
      body: JSON.stringify({ url: 'https://api.deepseek.com', model: 'deepseek-chat', key: 'test-key' }) });
    assert.equal(configured.status, 200);
    assert.doesNotMatch(await configured.text(), /test-key/);
    const result = await fetch(base + '/api/test', { method: 'POST', headers, body: '{}' });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).connected, true);
    assert.equal(target, 'https://api.deepseek.com/v1/chat/completions');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
