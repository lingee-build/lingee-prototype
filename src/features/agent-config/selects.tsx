import { useId, useRef, useState } from "react"
import { DropdownMenu, Icon } from "@/ui"
import { useT } from "@/i18n"
import type { ModelLevel } from "@/mock/fixtures/dev"
import { domainI18nKeys } from "./form"

const MODEL_LEVELS: ModelLevel[] = ["auto", "fast", "expert", "ultra"]

/** 各档位的图标（自动 / 专家 / 极致是设计稿给的 SVG，快速用图标库里的闪电） */
const LEVEL_PATHS: Partial<Record<ModelLevel, { viewBox: string; d: string[] }>> = {
  auto: {
    viewBox: "0 0 14 14",
    d: [
      "M6.66259 5.32953C7.39897 5.32953 7.99593 5.92648 7.99593 6.66286C7.99585 7.39918 7.39893 7.99619 6.66259 7.99619C5.92633 7.99611 5.32933 7.39912 5.32926 6.66286C5.32926 5.92653 5.92628 5.32961 6.66259 5.32953Z",
      "M8.45491 0.381609C9.96705 -0.152039 11.5678 -0.217758 12.5695 0.783953C13.5712 1.78568 13.5055 3.38639 12.9718 4.89854C12.7685 5.47467 12.4862 6.07276 12.1339 6.67653C12.4863 7.28047 12.7684 7.87888 12.9718 8.45518C13.5054 9.96723 13.571 11.5674 12.5695 12.5691C11.5678 13.5708 9.96706 13.5058 8.45491 12.9721C6.89173 12.4204 5.16391 11.2924 3.61246 9.74098C3.0298 9.15832 2.50703 8.55062 2.05192 7.9363C1.88655 8.26637 1.74795 8.58845 1.6385 8.89854C1.1486 10.2867 1.29692 11.1963 1.72705 11.6264C2.16123 12.0606 3.08428 12.2067 4.49072 11.7019C4.83715 11.5778 5.21923 11.7579 5.34358 12.1043C5.46785 12.4507 5.28761 12.8327 4.94124 12.9571C3.41433 13.5052 1.79489 13.5797 0.784337 12.5691C-0.217357 11.5674 -0.152281 9.9673 0.381343 8.45518C0.584699 7.879 0.866295 7.28035 1.21858 6.67653C0.866406 6.07286 0.584663 5.47457 0.381343 4.89854C-0.152307 3.38639 -0.217385 1.78568 0.784337 0.783953C1.61663 -0.0481782 2.86926 -0.138824 4.10139 0.147234C4.45998 0.230509 4.68392 0.588777 4.60074 0.947364C4.51737 1.3059 4.15854 1.52868 3.79996 1.44541C2.75609 1.20306 2.08154 1.37234 1.72705 1.72666C1.29689 2.15681 1.14854 3.06694 1.6385 4.45518C1.74791 4.76513 1.88664 5.08684 2.05192 5.41676C2.50696 4.80256 3.02993 4.19527 3.61246 3.61273C5.16389 2.0613 6.89175 0.933361 8.45491 0.381609ZM11.6268 1.72731C11.1966 1.29716 10.2865 1.1488 8.89827 1.63877C7.5611 2.11078 5.99758 3.11303 4.55517 4.55544C3.86326 5.24736 3.27287 5.96729 2.79345 6.67653C3.27293 7.3859 3.86312 8.10623 4.55517 8.79828C5.99761 10.2407 7.56109 11.2429 8.89827 11.7149C10.2865 12.2049 11.1966 12.0566 11.6268 11.6264C12.0568 11.1962 12.2045 10.2865 11.7147 8.89854C11.6051 8.58819 11.4662 8.26602 11.3006 7.93564C10.8455 8.54998 10.3234 9.15832 9.74072 9.74098C9.53281 9.94889 9.32205 10.1494 9.10921 10.3412C8.83574 10.5875 8.41425 10.5651 8.1678 10.2918C7.92138 10.0183 7.94317 9.59619 8.21663 9.34971C8.41217 9.17344 8.60648 8.9898 8.79801 8.79828C9.48993 8.10636 10.0797 7.38577 10.5591 6.67653C10.0797 5.96738 9.48984 5.24727 8.79801 4.55544C8.62942 4.38685 8.45872 4.22395 8.28694 4.06716C8.01523 3.81896 7.99596 3.39698 8.24397 3.1251C8.49221 2.85332 8.91414 2.83462 9.18603 3.08278C9.37275 3.25321 9.55788 3.42989 9.74072 3.61273C10.3232 4.19518 10.8456 4.80266 11.3006 5.41676C11.466 5.08674 11.6052 4.76522 11.7147 4.45518C12.2045 3.06727 12.0567 2.15759 11.6268 1.72731Z",
    ],
  },
  expert: {
    viewBox: "0 0 15 14",
    d: [
      "M10.4817 0C11.3096 0 12.0908 0.384789 12.5956 1.04102L14.3801 3.36133C15.1236 4.32795 15.1173 5.67583 14.3638 6.63477L10.0878 12.0768C8.75319 13.7751 6.18017 13.7751 4.84559 12.0768L0.569545 6.63477C-0.183901 5.67583 -0.190285 4.32795 0.553269 3.36133L2.33777 1.04102C2.84256 0.384789 3.62379 0 4.45171 0H10.4817ZM4.45171 1.33333C4.03775 1.33333 3.64681 1.52541 3.39441 1.85352L1.60991 4.17383C1.23814 4.65713 1.24168 5.33108 1.61837 5.81055L5.89376 11.2526C6.69452 12.2717 8.23884 12.2717 9.0396 11.2526L13.315 5.81055C13.6917 5.33108 13.6952 4.65713 13.3235 4.17383L11.5389 1.85352C11.2865 1.52541 10.8956 1.33333 10.4817 1.33333H4.45171ZM9.69454 4.49805C9.97164 4.25581 10.3929 4.28418 10.6353 4.5612C10.8775 4.83829 10.8492 5.25957 10.5721 5.50195L8.43217 7.37435C7.87931 7.85785 7.05406 7.85785 6.50119 7.37435L4.36121 5.50195C4.0842 5.25957 4.05582 4.83829 4.29806 4.5612C4.54045 4.28418 4.96172 4.25581 5.23882 4.49805L7.37879 6.37044C7.42906 6.41443 7.5043 6.41443 7.55457 6.37044L9.69454 4.49805Z",
    ],
  },
  ultra: {
    viewBox: "0 0 14 15",
    d: [
      "M9.50265 0.124444C10.3751 -0.232321 11.3697 0.205214 11.6967 1.08929L13.2468 5.2833C13.5731 6.16642 13.1035 7.14443 12.2103 7.44215L11.4135 7.70778C10.7202 7.93875 9.98794 7.76852 9.47074 7.32041L8.67387 7.56715C9.03178 8.02103 9.24611 8.59337 9.24613 9.21624C9.24613 9.99652 8.91051 10.698 8.37634 11.1856L9.78845 13.1622C10.0024 13.4618 9.93308 13.8779 9.6335 14.0919C9.3339 14.3059 8.91782 14.2366 8.70382 13.9369L7.18624 11.8126C6.99127 11.858 6.78825 11.8829 6.57947 11.8829C6.38109 11.8829 6.18802 11.8602 6.00199 11.8191L4.82491 13.8803C4.64224 14.2 4.23508 14.311 3.91541 14.1284C3.59583 13.9456 3.48471 13.5385 3.66736 13.2188L4.81319 11.213C4.26135 10.7244 3.9128 10.0112 3.9128 9.21624C3.9128 9.15586 3.91471 9.09593 3.91866 9.03655L2.92647 9.34385C1.90525 9.65933 0.815866 9.11581 0.453817 8.11012L0.11853 7.17848C-0.244272 6.16992 0.252412 5.05409 1.24483 4.64918L7.48897 2.10296C7.55883 1.38698 8.01186 0.734159 8.72074 0.444106L9.50265 0.124444ZM6.57947 7.88291C5.84317 7.88295 5.2462 8.47994 5.24613 9.21624C5.24613 9.95259 5.84313 10.5495 6.57947 10.5496C7.31585 10.5496 7.9128 9.95262 7.9128 9.21624C7.91274 8.47991 7.31581 7.88291 6.57947 7.88291ZM1.74874 5.88421C1.41803 6.01919 1.25224 6.39118 1.37309 6.72731L1.70837 7.65895C1.82909 7.99403 2.19228 8.1748 2.53259 8.06976L4.59835 7.43109C5.0864 6.88982 5.79328 6.5496 6.57947 6.54957C6.79609 6.54957 7.00673 6.5757 7.20837 6.62444L8.77087 6.14202L7.76567 3.42978L1.74874 5.88421ZM10.446 1.55153C10.3805 1.37488 10.1816 1.28747 10.0072 1.35882L9.2253 1.67848C8.89281 1.81468 8.72815 2.19048 8.85291 2.52744L10.1563 6.04176C10.2813 6.37883 10.6512 6.5564 10.9922 6.4428L11.7885 6.17718C11.967 6.11765 12.0613 5.92212 11.9961 5.74554L10.446 1.55153Z",
    ],
  },
}

