import { useEffect, useState, type CSSProperties } from 'react'

/** Direct React port of kcode-ui/components/text-shimmer.tsx. */
export function TextShimmer({ text, active = true, offset = 0 }: { text: string; active?: boolean; offset?: number }) {
  const [run, setRun] = useState(active)
  useEffect(() => {
    if (active) { setRun(true); return }
    const timer = setTimeout(() => setRun(false), 220)
    return () => clearTimeout(timer)
  }, [active])
  return <span data-component="text-shimmer" data-active={active ? 'true' : 'false'} aria-label={text} style={{ '--text-shimmer-swap': '220ms', '--text-shimmer-index': offset } as CSSProperties}>
    <span data-slot="text-shimmer-char"><span data-slot="text-shimmer-char-base" aria-hidden="true">{text}</span><span data-slot="text-shimmer-char-shimmer" data-run={run ? 'true' : 'false'} aria-hidden="true">{text}</span></span>
  </span>
}
