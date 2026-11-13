# 明晰支持矩阵 / Mingxi support matrix

以下描述当前工作区实现。**视觉滤镜**只改变显示颜色；**结构化增强**需要可读取的网页语义或图表数据。诊断结果显示的是当前页面的检测数量，不代表所有图表都已适配。

This matrix describes the current implementation. A **display filter** changes rendered colors. **Structured enhancement** requires readable page semantics or chart data. Detection counts do not mean every chart is supported.

| 内容 / Content | 视觉滤镜 / Filter | 结构化增强 / Structured enhancement | 数据识别 / Data recognition |
| --- | --- | --- | --- |
| HTML 状态 / HTML status | 页面重映射时适用 | 明确的 `data-status`、`aria-invalid`、语义类或 ARIA 标签可增加状态符号与缺失的文字；未知 `role="alert"` 标为“提示” | 仅依据页面提供的状态语义 |
| 内联 SVG 图表 / Inline SVG chart | 页面重映射时适用 | 至少两个明确标记的系列可获得纹理、线型；带 `data-value` 的柱形可获得数值标签 | 仅读取系列与数值属性，不从颜色猜测 |
| Chart.js Canvas 柱形图、折线图 / Chart.js Canvas bar or line chart | 支持 | 页面公开 `window.Chart` 且至少有两个可见数据集时，叠加纹理或虚线并提供数据表 | 读取 Chart.js 数据集、轴标题、坐标和数值；最多显示 300 个点 |
| 其他 Canvas / Other Canvas | 支持 | 不支持 | 不读取像素或推断图表数据 |
| PNG、JPG 和通过 `<img>` 加载的 SVG / Images | 支持 | 不支持 | 不使用 OCR；不识别图表数据 |
| 视频 / Video | 支持 | 不支持 | 不识别画面内容 |

“图片、Canvas 和视频的单独颜色滤镜”开关控制媒体单独滤镜；开启整页颜色重映射时，媒体仍会随页面一起变化。“可识别图表的纹理与数据提示”开关独立控制 SVG 与 Chart.js 增强。动态图表重绘后会尝试更新，但仍需在实际站点检查交互与性能。

The media filter and structured chart hints have separate switches. Whole-page remapping also affects media. Dynamic charts are rescanned or redrawn where supported; real sites still need interaction and performance checks.

## 页面边界 / Page boundaries

- 浏览器内部页面（例如 `chrome://`）不允许普通扩展内容脚本注入。Browser-internal pages are protected.
- 当前内容脚本只在顶层页面运行；iframe 内的内容不在本次扫描范围。The content script currently runs in the top frame only, including when an iframe has a different origin.
- Shadow DOM 内部元素不在当前普通 DOM 查询范围。Shadow DOM content is outside the current scan.
- 没有可靠语义标记的纯颜色状态、普通 SVG 系列、位图图表仍需人工判断。Color-only states and unmarked charts still need manual review.

## 测试反馈 / Test feedback

在弹窗点击“诊断当前页面”，导出 JSON 报告，并在反馈中说明扩展版本、浏览器版本、开启的设置、复现步骤、预期与实际表现。报告包含未识别 Canvas 的 DOM 位置，不包含图像像素或图表数据。上传截图前请遮盖账号和个人信息。

Use **Diagnose current page** in the popup and attach the exported JSON when useful. Include extension and browser versions, active settings, steps, expected behavior, and actual behavior. The report lists DOM paths for unrecognized Canvas elements, without image pixels or chart data. Remove personal details from screenshots before sharing.

更细的实现条件见 [色彩处理边界](color-model.md)。 / See [color-model.md](color-model.md) for detailed conditions.
