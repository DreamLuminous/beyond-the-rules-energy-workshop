# 交接说明 · 规则之外 / 能源工坊

> 这份文档给接手的人（或 agent）看：项目现状、文件职责、怎么跑、怎么验、有哪些坑、下一步能做什么。
> 最后有一节「可直接粘贴的交接提示词」。

---

## 1. 项目是什么

一个在本机浏览器里玩的「规则编程」小游戏，中文界面，两个章节共五关：

| 关 | 主题 | 知识点 |
|---|---|---|
| 01 第一颗能源核心 | 顺序 | 把一颗红色晶体送进红色发电炉 |
| 02 自动搬运系统 | 循环 | 反复搬运，把三颗红色晶体全部送达 |
| 03 颜色分拣工坊 | 条件 | 红、蓝晶体分别送进同色发电炉 |
| 04 古籍档案馆 | 数组与遍历 | 按编号 0～4 依次归档五卷红色卷宗（强制按编号递增） |
| 05 秘方蒸馏所 | 函数 | 定义技能（def/call）并调用三次 |

章节在 `engine.js` 的 `chapters` 注册（新手引导 / C 语言之路）；关卡选择按「章节小卡 → 二级关卡列表」两级展开。每关都可以用三种「表达方式」解题：

- **自然语言**：中文短句，本地解析器转成规则程序（不联网）。
- **伪代码**：题材化模板（档案馆说卷宗、蒸馏所说药剂），逐行校验。
- **C 代码**：浏览器端 Clang 编译成 WebAssembly，在独立 Worker 里运行，只允许产生受限动作；运行前给出本关对象清单（编号与坐标）。

五关共用同一套地图尺寸、胜负判定与 RuleProgram v2 程序格式（`engine.js`）。主题系统：每关的名词/图标/图例/报错文案从 `themes` 注册表取，伪代码解析前把题材词归一化为基础词。

技术栈：原生 HTML/CSS/JS + 一个本地 Node 静态服务。**没有 npm 依赖、没有构建步骤。**

---

## 2. 快速开始

```powershell
node server.js
# 打开 http://127.0.0.1:4173/
```

要求：Node.js 20+。

**必须通过这个服务打开**，原因有三：

1. 服务会给静态资源加 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`，浏览器才会 `crossOriginIsolated === true`，C 难度所需的 `SharedArrayBuffer` 才可用；
2. `/api/config`、`/api/test`、`/api/propose` 都挂在这个服务上；
3. 服务只监听 `127.0.0.1:4173` 并校验 Host/Origin。

用 `file://` 或别的静态服务器打开，C 难度会直接报「当前浏览器缺少 C 运行所需的隔离能力」。

---

## 3. 文件职责

| 文件 | 作用 |
|---|---|
| `index.html` | 三个视图（主界面 / 关卡 / 导出）+ 两个对话框（API 设置 / AI 对话）。**所有 id 都被 app.js 直接引用**，改结构要同步改 JS。 |
| `style.css` | 全部样式。深色主题：背景 `#0b171a`、主色 `#c8e1aa`、卡片 `#132627`、描边 `#2e4844`。文件前段是压缩的单行 CSS，末尾追加了主界面左栏、设置项、关卡内偏好等新规则。 |
| `engine.js` | 纯逻辑引擎，无 DOM。关卡数据、地图、`natural()` / `pseudo()` 解析、`validate()`、`fromActions()`、`execute()`。Node 与浏览器共用（`module.exports` + `window.Game`）。 |
| `growth.js` | 本机存档与导出草稿。存档版本 3，负责旧存档迁移、奖励发放、按关卡/合并生成 Markdown。Node 与浏览器共用。 |
| `server.js` | 静态文件 + AI 接口。`/api/config`（GET/PUT/DELETE）、`/api/test`、`/api/propose`。模型配置只存在进程内存，接口永不回传密钥。 |
| `app.js` | 全部 UI 逻辑：主界面左栏与面板、关卡页、编辑器、执行动画、音效、AI 对话、导出页、C 难度调度。 |
| `c-worker.js` | **常驻编译 Worker**：用 `@wasmer/sdk@0.8.0`（unpkg）加载 `clang/clang`，编译出 `game.wasm`，把字节和动作 token 传回主线程。`.webc` 工具链写入 Cache Storage（键名 `rules-c-toolchain-v1`）。 |
| `c-run-worker.js` | **一次性运行 Worker**：接收 wasm 字节，`init()` + `Wasmer.fromFile()` 运行，回传 stdout。用完即 terminate。 |
| `engine.test.js` / `growth.test.js` | `node --test` 单元测试。 |
| `e2e-check.cjs` | Playwright 浏览器回归（47 项）：导航、偏好持久化、三关流程、奖励、导出合并、AI 预览确认/故障回退、存档迁移、API 设置、桌面/手机布局。 |
| `c-integration.cjs` | Playwright + 真实 Clang 回归（9 项）：三关 C 通关、编译报错、无效投递、无限循环中止、中止后继续。 |
| `README.md` | 面向玩家/开发者的简明说明。 |
| `qa/` | 最近一次回归的截图（桌面/手机主界面、关卡页、设置、导出、通关页、C 通关）。 |
| `docs/spec-requirements.docx` | 最初的产品需求文档（规划与验收标准）。 |
| `HANDOFF.md` | 本文件。 |

