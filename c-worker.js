import { init, Wasmer, Directory } from 'https://unpkg.com/@wasmer/sdk@0.8.0/dist/index.mjs';

/* Persistent compiler worker: it only builds `game.wasm`; user code runs in c-run-worker.js. */
const header = `#ifndef WORKSHOP_H
#define WORKSHOP_H
#define RED 1
#define BLUE 2
int crystal_count(void);
int crystal_color(int id);
void deliver(int id, int furnace_color);
#endif
`;
let ready;
const CACHE = 'rules-c-toolchain-v1';
async function compiler() {
  if (!ready) ready = (async () => {
    postMessage({ type: 'status', value: '正在初始化浏览器编译环境…' });
    await init();
    postMessage({ type: 'status', value: '正在准备 C 编译器…' });
    const originalFetch = self.fetch.bind(self);
    self.fetch = async (...args) => {
      const url = String(args[0]?.url || args[0]);
      if (!url.endsWith('.webc')) return originalFetch(...args);
      let cache = null;
      try { cache = await caches.open(CACHE); } catch { /* cache is optional */ }
      const hit = cache ? await cache.match(url) : null;
      if (hit) { postMessage({ type: 'status', value: '正在读取本机缓存的 C 编译器…' }); return hit; }
      postMessage({ type: 'status', value: '正在下载 C 编译器，首次加载约 110 MB…' });
      const response = await originalFetch(...args);
      if (!response.body) return response;
      const [forCompiler, forCache] = response.body.tee();
      if (cache) cache.put(url, new Response(forCache, { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => {});
      const reader = forCompiler.getReader();
      const size = Number(response.headers.get('content-length')) || 110713421;
      let received = 0, reported = 0;
      const body = new ReadableStream({
        async pull(controller) {
          const chunk = await reader.read();
          if (chunk.done) { controller.close(); postMessage({ type: 'status', value: '下载完成，正在启动 C 编译器…' }); return; }
          received += chunk.value.byteLength;
          if (received - reported > 2000000) {
            reported = received;
            postMessage({ type: 'status', value: `正在下载 C 编译器… ${Math.min(100, Math.round(received / size * 100))}%` });
          }
          controller.enqueue(chunk.value);
        },
        cancel(reason) { reader.cancel(reason); },
      });
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
    return Wasmer.fromRegistry('clang/clang');
  })();
  return ready;
}
self.onmessage = async event => {
  const { code, colors } = event.data || {};
  if (typeof code !== 'string' || code.length > 16000 || !Array.isArray(colors) || colors.length > 20) {
    postMessage({ type: 'error', message: 'C 源码或关卡数据无效。' }); return;
  }
  const token = crypto.randomUUID();
  try {
    postMessage({ type: 'status', value: '正在按需加载 C 编译器…' });
    const clang = await compiler();
    const project = new Directory();
    await project.writeFile('main.c', code);
    await project.writeFile('workshop.h', header);
    const numbers = colors.map(c => c === 'red' ? 1 : 2);
    await project.writeFile('workshop.c', `#include <stdio.h>\n#include "workshop.h"\nstatic const int colors[] = {${numbers.join(',')}};\nint crystal_count(void){return ${numbers.length};}\nint crystal_color(int id){return id>=0 && id<${numbers.length}?colors[id]:0;}\nvoid deliver(int id,int furnace_color){printf("ACTION ${token} %d %d\\n",id,furnace_color);fflush(stdout);}\n`);
    postMessage({ type: 'status', value: '正在编译 C 代码…' });
    const task = await clang.entrypoint.run({
      args: ['-std=c11', '-Werror=implicit-function-declaration', '-Wl,--max-memory=33554432', '-I/project', '/project/main.c', '/project/workshop.c', '-o', '/project/game.wasm'],
      mount: { '/project': project },
    });
    const result = await task.wait();
    if (!result.ok) { postMessage({ type: 'error', phase: 'compile', message: String(result.stderr || result.stdout || 'C 编译失败。').slice(0, 5000) }); return; }
    const binary = await project.readFile('game.wasm');
    const bytes = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
    postMessage({ type: 'compiled', wasm: bytes, token }, [bytes]);
  } catch (error) { postMessage({ type: 'error', message: 'C 编译失败：' + String(error?.message || error).slice(0, 4000) }); }
};
