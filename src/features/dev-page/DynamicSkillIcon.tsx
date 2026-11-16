const COLORS = [
  { text: "#2970FF", bg: "#E9EDFF" },
  { text: "#7C5CFC", bg: "#F3E8FF" },
  { text: "#FF8F1F", bg: "#FEF3C7" },
  { text: "#04B545", bg: "#D1FAE5" },
  { text: "#F12234", bg: "#FFE4E6" },
  { text: "#2970FF", bg: "#E0F2FE" },
]

function hash(name: string) {
  return Array.from(name).reduce((h, ch) => (((h << 5) + h) ^ ch.charCodeAt(0)) >>> 0, 5381)
}

/** 按名称生成的文字头像：取首字，颜色由名称哈希决定（同名永远同色） */
export function DynamicSkillIcon(props: { name: string; size?: number }) {
  const size = props.size ?? 40
  const color = COLORS[hash(props.name) % COLORS.length]
  const first = props.name.trim().charAt(0)
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.29),
        backgroundColor: color.bg,
        border: "1px solid rgba(0,0,0,0.03)",
        boxSizing: "border-box",
        color: color.text,
        fontSize: Math.round(size * 0.5),
        fontWeight: 500,
        flexShrink: 0,
        userSelect: "none",
        lineHeight: 1,
        letterSpacing: "-0.5px",
      }}
    >
      {first ? first.toUpperCase() : "S"}
    </div>
  )
}