---

## 4. 当前界面结构（2026-10-25 改版后）

**主界面**：左右格式。左侧固定五个入口，从上到下：

1. **继续游戏**（主色按钮，直接进入第一个未通关的关卡，不是切换面板）
2. **关卡选择** → 章节小卡列表（第一章/第二章），点击展开二级关卡列表
3. **成长档案** → 双板块：当前进度（XP 条 /1500、统计磁贴、15 枚徽章网格）+ 整体成就墙（普通 6 / 彩蛋 5，默认折叠，彩蛋锁定只显示线索）
4. **可选连接** → AI 状态、常用模型模板（点击预填 API 设置）、API 设置入口
5. **更多设置** → 音效开关、游玩方式（娱乐/学习）、默认表达方式（自然语言/伪代码/C 代码）

导航下方是 N 段式通关进度条（与关卡数一致）+「已完成 n / 5 关」。右侧默认是封面：标题 + 主行动按钮 + 下一站提示 + 按章节分两行的学习路线迷你卡。手机宽度下：继续游戏占整行，其余四个入口两列排布，路线单列。

**关卡页**：左侧地图 + 图例 + 执行反馈；右侧从上到下为

- 「游玩方式」「表达方式」两组即时切换（改了会写进存档；每个难度各自保留草稿）
- 编辑器（自然语言/伪代码/C 三套模板与说明）
- 运行 / 重试、语音输入（仅自然语言）、「与 AI 对话并生成规则」（仅自然语言）
- 折叠区：提示（仅学习模式显示）、规则预览、执行过程

通关后整页只留结果卡：结果、首次获得的积分或徽章、「继续主线」「再次挑战」。

**导出页**：左侧列表（三关 + 成长总报告），右侧 Markdown 编辑区。已有文章不会被重新生成覆盖，只提示「有新记录可合并」，合并时把手写内容留在原处、把新事实追加到文末。支持下载 `.md`。

---

## 5. 关键实现细节

### 引擎（engine.js）

- 地图 11×8，左上角 `(0,0)`；`wall(x,y) = x===5 && y!==1 && y!==6`。
- 三关数据在 `levels`，晶体按数组下标编号（C 难度的 `crystal_color(id)` 用的就是这套编号）。
- 统一规则程序格式：`{ version: 2, type: 'sequence', steps: [...] }`，节点只有三种：
  `deliver_next`、`deliver_id`、`repeat`、`if_color`（`if_color` 目前只支持「红色 / 其他」两分支）。
- `validate()`：节点数 ≤ 40、嵌套 ≤ 5、只接受已知动作。
- `execute()`：返回事件流 `{ state, events, success, reason }`，动画由 UI 每 125ms 播放一条；步数 > 500 或事件 > 600 视为超限。
- 走位：`safe` 用 BFS，`direct` 走直角，撞墙会抛「路线被障碍挡住」——这是第一关「绕开障碍」的教学点。

### 存档（growth.js）

- 键：`beyond-rules-save-v3`。字段：`mode`、`sound`、`stage`、`progress`、`completedLevels`、`xp`、`completions`、`badges`、`runs`、`articles`、`combinedDraft`。
- 迁移：从 v2（`beyond-rules-save-v2`）读 100 XP、`expression` 徽章、玩家编辑过的文章；更老的只有数字进度（`beyond-rules-progress`）。
- 奖励：`award(save, level, stage)` 按 `completions["关卡:难度"]` 去重，XP 为 自然语言 100 / 伪代码 80 / C 120。
- `runs` 只保留最近 60 条，每条含提交内容、程序快照、步数、投递数、结果、停止原因。

### 导出

- `levelDraft(save, level)`：任务、尝试轨迹、每种难度最近一次提交、本关知识、玩家补充占位。
- `combined(save, levels)`：按选中关卡拼成总报告（若某关已有玩家文章，用文章正文）。
- 前端只在真正需要时生成；玩家编辑后的 `body` 不会被覆盖，`sourceRunIds` 用来判断哪些运行记录还没合并。

### AI（server.js）

