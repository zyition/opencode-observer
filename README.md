# opencode-observer

OpenCode 插件：为不支持图片输入的主模型提供多模态视觉分析能力。

当聊天中粘贴图片时，插件会自动将图片保存到临时目录，调度 `@observer` 子智能体进行结构化分析（UI 还原、问题定位、日志提取、OCR 等）。

## 安装指南

### For Humans

将以下内容粘贴到 opencode 会话中：

```
安装并配置 opencode-observer 插件，按照这里的说明操作：
https://raw.githubusercontent.com/zyition/opencode-observer/refs/heads/master/install.md
```

或者手动安装：

### 方式一：Git（推荐）

```json
{
  "plugin": ["opencode-observer@git+https://github.com/zyition/opencode-observer.git"]
}
```

### 方式二：本地文件

将插件克隆或下载到本地，然后在配置中引用：

```json
{
  "plugin": ["./path/to/opencode-observer/index.js"]
}
```

## 配置

observer 需要使用支持图片输入的多模态模型。在 opencode.jsonc 中配置：

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

推荐使用 Claude Sonnet 4、GPT-4o、Gemini 2.5 Pro 等具备视觉能力的模型。

### 自定义 system prompt

```json
{
  "agents": {
    "observer": {
      "system": "你的自定义 system prompt..."
    }
  }
}
```

## 使用

安装配置完成后，直接在聊天中粘贴图片即可：

1. **粘贴图片** — 拖拽、截图后粘贴，或复制文件后粘贴到输入框
2. **可选：附带文字说明** — 例如"分析这个报错"、"还原这个页面布局"、"提取图中的文字"
3. 插件自动调度 `@observer` 子智能体分析图片，返回结构化结果

无需手动 mention `@observer`，插件会自动处理。

## 工作原理

1. 插件通过 `experimental.chat.system.transform` 钩子，在主模型的 system prompt 中注入使用 @observer 的指令
2. 用户发送图片后，`chat.message` 钩子拦截消息，将图片 data URL 解码保存到 opencode 临时目录
3. 图片路径以 `[图片已保存至: /tmp/...]` 标记替换原附件
4. 自动创建 subtask 调度 observer agent 分析图片
5. Observer 读取图片后按模式（页面还原/问题定位/日志提取/OCR/图表提取）输出结构化分析

## 行为

- **主模型支持图片输入时**：插件自动禁用自己的拦截逻辑，不做任何干预
- **主模型不支持图片时**：完整执行上述拦截-保存-调度流程
- **未配置 observer 模型时**：图片会被保存但不会调度分析，插件会输出清晰的配置引导

## 致谢

本插件基于 [qtalen/agentic-ai-playground](https://github.com/qtalen/agentic-ai-playground/tree/v0.16.0/16_DeepSeek_Read_Images) 项目中的 observer 模式重构而来，感谢原作者的开源工作。
