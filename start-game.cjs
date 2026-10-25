const { execFile } = require('node:child_process');
const { createServer } = require('./server');
const server = createServer();
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? '游戏端口已被占用。请关闭之前的游戏服务窗口，再重新启动。'
    : `游戏服务启动失败：${error.message}`);
  process.exitCode = 1;
});
server.listen(4173, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:4173/';
  console.log(`规则之外已启动：${url}\n游玩时请保留此窗口。关闭窗口会结束服务并清除本次 API 配置。`);
  execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true }, error => {
    if (error) console.log('请手动在浏览器打开上面的地址。');
  });
});
