// 由 scripts/sync-from-lingee.ts 生成，请勿手改
export const VALIDATION_GROUPS = [
  {
    "id": "dir",
    "label": {
      "en": "Directory & File Structure",
      "zh": "目录与文件结构"
    },
    "rules": [
      {
        "name": {
          "en": "SKILL.md file exists",
          "zh": "SKILL.md 文件存在"
        },
        "severity": "block",
        "desc": {
          "en": "Root directory must contain SKILL.md",
          "zh": "根目录必须包含 SKILL.md"
        }
      },
      {
        "name": {
          "en": "SKILL.md file size",
          "zh": "SKILL.md 文件大小"
        },
        "severity": "block",
        "desc": {
          "en": "SKILL.md must not exceed 64KB",
          "zh": "SKILL.md 文件不得超过 64KB"
        }
      },
      {
        "name": {
          "en": "Skill package size",
          "zh": "技能包大小"
        },
        "severity": "block",
        "desc": {
          "en": "Estimated ZIP size must not exceed 50MB",
          "zh": "打包 ZIP 估算体积不得超过 50MB"
        }
      },
      {
        "name": {
          "en": "Directory name matches name",
          "zh": "目录名与 name 字段一致"
        },
        "severity": "block",
        "desc": {
          "en": "name field must exactly match parent directory name",
          "zh": "name 字段必须与父目录名完全一致"
        }
      },
      {
        "name": {
          "en": "Standard directory and file check",
          "zh": "标准目录与一级文件检查"
        },
        "severity": "warn",
        "desc": {
          "en": "Only scripts/, references/, assets/, templates/, i18n/, examples/, evals/, .meta/, properties/ subdirs and standard root files allowed; hidden dotfiles excluded",
          "zh": "只允许 scripts/、references/、assets/、templates/、i18n/、examples/、evals/、.meta/、properties/ 子目录及标准一级文件；隐藏点文件除外"
        }
      },
      {
        "name": {
          "en": "Referenced file exists",
          "zh": "引用文件存在"
        },
        "severity": "block",
        "desc": {
          "en": "Files referenced in body must actually exist",
          "zh": "正文中引用的文件必须实际存在"
        }
      },
      {
        "name": {
          "en": "File reference depth",
          "zh": "文件引用深度"
        },
        "severity": "warn",
        "desc": {
          "en": "File references must be single-level, no nested chains",
          "zh": "文件引用必须为单层，不允许嵌套链"
        }
      },
      {
        "name": {
          "en": "CHANGELOG header format",
          "zh": "CHANGELOG 标题格式"
        },
        "severity": "block",
        "desc": {
          "en": "Version headers must be '## X.Y.Z — YYYY-MM-DD'",
          "zh": "版本标题须为 `## X.Y.Z — YYYY-MM-DD`"
        }
      }
    ]
  },
  {
    "id": "yaml",
    "label": {
      "en": "YAML Frontmatter",
      "zh": "YAML 元数据"
    },
    "rules": [
      {
        "name": {
          "en": "Frontmatter format valid",
          "zh": "Frontmatter 格式有效"
        },
        "severity": "block",
        "desc": {
          "en": "Must have valid YAML delimited by ---",
          "zh": "必须有以 --- 分隔的有效 YAML"
        }
      },
      {
        "name": {
          "en": "name field required",
          "zh": "name 字段必填"
        },
        "severity": "block",
        "desc": {
          "en": "name field cannot be empty",
          "zh": "name 字段不能为空"
        }
      },
      {
        "name": {
          "en": "name length 1-64 chars",
          "zh": "name 长度 1-64 字符"
        },
        "severity": "block",
        "desc": {
          "en": "name must be 1-64 characters",
          "zh": "name 必须为 1-64 个字符"
        }
      },
      {
        "name": {
          "en": "name character pattern",
          "zh": "name 字符规范"
        },
        "severity": "block",
        "desc": {
          "en": "Only lowercase a-z, digits 0-9, and hyphens allowed",
          "zh": "只允许小写字母 a-z、数字 0-9 和连字符"
        }
      },
      {
        "name": {
          "en": "name boundary characters",
          "zh": "name 首尾字符"
        },
        "severity": "block",
        "desc": {
          "en": "Cannot start or end with hyphen",
          "zh": "不能以连字符开头或结尾"
        }
      },
      {
        "name": {
          "en": "name no consecutive hyphens",
          "zh": "name 无连续连字符"
        },
        "severity": "block",
        "desc": {
          "en": "Cannot contain consecutive hyphens --",
          "zh": "不能包含连续连字符 --"
        }
      },
      {
        "name": {
          "en": "name must be unquoted",
          "zh": "name 字段不得加引号"
        },
        "severity": "block",
        "desc": {
          "en": "name value must not be quoted; the platform submit-side parses frontmatter as raw text and treats quotes as part of the name",
          "zh": "name 值不得加引号；平台提交端按原始文本解析 frontmatter，会把引号当作名称的一部分"
        }
      },
      {
        "name": {
          "en": "description required",
          "zh": "description 必填"
        },
        "severity": "block",
        "desc": {
          "en": "description cannot be empty",
          "zh": "description 不能为空"
        }
      },
      {
        "name": {
          "en": "description must be plain string",
          "zh": "description 必须为纯文本字符串"
        },
        "severity": "block",
        "desc": {
          "en": "description must be plain text; {{...}} template markers break skill-list parsing",
          "zh": "description 必须为纯文本；{{...}} 模板标记会导致技能列表解析失败"
        }
      },
      {
        "name": {
          "en": "description length limit",
          "zh": "description 长度限制"
        },
        "severity": "warn",
        "desc": {
          "en": "Must be ≤512 characters",
          "zh": "应不超过 512 个字符"
        }
      },
      {
        "name": {
          "en": "tags array format",
          "zh": "tags 数组格式"
        },
        "severity": "warn",
        "desc": {
          "en": "tags must be string array, each item ≤32 chars",
          "zh": "tags 必须为字符串数组，每项 ≤32 字符"
        }
      },
      {
        "name": {
          "en": "allowed-tools format valid",
          "zh": "allowed-tools 格式有效"
        },
        "severity": "warn",
        "desc": {
          "en": "allowed-tools supports list[str] or comma-separated string",
          "zh": "allowed-tools 支持字符串列表或逗号分隔字符串"
        }
      },
      {
        "name": {
          "en": "allowed-tools no wildcards",
          "zh": "allowed-tools 无通配符"
        },
        "severity": "block",
        "desc": {
          "en": "allowed-tools entries must not contain * or ? wildcards",
          "zh": "allowed-tools 条目不得包含 * 或 ? 通配符"
        }
      }
    ]
  },
  {
    "id": "body",
    "label": {
      "en": "Body Specification",
      "zh": "正文规范"
    },
    "rules": [
      {
        "name": {
          "en": "Body line count limit",
          "zh": "正文行数限制"
        },
        "severity": "block",
        "desc": {
          "en": "SKILL.md body must not exceed 500 lines",
          "zh": "SKILL.md 正文不得超过 500 行"
        }
      },
      {
        "name": {
          "en": "Body token limit",
          "zh": "正文 token 限制"
        },
        "severity": "warn",
        "desc": {
          "en": "Body instructions should not exceed 5000 tokens (estimated)",
          "zh": "正文指令建议不超过 5000 token（估算）"
        }
      },
      {
        "name": {
          "en": "High-risk operation confirmation",
          "zh": "高风险操作确认"
        },
        "severity": "warn",
        "desc": {
          "en": "write/action/composite category should include confirmation step",
          "zh": "write/action/composite 类别应包含确认步骤"
        }
      }
    ]
  },
  {
    "id": "script",
    "label": {
      "en": "Script Standards",
      "zh": "脚本规范"
    },
    "rules": [
      {
        "name": {
          "en": "Interactive prompt scan",
          "zh": "交互式输入扫描"
        },
        "severity": "block",
        "desc": {
          "en": "Scan for input()/readline()/getpass() interactive calls",
          "zh": "扫描 input()/readline()/getpass() 交互式调用"
        }
      },
      {
        "name": {
          "en": "Usage documentation",
          "zh": "使用说明文档"
        },
        "severity": "warn",
        "desc": {
          "en": "Check for argparse / --help / docstring usage info",
          "zh": "检查 argparse / --help / docstring 使用说明"
        }
      }
    ]
  },
  {
    "id": "security",
    "label": {
      "en": "Security & Compliance",
      "zh": "安全与合规"
    },
    "rules": [
      {
        "name": {
          "en": "Sensitive info scan",
          "zh": "敏感信息扫描"
        },
        "severity": "block",
        "desc": {
          "en": "Regex match API Key / password / token / private key patterns",
          "zh": "正则匹配 API Key / 密码 / Token / 私钥模式"
        }
      },
      {
        "name": {
          "en": "Config leakage detection",
          "zh": "配置泄露检测"
        },
        "severity": "block",
        "desc": {
          "en": "Check if sensitive mcp.json header values leaked into skill files",
          "zh": "检查 mcp.json 鉴权 headers 值是否泄露到技能文件"
        }
      },
      {
        "name": {
          "en": "Dangerous operation scan",
          "zh": "危险操作扫描"
        },
        "severity": "block",
        "desc": {
          "en": "Detect rm -rf / DROP TABLE / DELETE FROM dangerous commands",
          "zh": "检测 rm -rf / DROP TABLE / DELETE FROM 危险命令"
        }
      },
      {
        "name": {
          "en": "Prompt injection scan",
          "zh": "提示词注入扫描"
        },
        "severity": "block",
        "desc": {
          "en": "Detect 'ignore previous' / 'override system' injection patterns",
          "zh": "检测「忽略前文」/「覆盖系统」等注入模式"
        }
      }
    ]
  },
  {
    "id": "kingdee",
    "label": {
      "en": "Kingdee Skill Checks",
      "zh": "金蝶技能检查"
    },
    "rules": [
      {
        "name": {
          "en": "manifest.yaml exists",
          "zh": "manifest.yaml 文件存在"
        },
        "severity": "block",
        "desc": {
          "en": "Kingdee skills must include manifest.yaml",
          "zh": "金蝶技能必须包含 manifest.yaml"
        }
      },
      {
        "name": {
          "en": "manifest required fields complete",
          "zh": "manifest 必填字段完整"
        },
        "severity": "block",
        "desc": {
          "en": "display_name/version/category/risk_level/side_effect_level required",
          "zh": "display_name/version/category/risk_level/side_effect_level 为必填项"
        }
      },
      {
        "name": {
          "en": "owner placeholder ignored",
          "zh": "owner 占位符会被忽略"
        },
        "severity": "warn",
        "desc": {
          "en": "owner placeholders (user/kingdee/admin...) are ignored; omit owner or write the developer's real name",
          "zh": "owner 占位符（user/kingdee/admin 等）会被忽略；请省略 owner 或填写开发者真实姓名"
        }
      },
      {
        "name": {
          "en": "MCP skill allowed-tools required",
          "zh": "MCP 技能 allowed-tools 必填"
        },
        "severity": "block",
        "desc": {
          "en": "non-third-party MCP tools require non-empty allowed-tools in frontmatter",
          "zh": "非第三方 MCP 工具要求 frontmatter 中 allowed-tools 非空"
        }
      },
      {
        "name": {
          "en": "allowed-tools matches manifest",
          "zh": "allowed-tools 与 manifest 一致"
        },
        "severity": "warn",
        "desc": {
          "en": "allowed-tools should align with manifest.yaml MCP tool ids excluding third-party entries",
          "zh": "allowed-tools 应与 manifest.yaml MCP 工具 id 一致（不含第三方条目）"
        }
      },
      {
        "name": {
          "en": "tool_access.tools fields complete",
          "zh": "tool_access.tools 字段完整"
        },
        "severity": "warn",
        "desc": {
          "en": "Each tool needs id/display_name/description/type",
          "zh": "每个工具需包含 id/display_name/description/type"
        }
      },
      {
        "name": {
          "en": "displayed_category valid",
          "zh": "displayed_category 合法值"
        },
        "severity": "block",
        "desc": {
          "en": "Field present and not a template placeholder; actual enum decided by list_skill_types",
          "zh": "字段存在且非占位符；具体枚举由 list_skill_types 决定"
        }
      },
      {
        "name": {
          "en": "version format valid",
          "zh": "version 格式有效"
        },
        "severity": "warn",
        "desc": {
          "en": "Must be semver format (x.y.z)",
          "zh": "必须为 semver 格式 (x.y.z)"
        }
      },
      {
        "name": {
          "en": "properties/tool.yaml ext-tools format",
          "zh": "properties/tool.yaml ext-tools 格式"
        },
        "severity": "warn",
        "desc": {
          "en": "ext-tools must be the only top-level key in properties/tool.yaml, a non-empty string list",
          "zh": "ext-tools 必须是 properties/tool.yaml 的唯一顶层键，值为非空字符串列表"
        }
      },
      {
        "name": {
          "en": "ext-tools excluded from allowed-tools",
          "zh": "ext-tools 不得出现在 allowed-tools"
        },
        "severity": "block",
        "desc": {
          "en": "third-party tools are declared only in properties/tool.yaml; no ext-tools entry may appear in SKILL.md allowed-tools",
          "zh": "第三方工具只声明在 properties/tool.yaml；任何 ext-tools 条目都不得出现在 SKILL.md 的 allowed-tools 中"
        }
      },
      {
        "name": {
          "en": "third-party tools declared in tool.yaml",
          "zh": "第三方工具已声明在 tool.yaml"
        },
        "severity": "warn",
        "desc": {
          "en": "allowed-tools entries matching the known third-party pattern (mcp_ext_*) do not belong in allowed-tools; declare them in properties/tool.yaml ext-tools only",
          "zh": "allowed-tools 中匹配已知第三方特征（mcp_ext_*）的条目不属于 allowed-tools；只应声明在 properties/tool.yaml 的 ext-tools 中"
        }
      }
    ]
  }
] as const
