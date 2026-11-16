# lingee-prototype

灵基 Build 的前端原型工程：React + mock 数据，用来做原型和后续功能的演进。视觉资产（样式、文案、图标、主题）从 lingee-build 同步，保证和线上一致；来源路径在 `sync.config.json` 里配置（也可用环境变量 `LINGEE_BUILD_DIR` 覆盖）。

## 启动

```bash
bun install
bun run dev        # http://127.0.0.1:5180
```

其他命令：

| 命令 | 作用 |
| --- | --- |
| `bun run typecheck` | 类型检查 |
| `bun run build` | 生产构建 |
| `bun run sync` | 从 lingee-build 重新同步样式 / 文案 / 图标 / 主题（线上视觉有变化时跑一次） |

## 目录

```
scripts/sync-from-lingee.ts   同步脚本
src/
  app/          路由、全局 Provider、主框架（侧边栏 + 内容区）
  ui/           React 版基础组件（对应 kcode-ui），一个组件一个目录
  i18n/         文案：dict/ 下是同步来的中英文字典，key 与线上一致
  theme/        明暗主题（复用线上的色板推导逻辑）
  stores/       Zustand：sync（服务端数据）、layout（界面状态）、prompt（输入框状态）
  services/     数据接口层，页面只调这里
  mock/         内存数据库、fixtures、流式回放引擎、剧本
  features/     跨页面复用的能力：sidebar、prompt-input、dev-page、dialogs
  pages/        session（新任务 + 会话）、dev（技能 / 智能体 / 业务组件）、settings
  vendor/       同步来的原始资产，不要手改
```

## 约定

- **不要改 `src/vendor/` 和 `*.gen.ts`**，它们会被 `bun run sync` 覆盖。
- 组件的 DOM 结构、`data-component` / `data-slot` 属性和类名照抄原工程，样式才能直接生效。
- 原工程用 Kobalte，这里用 Radix；`src/lib/kobalte-state.ts` 负责把 Radix 的 `data-state` 镜像成 Kobalte 的 `data-expanded` / `data-closed`。
- 页面不直接碰 mock：数据走 `services/`，以后接真实后端只换实现。
- 文案一律用 `useT()` + 线上的 key，新增文案要同时补中英文。

## 路由

| 路径 | 页面 |
| --- | --- |
| `/p/:projectId/session` | 新任务 |
| `/p/:projectId/session/:sessionId` | 会话 |
| `/dev/skill` `/dev/agent` `/dev/mcpapp` | 技能开发 / 智能体开发 / 业务组件 |
| `/dev/workflow` `/dev/workflow/:id` | 工作流开发（列表）/ 跳转到工作流的关联会话并打开画布 |
| `/dev/app` `/dev/expert` `/dev/cloudTenant` `/settings` | 占位，待建 |

## 会话里的产物卡片

模型回复末尾的 `:::render:kind {json}:::` 指令会渲染成一张产物卡片（`src/ui/render-card`，解析逻辑同步自线上）：

| 提示词开头 | 剧本 | 卡片 | 点卡片打开 |
| --- | --- | --- | --- |
| `/kingdee-skill-creator`（及其他） | `mock/scenarios/skill-create.ts` | 技能 `kdskill` | 技能预览抽屉 |
| `/ai-partner-creator` | `mock/scenarios/agent-create.ts` | 智能体 `ai-partner` | 智能体配置抽屉（可编辑） |
| `/mcp-apps-builder` | `mock/scenarios/mcp-app-create.ts` | 业务组件 `kdapp-artifact` | 组件详情抽屉 |

剧本走到最后一步时把产物写进 `mock/dev-store.ts`，所以对应的开发页里能看到新卡片。抽屉在 `features/side-panel/drawer`，内容与开发页的详情弹窗共用同一批组件（`features/skill-detail`、`features/agent-config`、`features/mcp-app-detail`）。

## 采购价格异常预警创建演示

启动后进入 `/p/scm-skills/session?demo=procurement`。该链接仅在原有新任务输入框预填需求，点击发送后，进入产品现有的技能创建会话。

- 完全复用 MessageTimeline、SessionTurn、ReasoningPart、ToolPart、TodoDock、QuestionDock、RenderCard 和 SkillDrawer，不使用独立演示页面或样式。
- 原有流式回放驱动技能加载、技能检索、业务对象发现、工具发现及校验、执行方案、集中提问和技能文件生成。创建过程不展示待办控件或订单分析报告；完成后显示简短说明与技能产物卡片。
- 规则通过原有提问区确认，可一键选择全部推荐项；阈值可自填。跳过时采用推荐配置，最终在生成摘要中明确展示实际规则。
- 点击本地测试后才展示采购订单价格分析。默认 90 天、15% 阈值时精密轴承异常、紧固件套装正常；改为 30% 时两项均正常。180 天历史样本可展示时间范围及数量加权的影响。
- 产物卡片打开原有技能预览抽屉；「本地测试」预填该技能，发送后按创建时的规则再次模拟。原有文件面板可查看技能说明、Python 脚本、执行方案和 10 条评测用例（已打开的文件树可点刷新）。
- 重新演示：点击产品原有「新任务」，再次输入需求。所有记录及产物仅保存在原项目 Mock 内存数据库中，刷新会清空。
- 核心剧本：`src/mock/scenarios/procurement-create.ts`；独立数据适配：`src/services/procurement.ts`；生成产物：`src/mock/procurement-artifacts.ts`。均不调用真实 ERP/DC/MCP。

