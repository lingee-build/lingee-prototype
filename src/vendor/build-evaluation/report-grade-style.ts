// Shared by the report list and the standalone report renderer.
export const reportGradeStyle = `.report-grade-theme {
  --grade-s: #08684d;
  --grade-s-bg: #d8f8eb;
  --grade-a: #2548bb;
  --grade-a-bg: #e3edff;
  --grade-b: #086378;
  --grade-b-bg: #daf5fa;
  --grade-c: #805000;
  --grade-c-bg: #fff1cc;
  --grade-d: #bd1938;
  --grade-d-bg: #ffe6ee;
}
@media(prefers-color-scheme:dark) {
  :root:not([data-color-scheme="light"]) .report-grade-theme {
    --grade-s:#8debc8; --grade-s-bg:#173d32;
    --grade-a:#b4cbff; --grade-a-bg:#222f53;
    --grade-b:#9de3ef; --grade-b-bg:#163b45;
    --grade-c:#ffdb8a; --grade-c-bg:#493719;
    --grade-d:#ffadc4; --grade-d-bg:#4b2434;
  }
}
:root[data-color-scheme="dark"] .report-grade-theme {
    --grade-s:#8debc8; --grade-s-bg:#173d32;
    --grade-a:#b4cbff; --grade-a-bg:#222f53;
    --grade-b:#9de3ef; --grade-b-bg:#163b45;
    --grade-c:#ffdb8a; --grade-c-bg:#493719;
    --grade-d:#ffadc4; --grade-d-bg:#4b2434;
}
:where(.report-grade-theme) .grade {display:inline-block;min-width:28px;text-align:center;padding:2px 7px;border-radius:5px;font-weight:700;font-size:13px;color:var(--grade-ink,var(--text-secondary));background:var(--grade-fill,var(--bg))}
:where(.report-grade-theme) .grade-S {--grade-ink:var(--grade-s);--grade-fill:var(--grade-s-bg)}
:where(.report-grade-theme) .grade-A {--grade-ink:var(--grade-a);--grade-fill:var(--grade-a-bg)}
:where(.report-grade-theme) .grade-B {--grade-ink:var(--grade-b);--grade-fill:var(--grade-b-bg)}
:where(.report-grade-theme) .grade-C {--grade-ink:var(--grade-c);--grade-fill:var(--grade-c-bg)}
:where(.report-grade-theme) .grade-D {--grade-ink:var(--grade-d);--grade-fill:var(--grade-d-bg)}
`
