#!/usr/bin/env bun
/**
 * 从 ../lingee-build 同步视觉资产（样式 / 文案 / 图标 / 静态资源）。
 * 原型工程不改这些文件，线上视觉变化后重新跑 `bun run sync` 即可。
 */
import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { Glob } from "bun"

const root = path.resolve(import.meta.dir, "..")
// 来源仓库：环境变量优先，其次读 sync.config.json（同级目录下可能有另一份旧的 lingee-build，所以不靠相对路径猜）
const config = await Bun.file(path.join(root, "sync.config.json")).json()
const source = path.resolve(process.env.LINGEE_BUILD_DIR ?? config.lingeeBuildDir, "packages")
const ui = path.join(source, "kcode-ui", "src")
const web = path.join(source, "kcode-web")
const vendor = path.join(root, "src", "vendor")

const copyGlob = async (pattern: string, from: string, to: string) => {
  const files = await Array.fromAsync(new Glob(pattern).scan({ cwd: from }))
  await Promise.all(
    files.map(async (file) => {
      await mkdir(path.dirname(path.join(to, file)), { recursive: true })
      await Bun.write(path.join(to, file), Bun.file(path.join(from, file)))
    }),
  )
  return files.length
}

await rm(vendor, { recursive: true, force: true })

// 1. kcode-ui 样式：保持 styles/ 与 components/ 的相对位置，index.css 里的 @import 无需改写
const uiStyles = await copyGlob("styles/**/*.css", ui, path.join(vendor, "kcode-ui"))
const uiComponents = await copyGlob("components/*.css", ui, path.join(vendor, "kcode-ui"))

// 2. kcode-web 样式：只有入口的包名 import 需要改成相对路径
const webStyles = await copyGlob("src/**/*.css", web, path.join(vendor, "kcode-web"))
const entry = path.join(vendor, "kcode-web", "src", "index.css")
await Bun.write(
  entry,
  (await Bun.file(entry).text()).replace('@import "@kcode/ui/styles/tailwind";', '@import "../../kcode-ui/styles/tailwind/index.css";'),
)

// 3. 文案：只保留中英文
await Promise.all(
  [
    ["kcode-web/src/i18n", "app"],
    ["kcode-ui/src/i18n", "ui"],
  ].flatMap(([from, to]) =>
    ["zh.ts", "en.ts"].map(async (file) =>
      Bun.write(path.join(root, "src", "i18n", "dict", to, file), Bun.file(path.join(source, from, file))),
    ),
  ),
)

// 4. 图标：抽出 SVG path 表与 viewBox 规则，生成框架无关的数据文件
const icon = await Bun.file(path.join(ui, "components", "icon.tsx")).text()
const table = icon.slice(icon.indexOf("const icons = {"), icon.indexOf("\n}\n", icon.indexOf("const icons = {")) + 2)
const viewBox = icon
  .slice(icon.indexOf("const viewBox = () => {") + "const viewBox = () => {".length, icon.lastIndexOf('return "0 0 16 16"'))
  .replaceAll("local.name", "name")