- 配置：`{ url, model, key }` 存内存；`source: 'memory' | 'environment'`，环境变量 `RULES_AI_URL` / `RULES_AI_MODEL` / `RULES_AI_KEY` 仍可用。
- 地址校验：必须 HTTPS（或 localhost HTTP），不能带账号、查询串、锚点。
- `/api/propose` 要求模型输出 JSON：`{ reply, program|null }`，`program` 交给 `engine.validate()`；不合格直接 422。
- 前端先展示规则预览，点「采纳规则并运行」才交给引擎；确认前地图不变。

### C 难度（c-worker.js + c-run-worker.js）

- 编译在**常驻** Worker：`clang/clang` 通过 `@wasmer/sdk@0.8.0` 从 unpkg 拉取，首次会下载约 110 MB 的 `.webc`（`cdn.wasmer.io`）。
- 工具链缓存：worker 内劫持 `fetch`，把 `.webc` 写进 Cache Storage；之后同一浏览器 profile 直接读缓存（约 3–6 秒）。
- 编译看门狗：**按进度重置的 5 分钟空闲超时**（每次收到 status 消息就重置），所以慢速下载不会被误杀。
- 运行在**一次性** Worker：`for(;;){}` 这类死循环由主线程 10 秒后 `terminate()`，不会拖垮编译器。
- 动作协议：编译时把随机 token 写进 `deliver()` 的 `printf`，运行后主线程只认 `ACTION <token> id color` 行，其他输出忽略；动作数 > 100 直接拒绝。
- 限制：源码 ≤ 16000 字符、stdout ≤ 20000 字符、动作 ≤ 100、运行 10 秒。

### 音效

- `app.js` 里的 `Sound` 用 WebAudio 实时合成四个提示音：`run` / `deliver` / `win` / `error`。
- 受 `save.sound` 控制，在「更多设置」里开关，状态入存档；默认开启。

---

## 6. 已验证到什么程度

最近一次全量回归（2026-10-25，五关合并版）：

```
node --test                → 2/2 通过（五关×三难度、章节、题材一致性、错误路径、成就、存档迁移、奖励、导出、API 配置）
node e2e-check.cjs         → 56/56 通过
node c-integration.cjs     → 五关版回归跑到 5/9 全 PASS 时按需暂停，脚本已修复存档残留问题，可随时重跑完整 9 项
```

e2e 覆盖：五入口、两张章节卡与二级关卡列表（3+2）、一屏关卡页（900px 无滚动）、设置对话框切换、三关流程、成就解锁（通关页显示「解锁成就「初试锋芒」」）、15 枚徽章与成就计数、导出全链、手机五页无溢出、AI 小窗（400px）、AI 预览确认、v2 迁移、模型模板、API 设置。

c-integration 注意：脚本开头会清空持久化 profile 的存档再跑（历史版本残留存档会让「继续游戏」跳进第四关导致断言失败）。

`e2e-check.cjs` 覆盖：左侧五入口顺序、四个面板、设置写入存档并在刷新后保留、继续游戏跳转、关卡内切换难度/模式、每难度草稿、第一关通关与奖励、重复通关不重复发奖、第二关伪代码通关、伪代码报错行号、C 编辑区说明、导出生成/手写保留/合并/总报告/下载、手机三页无横向溢出、AI 故障回退、AI 预览与确认、v2 存档迁移、API 设置保存/测试/清除。

`c-integration.cjs` 覆盖：第一关真实编译通关、编译报错（`expected ';'`）、无效投递被引擎拒绝、同会话再编译（走缓存，< 60s）、第二/三关 C 通关、无限循环 14 秒中止、中止后仍能继续编译运行。

---

## 7. 换机器 / 换平台要改的地方

1. **两个 `.cjs` 脚本开头硬编码了路径**：

   ```js
   require('C:/Users/wangy/.cache/codex-runtimes/.../node_modules/playwright')
   executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
   ```

   新机器请换成实际的 Playwright 安装位置和浏览器路径；没有 Playwright 就先 `npm i -D playwright && npx playwright install chromium`（脚本里的 `executablePath` 可以直接删掉，让 Playwright 用自带的 Chromium）。

2. **Node 可能不在 PATH 里**。本机是用绝对路径调用的；新环境确认 `node -v` 可用即可。

3. **端口固定 4173**。若必须改端口，`server.js` 里的 Host 白名单（`['localhost:4173', '127.0.0.1:4173']`）和 `listen` 都要改。

4. **`.dsh-acl-recovery/`**：上一轮工作区权限出问题时留下的 ACL 备份目录，与项目无关，可以直接删。

5. **C 工具链缓存属于浏览器 profile**，换浏览器或清站点数据后需要重新下载 110 MB；网络差时可能很久（本机实测 7 KB/s ~ 400 KB/s 都出现过）。

---

## 8. 已知问题（都不影响玩）

