import { useEffect, useRef, useState } from 'react'

/** Build 的不透明源沙箱协议；只接受当前 iframe 发出的会话消息。 */
export function ReportPreview({html,focusCaseIndex=-1,onSession}:{html:string;focusCaseIndex?:number;onSession?:(id:string)=>void}) {
  const [initial]=useState(html)
  const displayed = useRef(initial)
  const frame=useRef<HTMLIFrameElement>(null)
  const [ready,setReady]=useState(false)
  useEffect(()=>{
    if (!ready || displayed.current === html) return
    const start=html.indexOf('<main class="main">'), end=html.indexOf('</main>')
    const view = frame.current?.contentWindow
    if (view && start >= 0 && end >= start) {
      view.postMessage({ type: 'evaluation-preview', body: html.slice(start, end + 7) }, '*')
      displayed.current = html
    }
  },[html,ready])
  useEffect(()=>{if(ready && focusCaseIndex>=0)frame.current?.contentWindow?.postMessage({type:'evaluation-focus-case',index:focusCaseIndex},'*')},[focusCaseIndex,ready])
  useEffect(()=>{
    const listener=(e:MessageEvent)=>{if(e.source===frame.current?.contentWindow && e.data?.type==='evaluation-session-open' && typeof e.data.sessionId==='string')onSession?.(e.data.sessionId)}
    window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener)
  },[onSession])
  return <iframe ref={frame} className="eval-report-frame" title="评测报告" sandbox="allow-scripts" srcDoc={initial} onLoad={()=>setReady(true)}/>
}
