import { Icon } from "@/ui"

/** Status glyph copied from ToolStageStatusRow in the production kcode-ui source. */
export function ProcessStatus({ status }: { status: 'running' | 'completed' | 'error' }) {
  return <span data-slot="tool-stage-status-icon" data-status={status} aria-hidden="true">{status === 'completed' ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.76563 4.55094C8.9488 4.28592 9.31237 4.21966 9.57739 4.40283C9.84215 4.58605 9.90853 4.94911 9.7255 5.21403L6.70972 9.57764C6.60913 9.72313 6.4475 9.81509 6.27108 9.82772C6.09471 9.84027 5.9219 9.77223 5.80168 9.64258L4.16561 7.87777C3.94661 7.64153 3.96072 7.2725 4.19694 7.05347C4.43318 6.83447 4.80221 6.84858 5.02124 7.0848L6.16284 8.31584L8.76563 4.55094Z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M6.99967 0.583252C10.5435 0.583252 13.4163 3.45609 13.4163 6.99992C13.4163 10.5437 10.5435 13.4166 6.99967 13.4166C3.45585 13.4166 0.583008 10.5437 0.583008 6.99992C0.583008 3.45609 3.45585 0.583252 6.99967 0.583252ZM6.99967 1.74992C4.10018 1.74992 1.74967 4.10042 1.74967 6.99992C1.74967 9.89941 4.10018 12.2499 6.99967 12.2499C9.89917 12.2499 12.2497 9.89941 12.2497 6.99992C12.2497 4.10042 9.89917 1.74992 6.99967 1.74992Z" fill="currentColor"/></svg> : <Icon name={status === 'error' ? 'action-failed' : 'loading'} size="small" />}</span>
}
export function ProcessChevron({ open }: { open: boolean }) {
  return <span data-slot="tool-stage-chevron" style={{ transform: open ? 'rotate(90deg)' : 'none' }} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="m5.5 3.5 3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
}
