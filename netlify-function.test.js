const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('./netlify/functions/coach.cjs');

test('Netlify function config and DeepSeek test work without persisting the key', async () => {
  let authorization = '';
  const fetcher = async (_url, options) => {
    authorization = options.headers.Authorization;
    return new Response(JSON.stringify({ choices: [{ message: { content: '连接成功。' } }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  const handler = createHandler(fetcher, {});
  const config = { url: 'https://api.deepseek.com', model: 'deepseek-chat', key: 'test-secret' };
  const saved = await handler({ httpMethod: 'PUT', queryStringParameters: { action: 'config' }, body: JSON.stringify(config) });
  const savedBody = JSON.parse(saved.body);
  assert.equal(saved.statusCode, 200);
  assert.equal(savedBody.url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(saved.body.includes('test-secret'), false);

  const checked = await handler({ httpMethod: 'POST', queryStringParameters: { action: 'test' }, body: JSON.stringify({ __config: config }) });
  assert.equal(checked.statusCode, 200);
  assert.equal(JSON.parse(checked.body).connected, true);
  assert.equal(authorization, 'Bearer test-secret');
});
