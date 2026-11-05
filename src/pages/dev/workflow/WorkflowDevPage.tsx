import { BrandButton, CapsuleTag, ConfirmDialog, DropdownMenu, Empty, Icon, Tile, showToast, useDialog, type IconName } from "@/ui"
import { useT } from "@/i18n"
import type { Workflow } from "@/mock/fixtures/workflows"
import { workflowService } from "@/services/workflow"
import { DEV_GRID, DOT_BUTTON, DevPageLayout } from "@/features/dev-page/DevPageLayout"
import { useDevList } from "@/features/dev-page/use-dev-list"
import { cx } from "@/lib/cx"
import { useRef, useState } from "react"
import { WorkflowFormDialog } from "./WorkflowFormDialog"
import { useStartSession } from "@/features/dev-page/use-start-session"
import { useOpenWorkflow } from "@/features/workflow/use-open-workflow"
import { WORKFLOW_CREATOR } from "@/mock/fixtures/workflow-cases"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { parseDsl } from "@/features/workflow/dsl"

/** 状态页签与智能体开发列表对齐（方案 5.1 / 10.1） */
const TABS = ["all", "saved", "submitted", "published", "rejected"]

const formatDate = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 工作流开发页：与技能 / 智能体开发页共用页面壳和卡片；点卡片进入关联会话并在右侧打开画布 */
export function WorkflowDevPage() {
  const t = useT()
  const open = useOpenWorkflow()
  const data = useDevList<Workflow>({
    queryKey: "workflows",
    fetch: workflowService.list,
    matchTab: (item, tab) => item.status === tab,
    searchText: (item) => `${item.name} ${item.desc}`,
  })
  const list = [...data.list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const names = (data.list.length ? data.list : []).map((x) => x.name)

  // 新建：与技能 / 智能体开发一致，进入新任务页并选中 workflow-builder，通过对话设计工作流
  const startSession = useStartSession()
  const create = () => startSession(`/${WORKFLOW_CREATOR} `)

  // 导入：读入 DSL（「导出定义」生成的 JSON），新建一条「已保存」的工作流
  const file = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const importDsl = async (picked: File) => {
    setImporting(true)
    try {
      const dsl = parseDsl(await picked.text())
      const item = await workflowService.importDsl({ ...dsl, name: dsl.name || picked.name.replace(/\.json$/i, "") })
      data.refresh()
      showToast({ variant: "success", title: t("proto.workflowDev.imported", { name: item.name }) })
    } catch (error) {
      showToast({ variant: "error", title: t("proto.wf.importFailed"), description: error instanceof Error ? error.message : undefined })
    } finally {
      setImporting(false)
    }
  }

  return (
    <DevPageLayout
      title={t("proto.workflowDev.pageTitle")}
      searchWrapperStyle={{ background: "color-mix(in srgb, var(--surface-raised-stronger-non-alpha) 64%, transparent)" }}
      addLabel={t("proto.workflowDev.add")}
      onAdd={create}
      addBeforeAction={
        <>
          <BrandButton
            variant="secondary"
            size="normal"
            icon="submit-upload"
            iconSize="xs"
            disabled={importing}
            className="[&_[data-component=icon]]:!w-[14px] [&_[data-component=icon]]:!h-[14px] [--brand-button-secondary-hover:#6D80FF]"
            onClick={() => file.current?.click()}
          >
            {t("proto.workflowDev.import")}
          </BrandButton>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const picked = e.currentTarget.files?.[0]
              if (picked) void importDsl(picked)
              e.currentTarget.value = ""
            }}
          />
        </>
      }
      tabs={TABS.map((value) => ({ value, label: t(`proto.workflowDev.tab.${value}`) }))}
      tab={data.tab}
      onTabChange={data.setTab}
      searchValue={data.query}
      onSearchChange={data.setQuery}
      onRefresh={data.refresh}
      searchPlaceholder={t("proto.workflowDev.search")}
    >
      {list.length === 0 ? (
        !data.loading && (
          <div className="flex-1 flex items-center justify-center p-2">
            <Empty description={data.filtered ? t("proto.workflowDev.empty.noMatch") : t("proto.workflowDev.empty")} />
          </div>
        )
      ) : (
        <div className={DEV_GRID}>
          {list.map((item) => (
            <Tile
              key={item.id}
              className="dev-page-tile tile-filled tile-icon-40 group cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={t("proto.workflowDev.open", { name: item.name })}
              onClick={() => void open(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void open(item)
              }}
              icon={<DynamicSkillIcon name={item.name} size={40} />}
              name={item.name}
              desc={item.desc || t("proto.workflowDev.noDesc")}
              status={item.status}
              reason={item.rejectReason}
              footer={
                <>
                  {workflowService.nodeCount(item.id) !== undefined && <CapsuleTag className="shrink-0 whitespace-nowrap">{t("proto.workflowDev.nodeCount", { count: workflowService.nodeCount(item.id)! })}</CapsuleTag>}
                  <span className="text-[12px] leading-4 text-[var(--text-weaker)] truncate">
                    {t("proto.workflowDev.updatedAt", { time: formatDate(item.updatedAt) })}
                  </span>
                </>
              }
              action={<WorkflowCardActions workflow={item} names={names} onChanged={() => void data.refresh()} />}
            />
          ))}
        </div>
      )}
    </DevPageLayout>
  )
}

