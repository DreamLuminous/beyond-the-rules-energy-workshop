const { execFile } = require('node:child_process');
const { createServer } = require('./server');
const firstPort = 4173, lastPort = 4183;

function launch(port) {
  const server = createServer();
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && port < lastPort) return launch(port + 1);
    console.error(error.code === 'EADDRINUSE'
      ? `端口 ${firstPort}—${lastPort} 都被占用，请关闭旧的游戏服务后重试。`
      : `游戏服务启动失败：${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`${port === firstPort ? '' : `检测到 ${firstPort} 被占用，已自动改用 ${port}。\n`}规则之外已启动：${url}\n游玩时请保留此窗口。关闭窗口会结束服务并清除本次 API 配置。`);
    execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true }, error => {
      if (error) console.log('请手动在浏览器打开上面的地址。');
    });
  });
}

launch(firstPort);
