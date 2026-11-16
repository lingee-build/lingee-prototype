/** 页面使用便于阅读的本地时间。 */
export function formatEvaluationTime(time: number) {
  const value = new Date(time)
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}
