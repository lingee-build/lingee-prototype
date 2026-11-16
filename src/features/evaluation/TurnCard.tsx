import { useId, type ReactNode } from "react"
import { Icon } from "@/ui"

export function TurnCard({ number, input, meta, status, actions, open, toggle, children, turnId }: {
  number: number; input: string; meta: string; status: ReactNode; actions?: ReactNode;
  open: boolean; toggle: () => void; children: ReactNode; turnId: string
}) {
  const bodyId = useId()
  return <section className="eval-turn-card" data-turn-id={turnId}>
    <div className="eval-turn-heading">
      <button type="button" className="eval-turn-toggle" aria-expanded={open} aria-controls={bodyId} aria-label={`${open ? "折叠" : "展开"}第 ${number} 轮`} onClick={toggle}>
        <span className="eval-turn-chevron" aria-hidden="true"><Icon name="chevron-right-round" size="small" /></span>
        <span className="eval-grow"><span className="eval-turn-name">第 {number} 轮</span>{!open && <span className="eval-turn-preview">{input.trim().split(/\n/)[0] || "尚未填写用户输入"}</span>}{meta && <span className="eval-turn-meta">{meta}</span>}</span>
        {status}
      </button>
      {actions && <div className="eval-actions">{actions}</div>}
    </div>
    <div id={bodyId} className="eval-turn-body" hidden={!open}>{children}</div>
  </section>
}