## 与产品源码对齐的运行时组件

运行时样式来自当前「Build的源码」，通过 `npm run sync:runtime` 更新；原始组件代码保存在 `src/source-runtime/reference/`，CSS 和来源校验清单保存在同级目录。React 移植及组件对应关系见 [运行时移植说明](docs/runtime-source-port.md)。

执行 `npm run test:runtime` 可检查来源完整性、执行分组和采购规则联动，再用 `npm run build` 检查构建。

领导演示版本：界面及生成技能文件隐藏技术性 Mock 标签；底层继续使用独立本地 fixture，不调用真实 DC/ERP。采购业务样本及工具结构位于 `src/mock/fixtures/procurement-context.ts`。

## 工作流开发

左侧导航「智能体开发」下方新增「工作流开发」。工作流详情不是独立页面，而是「关联的 Build 会话 + 右侧画布」：左边用 Build 原生会话和助手对话，右边是画布。会话 / 画布 / 右栏默认 1:1:1，两条分隔线都可以左右拖动（沿用 Build 的 resize-handle，双击恢复默认，比例记在 `lingee-prototype.workflow-layout`）。

- **列表**（`pages/dev/workflow/`）：复用 `DevPageLayout`、`Tile`、`SegmentedControl` 等开发页控件。状态四种：已保存 / 已提交 / 已发布 / 已驳回（驳回卡片显示原因）。点卡片进入关联会话并打开画布（没有会话时自动新建，`features/workflow/use-open-workflow.ts`）。右上角「导入」读入 DSL（「导出定义」生成的 JSON，格式见 `features/workflow/dsl.ts`；也接受只有 `nodes` / `edges` 的画布），校验开始 / 结束节点、节点类型和连线后新建一条「已保存」的工作流。
- **新建**：进入新任务页并选中 `workflow-builder`（触发名 `/workflow-creator`）。场景模板里有「销售分析 / 费用审核 / 批量审批」（`mock/fixtures/workflow-cases.ts`），对话剧本见 `mock/scenarios/workflow-create.ts`，结束时推出 `kd-workflow` 卡片，点卡片在右侧打开画布并收起左侧导航。
- **画布**（`features/workflow/`，原生 React 实现）：头部「保存」「试运行」「提交」（已提交时变成「撤回提交」）和「···」（查看试运行记录、设计历史、查看定义、导出定义、编辑基本信息、使用说明）。头部操作栏里可以搜索节点（选中后画布定位到该节点）；底部操作栏的「节点」打开节点库（智能体、MCP 工具、代码、条件、并行、并行汇入、人工输入、循环），拖到画布上放下后从节点下方端口拖出连线，或点击插到选中节点之后。节点配置对齐原工作流设计器，分「节点配置 / 输入输出 / 执行记录 / 文件」四页（`NodePanel.tsx`、`node-config.tsx`）：条件是有序分支 + 默认出口，人工输入按动作走出口，智能体可「依据处理意图选择下一步」，分支定义在节点配置里、连线用 `edge.branch` 指向分支。修改即时写入画布，可撤销。
- **双向同步**：会话里要求修改画布时，`mock/scenarios/workflow-edit.ts` 先生成修改方案（`kd-workflow-change` 卡片 + 画布顶部横幅，改动节点蓝色虚线框），画布只读预览，点「应用」才写入、可撤销；「放弃」则丢弃。画布上的手动修改会被记录下来，下次发消息时助手自动读取（「读取画布」步骤），不需要用户操作。已提交状态下助手只读。
- **保存 / 提交**（方案 10.1 / 10.2）：保存做轻校验，形成「已保存基线」（判断未保存修改、设计历史可恢复）；提交做完整校验，不通过时列出问题并可定位，通过后弹提交清单（版本号、发布范围、写操作步骤、人工确认数、依赖对象、按「已提交基线」生成的变更说明），审核在 Console 进行。撤回提交回到已保存，已提交基线回退。
- **试运行**：模板只保存画布内容。MCP 工具账号、智能体版本、人工输入的实际办理人在试运行时配置（`doc.runtime`，可一键使用推荐配置，不进模板）。`trial-run.ts` 在本地模拟：并行分支、条件只走命中分支、循环逐轮输出、人工输入停在「待我处理」由你模拟办理并选择动作。智能体步骤记模拟 Token，汇总显示状态 / 耗时 / Token / 步骤；结果分「业务结果」（结束节点的最终输出）和「运行产物」（文件）。写操作 MCP 工具绑定「华东区账套（只读）」会失败，可在失败卡片里换账号后「重试该步骤并继续」。每次运行有记录可切换，步骤可展开看输入输出，结果文件可预览、下载、定位产出步骤，完成后在会话里追加一轮结果摘要。
- 数据存在 localStorage（`lingee-prototype.workflows.v3`、`lingee-prototype.workflow-docs.v3`），刷新不丢；关联会话在内存数据库里，刷新后会重新建。
