import { DropdownMenu, Icon, Tooltip, type IconName } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { useT } from "@/i18n"
import { useLayout, type GroupByMode } from "@/stores/layout"
import { useSync } from "@/stores/sync"

const ICON_BUTTON =
  "flex items-center justify-center cursor-pointer hover:bg-[var(--neutral-100)] transition-colors w-7 h-7 rounded-[8px] hover:[--icon-fill:var(--neutral-900)]"
const SUB_TRIGGER = "flex w-full cursor-pointer h-9 py-0 px-1 align-items-center gap-1 rounded-[16px] border-none"
const SUB_LABEL = "flex-1 text-left text-[var(--neutral-700)] text-[14px] font-[400] leading-[22px]"
const SUB_VALUE = "text-[var(--neutral-500)] text-[12px] font-[400] leading-[18px]"
const GROUP_MODES: GroupByMode[] = ["project", "date", "none"]

function HeaderButton(props: { tip: string; icon: IconName; onClick: () => void }) {
  return (
    <Tooltip value={props.tip} placement="top">
      <button type="button" className={ICON_BUTTON} onClick={props.onClick}>
        <Icon name={props.icon} size="small" className="pointer-events-none" />
      </button>
    </Tooltip>
  )
}

/** 「项目」标题行：搜索会话 / 新增项目 / 显示设置（分组方式 + 项目筛选） */
export function ProjectsHeader(props: { onSearch: () => void; onCreateProject: () => void; onImportProject: () => void }) {
  const t = useT()
  const projects = useSync((s) => s.projects)
  const { groupBy, setGroupBy, selectedProjects, setSelectedProjects } = useLayout()

  const toggleProject = (id: string) => {
    const current = selectedProjects ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setSelectedProjects(next.length === 0 || next.length === projects.length ? null : next)
  }

  return (
    <div className="shrink-0 px-2 pl-4" style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between h-8">
        <span className="text-[var(--neutral-500)] text-[12px] font-[500] leading-[18px]">{t("kcode.nav.projects")}</span>
        <div className="flex items-center gap-1">
          <HeaderButton tip={t("kcode.nav.search")} icon="search-16" onClick={props.onSearch} />
          <DropdownMenu placement="bottom-start">
            <DropdownMenu.Trigger className={ICON_BUTTON} aria-label="添加项目"><Icon name="directory" size="small" /></DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content style={{ minWidth: 180 }}>
                <DropdownMenu.Item className="cursor-pointer" onSelect={props.onCreateProject}>新建空项目</DropdownMenu.Item>
                <DropdownMenu.Item className="cursor-pointer" onSelect={props.onImportProject}>添加已有项目（示例）</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
          <DropdownMenu placement="bottom-start">
            <Tooltip value={t("kcode.nav.displaySettings")} placement="top">
              <DropdownMenu.Trigger className={ICON_BUTTON}>
                <Icon name="side-list" size="small" className="pointer-events-none" />
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Portal>
              <DropdownMenu.Content style={{ minWidth: 180 }}>
                <DropdownMenu.Sub gutter={10}>
                  <DropdownMenu.SubTrigger className={`${SUB_TRIGGER} text-[var(--neutral-600)]`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, flexShrink: 0 }}>
                      <path d={inlinePaths.groupBy1} fill="currentColor" />
                      <path d={inlinePaths.groupBy2} fill="currentColor" />
                      <path fillRule="evenodd" clipRule="evenodd" d={inlinePaths.groupBy3} fill="currentColor" />
                    </svg>
                    <span className={SUB_LABEL}>{t("kcode.nav.groupBy")}</span>
                    <div className="flex align-items-center gap-1">
                      <span className={SUB_VALUE}>{t(`kcode.nav.groupBy.${groupBy}`)}</span>
                      <Icon name="chevron-right-16" size="small" className="text-[var(--neutral-400)]" />
                    </div>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent style={{ minWidth: 140 }}>
                      {GROUP_MODES.map((mode) => (
                        <DropdownMenu.Item key={mode} onSelect={() => setGroupBy(mode)} className="flex items-center cursor-pointer">
                          <span className="flex-1 text-left">{t(`kcode.nav.groupBy.${mode}`)}</span>
                          {groupBy === mode && <Icon name="check" size="small" className="text-[var(--neutral-600)]" />}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>

                <DropdownMenu.Sub gutter={10}>
                  <DropdownMenu.SubTrigger className={SUB_TRIGGER}>
                    <Icon name="folder-16" size="small" className="text-[var(--neutral-600)]" />
                    <span className={SUB_LABEL}>{t("kcode.nav.projects")}</span>
                    <div className="flex align-items-center gap-1">
                      <span className={SUB_VALUE}>
                        {selectedProjects === null
                          ? t("kcode.nav.allProjects")
                          : `${selectedProjects.length}${t("kcode.nav.projectCountSuffix")}`}
                      </span>
                      <Icon name="chevron-right-16" size="small" className="text-[var(--neutral-400)]" />
                    </div>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent style={{ width: 189, minWidth: 189, maxWidth: 189 }}>
                      <DropdownMenu.Item onSelect={() => setSelectedProjects(null)} className="flex items-center cursor-pointer">
                        <span className="flex-1 text-left">{t("kcode.nav.allProjects")}</span>
                        {selectedProjects === null && <Icon name="check" size="small" className="text-[var(--neutral-600)]" />}
                      </DropdownMenu.Item>
                      {projects.map((project) => (
                        <DropdownMenu.Item
                          key={project.id}
                          // 多选：点完不收起菜单
                          onSelect={(e) => {
                            e.preventDefault()
                            toggleProject(project.id)
                          }}
                          className="flex items-center cursor-pointer min-w-0"
                        >
                          <span className="flex-1 text-left truncate" title={project.name}>
                            {project.name}
                          </span>
                          {selectedProjects?.includes(project.id) && <Icon name="check" size="small" className="text-[var(--neutral-600)]" />}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
