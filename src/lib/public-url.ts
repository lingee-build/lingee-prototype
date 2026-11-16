const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

/** public 目录下的资源地址：部署在子路径（如 GitHub Pages）时补上前缀；data: / http 地址原样返回 */
export function publicUrl(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? BASE + path : path
}
