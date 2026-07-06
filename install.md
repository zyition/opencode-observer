# Installation

## For Humans

Paste this into your opencode session:
```
安装并配置 opencode-observer 插件，按照这里的说明操作：
https://raw.githubusercontent.com/zyition/opencode-observer/refs/heads/master/install.md
```

或者手动安装，在 `opencode.jsonc` 中添加：
```json
"plugin": ["opencode-observer@git+https://github.com/zyition/opencode-observer.git"]
```

## For LLM Agents

如果你是一个 LLM Agent，正在帮助用户安装 opencode-observer 插件，请按以下步骤操作。

### 插件简介

opencode-observer 是一个 OpenCode 插件，为不支持图片输入的主模型提供多模态视觉分析能力。它拦截用户粘贴的图片，自动调度 `observer` 子智能体进行分析（UI 还原、问题定位、日志提取、OCR、图表提取）。

### Step 0: 确认环境

```bash
# 检查 opencode 是否安装
if command -v opencode &> /dev/null; then
    echo "OpenCode $(opencode --version) 已安装"
else
    echo "请先安装 OpenCode: https://opencode.ai/docs"
    exit 1
fi
```

### Step 1: 检查 observer 的模型配置

插件需要一个**支持图片输入的多模态模型**来驱动 observer agent。读取用户的 opencode.jsonc，检查是否已有可用的多模态模型：

```bash
cat ~/.config/opencode/opencode.jsonc
```

如果已经配置了支持 `image` 的模型，记录其 model ID；如果没有，询问用户要使用哪个模型。常见的选择包括 Claude Sonnet 4（Anthropic）、GPT-4o（OpenAI）、Gemini 2.5 Pro（Google）等支持图片输入的多模态模型。

> 💡 如果用户使用 **opencode zen** 模式，可以优先选择成本较低的多模态模型（如 `gemini-2.5-pro` 或 `gpt-4o`），避免增加 token 消耗。

**注意**：必须选择模型中 `modalities.input` 包含 `"image"` 的模型。

### Step 2: 添加插件引用

根据安装方式，在 `opencode.jsonc` 中配置插件路径：

**方式一：Git（推荐）**
```jsonc
{
  "plugin": ["opencode-observer@git+https://github.com/zyition/opencode-observer.git"]
}
```

**方式二：本地路径**
```jsonc
{
  "plugin": ["./path/to/opencode-observer/index.js"]
}
```

### Step 3: 配置 observer agent

在 `opencode.jsonc` 中为 observer 指定多模态模型：

```jsonc
{
  "agent": {
    "observer": {
      "model": "你的多模态模型 ID"
    }
  }
}
```

如果用户已有的 opencode.jsonc 使用 `"agents"`（V2 格式）而非 `"agent"`（V1 格式），则改为：

```jsonc
{
  "agents": {
    "observer": {
      "model": "你的多模态模型 ID"
    }
  }
}
```

其他配置项（description、mode、system、permission）**无需填写**，插件会在加载时自动设置默认值。

如果用户有多个支持图片的模型，建议为 observer 选择成本较低的那个。

### Step 4: 验证配置

```bash
cat ~/.config/opencode/opencode.jsonc
```

确认包含以下内容：
- `plugin` 数组中包含 Git 形式的 `opencode-observer@git+https://...` 或对应的本地路径
- `agent` / `agents` 中包含 `observer` 条目，且 `model` 指向支持图片的多模态模型

### Step 5: 重启生效

```bash
# 重启 opencode 使配置生效
# 用户下次启动 opencode 即可使用
echo "配置完成。重启 opencode 后插件自动生效。"
```

### 验证功能

启动 opencode 后，向聊天中粘贴一张图片：
1. 如果主模型不支持图片，会自动出现 `@observer` 的指令
2. 图片会被自动保存到临时目录
3. observer 子智能体会自动分析图片并返回结构化结果

### 卸载

如需卸载：
1. 从 `opencode.jsonc` 的 `plugin` 数组中移除 `opencode-observer@git+https://...` 条目
2. 从 `agent` / `agents` 中移除 `observer` 条目
3. 重启 opencode

### ⚠️ 注意事项

- **必须为 observer 配置多模态模型**，否则插件会保存图片但不会分析，并输出配置引导
- 插件不会覆盖用户已在 `agent.observer` 或 `agents.observer` 中配置的字段，仅当字段不存在时设默认值
- 图片保存在 `$TMPDIR/opencode/` 目录，opencode 自动清理，无需手动管理
