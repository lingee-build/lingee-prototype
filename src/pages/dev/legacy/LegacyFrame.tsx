import { useState } from "react"

/**
 * 旧版 Lingee 原型（应用开发原型/lingee）的静态嵌入页。
 * 源工程构建产物是单个自包含 index.html，放在 public/legacy/ 下，
 * 通过 ?view=apps|collab 指定初始视图（应用开发 / 协作开发）。
 * 同源 iframe 共享 sessionStorage，这里预置登录态以跳过原型的登录页。
 * 更新内容：执行 npm run sync:legacy 重新构建并拷贝产物。
 */
export function LegacyFrame(props: { view: "apps" | "collab"; title: string }) {
  const [src] = useState(() => {
    try {
      if (!sessionStorage.getItem("lingee_auth_session")) {
        sessionStorage.setItem("lingee_auth_session", "吴晓锋")
      }
      // 默认收起原型的内侧侧栏（原型自身支持 collapsed 持久化），避免与本工程侧栏叠加；
      // 用户在原型内手动展开后（值为 "0"）不再干预
      if (localStorage.getItem("sidebarCollapsed") === null) {
        localStorage.setItem("sidebarCollapsed", "1")
      }
    } catch {
      /* storage 不可用时让原型自己走登录页 */
    }
    return `${import.meta.env.BASE_URL}legacy/index.html?view=${props.view}`
  })
  return (
    <iframe
      src={src}
      title={props.title}
      className="block size-full border-0 bg-background-page"
      onLoad={(e) => {
        // 原型内层侧栏收起后会在左上角浮出「展开侧边栏」按钮，与本工程侧栏的开关重叠，直接隐藏
        try {
          const doc = e.currentTarget.contentDocument
          if (!doc || doc.getElementById("legacy-frame-patch")) return
          const style = doc.createElement("style")
          style.id = "legacy-frame-patch"
          style.textContent = ".expand-sidebar{display:none!important}"
          doc.head.appendChild(style)
        } catch {
          /* 文档未就绪时忽略 */
        }
      }}
    />
  )
}
