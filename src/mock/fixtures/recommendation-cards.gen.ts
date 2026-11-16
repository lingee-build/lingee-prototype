export default [
  {
    "title": {
      "zh": "查询发货通知单",
      "en": "Query Delivery Notice",
      "zht": "查詢發貨通知單"
    },
    "prompt": {
      "zh": "/kingdee-skill-creator 创建一个发货通知单查询技能，支持按单据编号、状态和通知日期等条件组合筛选，返回分页列表或物料行明细，以表格展示单据编号、状态、发货组织和订货客户等关键信息，查询为空时提示用户调整筛选条件后重试。",
      "en": "/kingdee-skill-creator Create a delivery notice query skill that supports combined filtering by document number, status, and delivery date, returning paginated lists or material line details, displaying key info like document number, status, shipping org, and ordering customer in a table. When query is empty, prompt the user to adjust filters and retry.",
      "zht": "/kingdee-skill-creator 建立一個發貨通知單查詢技能，支援按單據編號、狀態和通知日期等條件組合篩選，返回分頁列表或物料行明細，以表格展示單據編號、狀態、發貨組織和訂貨客戶等關鍵資訊，查詢為空時提示使用者調整篩選條件後重試。"
    },
    "typeKey": "kcode.nav.skillDev",
    "devMode": "skill"
  },
  {
    "title": {
      "zh": "办理请假申请",
      "en": "Submit Leave Request",
      "zht": "辦理請假申請"
    },
    "prompt": {
      "zh": "/kingdee-skill-creator 创建一个请假申请技能，通过对话逐步收集假期类型、起止日期、请假事由和代理人信息，自动查询剩余可用假期天数并校验是否充足，不足时提醒用户调整，校验通过后生成请假单草稿展示确认卡片，用户确认后提交审批并返回单据编号。",
      "en": "/kingdee-skill-creator Create a leave request skill that collects leave type, start/end dates, reason, and proxy info through conversation, automatically queries remaining leave days and validates sufficiency, reminds user to adjust if insufficient, generates a leave draft with confirmation card after validation, submits for approval and returns document number upon user confirmation.",
      "zht": "/kingdee-skill-creator 建立一個請假申請技能，通過對話逐步收集假期類型、起止日期、請假事由和代理人資訊，自動查詢剩餘可用假期天數並校驗是否充足，不足時提醒使用者調整，校驗通過後生成請假單草稿展示確認卡片，使用者確認後提交審批並返回單據編號。"
    },
    "typeKey": "kcode.nav.skillDev",
    "devMode": "skill"
  },
  {
    "title": {
      "zh": "提交费用报销",
      "en": "Submit Expense Reimbursement",
      "zht": "提交費用報銷"
    },
    "prompt": {
      "zh": "/kingdee-skill-creator 创建一个费用报销提交技能，分步收集费用类型、金额、发生日期和票据附件，用户上传的附件全部保留不做筛选，所有附件上传成功后才组装报销单，用户确认前不执行提交，金额超过报销限额时提醒需走额外审批流程，提交后返回报销单号。",
      "en": "/kingdee-skill-creator Create an expense reimbursement skill that collects expense type, amount, date, and receipt attachments step by step, retains all uploaded attachments without filtering, assembles the reimbursement form only after all uploads succeed, does not submit before user confirmation, reminds about extra approval when amount exceeds limit, returns reimbursement number after submission.",
      "zht": "/kingdee-skill-creator 建立一個費用報銷提交技能，分步收集費用類型、金額、發生日期和票據附件，使用者上傳的附件全部保留不做篩選，所有附件上傳成功後才組裝報銷單，使用者確認前不執行提交，金額超過報銷限額時提醒需走額外審批流程，提交後返回報銷單號。"
    },
    "typeKey": "kcode.nav.skillDev",
    "devMode": "skill"
  },
  {
    "title": {
      "zh": "评估客户信用风险",
      "en": "Assess Customer Credit Risk",
      "zht": "評估客戶信用風險"
    },
    "prompt": {
      "zh": "/kingdee-skill-creator 创建一个客户信用评估技能，根据用户提供的客户编码同时查询应收账款和历史回款记录，汇总逾期金额、平均回款周期和信用额度使用率，生成信用风险等级评估结果，如果查询无数据必须明确告知用户，不得编造任何评估内容。",
      "en": "/kingdee-skill-creator Create a customer credit assessment skill that queries accounts receivable and historical payment records by customer code, summarizes overdue amount, average payment cycle, and credit utilization rate, generates a credit risk rating, and clearly informs the user if no data is found without fabricating any assessment.",
      "zht": "/kingdee-skill-creator 建立一個客戶信用評估技能，根據使用者提供的客戶編碼同時查詢應收帳款和歷史回款記錄，彙總逾期金額、平均回款週期和信用額度使用率，生成信用風險等級評估結果，如果查詢無資料必須明確告知使用者，不得編造任何評估內容。"
    },
    "typeKey": "kcode.nav.skillDev",
    "devMode": "skill"
  },
  {
    "title": {
      "zh": "登记生产报工",
      "en": "Register Production Reporting",
      "zht": "登記生產報工"
    },
    "prompt": {
      "zh": "/kingdee-skill-creator 创建一个生产报工技能，用户输入工单号后查询当前工序进度，确认报工工序和完工数量，报工数量不得超过计划数量超出时提醒调整，提交前必须让用户再次确认报工信息，确认后提交报工记录并返回报工单号和更新后的工序状态。",
      "en": "/kingdee-skill-creator Create a production reporting skill that queries current process progress by work order number, confirms reporting process and completed quantity, reminds adjustment when reported quantity exceeds planned quantity, requires user reconfirmation before submission, submits and returns report number with updated process status.",
      "zht": "/kingdee-skill-creator 建立一個生產報工技能，使用者輸入工單號後查詢當前工序進度，確認報工工序和完工數量，報工數量不得超過計畫數量超出時提醒調整，提交前必須讓使用者再次確認報工資訊，確認後提交報工記錄並返回報工單號和更新後的工序狀態。"
    },
    "typeKey": "kcode.nav.skillDev",
    "devMode": "skill"
  },
  {
    "title": {
      "zh": "创建员工制度问答助手",
      "en": "Create Employee Policy Q&A Assistant",
      "zht": "建立員工制度問答助手"
    },
    "prompt": {
      "zh": "/ai-partner-creator 创建一个员工助手，基于企业知识库内相关内容，面向公司员工回答考勤、休假、报销、差旅、福利及员工管理规范等问题。",
      "en": "/ai-partner-creator Create an employee assistant based on enterprise knowledge base, answering questions about attendance, leave, reimbursement, travel, benefits, and employee management policies for company employees.",
      "zht": "/ai-partner-creator 建立一個員工助手，基於企業知識庫內相關內容，面向公司員工回答考勤、休假、報銷、差旅、福利及員工管理規範等問題。"
    },
    "typeKey": "kcode.nav.agentDev",
    "devMode": "agent"
  },
  {
    "title": {
      "zh": "创建销售陪练助手",
      "en": "Create Sales Training Assistant",
      "zht": "建立銷售陪練助手"
    },
    "prompt": {
      "zh": "/ai-partner-creator 创建一个销售陪练智能体，通过模拟制造业客户与销售人员进行多轮对话练习，围绕选型、价格、实施周期、系统替换、员工使用和项目效果等常见问题提出异议，并在演练结束后对需求挖掘、价值表达、倾听回应和异议处理进行评分、复盘和改进指导。",
      "en": "/ai-partner-creator Create a sales training agent that simulates manufacturing customer dialogues with sales reps across selection, pricing, implementation timeline, system replacement, user adoption, and project outcomes, then scores and reviews needs discovery, value articulation, listening, and objection handling after the exercise.",
      "zht": "/ai-partner-creator 建立一個銷售陪練智慧體，通過模擬製造業客戶與銷售人員進行多輪對話練習，圍繞選型、價格、實施週期、系統替換、員工使用和專案效果等常見問題提出異議，並在演練結束後對需求挖掘、價值表達、傾聽回應和異議處理進行評分、復盤和改進指導。"
    },
    "typeKey": "kcode.nav.agentDev",
    "devMode": "agent"
  },
  {
    "title": {
      "zh": "创建销售周报助手",
      "en": "Create Sales Weekly Report Assistant",
      "zht": "建立銷售週報助手"
    },
    "prompt": {
      "zh": "/ai-partner-creator 创建一个销售周报智能体，根据指定销售人员和时间范围，自动汇总客户跟进、商机进展、订单和回款数据，提炼本周进展、重点风险和下周计划，生成结构化销售周报。",
      "en": "/ai-partner-creator Create a sales weekly report agent that aggregates customer follow-ups, opportunity progress, orders, and payment data by sales rep and time range, distills weekly progress, key risks, and next week's plan, and generates a structured sales weekly report.",
      "zht": "/ai-partner-creator 建立一個銷售週報智慧體，根據指定銷售人員和時間範圍，自動彙總客戶跟進、商機進展、訂單和回款資料，提煉本週進展、重點風險和下週計畫，生成結構化銷售週報。"
    },
    "typeKey": "kcode.nav.agentDev",
    "devMode": "agent"
  },
  {
    "title": {
      "zh": "设计客户数据看板",
      "en": "Design Customer Data Dashboard",
      "zht": "設計客戶資料看板"
    },
    "prompt": {
      "zh": "/kingdee-design 设计一个客户管理系统的数据看板原型，顶部展示客户总数、本月新增、活跃客户、流失客户四个数据卡片，中间用ECharts展示客户增长趋势折线图和客户区域分布饼图，底部展示客户列表表格（客户名称、联系人、区域、状态），整体风格简洁专业，使用蓝色系配色",
      "en": "/kingdee-design Design a customer management data dashboard prototype with four KPI cards on top (total customers, new this month, active, churned), ECharts line chart for customer growth trend and pie chart for regional distribution, customer list table at the bottom (name, contact, region, status), clean professional style with blue color scheme.",
      "zht": "/kingdee-design 設計一個客戶管理系統的資料看板原型，頂部展示客戶總數、本月新增、活躍客戶、流失客戶四個資料卡片，中間用ECharts展示客戶增長趨勢折線圖和客戶區域分布圓餅圖，底部展示客戶列表表格（客戶名稱、聯絡人、區域、狀態），整體風格簡潔專業，使用藍色系配色"
    },
    "typeKey": "kcode.starter.app.universal",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "设计会议纪要助手",
      "en": "Design Meeting Minutes Assistant",
      "zht": "設計會議紀要助手"
    },
    "prompt": {
      "zh": "/kingdee-design 设计一个“智能会议纪要助手”高保真原型。页面包含会议录音上传与转写进度、左侧会议列表、右侧纪要详情；纪要详情按议题展示摘要、关键结论和行动项，行动项包含负责人、截止日期和完成状态。整体使用蓝紫色科技风，信息层级清晰，支持桌面端预览。",
      "en": "/kingdee-design Design a high-fidelity prototype of a \"Smart Meeting Minutes Assistant\". The page includes meeting recording upload with transcription progress, a meeting list on the left, and minutes details on the right; minutes are displayed by topic with summaries, key conclusions, and action items including owner, due date, and completion status. Blue-purple tech style with clear information hierarchy, desktop preview supported.",
      "zht": "/kingdee-design 設計一個「智慧會議紀要助手」高保真原型。頁面包含會議錄音上傳與轉寫進度、左側會議列表、右側紀要詳情；紀要詳情按議題展示摘要、關鍵結論和行動項，行動項包含負責人、截止日期和完成狀態。整體使用藍紫色科技風，資訊層級清晰，支援桌面端預覽。"
    },
    "typeKey": "kcode.starter.app.universal",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "设计差旅费用看板",
      "en": "Design Travel Expense Dashboard",
      "zht": "設計差旅費用看板"
    },
    "prompt": {
      "zh": "/kingdee-design 设计一个“差旅费用分析看板”高保真原型。顶部展示差旅总额、预算执行率、出差人次、人均费用四个指标；中部展示月度费用趋势折线图、部门费用排行柱状图和费用类型分布图；提供时间、部门、费用类型筛选，并在底部展示可下钻的异常费用明细。整体简洁专业，使用蓝色系配色。",
      "en": "/kingdee-design Design a high-fidelity prototype of a \"Travel Expense Analysis Dashboard\". Top shows four metrics: total travel cost, budget execution rate, travel count, and per-capita cost; middle shows monthly expense trend line chart, department ranking bar chart, and expense type distribution; provides time, department, and expense type filters with drill-down anomaly details at the bottom. Clean professional style with blue color scheme.",
      "zht": "/kingdee-design 設計一個「差旅費用分析看板」高保真原型。頂部展示差旅總額、預算執行率、出差人次、人均費用四個指標；中部展示月度費用趨勢折線圖、部門費用排行柱狀圖和費用類型分布圖；提供時間、部門、費用類型篩選，並在底部展示可下鑽的異常費用明細。整體簡潔專業，使用藍色系配色。"
    },
    "typeKey": "kcode.starter.app.universal",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "设计员工自助服务中心",
      "en": "Design Employee Self-Service Center",
      "zht": "設計員工自助服務中心"
    },
    "prompt": {
      "zh": "/kingdee-design 设计一个“员工自助服务中心”高保真原型。首页包含搜索框、证明申请/假勤查询/薪资查询等高频服务入口、我的申请进度列表、热门问题和智能问答入口；申请进度需要展示当前状态、处理人和预计完成时间。整体风格友好、简洁，适合企业员工门户。",
      "en": "/kingdee-design Design a high-fidelity prototype of an \"Employee Self-Service Center\". Homepage includes search box, high-frequency service entries (certificate application, leave query, salary query), my application progress list, popular questions, and smart Q&A entry; progress shows current status, handler, and estimated completion time. Friendly, clean style suitable for enterprise employee portal.",
      "zht": "/kingdee-design 設計一個「員工自助服務中心」高保真原型。首頁包含搜尋框、證明申請/假勤查詢/薪資查詢等高頻服務入口、我的申請進度列表、熱門問題和智慧問答入口；申請進度需要展示當前狀態、處理人和預計完成時間。整體風格友好、簡潔，適合企業員工門戶。"
    },
    "typeKey": "kcode.starter.app.universal",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "开发团队任务协作应用",
      "en": "Build Team Task Collaboration App",
      "zht": "開發團隊任務協作應用"
    },
    "prompt": {
      "zh": "/standalone-build 开发一个团队任务协作应用，包含左侧任务看板（待办/进行中/已完成三列，支持拖拽切换状态），右侧任务创建面板（任务名称、优先级下拉选择、负责人选择、截止日期），顶部导航栏含项目切换和搜索功能，使用React，数据用本地状态管理",
      "en": "/standalone-build Build a team task collaboration app with a task board on the left (todo/in-progress/done columns with drag-to-switch status), task creation panel on the right (name, priority dropdown, assignee, due date), top navigation with project switcher and search. Use React with local state management.",
      "zht": "/standalone-build 開發一個團隊任務協作應用，包含左側任務看板（待辦/進行中/已完成三列，支援拖曳切換狀態），右側任務建立面板（任務名稱、優先級下拉選擇、負責人選擇、截止日期），頂部導航欄含專案切換和搜尋功能，使用React，資料用本地狀態管理"
    },
    "typeKey": "kcode.starter.app.general",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "开发个人习惯打卡应用",
      "en": "Build Habit Tracker App",
      "zht": "開發個人習慣打卡應用"
    },
    "prompt": {
      "zh": "/standalone-build 开发一个“个人习惯打卡”React 应用。支持创建、编辑和归档习惯，可设置名称、颜色、频率和提醒时间；首页展示今日打卡列表，日历视图展示历史完成情况，并统计连续打卡天数和月度完成率。数据保存在浏览器本地，界面适配桌面端和移动端。",
      "en": "/standalone-build Build a \"Habit Tracker\" React app. Supports creating, editing, and archiving habits with name, color, frequency, and reminder time; homepage shows today's checklist, calendar view shows history, and stats display streak days and monthly completion rate. Data stored in browser localStorage, responsive for desktop and mobile.",
      "zht": "/standalone-build 開發一個「個人習慣打卡」React 應用。支援建立、編輯和歸檔習慣，可設定名稱、顏色、頻率和提醒時間；首頁展示今日打卡列表，日曆視圖展示歷史完成情況，並統計連續打卡天數和月度完成率。資料保存在瀏覽器本地，介面適配桌面端和行動端。"
    },
    "typeKey": "kcode.starter.app.general",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "开发客户跟进管理应用",
      "en": "Build Customer Follow-up App",
      "zht": "開發客戶跟進管理應用"
    },
    "prompt": {
      "zh": "/standalone-build 开发一个“客户跟进管理”React 应用。包含客户列表、销售阶段看板和客户详情页；客户列表支持搜索、标签和阶段筛选，详情页可以新增跟进记录、设置下次联系时间和负责人，并用时间线展示历史沟通。看板支持拖拽客户切换销售阶段，数据使用本地状态管理。",
      "en": "/standalone-build Build a \"Customer Follow-up\" React app with customer list, sales stage board, and customer detail page; list supports search, tags, and stage filtering, detail page can add follow-up records, set next contact time and owner, and timeline for history. Board supports drag to switch sales stages, data uses local state management.",
      "zht": "/standalone-build 開發一個「客戶跟進管理」React 應用。包含客戶列表、銷售階段看板和客戶詳情頁；客戶列表支援搜尋、標籤和階段篩選，詳情頁可以新增跟進記錄、設定下次聯絡時間和負責人，並用時間線展示歷史溝通。看板支援拖曳客戶切換銷售階段，資料使用本地狀態管理。"
    },
    "typeKey": "kcode.starter.app.general",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "开发轻量库存管理应用",
      "en": "Build Lightweight Inventory App",
      "zht": "開發輕量庫存管理應用"
    },
    "prompt": {
      "zh": "/standalone-build 开发一个“轻量库存管理”React 应用。物料列表展示编码、名称、分类、当前库存和安全库存，支持搜索与低库存筛选；提供入库、出库登记表单，提交后自动更新库存并生成库存流水；首页展示物料总数、库存总量和预警数量。数据使用本地状态管理。",
      "en": "/standalone-build Build a \"Lightweight Inventory\" React app. Material list shows code, name, category, current stock, and safety stock with search and low-stock filtering; provides inbound/outbound forms that auto-update stock and generate inventory logs; homepage shows total materials, stock quantity, and alert count. Data uses local state management.",
      "zht": "/standalone-build 開發一個「輕量庫存管理」React 應用。物料列表展示編碼、名稱、分類、當前庫存和安全庫存，支援搜尋與低庫存篩選；提供入庫、出庫登記表單，提交後自動更新庫存並生成庫存流水；首頁展示物料總數、庫存總量和預警數量。資料使用本地狀態管理。"
    },
    "typeKey": "kcode.starter.app.general",
    "devMode": "universal"
  },
  {
    "title": {
      "zh": "创建采购申请单",
      "en": "Create Purchase Requisition",
      "zht": "建立採購申請單"
    },
    "prompt": {
      "zh": "/app-build 创建一个“采购申请管理”单据，包含表头字段：供应商（基础资料类型）、申请日期（日期类型）、申请人（文本类型）、申请部门（文本类型）；明细字段：物料编码（基础资料类型）、物料名称（文本类型）、规格型号（文本类型）、数量（小数类型）、单价（小数类型）、金额（小数类型）、备注（文本类型）。开发完后帮我发布菜单。",
      "en": "/app-build Create a \"Purchase Requisition\" document with header fields: supplier (master data), request date (date), requester (text), department (text); line items: material code (master data), material name (text), specification (text), quantity (decimal), unit price (decimal), amount (decimal), remarks (text). Publish menu after development.",
      "zht": "/app-build 建立一個「採購申請管理」單據，包含表頭欄位：供應商（基礎資料類型）、申請日期（日期類型）、申請人（文字類型）、申請部門（文字類型）；明細欄位：物料編碼（基礎資料類型）、物料名稱（文字類型）、規格型號（文字類型）、數量（小數類型）、單價（小數類型）、金額（小數類型）、備註（文字類型）。開發完後幫我發布選單。"
    },
    "typeKey": "kcode.starter.app.erp",
    "devMode": "app"
  },
  {
    "title": {
      "zh": "创建销售报价单",
      "en": "Create Sales Quotation",
      "zht": "建立銷售報價單"
    },
    "prompt": {
      "zh": "/app-build 创建一个“销售报价管理”单据。表头字段包括客户（基础资料）、报价日期（日期）、销售员（人员）、币别（下拉）、有效期（日期）、报价状态（下拉）；明细字段包括产品（基础资料）、数量（小数）、单价（小数）、折扣率（小数）、报价金额（小数）。开发完后帮我发布菜单。",
      "en": "/app-build Create a \"Sales Quotation\" document. Header fields: customer (master data), quote date (date), sales rep (person), currency (dropdown), valid until (date), quote status (dropdown); line items: product (master data), quantity (decimal), unit price (decimal), discount rate (decimal), quote amount (decimal). Publish menu after development.",
      "zht": "/app-build 建立一個「銷售報價管理」單據。表頭欄位包括客戶（基礎資料）、報價日期（日期）、銷售員（人員）、幣別（下拉）、有效期（日期）、報價狀態（下拉）；明細欄位包括產品（基礎資料）、數量（小數）、單價（小數）、折扣率（小數）、報價金額（小數）。開發完後幫我發布選單。"
    },
    "typeKey": "kcode.starter.app.erp",
    "devMode": "app"
  },
  {
    "title": {
      "zh": "创建费用报销单",
      "en": "Create Expense Reimbursement Form",
      "zht": "建立費用報銷單"
    },
    "prompt": {
      "zh": "/app-build 创建一个“费用报销管理”单据。表头字段包括申请人（人员）、申请部门（组织）、申请日期（日期）、报销总额（小数）、审批状态（下拉）；明细字段包括费用类型（下拉）、发生日期（日期）、金额（小数）、费用事由（文本）、发票附件（附件）。开发完后帮我发布菜单。",
      "en": "/app-build Create an \"Expense Reimbursement\" document. Header fields: applicant (person), department (organization), application date (date), total amount (decimal), approval status (dropdown); line items: expense type (dropdown), occurrence date (date), amount (decimal), expense reason (text), invoice attachment (attachment). Publish menu after development.",
      "zht": "/app-build 建立一個「費用報銷管理」單據。表頭欄位包括申請人（人員）、申請部門（組織）、申請日期（日期）、報銷總額（小數）、審批狀態（下拉）；明細欄位包括費用類型（下拉）、發生日期（日期）、金額（小數）、費用事由（文字）、發票附件（附件）。開發完後幫我發布選單。"
    },
    "typeKey": "kcode.starter.app.erp",
    "devMode": "app"
  },
  {
    "title": {
      "zh": "创建客户拜访单",
      "en": "Create Customer Visit Form",
      "zht": "建立客戶拜訪單"
    },
    "prompt": {
      "zh": "/app-build 创建一个“客户拜访管理”单据。字段包括客户（基础资料）、拜访人（人员）、拜访时间（日期时间）、拜访地点（文本）、拜访方式（下拉）、沟通纪要（多行文本）、客户需求（多行文本）、现场附件（附件）、下次跟进日期（日期）、跟进负责人（人员）、跟进状态（下拉）。开发完后帮我发布菜单。",
      "en": "/app-build Create a \"Customer Visit\" document. Fields: customer (master data), visitor (person), visit time (datetime), visit location (text), visit method (dropdown), meeting notes (multiline text), customer needs (multiline text), on-site attachments (attachment), next follow-up date (date), follow-up owner (person), follow-up status (dropdown). Publish menu after development.",
      "zht": "/app-build 建立一個「客戶拜訪管理」單據。欄位包括客戶（基礎資料）、拜訪人（人員）、拜訪時間（日期時間）、拜訪地點（文字）、拜訪方式（下拉）、溝通紀要（多行文字）、客戶需求（多行文字）、現場附件（附件）、下次跟進日期（日期）、跟進負責人（人員）、跟進狀態（下拉）。開發完後幫我發布選單。"
    },
    "typeKey": "kcode.starter.app.erp",
    "devMode": "app"
  },
  {
    "title": {
      "zh": "展示数据趋势与同比环比",
      "en": "Display Data Trend with YoY/MoM",
      "zht": "展示資料趨勢與同比環比"
    },
    "prompt": {
      "zh": "/mcp-apps-builder 创建一个数据趋势图组件，这是一个纯展示组件不需要调用后端接口，接收指标名称和数据数组，用图表展示折线趋势，下方文字展示同比环比变化，支持跟随平台亮色暗色主题自动切换。",
      "en": "/mcp-apps-builder Create a data trend chart component, a display-only component without backend API calls, that accepts metric name and data array, renders a line chart for trends, shows YoY/MoM changes as text below, and supports automatic light/dark theme switching.",
      "zht": "/mcp-apps-builder 建立一個資料趨勢圖元件，這是一個純展示元件不需要呼叫後端介面，接收指標名稱和資料陣列，用圖表展示折線趨勢，下方文字展示同比環比變化，支援跟隨平台亮色暗色主題自動切換。"
    },
    "typeKey": "kcode.starter.app.mcp",
    "devMode": "mcpapp"
  },
  {
    "title": {
      "zh": "查看审批进度并处理审批",
      "en": "View and Process Approval",
      "zht": "查看審批進度並處理審批"
    },
    "prompt": {
      "zh": "/mcp-apps-builder 创建一个审批流程组件，接收单据编号，内部调用审批详情查询接口获取审批节点列表，以时间线展示各节点审批人和状态，当前节点高亮，底部提供同意和驳回按钮，点击后调用审批接口提交，把操作结果告诉 AI。",
      "en": "/mcp-apps-builder Create an approval flow component that receives a document number, calls the approval detail API internally to get approval node list, displays nodes as a timeline with approver and status, highlights the current node, provides approve and reject buttons that call the approval API on click, and reports the result to AI.",
      "zht": "/mcp-apps-builder 建立一個審批流程元件，接收單據編號，內部呼叫審批詳情查詢介面取得審批節點列表，以時間線展示各節點審批人和狀態，當前節點高亮，底部提供同意和駁回按鈕，點擊後呼叫審批介面提交，把操作結果告訴 AI。"
    },
    "typeKey": "kcode.starter.app.mcp",
    "devMode": "mcpapp"
  },
  {
    "title": {
      "zh": "预览并选择会话附件",
      "en": "Preview and Select Session Attachments",
      "zht": "預覽並選擇會話附件"
    },
    "prompt": {
      "zh": "/mcp-apps-builder 创建一个附件预览组件，组件启动后自动获取当前对话中用户上传的附件列表并以缩略图展示文件名和大小，用户可以勾选需要的附件也可以取消不相关的，点击确认后把最终选中的附件列表告诉 AI 用于后续处理。",
      "en": "/mcp-apps-builder Create an attachment preview component that auto-fetches user-uploaded attachments from the current conversation on startup, displays thumbnails with file name and size, allows user to select or deselect attachments, and sends the final selected list to AI for subsequent processing on confirm.",
      "zht": "/mcp-apps-builder 建立一個附件預覽元件，元件啟動後自動取得當前對話中使用者上傳的附件列表並以縮圖展示檔案名稱和大小，使用者可以勾選需要的附件也可以取消不相關的，點擊確認後把最終選中的附件列表告訴 AI 用於後續處理。"
    },
    "typeKey": "kcode.starter.app.mcp",
    "devMode": "mcpapp"
  },
  {
    "title": {
      "zh": "分步采集信息并保存进度",
      "en": "Multi-Step Info Collection with Save",
      "zht": "分步採集資訊並保存進度"
    },
    "prompt": {
      "zh": "/mcp-apps-builder 创建一个分步信息采集组件，接收步骤定义，以步骤条渲染当前步骤的表单，每步填完点击下一步时校验必填项，用户填写过程中自动保存进度，组件被关闭后重新打开时恢复到上次填写的位置，最后一步提交后把全部数据一次性告诉 AI 处理。",
      "en": "/mcp-apps-builder Create a multi-step info collection component that accepts step definitions, renders the current step's form with a step bar, validates required fields on next, auto-saves progress during editing, restores to the last position when reopened, and sends all collected data to AI at once after the final step submission.",
      "zht": "/mcp-apps-builder 建立一個分步資訊採集元件，接收步驟定義，以步驟條渲染當前步驟的表單，每步填完點擊下一步時校驗必填項，使用者填寫過程中自動保存進度，元件被關閉後重新開啟時恢復到上次填寫的位置，最後一步提交後把全部資料一次性告訴 AI 處理。"
    },
    "typeKey": "kcode.starter.app.mcp",
    "devMode": "mcpapp"
  },
  {
    "title": {
      "zh": "一键打开ERP单据详情",
      "en": "Open ERP Document Detail",
      "zht": "一鍵開啟ERP單據詳情"
    },
    "prompt": {
      "zh": "/mcp-apps-builder 创建一个 ERP 单据跳转组件，接收单据类型和单据编号，组件自动获取当前会话绑定的 ERP 环境地址，用该地址拼接单据详情页链接，展示单据摘要信息和一个在 ERP 中打开按钮，点击后在新窗口打开对应的 ERP 页面。",
      "en": "/mcp-apps-builder Create an ERP document redirect component that receives document type and number, auto-fetches the ERP environment URL bound to the current session, constructs the document detail page link, displays document summary info with an \"Open in ERP\" button, and opens the corresponding ERP page in a new window on click.",
      "zht": "/mcp-apps-builder 建立一個 ERP 單據跳轉元件，接收單據類型和單據編號，元件自動取得當前會話綁定的 ERP 環境地址，用該地址拼接單據詳情頁連結，展示單據摘要資訊和一個在 ERP 中開啟按鈕，點擊後在新視窗開啟對應的 ERP 頁面。"
    },
    "typeKey": "kcode.starter.app.mcp",
    "devMode": "mcpapp"
  }
]
