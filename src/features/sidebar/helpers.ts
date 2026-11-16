import type { Translate } from "@/i18n"
import type { Session } from "@/mock/types"

export const sessionPath = (session: Pick<Session, "id" | "projectId">) => `/p/${session.projectId}/session/${session.id}`

/** 会话更新时间的人性化文案：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期 */
export function formatSessionTime(ms: number, t: Translate) {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t("kcode.time.justNow")
  if (mins < 60) return `${mins}${t("kcode.time.minuteAgo")}`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}${t("kcode.time.hourAgo")}`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}${t("kcode.time.dayAgo")}`
  const d = new Date(ms)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
}

export type DateGroup = "today" | "thisWeek" | "earlier"

export function groupSessionsByDate(sessions: Session[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const startOfWeek = startOfToday - 6 * 86400000
  const keyOf = (session: Session): DateGroup =>
    session.time.updated >= startOfToday ? "today" : session.time.updated >= startOfWeek ? "thisWeek" : "earlier"
  return (["today", "thisWeek", "earlier"] as const)
    .map((key) => ({ key, items: sessions.filter((session) => keyOf(session) === key) }))
    .filter((group) => group.items.length > 0)
}

export const byUpdated = (a: Session, b: Session) => b.time.updated - a.time.updated
