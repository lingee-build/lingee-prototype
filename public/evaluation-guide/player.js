;(() => {
  const $ = (id) => document.getElementById(id)
  const steps = ["background", "local", "enter", "draft", "run", "report", "repair", "retest", "end"]
  const starts = [0, 16, 36, 49, 76, 94, 122, 151, 174]
  const captions = ["goal", "cLocal", "cEnter", "cDraft", "cRun", "cReport", "cRepair", "cRetest", "value"]
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    )
  const tr = (key) => escape(text(key))
  const p = (key) => `<p>${tr(key)}</p>`
  const button = (key, target) => `<button class="primary action" data-target="${target}">${tr(key)}</button>`
  const rows = (wrong) =>
    `<div class="answer-lines"><div>${tr("tea")}<b>${tr("unit")}</b></div><div class="${wrong ? "incorrect" : "correct"}">${tr("item")}<b>${tr(wrong ? "money5" : "money4")}</b></div><div>${tr("total")}<b>${tr("money5")}</b></div></div>`
  const panel = (label, body) => `<article><h2>${tr(label)}</h2>${body}</article>`
  const report = (score, id) =>
    `<div class="report-id">${id}</div><div class="score"><strong>${score}</strong><span>/ 100<br>${tr("score")}</span></div><p class="pass">${tr("passed")}</p>`
  const views = [
    () =>
      `<div class="intro"><h1>${tr("background")}</h1>${p("story")}<div class="order">XSDD-240817-000013${rows(false)}</div>${button("local", 16)}</div>`,
    () =>
      panel("user", p("ask") + button("enter", 36)) +
      panel("answer", rows(true) + `<p class="hint">${tr("expected")}：${tr("money4")}</p>`),
    () =>
      panel("local", p("ask") + button("enter", 49)) +
      panel(
        "enter",
        `<div class="linked">✓ ${tr("linked")}</div>${p("cEnter")}${p("sample")}<div class="order">XSDD-240817-000013${rows(false)}</div>`,
      ),
    () =>
      panel("draft", `<div class="bubble">${tr("generate")}</div><p class="hint">${tr("cDraft")}</p>`) +
      panel(
        "case",
        `<h3>${tr("cases")}</h3><small>EC-20261114-0006</small><p class="template">${tr("template")}</p><h3>${tr("sample")}</h3><div class="sample">XSDD-240817-000013${rows(false)}</div>${p("check")}${button("run", 76)}`,
      ),
    () =>
      panel("run", p("model") + p("check") + `<div class="run-track"><i></i></div>${p("running")}`) +
      panel("case", `<h3>${tr("cases")}</h3><small>EC-20261114-0006</small><div class="bubble">${tr("ask")}</div>`),
    () =>
      panel("report", report(91, "ER-20261114-203105") + `<p class="hint">${tr("rule")}</p>` + button("analyze", 122)) +
      panel(
        "expected",
        rows(false) +
          `<h3>${tr("actual")}</h3><div class="mistake">${tr("item")} <b>${tr("money5")}</b></div><div class="evidence">${tr("evidence")}</div>`,
      ),
    (time) =>
      panel(
        "repair",
        `<h3>${tr("cause")}</h3>${p("solution")}${time >= 136 ? `<div class="confirmation">${tr("confirm")}</div>` : ""}${time >= 142 ? `<div class="linked">✓ ${tr("saved")}</div>` : ""}`,
      ) +
      panel(
        "report",
        report(91, "ER-20261114-203105") +
          p("evidence") +
          `<p class="hint">${tr("cRepair")}</p>${time >= 142 ? button("retest", 151) : button("confirm", 136)}`,
      ),
    (time) =>
      panel("before", report(91, "ER-20261114-203105") + rows(true)) +
      panel(
        "after",
        time < 158
          ? `${p("running")}<div class="run-track"><i></i></div>`
          : report(100, "ER-20261114-203710") + rows(false) + `<p class="hint">${tr("same")}</p>`,
      ),
    () =>
      `<div class="intro"><h1>${tr("closing")}</h1><p class="closing-value">${tr("value")}</p><div class="result">91 <span>→</span> 100</div>${p("limit")}${button("replay", 0)}</div>`,
  ]
  $("steps").setAttribute("aria-label", text("title"))
  document.title = text("title")
  $("title").textContent = text("title")
  $("notice").textContent = text("notice")
  $("object").textContent = text("object")
  for (const key of ["restart", "prev", "next"]) $(key).textContent = text(key === "restart" ? "replay" : key)
  $("seek").setAttribute("aria-label", text("progress"))
  $("steps").innerHTML = steps
    .slice(1, 8)
    .map((key, i) => `<button data-step="${i + 1}">${i + 1}. ${tr(key)}</button>`)
    .join("")
  let time = 0,
    playing = false,
    last = 0,
    previous = ""
  const index = () => starts.findLastIndex((start) => time >= start)
  const clock = (n) =>
    `${Math.floor(n / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(n % 60)
      .toString()
      .padStart(2, "0")}`
  function render() {
    const i = index()
    $("eval-cinema").dataset.playing = String(playing)
    const version = `${i}:${i === 6 ? (time >= 142 ? 2 : time >= 136 ? 1 : 0) : i === 7 ? (time >= 158 ? 1 : 0) : 0}`
    if (previous !== version) {
      $("scene").innerHTML = views[i](time)
      $("scene").className = i === 0 || i === 8 ? "single" : ""
      $("phase").textContent = text(steps[i])
      $("caption").textContent = text(captions[i])
      previous = version
      document.querySelectorAll("[data-step]").forEach((el) => {
        el.setAttribute("aria-current", Number(el.dataset.step) === i ? "step" : "false")
      })
    }
    $("play").textContent = text(playing ? "pause" : "play")
    $("play").setAttribute("aria-pressed", String(playing))
    $("seek").value = time
    $("clock").textContent = `${clock(time)} / 03:00`
    $("prev").disabled = i === 0
    $("next").disabled = i === 8
  }
  function jump(value, play = false) {
    time = Math.max(0, Math.min(180, value))
    playing = play
    last = 0
    render()
  }
  function toggle() {
    if (time >= 180) time = 0
    playing = !playing
    last = 0
    render()
  }
  $("play").onclick = toggle
  $("restart").onclick = () => jump(0, true)
  $("prev").onclick = () => jump(starts[Math.max(0, index() - 1)])
  $("next").onclick = () => jump(starts[Math.min(8, index() + 1)])
  $("seek").oninput = (event) => jump(Number(event.target.value))
  $("steps").onclick = (event) => {
    const el = event.target.closest("[data-step]")
    if (el) jump(starts[Number(el.dataset.step)])
  }
  $("scene").onclick = (event) => {
    const el = event.target.closest("[data-target]")
    if (el) jump(Number(el.dataset.target), true)
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      parent.postMessage({ type: "lingee-evaluation-guide", action: "escape" }, "*")
      return
    }
    if (event.target.closest("button,input")) return
    if (event.code === "Space") {
      event.preventDefault()
      toggle()
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      $("next").click()
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      $("prev").click()
    }
  })
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      playing = false
      last = 0
      render()
    }
  })
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.type !== "lingee-evaluation-guide") return
    const action = event.data.action
    if (action === "pause") {
      playing = false
      render()
    }
    if (action === "replay") jump(0, true)
    if (action === "dark" || action === "light") document.documentElement.style.colorScheme = action
  })
  function tick(now) {
    if (playing && !document.hidden) {
      if (last) time = Math.min(180, time + Math.min((now - last) / 1000, 0.25))
      if (time === 180) playing = false
      render()
    }
    last = now
    requestAnimationFrame(tick)
  }
  render()
  requestAnimationFrame(tick)
  parent.postMessage({ type: "lingee-evaluation-guide", action: "ready" }, "*")
})()
