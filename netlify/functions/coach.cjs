const { createAI } = require('../../server.js');

function json(statusCode, value) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Rules-Service': 'rules-netlify-v1',
    },
    body: JSON.stringify(value),
  };
}

function createHandler(fetcher = fetch, env = process.env) {
  return async event => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    const action = String(event.queryStringParameters?.action || '').toLowerCase();
    let input = {};
    if (event.body) {
      if (event.body.length > 20000) return json(413, { error: '请求过长。' });
      try { input = JSON.parse(event.body); }
      catch { return json(400, { error: 'JSON 格式错误。' }); }
    }
    const ai = createAI(env, fetcher);
    try {
      if (action === 'config') {
        if (event.httpMethod === 'GET' || event.httpMethod === 'DELETE') return json(200, ai.status());
        if (event.httpMethod !== 'PUT') return json(405, { error: '请求方法不支持。' });
        return json(200, ai.configure(input));
      }
      if (event.httpMethod !== 'POST') return json(405, { error: '请求方法不支持。' });
      if (input.__config) ai.configure(input.__config);
      delete input.__config;
      if (action === 'test') return json(200, await ai.test());
      if (action === 'propose') return json(200, await ai.propose(input));
      return json(404, { error: '接口不存在。' });
    } catch (error) {
      return json(error.status || 400, { error: error.message });
    }
  };
}

const handler = createHandler();
module.exports = { handler, createHandler };
