import { devStore } from "../dev-store"
import type { McpApp } from "../fixtures/dev"
import type { Scenario, ScenarioContext } from "./types"
import { entityName, slugOf } from "./types"

const APP_TSX = `export default function App({ toolInput }: { toolInput: { billNo?: string } }) {
  const { data, loading } = useToolResult("bill_query", { billNo: toolInput.billNo })
  if (loading) return <Skeleton rows={4} />
  return <SummaryCard title={data.billNo} fields={data.fields} actions={<SubmitButton />} />
}`

/** 提示词里点了某个已有组件的名字（「编辑【xxx】组件」「预览【xxx】组件」）就是在它上面继续做 */
const findTarget = (prompt: string) => devStore.mcpApps.find((x) => prompt.includes(`【${x.appName}】`))

/** 剧本：开发一个业务组件（MCP APPS）。结束时给出组件产物卡片，并把结果写进「业务组件」页的数据 */
export const mcpAppCreateScenario = ({ prompt, projectId }: ScenarioContext): Scenario => {
  const target = findTarget(prompt)
  const appName = target?.appName ?? entityName(prompt, "业务组件")
  const appCode = target?.appCode ?? `kdcloud_scm_${slugOf(appName, "app").replace(/-/g, "_")}`
  const previewOnly = !!target && /^\/\S+\s*预览/.test(prompt)

  const finish = () => {
    const now = new Date().toISOString()
    const [major = 1, minor = 0, fix = 0] = (target?.version ?? "1.0.0").split(".").map(Number)
    const version = target?.artifacts.length ? `${major}.${minor}.${fix + 1}` : "1.0.0"
    const app: McpApp = {
      appCode,
      appName,
      appDescription: target?.appDescription ?? (prompt.replace(/^\/\S+\s*/, "").trim().slice(0, 80) || `${appName}：由对话生成的业务组件。`),
      projectId: target?.projectId ?? projectId,
      mcpStatus: target?.mcpStatus ?? "",
      buildStatus: "success",
      tested: false,
      packageKind: "source",
      version,
      artifacts: previewOnly ? (target?.artifacts ?? []) : [...(target?.artifacts ?? []), { version, createdAt: now, changeDesc: target ? "按对话要求调整" : "首次构建" }],
      info: {
        cloud: "kdcloud",
        domain: "scm",
        appCode,
        appName,
        description: `${appName}`,
        runMode: "message",
        version,
        entryTool: { virtual: { inputSchema: { type: "object", properties: { billNo: { type: "string" } } } } },
        mcpConnector: [{ type: "MCP", mcpInstanceId: "scm-bill-service", relateTools: [{ name: "bill_query" }] }],
      },
      reviewRemark: target?.reviewRemark,
    }
    devStore.mcpApps = [...devStore.mcpApps.filter((x) => x.appCode !== appCode), app]
    return { kind: "kdapp-artifact", config: { appCode, title: appName, phase: "preview", jobId: `job_${appCode}`, url: "http://localhost:5173" } }
  }

  if (previewOnly)
    return {
      todos: ["安装依赖", "启动开发服务器"],
      steps: [
        { todo: 0, tools: [{ tool: "bash", title: "npm install", detail: "exit 0", output: "added 212 packages in 6s" }] },
        {
          todo: 1,
          tools: [{ tool: "bash", title: "npm run dev", detail: "running", output: "VITE ready in 412 ms\n➜  Local: http://localhost:5173/" }],
          text: `「${appName}」的开发服务器已启动，点下面卡片上的 **预览** 可以在右侧查看。`,
          card: finish,
        },
      ],
    }

  return {
    todos: ["确认组件形态与数据来源", "生成组件工程", "补全 info.json", "构建并打包"],
    steps: [
      {
        todo: 0,
        reasoning: "业务组件要挂在对话里渲染。按「展示 + 操作」来做：既展示数据，也提供提交入口，所以需要配置 MCP 连接器。",
        tools: [{ tool: "skill", title: "mcp-apps-builder", output: "已加载业务组件开发规范" }],
      },
      {
        todo: 1,
        tools: [
          { tool: "write", title: `mcp-app/${appCode}/src/App.tsx`, output: APP_TSX },
          { tool: "write", title: `mcp-app/${appCode}/src/styles.css`, output: ".summary-card { border-radius: 16px; padding: 16px; }" },
        ],
      },
      {
        todo: 2,
        tools: [{ tool: "write", title: `mcp-app/${appCode}/info.json`, output: `{\n  "appCode": "${appCode}",\n  "appName": "${appName}",\n  "runMode": "message",\n  "version": "1.0.0"\n}` }],
      },
      {
        todo: 3,
        tools: [{ tool: "bash", title: "npm run build", detail: "exit 0", output: "vite v7 building for production...\n✓ 38 modules transformed.\ndist/index.html  0.46 kB\ndist/assets/index.js  61.20 kB\n✓ built in 1.31s" }],
        text: `「${appName}」已经${target ? "按要求调整并重新" : ""}构建完成。\n\n## 产物\n\n- 组件编码：\`${appCode}\`\n- 入口：\`src/App.tsx\`，通过虚拟入口工具接收 \`toolInput\`\n- 已生成 \`dist.zip\` 与 \`info.json\`\n\n## 核心代码\n\n\`\`\`tsx\n${APP_TSX}\n\`\`\`\n\n## 下一步\n\n- 点卡片上的 **预览** 启动开发服务器看效果\n- 点 **详情** 查看基本信息与 info.json 完整性检查，确认后再测试、提交\n\n> 这是原型工程的模拟回复，内容由剧本生成。`,
        card: finish,
      },
    ],
  }
}
