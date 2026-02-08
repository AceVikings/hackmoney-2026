/**
 * OpenAI helper — thin wrapper around the chat completions API.
 * Uses native fetch so we don't need the openai npm package.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌  OPENAI_API_KEY is not set. Agents will not work.');
  process.exit(1);
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  model = 'gpt-4o-mini',
  maxTokens = 1024,
): Promise<string> {
  // Some newer models (gpt-5-*) don't support temperature or max_tokens
  const body: Record<string, any> = { model, messages };

  // Prefer max_completion_tokens (newer API) but fall back for older models
  body.max_completion_tokens = maxTokens;

  // Only set temperature for models that support it
  const noTempModels = ['gpt-5', 'o1', 'o3', 'o4'];
  if (!noTempModels.some((prefix) => model.startsWith(prefix))) {
    body.temperature = 0.3;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}
