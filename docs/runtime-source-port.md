# Build 运行时组件移植

来源：`sync.config.json` 指向「Build的源码 / lingee-build-feature_sit」。

`src/source-runtime/styles/` 内的组件 CSS 直接复制自产品源码，不做手工修改；Web 入口里的运行时规则按完整 CSS 块提取。`manifest.json` 记录来源、目标路径和 SHA-256。`reference/` 保留原始 Solid 组件文本用于逐项对照，不参与编译与 Tailwind 扫描。

原型使用 React，产品使用 Solid。组件逻辑在下表对应位置移植，继续使用相同的 `data-component`、`data-slot` 和主题 token。附件中的灰色圆角执行组、状态连接线保存在局部的 `process-group.css` 中，覆盖当前源码中未填充的组背景。

| 产品源码 | 原型 React 实现 | 保留的行为 |
| --- | --- | --- |
| `kcode-ui/message-part.tsx` 中 AssistantParts / stageParts | `pages/session/timeline/process-groups.ts`、`SessionTurn.tsx` | 连续工具组成阶段，思考不打断阶段，正文分隔阶段，最终正文及卡片在过程折叠区外 |
| TurnProcessGroup / ToolStageGroup | `pages/session/timeline/ProcessGroup.tsx` | 整轮时长、运行/完成/失败、分类计数、自动展开与完成后收起、手动覆盖、组内滚动跟随 |
| BasicTool / 工具注册渲染器 | `pages/session/timeline/ToolPart.tsx` | MCP / Shell / 技能 / 读取 / 搜索 / 写入 / 提问；输出折叠、Shell 输出与复制、问答回显、失败详情 |
| ReasoningPartDisplay | `pages/session/timeline/ReasoningPart.tsx` | 首行摘要、流式末行摘要、合并连续思考、限高滚动、手动回看时停止跟随 |
| text-shimmer.tsx | `ui/text-shimmer/TextShimmer.tsx` | 原 DOM 和 220ms 切换规则，使用原 CSS |
| UserMessageDisplay | `pages/session/timeline/UserMessage.tsx` | 气泡、技能标签、模型/时间、复制反馈、展开长消息、ResizeObserver |
| session-todo-dock.tsx | `pages/session/composer/TodoDock.tsx` | 待办折叠、进行中旋转标记、完成标记、动态高度和展开过渡 |
| session-question-dock.tsx | `pages/session/composer/question/` | 原提问 Dock、推荐选项、自定义输入、多题导航与滚动、快捷键、确认/跳过 |
| session-permission-dock.tsx / dock-prompt.tsx / dock-surface.tsx | `pages/session/composer/PermissionDock.tsx`、`ui/dock-prompt/`、`ui/dock-surface/` | 原权限区与内容/按钮托盘层级 |
| prompt-input.tsx | `features/prompt-input/` | 原编辑区、运行时停止按钮、模式及模型选择、附件入口 |
| render-card.tsx | `ui/render-card/RenderCard.tsx` | 原产物卡片、图标、查看产物及本地测试入口 |

本次显示修改作用于所有会话，不仅采购案例。采购剧本把应对用户展示的业务进展作为正文穿插在工具组之间，DC Mock 调用以 MCP 工具行展示。

## 同步与检查

```sh
npm run sync:runtime
npm run test:runtime
npm run typecheck
npm run build
```

也可以传入另一份同结构源码路径：`npm run sync:runtime -- /absolute/path/to/lingee-build`。同步不会修改产品源码，也不会覆盖原型 `vendor/`。

`test:runtime` 检查真实移植函数的分组、相邻探索/思考合并、最终正文与卡片分离、规则到生成文件/模拟报告/本地重测的一致性，以及源码副本的哈希完整性。浏览器验收另外覆盖运行中、业务规则确认、生成完成、组内展开、Shell 输出和产物预览。


## 输入框与工具栏

输入框的外框、编辑区、项目/分支 hood、模式标签、模型菜单、上下文空状态、提示词增强按钮及附件卡片对应 `features/prompt-input/` 下的 React 组件。`reference/` 中保留模型、增强、附件、补全菜单及上下文组件的原始 Solid 源码。

UI 组件 CSS 必须以 `layer(components)` 引入，与产品入口保持一致；否则无层级的基础按钮样式会覆盖 Tailwind 工具类，导致发送按钮退回 24px、透明背景等错误。同步脚本生成图标表，`test:runtime` 覆盖关键 CSS 层级，避免再次出现此问题。

现有原型不连接产品的增强、文件上传和模型计量接口。增强与撤销使用本地示例响应，附件仅保存在当前编辑区并以文件名引用进入剧本；上下文面板沿用产品的“暂无上下文用量数据”状态，不编造 Token 数据。语音入口按源码默认关闭的功能开关保持隐藏。

## 采购案例演示叙述与节奏

采购创建剧本对齐产品的工具组与生成流程：

1. 加载技能后，Shell 扫描 skills 目录，`search_tools` 加载 `query_mcp_tools` 与 `list_skill_types`，5 次读取参考文件；复用工具组计数和折叠组件。
2. 只调用一次 `searchEntities`，返回场景化采购订单、采购协同采购订单、供应链采购订单三个候选子图。在思考组件中比较场景关联，自动匹配供应链实体。
3. 仅以采购订单、采购历史价格查询、采购价目表三个业务实体调用 `getEntityTransformRules`、`getEntityMcpTools`、`getEntityOpenApis`。物料明细保留为分录关系，不作为接口实体参数。
4. 消息中的 execution-plan part 复用现有 Markdown 控件，以原生流程代码块显示步骤与分支，历史价和价目表并行；不再渲染独立白色卡片和节点色块。
5. 确认后用 2 次写入及 2 次 Shell 组成生成工具组，生成 SKILL.md、evals/basic.json、manifest.yaml、CHANGELOG.md 等文件，再调用 output_check，完成后保留技能产物卡片。

所有接口行使用英文名称，不显示 DC 前缀。5 道业务问题的 13 个选项保留业务说明。采购创建正文及思考按段输出，段间隔 650ms、每条正文保留 1.1 秒、工具调用显示 850ms、步骤间隔 100ms；自动播放总时长控制在 1 分钟内，用户答题等待时间不计入，停止操作立即取消播放等待。

流式正文在整轮结束前固定保留于过程区，不因下一条工具出现而换父节点。消息滚动通过 requestAnimationFrame 跟随，ResizeObserver 处理正文、折叠区和提问 Dock 的尺寸变化；用户向上滚动时停止跟随，并尊重减少动画偏好。

实体候选匹配组以 stageGroup 从首次调用起保持同一组件，避免思考加入时重建。业务分析按句追加，自动展开 48px 限高的思考正文并滚动跟随；完成且后续正文出现 450ms 后，整组自动收起，可点击回看。多工具步骤同样从首个调用起保持组结构。段落与新工具行使用 220ms 入场，页面跟随采用 150ms 时间常数平滑滚动，尊重减少动态效果设置。独立 Markdown 流程块清除 pre 的上下 1rem 边距，与普通正文使用相同的 4px / 6px 局部边距。
