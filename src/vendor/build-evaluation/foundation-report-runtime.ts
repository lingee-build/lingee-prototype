// Fixed offline report script. Model output is only read as text or numeric chart data.
export const reportRuntime = `
const tocTooltip = document.createElement("div");
tocTooltip.className = "toc-tooltip";
tocTooltip.setAttribute("aria-hidden", "true");
tocTooltip.hidden = true;
document.body.append(tocTooltip);

function showTocTooltip(event) {
  const link = event.target.closest(".sidebar .toc-link");
  if (!link || link.scrollWidth <= link.clientWidth) return;
  tocTooltip.textContent = link.textContent;
  tocTooltip.hidden = false;
  const anchor = link.getBoundingClientRect();
  const width = tocTooltip.offsetWidth;
  const height = tocTooltip.offsetHeight;
  const right = document.documentElement.clientWidth - 8;
  const below = anchor.bottom + 6;
  tocTooltip.style.left = Math.max(8, Math.min(anchor.left, right - width)) + "px";
  tocTooltip.style.top = Math.max(8, below + height <= window.innerHeight - 8
    ? below : anchor.top - height - 6) + "px";
}

function hideTocTooltip() {
  tocTooltip.hidden = true;
}

const toc = document.querySelector(".sidebar");
toc.addEventListener("pointerover", showTocTooltip);
toc.addEventListener("pointerout", hideTocTooltip);
toc.addEventListener("focusin", showTocTooltip);
toc.addEventListener("focusout", hideTocTooltip);
toc.addEventListener("click", hideTocTooltip);
document.addEventListener("scroll", hideTocTooltip, true);
window.addEventListener("resize", hideTocTooltip);
const tocButton = toc.querySelector(".report-toc-fab");
let tocPinned = false;
let tocCloseTimer;
function closeFloatingToc() {
  clearTimeout(tocCloseTimer);
  tocPinned = false;
  if (tocButton?.getAttribute("aria-expanded") !== "true") return false;
  tocButton.setAttribute("aria-expanded", "false");
  return true;
}
tocButton?.addEventListener("pointerenter", event => {
  if (event.pointerType === "mouse") tocButton.setAttribute("aria-expanded", "true");
});
toc.addEventListener("pointerenter", () => clearTimeout(tocCloseTimer));
toc.addEventListener("pointerleave", event => {
  if (event.pointerType !== "mouse" || tocPinned) return;
  clearTimeout(tocCloseTimer);
  tocCloseTimer = setTimeout(() => {
    if (!tocPinned && !toc.querySelector(".toc-sections")?.contains(document.activeElement)) closeFloatingToc();
  }, 220);
});
toc.addEventListener("focusout", event => {
  if (!tocPinned && !toc.matches(":hover") && !toc.contains(event.relatedTarget)) closeFloatingToc();
});
tocButton?.addEventListener("click", event => {
  if (tocPinned || (event.detail === 0 && tocButton.getAttribute("aria-expanded") === "true")) {
    closeFloatingToc();
    return;
  }
  clearTimeout(tocCloseTimer);
  tocPinned = true;
  tocButton.setAttribute("aria-expanded", "true");
});
document.addEventListener("pointerdown", event => {
  if (!toc.contains(event.target)) closeFloatingToc();
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  hideTocTooltip();
  if (closeFloatingToc() && toc.contains(document.activeElement)) tocButton.focus();
});

const charts = new Map();
function renderCharts() {
  const theme = getComputedStyle(document.documentElement);
  Chart.defaults.color = theme.getPropertyValue("--text-secondary").trim();
  Chart.defaults.borderColor = theme.getPropertyValue("--border").trim();
  for (const canvas of document.querySelectorAll("canvas[data-chart]")) {
    const config = JSON.parse(canvas.dataset.chart);
    const signature = canvas.dataset.chart + Chart.defaults.color + Chart.defaults.borderColor;
    const previous = charts.get(canvas.id);
    if (previous && previous.canvas === canvas && previous.signature === signature) continue;
    previous?.instance.destroy();
    charts.set(canvas.id, {canvas, signature, instance: new Chart(canvas, config)});
  }
}
document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  const target = document.getElementById(link.getAttribute("href").slice(1));
  if (!target) return;
  for (let node = target; node; node = node.parentElement) {
    if (node.tagName === "DETAILS") node.open = true;
  }
  closeFloatingToc();
  for (const entry of document.querySelectorAll("nav a")) {
    if (entry.hash === link.hash) entry.setAttribute("aria-current","location");
    else entry.removeAttribute("aria-current");
  }
  target.tabIndex = -1;
  target.focus({preventScroll:true});
  target.scrollIntoView({block:"start"});
});
document.addEventListener("click", event => {
  const entry = event.target.closest("[data-eval-session]");
  if (!entry) return;
  // 入口位于用例卡 summary 内，必须阻止默认行为，否则回看会顺带折叠该用例。
  event.preventDefault();
  if (window.parent !== window) window.parent.postMessage({type:"evaluation-session-open", sessionId: entry.dataset.evalSession},"*");
});
let issueFilter = "all";
let elapsedTimer;
function updateElapsedClock() {
  clearInterval(elapsedTimer);
  const value = document.querySelector("[data-elapsed-since]");
  if (!value) return;
  const startedAt = Number(value.dataset.elapsedSince);
  if (!Number.isFinite(startedAt)) return;
  const tick = () => {
    value.textContent = (Math.max(0, Date.now() - startedAt) / 1000).toFixed(1);
  };
  tick();
  elapsedTimer = setInterval(tick, 1000);
}
function applyIssueFilter(root) {
  const buttons = Array.from(root.querySelectorAll("[data-issue-filter]"));
  if (!buttons.some(button => button.dataset.issueFilter === issueFilter)) issueFilter = "all";
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.issueFilter === issueFilter));
  }
  for (const card of root.querySelectorAll("[data-issue-priority]")) {
    card.hidden = issueFilter !== "all" && card.dataset.issuePriority !== issueFilter;
  }
}
document.addEventListener("click", event => {
  const button = event.target.closest("[data-issue-filter]");
  if (!button) return;
  issueFilter = button.dataset.issueFilter;
  applyIssueFilter(document);
});
if (window.parent !== window && document.body.classList.contains("embedded")) {
  window.addEventListener("message", event => {
    if (event.source !== window.parent) return;
    if (event.data?.type === "evaluation-focus-case") {
      const index = event.data.index;
      if (!Number.isSafeInteger(index) || index < 0) return;
      const card = document.getElementById("case-" + index);
      if (!card?.matches("details.case-card")) return;
      card.open = true;
      card.querySelector("summary")?.focus({preventScroll:true});
      card.scrollIntoView({block:"start"});
      return;
    }
    if (event.data?.type === "evaluation-focus-session") {
      const button = Array.from(document.querySelectorAll("[data-eval-session]"))
        .find(entry => entry.dataset.evalSession === event.data.sessionId);
      if (!button) return;
      const card = button.closest("details.case-card");
      if (card) card.open = true;
      button.focus({preventScroll:true});
      button.scrollIntoView({block:"center"});
      return;
    }
    if (event.data?.type !== "evaluation-preview") return;
    const next = new DOMParser().parseFromString(event.data.body,"text/html");
    const main = document.querySelector("main");
    const replacement = next.querySelector("main");
    if (!main || !replacement) return;
    const currentScroll = window.scrollY;
    const open = new Map(Array.from(main.querySelectorAll("details")).map(el => [el.id || el.querySelector("summary")?.textContent,el.open]));
    for (const el of replacement.querySelectorAll("details")) {
      const key = el.id || el.querySelector("summary")?.textContent;
      if (open.has(key)) el.open = open.get(key);
    }
    const focusedFilter = document.activeElement?.dataset.issueFilter;
    applyIssueFilter(replacement);
    main.replaceWith(replacement);
    updateElapsedClock();
    if (focusedFilter) {
      replacement.querySelector('[data-issue-filter="' + issueFilter + '"]')?.focus({preventScroll:true});
    }
    renderCharts();
    window.scrollTo(0,currentScroll);
  });
  updateElapsedClock();
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderCharts);
renderCharts();`

export const runtimeIntegrity = "sha256-01s0ojJfMPMIjFErED7RukUJMgpMPLK1GmGdBAQZuxE="
