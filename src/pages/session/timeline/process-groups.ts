import type { Part } from '@/mock/types'

/** React adaptation of kcode-ui/message-part.tsx stageParts + mergeReasoningRuns. */
export type ProcessGroup = { key: string; type: 'stage' | 'reasoning' | 'part'; parts: Part[] }
export function stageParts(parts: Part[]): ProcessGroup[] {
  const result: ProcessGroup[] = []
  let tools: Part[] = []
  let thinking: Part[] = []
  const flush = () => {
    if (!tools.length) return
    result.push({ key: tools.find(p => p.type === 'tool')!.id, type: tools.length > 1 || tools.some(p => p.type === 'tool' && p.stageGroup) ? 'stage' : 'part', parts: tools })
    tools = []
  }
  const flushThinking = () => {
    if (!thinking.length) return
    result.push({ key: thinking[0].id, type: 'reasoning', parts: thinking })
    thinking = []
  }
  for (const part of parts) {
    if (part.type === 'reasoning') { thinking.push(part); continue }
    if (part.type === 'tool') { tools.push(...thinking, part); thinking = []; continue }
    if (tools.length) { tools.push(...thinking); thinking = [] }
    flush()
    flushThinking()
    result.push({ key: part.id, type: 'part', parts: [part] })
  }
  if (tools.length && thinking.length) { tools.push(...thinking); thinking = [] }
  flush()
  flushThinking()
  return result
}
export const isContextTool = (p: Part): boolean => p.type === 'tool' && ['read', 'grep', 'websearch'].includes(p.tool)
export function contextRuns(parts: Part[]): Part[][] {
  const result: Part[][] = []
  for (const part of parts) {
    const last = result.at(-1)
    if (last && ((isContextTool(part) && last.every(isContextTool)) || (part.type === 'reasoning' && last.every(p => p.type === 'reasoning')))) result[result.length - 1].push(part)
    else result.push([part])
  }
  return result
}
export function splitFinalParts(parts: Part[], streaming = false) {
  // Keep each streaming paragraph in one DOM location until the turn finishes.
  if (streaming) return { process: parts, final: [] as Part[] }
  const lastProcess = parts.findLastIndex(p => p.type !== 'text')
  return { process: parts.slice(0, lastProcess + 1), final: parts.slice(lastProcess + 1) }
}
