// Foundation M2R1 八维评分标尺及等级表。
export const foundationQualityScale = `<details class="rule-section"><summary id="scale">4.1 场景业务质量评分标尺（8维度 / 100分）</summary>
<div class="card">
<h3 style="margin-top:0; display:flex; align-items:center; gap:8px;">
    场景业务质量
    <span style="font-size:12px; font-weight:400; color:var(--text-secondary);">权重 100%</span>
</h3>
<p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">通用智能体对每个用例全部轮次对话日志进行单次LLM Judge评分（8维度100分制），评分前先判定环境阻塞。每个维度输出得分说明与逐项扣分点/扣分证据；用例等级仅由该100分判定。</p>
<table>
<thead>
<tr>
<th style="text-align:left; min-width:130px;">维度</th>
<th style="text-align:left; min-width:80px;">分档</th>
<th style="text-align:left;">评定标准</th>
</tr>
</thead>
<tbody>
<tr>
<td rowspan="6" style="text-align:left; font-weight:600; vertical-align:top;">Q1 Skill遵循度<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">16分</span></td>
<td style="text-align:left; white-space:nowrap;">15-16完全遵循(范围/流程/约束/MUST/禁止项/守护规则全遵守)分</td>
<td style="text-align:left; font-size:12px;">15-16完全遵循(范围/流程/约束/MUST/禁止项/守护规则全遵守)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">12-14基本遵循(个别非关键约束偏差,每处扣1-2)分</td>
<td style="text-align:left; font-size:12px;">12-14基本遵循(个别非关键约束偏差,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">8-11部分</td>
<td style="text-align:left; font-size:12px;">8-11部分遵循(跳过必要步骤/忽略约束/输出偏离约定,每处扣2-4)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">4-7严重偏离(多处违反约束/擅自改流程/越权,每处扣3-5)分</td>
<td style="text-align:left; font-size:12px;">4-7严重偏离(多处违反约束/擅自改流程/越权,每处扣3-5)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-4形同虚设分</td>
<td style="text-align:left; font-size:12px;">1-4形同虚设</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0未按skill执行分</td>
<td style="text-align:left; font-size:12px;">0未按skill执行</td>
</tr>
<tr>
<td rowspan="6" style="text-align:left; font-weight:600; vertical-align:top;">Q2 意图识别与技能路由<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">14分</span></td>
<td style="text-align:left; white-space:nowrap;">13-14完全正确(意图准确+参数解析完整+首轮正确路由+范围外正确拒绝)分</td>
<td style="text-align:left; font-size:12px;">13-14完全正确(意图准确+参数解析完整+首轮正确路由+范围外正确拒绝)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">11-12核心正确(个别参数瑕疵/多余确认,每处扣1)分</td>
<td style="text-align:left; font-size:12px;">11-12核心正确(个别参数瑕疵/多余确认,每处扣1)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">8-10次要偏差(参数有误或路由犹豫后纠正,每处扣1-2)分</td>
<td style="text-align:left; font-size:12px;">8-10次要偏差(参数有误或路由犹豫后纠正,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">5-7部分</td>
<td style="text-align:left; font-size:12px;">5-7部分正确(意图偏差或路由错误已影响路径)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-4基本错误分</td>
<td style="text-align:left; font-size:12px;">1-4基本错误</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0未识别。参考agent.md技能地图与评测集澄清规则分</td>
<td style="text-align:left; font-size:12px;">0未识别。参考agent.md技能地图与评测集澄清规则</td>
</tr>
<tr>
<td rowspan="6" style="text-align:left; font-weight:600; vertical-align:top;">Q3 流程准确与完整性<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">16分</span></td>
<td style="text-align:left; white-space:nowrap;">15-16完全正确(所有轮次关键验证点全部命中,步骤完整,多轮衔接/STOP/阶段控制无误)分</td>
<td style="text-align:left; font-size:12px;">15-16完全正确(所有轮次关键验证点全部命中,步骤完整,多轮衔接/STOP/阶段控制无误)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">12-14基本正确(个别非关键缺失,每处扣1-2)分</td>
<td style="text-align:left; font-size:12px;">12-14基本正确(个别非关键缺失,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">8-11存在遗漏(关键步骤遗漏/分</td>
<td style="text-align:left; font-size:12px;">8-11存在遗漏(关键步骤遗漏/分支判定与标准偏差,每处扣2-4)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">4-7明显不完整分</td>
<td style="text-align:left; font-size:12px;">4-7明显不完整</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-4严重缺失分</td>
<td style="text-align:left; font-size:12px;">1-4严重缺失</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0未执行。评分</td>
<td style="text-align:left; font-size:12px;">0未执行。评分方法:逐条对照标准答案验证点,说明中列明"命中n/m条"</td>
</tr>
<tr>
<td rowspan="7" style="text-align:left; font-weight:600; vertical-align:top;">Q4 产物质量与规范性<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">16分</span></td>
<td style="text-align:left; white-space:nowrap;">15-16完全规范(交付物齐全,结构/命名/格式符合SKILL与标准答案)分</td>
<td style="text-align:left; font-size:12px;">15-16完全规范(交付物齐全,结构/命名/格式符合SKILL与标准答案)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">12-14基本规范(个别规范瑕疵,每处扣1-2)分</td>
<td style="text-align:left; font-size:12px;">12-14基本规范(个别规范瑕疵,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">8-11明显不足(缺标准答案要求的交付文件或关键内容板块缺失,每处扣2-4)分</td>
<td style="text-align:left; font-size:12px;">8-11明显不足(缺标准答案要求的交付文件或关键内容板块缺失,每处扣2-4)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">4-7严重不足分</td>
<td style="text-align:left; font-size:12px;">4-7严重不足</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-4基本无效分</td>
<td style="text-align:left; font-size:12px;">1-4基本无效</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0应产出产物但完全没有。产物内容核对以对话日志中呈现的产物摘要为准分</td>
<td style="text-align:left; font-size:12px;">0应产出产物但完全没有。产物内容核对以对话日志中呈现的产物摘要为准</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">产物要求以评测集标准</td>
<td style="text-align:left; font-size:12px;">产物要求以评测集标准答案为准,标准答案未要求文件产物的用例不因无产物文件扣分,按对话内交付内容(回答/表格/结论)评定</td>
</tr>
<tr>
<td rowspan="6" style="text-align:left; font-weight:600; vertical-align:top;">Q5 数据准确与一致性<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">14分</span></td>
<td style="text-align:left; white-space:nowrap;">13-14完全准确(数值/计算/前后一致/与标准答案及源数据吻合)分</td>
<td style="text-align:left; font-size:12px;">13-14完全准确(数值/计算/前后一致/与标准答案及源数据吻合)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">11-12极小瑕疵(每处扣0.5-1)分</td>
<td style="text-align:left; font-size:12px;">11-12极小瑕疵(每处扣0.5-1)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">8-10个别错误(数据错误/口径不一/表述不一致,每处扣1-2)分</td>
<td style="text-align:left; font-size:12px;">8-10个别错误(数据错误/口径不一/表述不一致,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">5-7多处错误分</td>
<td style="text-align:left; font-size:12px;">5-7多处错误</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-4大量错误分</td>
<td style="text-align:left; font-size:12px;">1-4大量错误</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0严重失真分</td>
<td style="text-align:left; font-size:12px;">0严重失真</td>
</tr>
<tr>
<td rowspan="5" style="text-align:left; font-weight:600; vertical-align:top;">Q6 交互与表达规范性<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">10分</span></td>
<td style="text-align:left; white-space:nowrap;">9-10规范出色(结构清晰/语言与评测集一致/引导明确/节奏得当)分</td>
<td style="text-align:left; font-size:12px;">9-10规范出色(结构清晰/语言与评测集一致/引导明确/节奏得当)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">7-8基本规范(个别冗余或格式不当,每处扣1)分</td>
<td style="text-align:left; font-size:12px;">7-8基本规范(个别冗余或格式不当,每处扣1)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">5-6存在问题(表达混乱/明显冗长/语言不匹配/内部调试信息泄漏,每处扣1-2)分</td>
<td style="text-align:left; font-size:12px;">5-6存在问题(表达混乱/明显冗长/语言不匹配/内部调试信息泄漏,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-4严重影响理解分</td>
<td style="text-align:left; font-size:12px;">1-4严重影响理解</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0无有效交互分</td>
<td style="text-align:left; font-size:12px;">0无有效交互</td>
</tr>
<tr>
<td rowspan="5" style="text-align:left; font-weight:600; vertical-align:top;">Q7 幻觉检测与事实约束<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">8分</span></td>
<td style="text-align:left; white-space:nowrap;">8无幻觉(全部事实可溯源)分</td>
<td style="text-align:left; font-size:12px;">8无幻觉(全部事实可溯源)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">6-7轻微过度(无事实幻觉但措辞夸大/推断未标注,扣1-2)分</td>
<td style="text-align:left; font-size:12px;">6-7轻微过度(无事实幻觉但措辞夸大/推断未标注,扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">3-5存在编造(数据/文件/调用结果/编号,每处扣2-3)分</td>
<td style="text-align:left; font-size:12px;">3-5存在编造(数据/文件/调用结果/编号,每处扣2-3)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-2多处幻觉分</td>
<td style="text-align:left; font-size:12px;">1-2多处幻觉</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0系统性伪造。判定:关键事实须能对应工具调用记录/产物清单/标准答案,对应不上按编造计分</td>
<td style="text-align:left; font-size:12px;">0系统性伪造。判定:关键事实须能对应工具调用记录/产物清单/标准答案,对应不上按编造计</td>
</tr>
<tr>
<td rowspan="5" style="text-align:left; font-weight:600; vertical-align:top;">Q8 错误与异常处理<br/><span style="font-size:11px; font-weight:400; color:var(--text-secondary);">6分</span></td>
<td style="text-align:left; white-space:nowrap;">6优雅处理(异常正确处理或明确告知+下一步建议,边界场景正确)分</td>
<td style="text-align:left; font-size:12px;">6优雅处理(异常正确处理或明确告知+下一步建议,边界场景正确)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">5基本得当(个别反馈不足扣1)分</td>
<td style="text-align:left; font-size:12px;">5基本得当(个别反馈不足扣1)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">3-4部分</td>
<td style="text-align:left; font-size:12px;">3-4部分未处理(异常未恢复/未告知,每处扣1-2)</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">1-2大部分</td>
<td style="text-align:left; font-size:12px;">1-2大部分未处理</td>
</tr>
<tr>
<td style="text-align:left; white-space:nowrap;">0异常导致崩溃。全程无异常且任务正常完成按6分</td>
<td style="text-align:left; font-size:12px;">0异常导致崩溃。全程无异常且任务正常完成按6分计并注明</td>
</tr>
</tbody>
</table>
</div>
<div class="card" id="sec-env-rule" style="scroll-margin-top:16px;">
<h3 style="margin-top:0; display:flex; align-items:center; gap:8px;">
    环境阻塞强制归零规则
    <span style="font-size:12px; font-weight:700; color:var(--danger); background:var(--danger-tint); border:1px solid var(--border); border-radius:4px; padding:1px 8px;">硬性规则</span>
</h3>
<p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">评测环境自身异常导致用例输出回答没有达到预期结果时，该用例8个维度不评价智能体能力，全部计0分。规则由确定性扫描（quality_scorer.py）与 LLM Judge 双通道判定，merge 阶段强制生效，任一通道判定成立即全维度归零。</p>
<table>
<thead>
<tr><th style="text-align:left; min-width:130px;">规则</th><th style="text-align:left;">说明</th></tr>
</thead>
<tbody>
<tr>
<td style="text-align:left; font-weight:600;">环境阻塞成立</td>
<td style="text-align:left; font-size:12px;">模型服务5xx/超时/限流、MCP或HTTP接口5xx/连接失败、网络中断、网关超时、配额耗尽、会话执行失败等评测环境自身异常，导致空回答、失败占位文本或关键数据取不到而无有效结论</td>
</tr>
<tr>
<td style="text-align:left; font-weight:600;">环境阻塞不成立</td>
<td style="text-align:left; font-size:12px;">智能体自身工具参数错误（ToolInputJsonParseError 等）、脚本/命令执行报错、业务数据校验失败、未遵循SKILL、幻觉、本可自行重试恢复却直接放弃的错误——均按标尺正常扣分</td>
</tr>
<tr>
<td style="text-align:left; font-weight:600;">归零执行</td>
<td style="text-align:left; font-size:12px;">8维度得分全部置0（总分0、等级D、未通过），每维度输出扣分点与扣分证据，用例问题清单生成P0【环境阻塞】条目，并保留Judge原始打分以便追溯</td>
</tr>
<tr>
<td style="text-align:left; font-weight:600;">报告口径</td>
<td style="text-align:left; font-size:12px;">归零用例按0分计入质量均分与通过率，同时给出剔除环境阻塞用例后的参考均分；性能18项指标仍如实记录，不因环境阻塞做任何评分或过滤</td>
</tr>
</tbody>
</table>
</div>
</details>
<details class="rule-section"><summary id="grades">4.2 等级评定规则</summary>
<div class="card">
<p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">每个用例由通用智能体对全部轮次对话日志进行单次LLM Judge评分（每用例仅评1次，不取中位数），8维度得分直接求和得到用例总分（满分100），并按以下阈值判定用例等级；全部用例总分的平均值决定整体等级。<b>通用执行性能仅记录实际数据，不参与任何评分与评级。</b></p>
<table style="max-width:400px;">
<thead><tr><th>等级</th><th>用例总分门槛</th></tr></thead>
<tbody>
<tr>
<td><span class="grade grade-S">S</span> 卓越</td>
<td>&gt;= 90</td>
</tr>
<tr>
<td><span class="grade grade-A">A</span> 优秀</td>
<td>&gt;= 80</td>
</tr>
<tr>
<td><span class="grade grade-B">B</span> 良好</td>
<td>&gt;= 70</td>
</tr>
<tr>
<td><span class="grade grade-C">C</span> 及格</td>
<td>&gt;= 60</td>
</tr>
<tr>
<td><span class="grade grade-D">D</span> 不及格</td>
<td>&lt; 60</td>
</tr>
</tbody>
</table>
</div></details>`
