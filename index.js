import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const tempDir = join(tmpdir(), "opencode")
mkdirSync(tempDir, { recursive: true })

const MAX_AGE_MS = 3600_000
try {
  for (const name of readdirSync(tempDir)) {
    const filepath = join(tempDir, name)
    try {
      if (Date.now() - statSync(filepath).mtimeMs > MAX_AGE_MS) {
        unlinkSync(filepath)
      }
    } catch {}
  }
} catch {}

const supportsImage = new Map()
let observerModelConfigured = false

function loadSystemPrompt() {
  try {
    return readFileSync(join(__dirname, "system.md"), "utf-8")
  } catch {
    return null
  }
}

const OBSERVER_SYSTEM = loadSystemPrompt()

const OBSERVER_INSTRUCTION = [
  "## 图片解读",
  "- 你应该使用 @observer 子智能体来解读图像。",
  "- 当对话中出现 [图片已保存至: <path>] 这样的消息时，调用 @observer 子智能体并告知其读取该路径的图片文件进行解读。",
  "- 如果图片中包含文字/代码/报错/UI 界面，Observer 会做结构化提取，无需重复描述。",
].join("\n")

function makeErrorText(text, sessionID, messageID) {
  return {
    type: "text",
    text,
    synthetic: true,
    id: "prt_" + randomUUID(),
    sessionID,
    messageID,
  }
}

export const server = async (_ctx, options) => {
  return {
    config: async (cfg) => {
      cfg.agent = cfg.agent || {}
      if (!cfg.agent["observer"]) {
        cfg.agent["observer"] = {}
      }

      const agent = cfg.agent["observer"]

      agent.description = agent.description || "多模态视觉分析：读取并分析图片/截图/设计稿/日志，提取文字、还原布局、定位 UI 问题、提取报错信息"
      agent.mode = agent.mode || "subagent"
      agent.permission = agent.permission || {
        edit: "deny",
        bash: "deny",
        task: "deny",
      }

      if (!agent.system && OBSERVER_SYSTEM) {
        agent.system = OBSERVER_SYSTEM
      }

      if (!agent.model && options?.model) {
        agent.model = options.model
      }

      observerModelConfigured = !!agent.model
    },

    "experimental.chat.system.transform": async (input, output) => {
      try {
        const capable = input.model?.capabilities?.input?.image ?? false
        if (input.sessionID) {
          supportsImage.set(input.sessionID, capable)
        }
        if (!capable) {
          output.system.push(OBSERVER_INSTRUCTION)
        }
      } catch (err) {
        console.error("[opencode-observer] system.transform error:", err)
      }
    },

    "chat.message": async (input, output) => {
      try {
        const capable = supportsImage.get(input.sessionID)
        if (capable) return

        let imageFound = false
        const imagePaths = []

        for (let i = 0; i < output.parts.length; i++) {
          const part = output.parts[i]
          if (part.type !== "file") continue
          if (!part.mime?.startsWith("image/")) continue
          if (!part.url?.startsWith("data:")) continue

          const base64 = part.url.split(",")[1]
          if (!base64) {
            output.parts.push(makeErrorText(
              "[opencode-observer ERROR] 图片 base64 数据为空",
              input.sessionID, output.message.id,
            ))
            continue
          }

          const ext = part.mime.split("/")[1]?.replace("jpeg", "jpg") || "png"
          const filename = `observer_pasted_${randomUUID()}.${ext}`
          const filepath = join(tempDir, filename)

          try {
            writeFileSync(filepath, Buffer.from(base64, "base64"))
            output.parts[i] = {
              type: "text",
              text: `[图片已保存至: ${filepath}]`,
              synthetic: true,
              id: "prt_" + randomUUID(),
              sessionID: input.sessionID,
              messageID: output.message.id,
            }
            imageFound = true
            imagePaths.push(filepath)
          } catch (err) {
            output.parts.push(makeErrorText(
              `[opencode-observer ERROR] 图片保存失败: ${err.message}`,
              input.sessionID, output.message.id,
            ))
          }
        }

        if (!imageFound) return

        if (!observerModelConfigured) {
          output.parts.push(makeErrorText(
            "⚠️ 图片已拦截保存，但 **observer 子智能体未配置模型**，无法调用视觉分析。\n\n"
            + "请在 opencode.jsonc 中为 observer 指定一个多模态模型，例如：\n\n"
            + '```jsonc\n{\n  "agent": {\n    "observer": {\n      "model": "你的多模态模型 ID"\n    }\n  }\n}\n```',
            input.sessionID, output.message.id,
          ))
          return
        }

        const userText = output.parts
          .filter(p => p.type === "text" && !p.synthetic)
          .map(p => p.text)
          .join("\n")
          .slice(0, 300)

        if (userText) {
          output.parts.push(makeErrorText(
            `[用户查询: ${userText}]`,
            input.sessionID, output.message.id,
          ))
        }

        const imageList = imagePaths.map((p, i) => `[Image ${i + 1}] ${p}`).join("\n")
        const observerPrompt = userText
          ? `读取并分析图片文件:\n${imageList}\n用户需求: ${userText}`
          : `读取并分析图片文件:\n${imageList}`

        output.parts.push({
          type: "subtask",
          agent: "observer",
          description: "图片分析",
          prompt: observerPrompt,
          id: "prt_" + randomUUID(),
          sessionID: input.sessionID,
          messageID: output.message.id,
        })
      } catch (err) {
        console.error("[opencode-observer] chat.message error:", err)
        output.parts.push(makeErrorText(
          `[opencode-observer ERROR] 内部错误: ${err.message}`,
          input.sessionID, output.message.id,
        ))
      }
    },
  }
}
