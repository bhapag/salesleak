import type { AIProvider } from "../types";

const DEFAULT_MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Talks to Anthropic's Messages API directly over fetch — no SDK dependency
 * for one HTTP call. Reads ANTHROPIC_API_KEY (never exposed client-side;
 * this file only ever runs on the server) and an optional AI_MODEL override.
 * Swapping to a different provider later means writing one more file that
 * implements AIProvider — nothing else in the AI layer references this
 * class by name.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async generateJSON({ system, prompt, maxTokens = 1024 }: { system: string; prompt: string; maxTokens?: number }) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = json.content?.find((block) => block.type === "text")?.text ?? "";
    return {
      text,
      usage: { inputTokens: json.usage?.input_tokens, outputTokens: json.usage?.output_tokens },
    };
  }
}

export const anthropicProvider = new AnthropicProvider();
