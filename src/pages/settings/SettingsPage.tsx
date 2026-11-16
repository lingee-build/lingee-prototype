import { Empty } from "@/ui"
import { useT } from "@/i18n"

/** 配置管理：后续分期实现，先占位保证路由可达 */
export function Component() {
  const t = useT()
  return (
    <div className="size-full flex items-center justify-center bg-background-page">
      <Empty description={`${t("kcode.nav.configMgmt")} · 原型待建`} />
    </div>
  )
}
