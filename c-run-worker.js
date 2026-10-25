import { init, Wasmer } from 'https://unpkg.com/@wasmer/sdk@0.8.0/dist/index.mjs';

/* One-shot worker: runs the compiled module only. The page terminates it on timeout. */
self.onmessage = async event => {
  const { wasm, token } = event.data || {};
  if (!(wasm instanceof ArrayBuffer) || typeof token !== 'string' || !/^[0-9a-f-]{36}$/.test(token)) {
    postMessage({ type: 'error', message: '编译产物无效。' }); return;
  }
  try {
    postMessage({ type: 'status', value: '正在启动隔离运行环境…' });
    await init();
    const program = await Wasmer.fromFile(new Uint8Array(wasm));
    postMessage({ type: 'status', value: '正在运行 C 程序…' });
    const instance = await program.entrypoint.run();
    const outcome = await instance.wait();
    if (!outcome.ok) { postMessage({ type: 'error', message: String(outcome.stderr || 'C 程序运行失败。').slice(0, 5000) }); return; }
    const stdout = String(outcome.stdout || '');
    if (stdout.length > 20000) { postMessage({ type: 'error', message: 'C 程序输出超过限制。' }); return; }
    postMessage({ type: 'stdout', output: stdout, token });
  } catch (error) { postMessage({ type: 'error', message: 'C 运行失败：' + String(error?.message || error).slice(0, 4000) }); }
};
