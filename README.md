# Mingxi 明晰 · 色彩无障碍

[English README](README_EN.md)

[隐私政策](PRIVACY.md) · [中文商店介绍](STORE_LISTING_ZH.md)
[支持矩阵](docs/support-matrix.md) · [色彩处理边界](docs/color-model.md)

帮助色盲和色弱用户更容易理解网页信息。

## 功能

- 可选的颜色重映射辅助层
- 自动提高文字与背景对比度
- 为成功、警告和错误状态增加文字与图标提示
- 为链接增加下划线；为符合条件的内联 SVG 和 Chart.js Canvas 图表添加纹理、线型与数值表，对图片和其他 Canvas 应用显示滤镜（[支持矩阵](docs/support-matrix.md)）
- 按网站保存设置并支持强度调节
- 非标准化的色彩图案辨认体验
- 快捷键：`Alt + Shift + S` 开关模式，`Alt + Shift + R` 打开阅读模式
- 当前页面启发式无障碍诊断：报告文字对比度及 SVG、Canvas、状态提示的覆盖数量，支持一键增强和 JSON 报告导出
- 全部设置 JSON 导入与导出、最近使用统计
- 表单焦点高亮、右键对比度检查和扩展图标状态提示
- Popup 支持跟随系统的深色模式

## 免责声明

明晰是无障碍辅助工具，不是医学诊断或治疗工具。色彩图案体验不能判断色觉类型、程度或最佳模式，也不具有医学筛查效力。色彩预设是可自行比较的视觉调整方案，未经临床有效性验证。

## 本地安装

1. 打开 `chrome://extensions/` 或 `edge://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `extension/` 文件夹。

## 验证

运行 `node tests/extension.test.js`。测试包含配置校验、WCAG 公式、透明背景合成、扩展更新和浏览器恢复场景。浏览器场景需要本机安装 Google Chrome；CI 会要求该测试实际执行。

发现问题时，可在弹窗导出“当前页面诊断”JSON，并使用 [功能测试反馈模板](.github/ISSUE_TEMPLATE/feature_feedback.yml) 提供复现步骤。上传前请移除账号和个人信息。

## 打包发布

运行 `python3 scripts/package-extension.py`，生成 `releases/mingxi-extension-<版本号>.zip`。脚本会检查 Manifest 中引用的核心文件，并将 `extension/` 下的文件打包到 ZIP 根目录。

诊断只覆盖可读取的网页文字和纯色背景；渐变、背景图片、遮挡元素和 Canvas 内文字需要人工复核。

## 许可证

项目代码采用 MIT License。第三方算法、方法和测试资源仍遵循各自的许可证，请查看插件内的来源与署名信息。
