import { useEffect, useState } from "react"

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
  // 旧原型在 load 前会先画一帧半成品（只有页签、没有工具栏），load 后再补样式补丁，
  // 直接显示会闪一下。先隐藏，补丁打完后的下一帧再显示；3 秒兜底防止一直白屏
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 3000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <iframe
      src={src}
      title={props.title}
      className="block size-full border-0 bg-background-page"
      style={{ visibility: ready ? "visible" : "hidden" }}
      onLoad={(e) => {
        // 原型内层侧栏收起后会在左上角浮出「展开侧边栏」按钮，与本工程侧栏的开关重叠，直接隐藏
        try {
          const doc = e.currentTarget.contentDocument
          if (doc && !doc.getElementById("legacy-frame-patch")) {
          const style = doc.createElement("style")
          style.id = "legacy-frame-patch"
          style.textContent =
            ".expand-sidebar{display:none!important}" +
            // 应用开发放进「产物」页签后：去掉原型自带的「应用开发」标题，内容区宽度和左右边距对齐其它产物页（1200 / 24px / 40px）
            "#view-apps .apps-head{display:none!important}" +
            "#view-apps{max-width:1200px;margin:0 auto;padding:0 40px 56px 24px!important}" +
            "#view-apps .apps-toolbar{margin-bottom:16px}" +
            // 应用页背景透明，透出 iframe 的 bg-background-page，和其它产物页签同色（协作页不动）
            (props.view === "apps" ? "html,body,.main,#view-apps{background:transparent!important}" : "")
          doc.head.appendChild(style)
          }
        } catch {
          /* 文档未就绪时忽略 */
        }
        // load 之后原型还会异步渲染一轮列表（约 100ms），等内容连续 150ms 不再变化再显示，最多等 1.5 秒
        const doc = e.currentTarget.contentDocument
        let last = -1
        let stable = 0
        const started = Date.now()
        const check = () => {
          const len = doc?.body?.innerText.length ?? 0
          stable = len === last ? stable + 1 : 0
          last = len
          if (stable >= 3 || Date.now() - started > 1500) setReady(true)
          else setTimeout(check, 50)
        }
        check()
      }}
    />
  )
}