/** 卡片右上角「…」菜单：设计 / 编辑信息 / 复制 / 删除；悬停卡片才出现 */
function WorkflowCardActions(props: { workflow: Workflow; names: string[]; onChanged: () => void }) {
  const t = useT()
  const openWorkflow = useOpenWorkflow()
  const dialog = useDialog()
  const [open, setOpen] = useState(false)
  const { workflow } = props

  const item = (icon: IconName, label: string, onSelect: () => void) => (
    <DropdownMenu.Item className="flex items-center cursor-pointer gap-1" onSelect={onSelect}>
      <Icon name={icon} size="small" />
      <span>{label}</span>
    </DropdownMenu.Item>
  )

  const edit = () =>
    dialog.show(() => (
      <WorkflowFormDialog
        workflow={workflow}
        existingNames={props.names}
        onSubmit={async (input) => {
          await workflowService.update(workflow.id, { name: input.name, desc: input.desc })
          props.onChanged()
          showToast({ variant: "success", title: t("proto.workflowDev.saved") })
        }}
      />
    ))

  const duplicate = async () => {
    const copy = await workflowService.duplicate(workflow.id)
    props.onChanged()
    if (copy) showToast({ variant: "success", title: t("proto.workflowDev.duplicated", { name: copy.name }) })
  }

  const remove = () =>
    dialog.show(() => (
      <ConfirmDialog
        title={t("proto.workflowDev.deleteTitle")}
        description={t("proto.workflowDev.deleteDesc", { name: workflow.name })}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        variant="danger"
        onConfirm={async () => {
          await workflowService.remove(workflow.id)
          props.onChanged()
          showToast({ variant: "success", title: t("proto.workflowDev.deleted") })
        }}
      />
    ))

  return (
    <div
      className={cx(
        "flex items-center transition-opacity duration-150",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu placement="bottom-start" open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger aria-label={t("proto.agentConfig.moreActions")} className={DOT_BUTTON}>
          <Icon name="dot-grid" size="small" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content style={{ minWidth: 112 }}>
            {item("git-branch-network", t("proto.workflowDev.menu.design"), () => void openWorkflow(workflow))}
            {item("edit-doc-16", t("proto.workflowDev.menu.edit"), edit)}
            {item("doc-copy", t("proto.workflowDev.menu.duplicate"), () => void duplicate())}
            <DropdownMenu.Item onSelect={remove} className="group/delete flex items-center cursor-pointer gap-1" variant="destructive">
              <Icon name="trash-16" size="small" className="group-hover/delete:text-[var(--text-on-error-base)]" />
              <span className="group-hover/delete:text-[var(--text-on-error-base)]">{t("common.delete")}</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}
