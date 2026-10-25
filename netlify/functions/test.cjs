const { createHandler } = require('./coach.cjs');
const run = createHandler();

exports.handler = event => run({
  ...event,
  queryStringParameters: { ...(event.queryStringParameters || {}), action: 'test' }
});