await Bun.write(
  path.join(root, "src", "ui", "icon", "icons.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\n${table.replace("const icons", "export const icons")}\n\nexport type IconName = keyof typeof icons\n\nexport function iconViewBox(name: string) {${viewBox}return "0 0 16 16"\n}\n`,
)

// 4a. Toast 状态图标
const toast = await Bun.file(path.join(ui, "components", "toast.tsx")).text()
const toastIcons = [
  ["success", "SuccessIcon"],
  ["error", "ErrorIcon"],
  ["warning", "WarningIcon"],
  ["default", "NormaralIcon"],
].map(([key, fn]) => {
  const body = toast.slice(toast.indexOf(`function ${fn}(`))
  return `  ${key}: \`${body.slice(body.indexOf("<svg"), body.indexOf("</svg>") + 6).replace(" {...props}", "")}\`,`
})
await Bun.write(
  path.join(root, "src", "ui", "toast", "toast-icons.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport const toastIcons = {\n${toastIcons.join("\n")}\n}\n`,
)

// 4c. 页面里内联的零散 SVG path：按起始坐标从源码里摘出来，避免手抄走样
const pathD = (source: string, prefix: string) => source.match(new RegExp(`d="(${prefix.replaceAll(".", "\\.")}[^"]*)"`))?.[1] ?? ""
const sidebarSource = await Bun.file(path.join(web, "src", "pages", "layout", "sidebar-shell.tsx")).text()
const promptSource = await Bun.file(path.join(web, "src", "components", "prompt-input.tsx")).text()
const messagePartSource = await Bun.file(path.join(ui, "components", "message-part.tsx")).text()
const todoSource = await Bun.file(path.join(web, "src", "pages", "session", "composer", "session-todo-dock.tsx")).text()
const inlinePaths = {
  todoCheckFill: pathD(todoSource, "M8.64743 0.407045"),
  todoCheckStroke: pathD(todoSource, "M7.66797 0.484619"),
  todoCollapse: pathD(todoSource, "M6.96285 9.42778"),
  reasoningChevron: pathD(messagePartSource, "M5.12918 10.9125"),
  pin: pathD(sidebarSource, "M8.54259 2.22687"),
  moveToProject: pathD(sidebarSource, "M6.26035 2C7.0387"),
  groupBy1: pathD(sidebarSource, "M7.67159 9.29004"),
  groupBy2: pathD(sidebarSource, "M7.68917 6.49381"),
  groupBy3: pathD(sidebarSource, "M5.83825 3.09277"),
  userChevron: pathD(sidebarSource, "M11.862 9.19556"),
  usageClock: pathD(sidebarSource, "M8 1C4.13401"),
  searchEmpty: pathD(sidebarSource, "M24.4998 4.66666"),
  folderPlus: pathD(promptSource, "M6.25938 2C7.03773"),
}
await Bun.write(
  path.join(root, "src", "ui", "icon", "inline-paths.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport const inlinePaths = ${JSON.stringify(inlinePaths, null, 2)}\n`,
)

// 4d. Markdown：代码高亮主题（Shiki）与代码块复制按钮的图标
const markedSource = await Bun.file(path.join(ui, "context", "marked.tsx")).text()
const themeStart = markedSource.indexOf("Promise.resolve(") + "Promise.resolve(".length
const markdownSource = await Bun.file(path.join(ui, "components", "markdown.tsx")).text()
const iconPathsStart = markdownSource.indexOf("const iconPaths = {")
await Bun.write(
  path.join(root, "src", "ui", "markdown", "markdown-assets.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport const kcodeTheme = ${markedSource.slice(themeStart, markedSource.indexOf("} as unknown as ThemeRegistrationResolved)") + 1)}\n\nexport ${markdownSource.slice(iconPathsStart, markdownSource.indexOf("\n}\n", iconPathsStart) + 2)}\n`,
)

// 4e. 文件类型图标：SVG 雪碧图 + 少量位图，放进 public 直接按地址引用；图标名映射规则是纯 TS，原样复用
const fileIconSource = await Bun.file(path.join(ui, "components", "file-icon.tsx")).text()
const bitmapImports = new Map(
  Array.from(fileIconSource.matchAll(/^import (\w+) from "\.\.\/assets\/icons\/(.+\.png)"$/gm)).map((m) => [m[1], m[2]]),
)
const bitmapBlock = fileIconSource.slice(fileIconSource.indexOf("const BITMAP_ICONS"), fileIconSource.indexOf("export type FileIconProps"))
const bitmaps = Array.from(bitmapBlock.matchAll(/^\s+(\w+): (\w+),$/gm)).flatMap((m) => {
  const file = bitmapImports.get(m[2])
  return file ? [[m[1], file] as const] : []
})
await Promise.all([
  Bun.write(path.join(root, "public", "file-icons", "sprite.svg"), Bun.file(path.join(ui, "components", "file-icons", "sprite.svg"))),
  ...bitmaps.map(([, file]) =>
    Bun.write(path.join(root, "public", "file-icons", "bitmap", path.basename(file)), Bun.file(path.join(ui, "assets", "icons", file))),
  ),
])
await Bun.write(
  path.join(root, "src", "ui", "file-icon", "file-icon-names.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport const BITMAP_ICONS: Record<string, string> = ${JSON.stringify(
    Object.fromEntries(bitmaps.map(([name, file]) => [name, `/file-icons/bitmap/${path.basename(file)}`])),
    null,
    2,
  )}\n\n${fileIconSource.slice(fileIconSource.indexOf("type IconMaps = {"))}`,
)

// 4b. 主题：色板推导是纯 TS，直接复用，保证明暗色 token 与线上逐一一致
await Promise.all(
  ["types.ts", "color.ts", "resolve.ts", path.join("themes", "nova.json")].map((file) =>
    Bun.write(path.join(vendor, "kcode-ui", "theme", file), Bun.file(path.join(ui, "theme", file))),
  ),
)

// 5. 纯数据：推荐模板卡片及其图标
await Bun.write(
  path.join(root, "src", "mock", "fixtures", "recommendation-cards.gen.ts"),
  Bun.file(path.join(web, "src", "data", "recommendation-cards.ts")),
)
const session = await Bun.file(path.join(web, "src", "pages", "session.tsx")).text()
const iconsStart = session.indexOf("const RECOMMENDATION_ICON_HTML")
await Bun.write(
  path.join(root, "src", "mock", "fixtures", "recommendation-icons.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport ${session.slice(iconsStart, session.indexOf("\n}\n", iconsStart) + 2)}\n`,
)

