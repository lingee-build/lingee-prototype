import { renderCardIcons } from "@/vendor/kcode-ui/assets/render-card-icons"
import { useT } from "@/i18n"
import { Icon } from "../icon/Icon"
import workflowIcon from "./workflow-card-icon.svg"

import { split, type Segment } from "@/vendor/kcode-ui/components/render-block"
export type { Segment }

/**
 * 原型新增的产物类型。线上解析器（vendor，同步文件不能改）只认白名单里的 kind，
 * 这里先切出原型类型的卡片，其余文本仍交给线上解析器。
 */
const PROTO_CARD = /:::render:(kd-workflow-change|kd-workflow)\s*(\{[^{}]*\})\s*:::/g

export function splitRenderBlocks(text: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  for (const match of text.matchAll(PROTO_CARD)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push(...split(text.slice(cursor, index)))
    try {
      segments.push({ type: "render", kind: match[1], config: JSON.parse(match[2]) as Record<string, string> })
    } catch {
      segments.push({ type: "text", content: match[0] })
    }
    cursor = index + match[0].length
  }
  if (cursor < text.length) segments.push(...split(text.slice(cursor)))
  return segments
}

const DESC_KEYS: Record<string, string> = {
  kdform: "ui.renderCard.desc.kdform",
  kwcform: "ui.renderCard.desc.kwcform",
  "ai-partner": "ui.renderCard.desc.ai-partner",
  kdskill: "ui.renderCard.desc.kdskill",
  kdapp: "ui.renderCard.desc.kdform",
  "kdapp-prototype": "ui.renderCard.desc.kdappPrototype",
  kdapi: "ui.renderCard.desc.kdform",
  "kdapp-artifact": "ui.renderCard.desc.kdappArtifact",
  kdstandalone: "ui.renderCard.desc.kdstandalone",
  "kd-digital-employee": "ui.renderCard.desc.kd-digital-employee",
  "kd-expert-team": "ui.renderCard.desc.kd-expert-team",
}

/** kind → 图标：不同产物用不同图标，认不出的兜底 general */
const KIND_ICON_MAP: Record<string, string> = {
  kdskill: renderCardIcons.skillDev,
  "ai-partner": renderCardIcons.agentDev,
  "kdapp-prototype": renderCardIcons.prototype,
  kdapp: renderCardIcons.appDev,
  kdform: renderCardIcons.cosmicDev,
  kwcform: renderCardIcons.cosmicDev,
  kdapi: renderCardIcons.cosmicDev,
  "kdapp-artifact": renderCardIcons.componentDev,
  kdstandalone: renderCardIcons.general,
  "kd-digital-employee": renderCardIcons.agentDev,
  "kd-expert-team": renderCardIcons.agentDev,
  // 原型新增：工作流
  "kd-workflow": workflowIcon,
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.875 10.0123C1.8751 9.55216 2.24816 9.17898 2.70833 9.17898H15.2824L11.285 5.17179C10.9602 4.84597 10.9609 4.31839 11.2866 3.9934C11.6124 3.66861 12.14 3.66941 12.465 3.99503L17.8817 9.42312C18.0377 9.57953 18.1252 9.79218 18.125 10.0131C18.1247 10.2341 18.0364 10.4462 17.88 10.6023L12.4634 16.0068C12.1376 16.3317 11.61 16.3309 11.285 16.0052C10.9602 15.6794 10.9609 15.1518 11.2866 14.8268L15.2767 10.8457H2.70833C2.24817 10.8457 1.87511 10.4725 1.875 10.0123Z"
        fill="currentColor"
      />
    </svg>
  )
}

export type CardClick = (kind: string, config: Record<string, string>) => void

/**
 * 会话里的「产物卡片」：模型回复里的 :::render:kind {json}::: 指令渲染成一张可点击的卡片。
 * 技能 / 智能体卡片带「本地测试」，业务组件卡片（预览阶段）带「预览」「详情」。
 * 结构对齐 kcode-ui 的 render-card。
 */
export function RenderCard(props: {
  kind: string
  config: Record<string, string>
  localTestDisabled?: boolean
  disabled?: boolean
  onCardClick?: CardClick
}) {
  const t = useT()
  const { kind, config } = props
  const isPreview = kind === "kdapp-artifact" && config.phase === "preview"
  const hasStandalonePreview = kind === "kdstandalone" && !!config.url
  const stop = (run: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    run()
  }

  return (
    <div
      data-component="render-card"
      data-preview={isPreview ? "" : undefined}
      data-disabled={props.disabled ? "" : undefined}
      aria-disabled={props.disabled ? "true" : undefined}
      onClick={() => !props.disabled && props.onCardClick?.(kind, config)}
    >
      <div data-slot="render-card-icon">
        <img src={KIND_ICON_MAP[kind] ?? renderCardIcons.general} alt="" draggable={false} />
      </div>
      <div data-slot="render-card-body">
        <span data-slot="render-card-title">{config.title ?? config.displayName ?? ""}</span>
        <span data-slot="render-card-desc">{config.desc || config.description || t(DESC_KEYS[kind] ?? DESC_KEYS.kdform)}</span>
      </div>
      {kind === "kdapp" && (
        <span data-slot="render-card-confirm" onClick={stop(() => props.onCardClick?.("kdapp-confirm", config))}>
          {t("ui.renderCard.confirm")}
        </span>
      )}
      {isPreview && (
        <>
          <span data-slot="render-card-preview-toggle" onClick={stop(() => props.onCardClick?.("kdapp-preview-start", config))}>
            {t("ui.renderCard.previewStart")}
          </span>
          <span data-slot="render-card-detail" onClick={stop(() => props.onCardClick?.("kdapp-artifact", config))}>
            {t("ui.renderCard.detail")}
          </span>
        </>
      )}
      {hasStandalonePreview && (
        <span data-slot="render-card-preview-toggle" onClick={stop(() => props.onCardClick?.("kdstandalone-preview", config))}>
          {t("ui.renderCard.previewStart")}
        </span>
      )}
      {(kind === "ai-partner" || kind === "kdskill") && (
        <span
          data-slot="render-card-local-test"
          data-disabled={props.localTestDisabled ? "" : undefined}
          aria-disabled={props.localTestDisabled ? "true" : undefined}
          onClick={stop(() => !props.localTestDisabled && props.onCardClick?.(`${kind}-local-test`, config))}
        >
          <Icon name="monitor" size="small" />
          {t("ui.renderCard.localTest")}
        </span>
      )}
      {!isPreview && (
        <div data-slot="render-card-arrow">
          <ArrowIcon />
        </div>
      )}
    </div>
  )
}