- **Wasmer SDK 在每次 clang 任务结束后会在 Worker 内部 panic**（`unreachable` / `unwrap_throw`，错误来自 `wasmer_js_bg.wasm`）。现在的处理是：任务结束即认为 Worker 已废弃，静默回收，下次编译重新建 Worker 并读缓存重建（3–6 秒）。玩家界面看不到报错，只有 devtools 控制台里有噪音。
- **首次 C 编译需要下载约 110 MB**，进度显示在关卡内「执行反馈」里；中途离开关卡会取消并重新开始。
- **移动端 C 编辑器很长**，需要滚动；功能正常。
- 引擎的 `if_color` 只支持「红色 / 其他」两分支，扩关卡时需要先扩展节点类型和解析器。

---

## 9. 下一步可以做什么

需求文档里明确留的后续内容：

- **新关卡**：按知识点路线，下一个是**结构体**（管理不同类型机器人）；加关 checklist 在 `E:\Rules-merge\Rules\交接说明-五关合并.md` 第五节（chapters/levels/themes/脚手架/测试各加一项）。
- **变体挑战与更多彩蛋**：通关后开放同关变体（仓库数量变化、电量限制、周期闸门、设备故障）；成就系统已就位，`Growth.ACHIEVEMENTS` 加条目即可。
- **导出中心**：自定义章节模板、按难度筛选、导出前后的差异预览。
- **C 难度体验**：进入 C 关卡时预取工具链、编译结果在会话内复用、给编译错误做定位跳转（现在是把 clang 原始 stderr 原样显示）。

---

## 10. 可直接粘贴的交接提示词

```
你接手一个已经跑通的本地小游戏项目「规则之外 · 能源工坊」，代码就在当前工作区。
先读 HANDOFF.md 与 README.md，再动手。

背景：两个章节共五关——新手引导（顺序/循环/条件）+ C 语言之路（数组遍历/函数 def-call），
每关有三种表达方式——自然语言、伪代码（题材化模板）、C 代码（浏览器端 Clang 编译成
WebAssembly，在独立 Worker 里运行，运行前给对象清单）。主界面是左侧五入口（继续游戏、
关卡选择、成长档案、可选连接、更多设置）+ 右侧面板；关卡选择是章节小卡二级展开；成长档案
分「当前进度」与「成就墙」（普通+彩蛋）两板块；游玩方式与表达方式在关卡内右上角 ⚙ 设置
对话框里切换；AI 对话用右下角小窗；语音输入在编辑框右下角。AI 只产出结构化规则，玩家确认
后才交给本地引擎执行。

启动与验证：
1) node server.js（Node 20+），打开 http://127.0.0.1:4173/。不要用 file:// 或别的静态
   服务器：C 难度依赖这个服务下发的 COOP/COEP 头（crossOriginIsolated），AI 接口也在它上面。
2) node --test                       —— 引擎与存档单测
3) node e2e-check.cjs                —— 浏览器回归 56 项（需服务已启动）
4) node c-integration.cjs            —— 真实 Clang 回归 9 项（首次下载 ~110MB，之后走缓存；
                                        脚本开头会清存档，避免旧存档干扰）
注意：两个 .cjs 开头硬编码了 Playwright 模块路径与 Edge 可执行文件路径，请先改成本机路径
（或删掉 executablePath 用 Playwright 自带 Chromium）。

风格与硬性约束：
- 保持现有深色主题（背景 #0b171a、主色 #c8e1aa、卡片 #132627、描边 #2e4844），不要重做视觉；
  新控件沿用既有类：.segmented、.detail、.home-card、.setting-item、.rail-nav 等。中文文案，句子短。
- 地图、胜负判定只能由 engine.js 决定；AI/模型不能直接改世界或判定通关。
- C 代码只能产生受限动作（deliver），必须由同一引擎校验，运行必须可被强制终止。
- 存档按「关卡 × 难度」记录，首次奖励只发一次；导出只引用真实运行记录，重新生成不得覆盖
  玩家手写内容；API 密钥只留在 Node 进程内存，接口不回传。
- 改完 UI 请同时跑 e2e-check.cjs 与 c-integration.cjs，并更新 HANDOFF.md 的「已验证」一节。

下一步任务（按需求文档路线）：在三关之后补「电量 / 周期闸门 / 设备故障」挑战；
或在导出中心做模板与筛选；或打磨 C 难度的首次加载与错误定位。
```

---

## 11. 联系上下文

- 需求与验收标准：`docs/spec-requirements.docx`
- 界面现状：`qa/*.png`（桌面/手机主界面、关卡页、设置、导出页、通关页、C 通关截图）
- 最近一次回归的原始输出没有保留成文件，需要时重跑第 6 节的命令即可。
