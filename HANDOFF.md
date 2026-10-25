# 交接说明 · 规则之外 / 能源工坊

> 这份文档给接手的人（或 agent）看：项目现状、文件职责、怎么跑、怎么验、有哪些坑、下一步能做什么。
> 最后有一节「可直接粘贴的交接提示词」。

---

## 1. 项目是什么

一个**本地优先**的「规则编程」教学小游戏，中文界面，两个章节共五关：

| 关 | 主题 | 知识点 |
|---|---|---|
| 01 第一颗能源核心 | 顺序 | 把一颗红色晶体送进红色发电炉 |
| 02 自动搬运系统 | 循环 | 反复搬运，把三颗红色晶体全部送达 |
| 03 颜色分拣工坊 | 条件 | 红、蓝晶体分别送进同色发电炉 |
| 04 古籍档案馆 | 数组与遍历 | 按编号 0～4 依次归档五卷红色卷宗（强制按编号递增） |
| 05 秘方蒸馏所 | 函数 | 定义技能（def/call）并调用三次 |

章节在 `engine.js` 的 `chapters` 注册（新手引导 / C 语言之路）；关卡选择按「章节小卡 → 二级关卡列表」两级展开。每关都可以用三种「表达方式」解题：

- **自然语言**：中文短句，本地解析器转成规则程序（不联网）。AI 对话在未配置模型时也走本地识别。
- **伪代码**：题材化模板（档案馆说卷宗、蒸馏所说药剂），逐行校验。
- **C 代码**：浏览器端 Clang 编译成 WebAssembly，在独立 Worker 里运行，只允许产生受限动作；运行前给出本关对象清单（编号与坐标）。

五关共用同一套地图尺寸、胜负判定与 RuleProgram v2 程序格式（`engine.js`）。主题系统：每关的名词/图标/图例/报错文案从 `themes` 注册表取，伪代码解析前把题材词归一化为基础词。

**双入口形态**（2026-10-25 Netlify 版起）：

- **本机版**：`node server.js` 或双击「启动游戏.cmd」，数据全在本地；
- **线上版**：Netlify 静态托管 + 同站点 Functions 转发 AI（演示站 `incomparable-yeot-02251a.netlify.app`），密钥只留在页面内存，随请求交给函数转发。

两种入口共用同一套游戏代码；接口路径都是 `/api/config`、`/api/test`、`/api/propose`。

技术栈：原生 HTML/CSS/JS + Node 静态服务 + Netlify Functions。**没有 npm 运行时依赖、没有构建步骤**（Netlify 构建只是复制文件）。

---

## 2. 快速开始

```powershell
node server.js          # 或双击 启动游戏.cmd（Windows，自动开浏览器）
# 打开 http://127.0.0.1:4173/
```

要求：Node.js 20+。

- 「启动游戏.cmd」调用 `start-game.cjs`：4173 被占用时自动落到 4174—4183，并以实际打开的地址为准。
- **本机游玩必须走这个服务**：C 难度依赖服务下发的 COOP/COEP 头（`crossOriginIsolated`），AI 接口也挂在它上面；服务只监听 `127.0.0.1` 并校验 Host/Origin。
- 线上版由 Netlify 构建：`node prepare-netlify.cjs` 把 8 个公开文件复制到 `dist`，`netlify.toml` 把 `/api/*` 交给 `netlify/functions/`。**只拖静态文件不会部署函数**，要用 Git 连接或 Netlify CLI 部署整个目录（或双击「部署到Netlify.cmd」）。

---

## 3. 文件职责