// 2b. 深色规则跟应用主题走：线上样式里有一批 @media (prefers-color-scheme: dark)，它们跟的是系统偏好。
//     浏览器里系统深色 + 应用浅色时会出现半黑半白（侧边栏、开关、弹窗阴影…），这里统一改成看 <html data-color-scheme="dark">。
//     顶层的整块改成选择器前缀；嵌在规则里面的改成「祖先是深色」或「自身（:root）是深色」。
const DARK_MEDIA = /^([ \t]*)@media \(prefers-color-scheme: dark\) \{/gm
await Promise.all(
  (await Array.fromAsync(new Glob("**/*.css").scan({ cwd: vendor }))).map(async (file) => {
    const full = path.join(vendor, file)
    const css = await Bun.file(full).text()
    if (!css.includes("prefers-color-scheme: dark")) return
    await Bun.write(
      full,
      css.replace(DARK_MEDIA, (_, indent: string) =>
        indent ? `${indent}:where(:root[data-color-scheme="dark"]) &, &:where([data-color-scheme="dark"]) {` : `:root[data-color-scheme="dark"] {`,
      ),
    )
  }),
)

// 5b. 不依赖框架的纯逻辑：结果卡片解析、业务组件 info.json 检查清单、智能体领域映射、技能「去修复」提示词模板
await Promise.all(
  [
    [path.join(ui, "components", "render-block.ts"), path.join(vendor, "kcode-ui", "components", "render-block.ts")],
    [path.join(web, "src", "utils", "mcp-app-check.ts"), path.join(vendor, "kcode-web", "src", "utils", "mcp-app-check.ts")],
    [path.join(web, "src", "utils", "agent-domain.ts"), path.join(vendor, "kcode-web", "src", "utils", "agent-domain.ts")],
    [path.join(web, "src", "utils", "skill-fix-prompts.ts"), path.join(vendor, "kcode-web", "src", "utils", "skill-fix-prompts.ts")],
  ].map(([from, to]) => Bun.write(to, Bun.file(from))),
)

// 5c. 技能检查项：规则清单来自技能校验脚本 validate_skill.py（分组、规则名、级别、说明，含中文对照）
const validator = await Bun.file(
  path.join(source, "opencode", "builtin-skills", "kingdee-skill-creator", ".locales", "zh", "scripts", "validate_skill.py"),
).text()
const zhTable = Object.fromEntries(
  [...validator.slice(validator.indexOf("_ZH"), validator.indexOf("_TRANSLATIONS")).matchAll(/^\s*"((?:[^"\\]|\\.)+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map((m) => [m[1], m[2]]),
)
const groupDefs = [...validator.matchAll(/\("(\w+)",\s*"([^"]+)",\s*check_(\w+)\(/g)].map((m) => ({ id: m[1], label: m[2], fn: m[3] }))
const validationGroups = groupDefs.map((group) => {
  const start = validator.indexOf(`def check_${group.fn}(`)
  const next = validator.indexOf("\ndef ", start + 1)
  const body = validator.slice(start, next === -1 ? undefined : next)
  return {
    id: group.id,
    label: { en: group.label, zh: zhTable[group.label] ?? group.label },
    rules: [...body.matchAll(/Rule\("([^"]+)",\s*"(block|warn)",\s*"((?:[^"\\]|\\.)*)"\)/g)].map((m) => ({
      name: { en: m[1], zh: zhTable[m[1]] ?? m[1] },
      severity: m[2],
      desc: { en: m[3], zh: zhTable[m[3]] ?? m[3] },
    })),
  }
})
await Bun.write(
  path.join(root, "src", "mock", "fixtures", "skill-validation.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport const VALIDATION_GROUPS = ${JSON.stringify(validationGroups, null, 2)} as const\n`,
)

// 5d. 检查页签用到的几枚彩色图标（kcode-web 的 components/icon.tsx 里是独立的 SVG 组件）
const webIcons = await Bun.file(path.join(web, "src", "components", "icon.tsx")).text()
const checkIcons = Object.fromEntries(
  ["CheckItemIcon", "PassIcon", "UnpassIcon", "CheckSuccessIcon", "CheckWarningIcon", "ErrorIcon"].map((name) => {
    const from = webIcons.indexOf(`export const ${name}:`)
    const svg = webIcons.slice(webIcons.indexOf("<svg", from), webIcons.indexOf("</svg>", from))
    return [name, { viewBox: svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 16 16", html: svg.slice(svg.indexOf(">") + 1).replace(/\{\.\.\.props\}/g, "").trim() }]
  }),
)
await Bun.write(
  path.join(root, "src", "features", "skill-detail", "check-icons.gen.ts"),
  `// 由 scripts/sync-from-lingee.ts 生成，请勿手改\nexport const CHECK_ICONS = ${JSON.stringify(checkIcons, null, 2)} as const\n`,
)

// 6. 静态资源
await cp(path.join(web, "public"), path.join(root, "public"), { recursive: true })
await cp(path.join(web, "src", "assets"), path.join(vendor, "kcode-web", "assets"), { recursive: true })
await Promise.all(
  ["images", "avatars", "render-card-icons", "favicon"].map((dir) =>
    cp(path.join(ui, "assets", dir), path.join(vendor, "kcode-ui", "assets", dir), { recursive: true }),
  ),
)

console.log(`synced: ${uiStyles + uiComponents} ui css, ${webStyles} web css, i18n zh/en, icons, assets`)
