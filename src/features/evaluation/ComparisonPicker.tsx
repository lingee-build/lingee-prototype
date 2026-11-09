import { Button, DropdownMenu, Icon } from "@/ui"
import type { EvalRun } from "@/services/evaluation"
import { runLabelText } from "@/services/evaluation-comparison"

/**
 * 报告列表的对比范围选择器：勾选参与对比的报告（可全选已完成），
 * 勾选后可将其设为基线（基线唯一，卡片第二项对比与它比较）。
 */
export function ComparisonPicker({ dones, poolIds, baselineId, onSelectionChange, onSetBaseline }: {
  dones: EvalRun[]
  poolIds: string[]
  baselineId?: string
  onSelectionChange: (ids: string[] | null) => void
  onSetBaseline: (runId: string) => void
}) {
  const inPool = (id: string) => poolIds.includes(id)
  const allSelected = dones.length > 0 && dones.every(run => inPool(run.id))
  const summary = !poolIds.length ? "未选择报告"
    : allSelected ? `全部已完成（${poolIds.length} 份）`
    : `已选 ${poolIds.length} 份：${poolIds.map(id => { const run = dones.find(item => item.id === id); return run ? runLabelText(run) : id }).join("、")}`
  return (
    <DropdownMenu placement="bottom-start">
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" className="eval-cmp-btn" title={summary}>
          <span className="eval-cmp-label">选择报告对比范围</span>
          <span className="eval-cmp-value">{summary}</span>
          {baselineId && <span className="eval-cmp-base">基线 {runLabelText(dones.find(run => run.id === baselineId)!)}</span>}
          <Icon name="chevron-down" size="small" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="eval-cmp-pop" align="start" sideOffset={6}>
          <div className="eval-cmp-header">参与对比的报告<small>卡片两项对比都从所选范围里取</small></div>
          <label className="eval-check eval-cmp-all">
            <input
              type="checkbox"
              ref={node => { if (node) node.indeterminate = poolIds.length > 0 && !allSelected }}
              disabled={!dones.length}
              checked={allSelected}
              onChange={e => onSelectionChange(e.target.checked ? null : [])}
            />
            全部已完成（{dones.length} 份）
          </label>
          <div className="eval-cmp-list">
            {dones.map(run => {
              const selected = inPool(run.id)
              return (
                <div className="eval-cmp-row" data-on={selected || undefined} key={run.id}>
                  <label className="eval-check">
                    <input type="checkbox" checked={selected}
                      onChange={e => onSelectionChange(e.target.checked ? [...poolIds, run.id] : poolIds.filter(id => id !== run.id))} />
                  </label>
                  <span className="eval-cmp-name" title={runLabelText(run)}>{runLabelText(run)}</span>
                  {selected && (baselineId === run.id
                    ? <span className="eval-cmp-state">基线</span>
                    : <Button variant="ghost" className="eval-cmp-set" onClick={() => onSetBaseline(run.id)}>设为基线</Button>)}
                </div>
              )
            })}
          </div>
          <div className="eval-cmp-footer">
            当前基线：{baselineId ? runLabelText(dones.find(run => run.id === baselineId)!) : "未设置"}
            <small>基线唯一，卡片第二项对比与它比较</small>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