| 文件 | 作用 |
|---|---|
| `index.html` | 三个视图（主界面 / 关卡 / 导出）+ 两个对话框（API 设置 / 关卡内偏好）。**所有 id 都被 app.js 直接引用**，改结构要同步改 JS。 |
| `style.css` + `theme.css` | 深色主题框架与每关 `data-theme` 元素配色（V1.0 起拆成两个文件）。背景 `#0b171a`、主色 `#c8e1aa`、卡片 `#132627`、描边 `#2e4844`。 |
| `engine.js` | 纯逻辑引擎，无 DOM。关卡/章节/主题注册表、`natural()` / `pseudo()` 解析、`validate()`、`fromActions()`、`execute()`（BFS 寻路 + 事件流）。Node 与浏览器共用。 |
| `growth.js` | 存档 v3、XP/徽章/**成就系统**（6 普通 + 5 彩蛋）、按关卡/合并生成 Markdown。Node 与浏览器共用。 |
| `app.js` | 全部 UI 逻辑：主界面、章节导航、主题化地图与文案、编辑器、执行动画、音效、AI 小窗（含**未配置模型时的本地识别**）、导出中心、C 难度调度。 |
| `server.js` | 本机静态服务 + AI 代理。导出 `createAI` / `createServer` / `endpoint`；地址校验（HTTPS 或本机 HTTP、自动补全 `/chat/completions`）、上游错误映射成中文提示、密钥不回传。 |
| `start-game.cjs` | 启动器：端口 4173—4183 自动回退并打开浏览器。 |
| `netlify/functions/` | `coach.cjs`（共用 handler，复用 `server.js` 的 `createAI`）+ `config.cjs` / `test.cjs` / `propose.cjs` 三个入口。 |
| `prepare-netlify.cjs` | Netlify 构建脚本：复制 8 个公开文件到 `dist`。 |
| `c-worker.js` / `c-run-worker.js` | 常驻编译 Worker（Wasmer + Clang，工具链写 Cache Storage）与一次性运行 Worker（10s 超时强制终止）。 |
| `engine.test.js` / `growth.test.js` / `server.test.js` / `netlify-function.test.js` | `node --test` 单元测试（引擎、存档与成就、服务器、函数路由）。 |
| `e2e-check.cjs` | Playwright 浏览器回归 60 项（本机版 UI；对 Netlify 版代码同样通过）。 |
| `c-integration.cjs` | 真实 Clang 集成回归 9 项（开头会清存档）。 |
| `package.json` | 仅声明 `scripts`（build/test）与 Node 版本要求，**无运行时依赖**。 |
| `路演材料.html` | 单页路演稿（可浏览器直接打开）。 |
| `README.md` | 面向玩家/部署者的说明（Netlify 版口径）。 |
| `qa/`、`.qa/` | 截图与本机工具脚本，不进仓库。 |
| `HANDOFF.md` | 本文件。 |

---

## 4. 当前界面结构（V1.0 + Netlify 版）

**主界面**：左侧编号导航（继续游戏 / 01 关卡选择 / 02 成长档案 / 03 可选连接 / 04 更多设置）+ 五段式通关进度条；右侧封面：机器人插画 hero + 主行动按钮（开始第一关 / 继续当前关）+ 「01—05 · 你的探索路线」按章节分行的迷你路线卡。

**关卡选择**：两张章节小卡（第一章 · 新手引导 / 第二章 · C 语言之路），点击展开二级关卡列表。

**关卡页**（桌面 900px 高内一屏）：右上角「⚙ 设置」对话框切换游玩方式与表达方式（不再平铺在面板上）；左侧地图 + 图例，底部一行合并「图例 + 反馈」；右侧编辑器、文本框右下角圆形语音按钮（点击开始/停止识别）、运行/重试、AI 对话入口；规则预览与执行过程为折叠区，预览按嵌套缩进排版，日志带序号与着色（送达/取起/错误）。

**AI 对话**：右下角小窗（400px 宽）。未配置模型时由**本地识别**接管：识别意图、给出行动预览，确认后照常通关；配置模型后优先 AI，故障自动退回本地；支持连续补充策略（先说"带到右边的机器"，再说"绕开墙壁"）。确认前地图不变。

**成长档案**：双板块——当前进度（XP 条 /1500、五个统计磁贴、15 枚徽章网格）+ 成就墙（普通 6 / 彩蛋 5，默认折叠，彩蛋锁定只显示线索）。

**导出页**：左侧五关 + 成长总报告，右侧 Markdown 编辑区；手写内容不被覆盖，新记录可合并，支持下载。

---

## 5. 关键实现细节

### 引擎（engine.js）

- 地图 11×8，左上角 `(0,0)`；多数关卡 `walls` 自定义，无 `walls` 字段时回退默认墙 `x===5 && y!==1 && y!==6`。
- 五关数据在 `levels`，`themes` 三套（workshop/archive/alchemy），`chapters` 两章。晶体按数组下标编号。
- RuleProgram v2 节点：`deliver_next` / `deliver_id` / `repeat` / `if_color` / **`def` / `call`**（第五关，调用未定义技能报运行期错误，嵌套 >5 报错）。
- `validate()`：节点 ≤40、嵌套 ≤5；`execute()` 预算 120 节点、500 步、600 事件。第四关 `ordered: true` 强制按编号递增。
- `pseudo()` 先把题材词归一化为基础词再逐行比对模板，报错时反向映射回本关词汇——解析与显示两层互不影响。

### 存档（growth.js）

- 键 `beyond-rules-save-v3`。字段含 `completedLevels`（由它算 `progress`）、`completions["关卡:难度"]`、`badges`（15 枚）、`achievements`、`marks`（failCount/wallHit/voiceUsed 等，喂彩蛋成就）。
- `award()` 按 completions 去重，XP：自然语言 100 / 伪代码 80 / C 120，总上限 1500。
- `Growth.evaluate(save, ctx)` 在通关后触发成就判定，返回本次新解锁列表（通关页会显示「解锁成就「×××」」）。旧 v3 存档读入时补默认字段。

### 服务器与函数（server.js / netlify/functions）

- `createAI(env, fetcher)` 是全部 AI 逻辑的唯一实现：`endpoint()` 做地址校验与 `/chat/completions` 补全；上游 400/401/403/404/429 映射成中文提示且**密钥会被打码**；`propose()` 要求模型输出 JSON `{reply, program}` 并过 `Game.validate()`。
- 本机 `createServer()` 校验 Host/Origin、静态文件带 COOP/COEP；Netlify 侧 `coach.cjs` 复用同一个 `createAI`，`__config` 字段支持"页面内存配置随请求携带"。
- 密钥永不下发、永不入存档：本机版存进程内存，线上版存页面内存。

### C 难度（c-worker.js / c-run-worker.js）

- 编译 Worker 常驻，工具链 `.webc` 写 Cache Storage（键 `rules-c-toolchain-v1`）；编译看门狗按进度重置（5 分钟空闲）。
- 运行 Worker 一次性：`for(;;){}` 由主线程 10s 后 `terminate()`；动作协议 `ACTION <token> id color`，动作 >100 拒绝。
- 运行前编辑器帮助区给出**本关对象清单**（`#编号 颜色(坐标)`），C 模板按题材生成。

### 音效

- `app.js` 的 `Sound` 用 WebAudio 合成 run/deliver/win/error 四个提示音，受存档 `sound` 开关控制。

---

## 6. 已验证到什么程度

2026-10-25（Netlify 部署版代码）：

```
node --test              → 9/9 通过（引擎五关×三难度、章节、成就、存档迁移、导出、服务器契约、Netlify 函数路由）
node e2e-check.cjs       → 60/60 通过（本机版 UI 断言，对当前代码复跑通过；含 4 项离线对话能力）
node prepare-netlify.cjs → 构建冒烟通过（dist 8 个公开文件）
node c-integration.cjs   → V1.0 代码上跑到 5/9 全 PASS 时按需暂停；脚本含清存档修复，可随时完整重跑
```

e2e 覆盖：五入口、两张章节卡与二级列表（3+2）、一屏关卡页、设置对话框切换、三关流程、成就解锁、15 枚徽章与成就计数、导出全链、手机五页无溢出、AI 小窗、AI 预览确认、离线本地识别、v2 迁移、模型模板、API 设置。

---

## 7. 换机器 / 换平台要改的地方

1. **两个 `.cjs` 测试脚本开头硬编码了路径**：Playwright 模块与 Edge 可执行文件。新机器换成实际路径，或删掉 `executablePath` 让 Playwright 用自带 Chromium。
2. **Node 20+**；本机 Node 常不在 PATH（`C:\Users\wangy\.cache\codex-runtimes\...\node\bin\node.exe`）。
3. **端口**：本机默认 4173，启动器会自动回退到 4183；`server.js` 的 Host 白名单跟随实际端口。
4. **C 工具链缓存属于浏览器 profile**，换浏览器或清站点数据后重新下载约 110MB。
5. **Netlify 部署**：Git 连接后推送自动构建；或 `npx netlify-cli link && npx netlify-cli deploy --prod --build`。演示站名 `incomparable-yeot-02251a`。

---

## 8. 已知问题（都不影响玩）

- Wasmer SDK 每次编译任务后可能在 Worker 内 panic（控制台噪音），处理方式是任务结束即废弃 Worker、下次重建，界面无感。
- 首次 C 编译下载约 110MB，进度显示在执行反馈；移动端 C 编辑器较长需滚动。
- `if_color` 只支持「红色 / 其他」两分支，扩关卡需先扩节点与解析器。
- `e2e-check.cjs` / `c-integration.cjs` 是**本机版**脚本（直连 `127.0.0.1:4173`），未覆盖 Netlify 线上路径；函数逻辑由 `netlify-function.test.js` 单测兜底。
- `HANDOFF.md` 的旧截图参考（`qa/*.png`）可能落后于 V1.0 界面，以实机为准。

---

## 9. 下一步可以做什么

- **新关卡**：按知识点路线下一个是**结构体**（管理不同类型机器人）；加关 checklist：`levels`/`chapters`/`themes`/两个脚手架函数/`engine.test.js` 各加一项。
- **变体挑战与彩蛋**：`Growth.ACHIEVEMENTS` 加条目即可挂新成就；变体关（数量变化、电量、周期闸门）待设计。
- **成长网站静态导出**（v2.0 规划）：文章 + 徽章 → 静态个人网站 ZIP + 部署教程。
- **C 难度体验**：进入 C 关预取工具链、编译结果会话内复用、编译错误定位跳转。
- **测试对齐**：让 e2e 支持指向线上站，补 Netlify 端到端路径。

---

## 10. 可直接粘贴的交接提示词

```
你接手一个已经跑通的本地小游戏项目「规则之外 · 能源工坊」，代码就在当前工作区。
先读 HANDOFF.md 与 README.md，再动手。

背景：两个章节共五关——新手引导（顺序/循环/条件）+ C 语言之路（数组遍历/函数 def-call），
每关三种表达方式：自然语言（含离线本地识别）、伪代码（题材化模板）、C 代码（浏览器端
Clang→WASM，运行前给对象清单）。双入口：本机 node server.js / 启动游戏.cmd，线上
Netlify 静态 + Functions 转发 AI（coach.cjs 复用 server.js 的 createAI）。主界面编号导航
+ 章节卡二级列表 + 成就墙；关卡内偏好收在右上角 ⚙ 设置对话框；AI 对话是右下角小窗。
AI 只产出结构化规则，玩家确认后才交给本地引擎执行。

启动与验证：
1) node server.js（Node 20+），打开 http://127.0.0.1:4173/。C 难度依赖 COOP/COEP 头，
   不要用 file:// 或其他静态服务器。
2) node --test                 —— 9 项单测（引擎/存档/服务器/Netlify 函数）
3) node e2e-check.cjs          —— 浏览器回归 60 项（需服务已启动）
4) node c-integration.cjs      —— 真实 Clang 回归 9 项（首次下载 ~110MB；开头清存档）
注意：两个浏览器脚本开头硬编码了 Playwright 模块与 Edge 路径，换机器先改或删 executablePath。

风格与硬性约束：
- 深色主题（#0b171a / #c8e1aa / #132627 / #2e4844），主题色拆在 style.css + theme.css；
  新控件沿用既有类（.segmented、.setting-item、.chapter-tile、.road-step 等）。中文文案，句子短。
- 地图、胜负判定只能由 engine.js 决定；AI/模型不能直接改世界或判定通关。
- 存档按「关卡 × 难度」记录，首次奖励只发一次；导出只引用真实运行记录，重新生成不得覆盖
  玩家手写内容；API 密钥只留在进程/页面内存，接口不回传。
- 改完 UI 跑 e2e-check.cjs（必要时 c-integration.cjs）并更新本文件「已验证」一节。

下一步任务：结构体关卡；变体挑战与更多彩蛋；成长网站静态导出；C 难度首次加载与错误定位打磨。
```

---

## 11. 联系上下文

- 需求与验收标准：`docs/spec-requirements.docx`（原始三关版）、需求文档一（五关路线与成就设计，本机留存）
- 路演材料：`路演材料.html`（单页）、`docs/路演-规则之外-能源工坊.pptx` 与 `docs/路演-演讲稿.md`（本机留存）
- 仓库：<https://github.com/DreamLuminous/beyond-the-rules-energy-workshop>；线上演示：<https://incomparable-yeot-02251a.netlify.app/>
- 界面现状：以实机为准（`qa/` 内截图可能滞后于 V1.0）
