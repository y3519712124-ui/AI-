# AI智财助手（微信小程序）

基于微信云开发的简化版财务助手，包含 5 个核心页面：

- 首页：收支、结余、快捷入口、最近消费
- 记账页：金额 + 分类 + 备注
- 分析页：消费分类柱状图
- 目标页：储蓄目标进度
- 学习页：金融知识内容展示

同时支持数据导出 CSV，方便做大创报告。

## 云开发配置

1. 在微信开发者工具开通云开发环境
2. 打开 `miniprogram/app.js`，配置 `env` 为你的环境 ID
3. 右键 `cloudfunctions/quickstartFunctions`，执行“上传并部署：云端安装依赖”

## 百度 OCR 与语音识别配置（可选）

拍照识单和语音记账需要百度智能云凭据。复制
`miniprogram/config/baidu.example.js` 为 `miniprogram/config/baidu.js`，
再填入你自己的 API Key 和 Secret Key。`baidu.js` 已被 Git 忽略，不会提交到仓库。

未配置凭据时，其余记账、分析、目标和学习功能仍可正常使用。

## 数据存储

使用云数据库集合：

- `finance_records`：账单记录
- `finance_goals`：目标记录

## 导出数据

首页点击“导出CSV（报告用）”：

- 自动汇总后台账单数据
- 生成 `records_export.csv`
- 可在小程序中直接打开并导出用于报告