function LevelGlyph(props: { level: ModelLevel; px: number }) {
  const svg = LEVEL_PATHS[props.level]
  if (!svg) return <Icon name="lightning-charge" size="small" containerClass={props.px === 14 ? "shrink-0 !w-[16px] !h-[16px]" : "!w-[18px] !h-[18px]"} className="text-text-strong" />
  return (
    <svg width={props.px} height={props.px} viewBox={svg.viewBox} fill="none" className="shrink-0 text-text-strong">
      {svg.d.map((d) => (
        <path key={d.slice(0, 24)} fillRule="evenodd" clipRule="evenodd" d={d} fill="currentColor" />
      ))}
    </svg>
  )
}

/** 领域下拉：菜单与触发器等宽，选中项右侧打勾 */
export function DomainSelect(props: { value: string; onChange: (value: string) => void; label: string; readonly?: boolean }) {
  const t = useT()
  const labelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [width, setWidth] = useState(0)
  const label = domainI18nKeys[props.value] ? t(domainI18nKeys[props.value]) : props.value

  return (
    <div data-component="domain-select" className="flex flex-col gap-3">
      <span id={labelId} data-slot="domain-select-label" className="text-[14px] leading-5 text-text-weak">{props.label}</span>
      {props.readonly ? (
        <div data-slot="domain-select-value" className="flex h-9 w-full items-center rounded-xl border border-[var(--border-weak-base)] bg-[var(--input-base)] px-3">
          <span className="text-[14px] leading-5 font-normal text-text-strong">{label}</span>
        </div>
      ) : (
        <DropdownMenu placement="bottom" gutter={4} onOpenChange={(open) => open && trigger.current && setWidth(trigger.current.getBoundingClientRect().width)}>
          <DropdownMenu.Trigger
            ref={trigger}
            aria-labelledby={labelId}
            className="flex h-9 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--border-weak-base)] bg-[var(--input-base)] px-3 transition-colors duration-150 hover:border-[var(--border-base)] [&[data-expanded]]:border-[var(--border-selected)]"
          >
            <span className="text-[14px] leading-5 font-normal text-text-strong">{label}</span>
            <Icon name="chevron-down-16" size="small" className="text-text-weak" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="domain-select-menu" style={{ minWidth: width, width }}>
              {Object.keys(domainI18nKeys).map((value) => (
                <DropdownMenu.Item key={value} onSelect={() => props.onChange(value)}>
                  <DropdownMenu.ItemLabel className="text-text-strong">{t(domainI18nKeys[value])}</DropdownMenu.ItemLabel>
                  {props.value === value && (
                    <DropdownMenu.ItemIndicator>
                      <Icon name="check" size="small" className="text-[var(--neutral-600)]" />
                    </DropdownMenu.ItemIndicator>
                  )}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      )}
    </div>
  )
}

/** 默认模型等级下拉：每项两行（图标 + 名称 + 勾选 / 说明） */
export function ModelLevelSelect(props: { value: ModelLevel; onChange: (value: ModelLevel) => void; readonly?: boolean }) {
  const t = useT()
  const name = (level: ModelLevel) => t(`kcode.agentConfig.basic.modelPolicy.level.${level}`)

  if (props.readonly)
    return (
      <div className="flex h-8 items-center gap-1.5 px-2 text-[14px] leading-5 text-text-strong">
        <LevelGlyph level={props.value} px={16} />
        <span>{name(props.value)}</span>
      </div>
    )
  return (
    <DropdownMenu placement="bottom-end" gutter={4}>
      <DropdownMenu.Trigger className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[14px] leading-5 text-text-strong transition-colors duration-150 hover:bg-[var(--surface-base)] [&[data-expanded]]:bg-[var(--surface-base)]">
        <LevelGlyph level={props.value} px={16} />
        <span>{name(props.value)}</span>
        <Icon name="chevron-down-16" size="small" className="text-text-weak" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="model-level-menu" style={{ minWidth: 260, padding: 3 }}>
          {MODEL_LEVELS.map((level) => (
            <DropdownMenu.Item
              key={level}
              onSelect={() => props.onChange(level)}
              style={{ height: "auto", flexDirection: "column", alignItems: "stretch", gap: 2, padding: "8px 12px", borderRadius: 20 }}
            >
              <div className="flex items-center gap-2.5">
                <LevelGlyph level={level} px={14} />
                <span className="min-w-0 flex-1 truncate text-[15px] leading-[22px] font-[500] text-text-strong">{name(level)}</span>
                {props.value === level && <Icon name="check" size="normal" containerClass="shrink-0" className="text-[var(--neutral-700)]" />}
              </div>
              <span className="text-[12px] leading-4 text-text-weak">{t(`kcode.agentConfig.basic.modelPolicy.levelDesc.${level}`)}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
