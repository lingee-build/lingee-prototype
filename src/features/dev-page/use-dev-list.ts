import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

/** 开发页列表的通用状态：拉取、页签筛选、关键字搜索、刷新 */
export function useDevList<T>(options: {
  queryKey: string
  fetch: () => Promise<T[]>
  matchTab: (item: T, tab: string) => boolean
  searchText: (item: T) => string
}) {
  const client = useQueryClient()
  const [tab, setTab] = useState("all")
  const [query, setQuery] = useState("")
  // 会话里可能刚生成了新的技能 / 智能体 / 业务组件，每次进页面都重新拉一次
  const result = useQuery({ queryKey: [options.queryKey], queryFn: options.fetch, staleTime: 0 })

  const list = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return (result.data ?? []).filter(
      (item) => (tab === "all" || options.matchTab(item, tab)) && (!keyword || options.searchText(item).toLowerCase().includes(keyword)),
    )
  }, [result.data, tab, query])

  return {
    tab,
    setTab,
    query,
    setQuery,
    list,
    loading: result.isPending,
    filtered: query !== "" || tab !== "all",
    refresh: () => result.refetch(),
    /** 乐观更新本地缓存（删除、状态流转等） */
    update: (updater: (items: T[]) => T[]) => client.setQueryData<T[]>([options.queryKey], (items) => updater(items ?? [])),
  }
}
