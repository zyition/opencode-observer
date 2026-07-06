# opencode-observer 插件配置

## 概述

opencode-observer 是一个 OpenCode 插件，为不支持图片输入的主模型代理提供多模态视觉分析能力。它拦截用户发送的图片消息，将图片保存到本地临时目录，然后调度 `observer` 子智能体对图片进行结构化分析。

## 安装方式

### 通过 Git 安装

```json
{
  "plugin": ["opencode-observer@git+https://github.com/zyition/opencode-observer.git"]
}
```

详细的安装步骤请阅读 [install.md](./install.md) 或直接让 opencode 读取该文件自动配置。

### 通过本地路径

```json
{
  "plugin": ["./path/to/opencode-observer/index.js"]
}
```

## 必要配置

observer 需要**多模态模型**才能工作。必须在 `opencode.jsonc` 中配置：

```json
{
  "agents": {
    "observer": {
      "model": "anthropic:claude-sonnet-4-20250514",
      "temperature": 0.1
    }
  }
}
```

如果未配置模型，插件会保存图片但不会调度分析，并输出清晰的配置引导提示。

## 插件注册的内容

| 项目 | 值 |
|------|-----|
| Agent ID | `observer` |
| Agent mode | `subagent` |
| Agent description | 多模态视觉分析：读取并分析图片/截图/设计稿/日志... |
| System prompt | 从 `system.md` 读取，包含完整的分析模式定义（页面还原/问题定位/日志提取/OCR/图表提取） |
| Hooks | `experimental.chat.system.transform`, `chat.message`, `config` |

## 插件钩子说明

### `config`
- 注册 `observer` 子智能体，设置 description、mode、system prompt
- 检查 model 配置状态

### `experimental.chat.system.transform`
- 检测当前主模型是否支持图片输入
- 若不支持，在主模型的 system prompt 中注入 @observer 使用说明

### `chat.message`
- 拦截用户消息中的图片附件（data URL 格式）
- 将图片解码保存到系统临时目录（`os.tmpdir()/opencode/`）
- 插件加载时清理超过 1 小时的过期图片
- 替换原图片附件为 `[图片已保存至: ...]` 文本标记
- 若 observer 已配置模型，创建 subtask 调度 observer 分析图片
- 若 observer 未配置模型，输出配置引导提示并停止处理

## observer 子智能体能力

observer agent 支持五种分析模式，按优先级自动匹配：

1. **模式 C 报错日志提取**（最高优先级）：逐字提取截图中报错/日志文本，保留堆栈跟踪
2. **模式 E 图表数据提取**：从图表截图中提取数据点、趋势、标注
3. **模式 B 问题定位与修复**：识别界面问题，分析原因，给出修复建议
4. **模式 A 页面还原**：像素级描述 UI 界面，输出布局图、元素属性、设计 token
5. **模式 D 文本/对话提取**（默认）：提取文字、厘清对话结构、表格数据

支持多图片批量分析，每张图片独立输出分析结果，最后汇总。

## 文件结构

```
opencode-observer/
├── index.js        # 插件主代码
├── system.md       # observer agent 的 system prompt
├── install.md      # LLM Agent 安装指南
├── README.md       # 用户文档
├── AGENTS.md       # 本文档
├── package.json    # npm 包元数据
├── LICENSE         # 开源许可证
└── .gitignore
```

## 自定义

用户可以在 `opencode.jsonc` 的 `agents.observer` 中覆盖以下字段：

| 字段 | 说明 |
|------|------|
| `model` | 指定多模态模型 |
| `temperature` | 控制输出随机性 |
| `system` | 自定义 system prompt 覆盖默认值 |
| `description` | 自定义 agent 描述 |
| `mode` | agent 模式（默认 subagent） |
| `permission` | 自定义权限规则 |

所有字段均为可选，插件仅在用户未设置时提供默认值。

> 如果插件的 `options.model` 指定了默认模型，且用户未在 `agents.observer.model` 中设置，插件会自动使用该默认值。
