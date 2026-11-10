import { devStore } from "@/mock/dev-store"
import { skillDetailOf } from "@/mock/fixtures/skill-detail"
import { configTarget, configMissing, guardArtifactConfig, type ArtifactKind } from "./config-state"

/** 原型导出：下载演示文件包；真实包完整性应由后端检查。 */
export async function createDemoArtifactPackage(kind: Exclude<ArtifactKind, "mcpapp">, id: string) {
  const target = configTarget(kind, id)
  if (!target) throw new Error("产物不存在，请刷新后重试")
  if (configMissing(target)) throw new Error("产物缺少必要的配置文件，请先修复")
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const skill = kind === "skill" ? devStore.skills.find(x => x.id === target.id) : undefined
  const agent = kind === "agent" ? devStore.agents.find(x => x.id === target.id) : undefined
  const code = skill?.name ?? target.id
  const yaml = `name: ${JSON.stringify(code)}\ndisplayName: ${JSON.stringify(target.name)}\ndescription: ${JSON.stringify(skill?.desc ?? agent?.desc ?? "")}\n`
  zip.file(`${kind}.yaml`, yaml)
  zip.file("i18n/zh-CN.json", JSON.stringify({ name: target.name, description: skill?.desc ?? agent?.desc }, null, 2))
  if (skill) zip.file("SKILL.md", skillDetailOf(skill).content)
  if (agent) zip.file("assistant.json", JSON.stringify(agent, null, 2))
  zip.file("README.txt", "此包为 Build 原型演示数据，用于展示完整性校验与导出交互，不是真实可部署的产物包。")
  return { filename: `${code}-demo.zip`, bytes: await zip.generateAsync({ type: "uint8array" }) }
}
export async function exportArtifactPackage(kind: "agent" | "skill", id: string) {
  // 下载动作集中校验，列表与其他入口共用，防止绕过。
  if (guardArtifactConfig(kind, id)) return
  const { showToast } = await import("@/ui")
  try {
    const { filename, bytes } = await createDemoArtifactPackage(kind, id)
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/zip" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    showToast({ variant: "error", title: "导出失败", description: error instanceof Error ? error.message : "请重试" })
  }
}
