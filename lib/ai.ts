import Anthropic from "@anthropic-ai/sdk";
import { loadDb } from "./localdb";

// Claude is called straight from the browser with the user's own key
// (stored on-device in Settings). No server sees it.

export class ApiKeyMissingError extends Error {
  constructor() {
    super("No API key yet — open Settings and paste your Anthropic API key first.");
    this.name = "ApiKeyMissingError";
  }
}

function getClient(): { client: Anthropic; model: string } {
  const { apiKey, model } = loadDb().settings;
  if (!apiKey) throw new ApiKeyMissingError();
  return {
    client: new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
    }),
    model: model || "claude-sonnet-5",
  };
}

export async function askClaude(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const { client, model } = getClient();
  const res = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Ask Claude for JSON and parse it, tolerating markdown fences and prose around it. */
export async function askClaudeJson<T>(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<T> {
  const text = await askClaude(opts);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Claude did not return JSON: " + text.slice(0, 300));
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
