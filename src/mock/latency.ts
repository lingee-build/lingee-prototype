/** 模拟网络延迟，让加载态、骨架屏在原型里也能看到 */
export const latency = <T>(value: T, ms = 120 + Math.random() * 180) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))

export const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
  if (signal?.aborted) return resolve()
  const finish = () => {
    clearTimeout(timer)
    signal?.removeEventListener("abort", finish)
    resolve()
  }
  const timer = setTimeout(finish, ms)
  signal?.addEventListener("abort", finish, { once: true })
})

export const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
