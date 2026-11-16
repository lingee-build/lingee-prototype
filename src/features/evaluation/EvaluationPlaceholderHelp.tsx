import { useId, useRef, useState } from "react"
import { marked } from "marked"
import { Button, Icon } from "@/ui"
import reference from "@/vendor/build-evaluation/evaluation-placeholder-reference.md?raw"

const [intro, ...sections] = reference.replace(/^# .*\r?\n+/, "").split(/^## /m)
const chapters = sections.map(section => {
  const newline = section.indexOf("\n")
  return { title: section.slice(0, newline).trim(), body: section.slice(newline + 1).trim() }
})
const markdown = (text: string) => ({ __html: marked.parse(text, { async: false }) })

export function EvaluationPlaceholderHelp({ drawer }: { drawer: React.RefObject<HTMLDialogElement | null> }) {
  const id = useId()
  const headings = useRef<(HTMLHeadingElement | null)[]>([])
  const body = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)
  function scrollTo(index: number) {
    const heading = headings.current[index]
    const scroll = body.current
    if (!heading || !scroll) return
    heading.focus({ preventScroll: true })
    scroll.scrollTop += heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20
    setActive(index)
  }
  return <dialog ref={drawer} className="eval-syntax-drawer" aria-labelledby={id} onClose={() => setActive(-1)}>
    <div className="eval-syntax-scrim" aria-hidden="true" onClick={() => drawer.current?.close()} />
    <div className="eval-syntax-panel">
      <header><h2 id={id}><span aria-hidden="true">{"{{...}} "}</span>占位符语法</h2><Button variant="ghost" icon="close" aria-label="关闭" onClick={() => drawer.current?.close()} /></header>
      <nav aria-label="章节导航">
        <div className="eval-syntax-nav-title"><span aria-hidden="true"><Icon name="side-list" size="small" /></span>章节导航</div>
        <div className="eval-syntax-nav-items">{chapters.map((chapter, index) => <Button key={chapter.title} variant="secondary" size="small"
          aria-current={active === index ? "location" : undefined} onClick={() => scrollTo(index)}>{chapter.title}</Button>)}</div>
      </nav>
      <div className="eval-syntax-body" ref={body} tabIndex={0} onScroll={event => {
        const boundary = event.currentTarget.getBoundingClientRect().top + 21
        setActive(headings.current.findLastIndex(heading => !!heading && heading.getBoundingClientRect().top <= boundary))
      }}>
        <div className="eval-syntax-intro"><div data-component="markdown" dangerouslySetInnerHTML={markdown(intro)} /></div>
        {chapters.map((chapter, index) => <section className="eval-syntax-chapter" key={chapter.title}>
          <h3 ref={element => { headings.current[index] = element }} tabIndex={-1}>{chapter.title}</h3>
          <div data-component="markdown" dangerouslySetInnerHTML={markdown(chapter.body)} />
        </section>)}
      </div>
    </div>
  </dialog>
}
