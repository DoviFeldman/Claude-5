// Provider-swappable LLM client: anthropic (default), openai, or deepseek.
// All calls go through complete(system, prompt) which returns plain text.
import { config } from './config.js';

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
};

async function post(url, apiKeyHeader, body) {
  // Transient network blips and 5xx/429s shouldn't kill a whole build — retry.
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...apiKeyHeader },
        body: JSON.stringify(body),
        // A hung connection would otherwise stall a build forever.
        signal: AbortSignal.timeout(240_000),
      });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        const err = new Error(
          `LLM request failed (HTTP ${res.status}): ${(await res.text()).slice(0, 500)}`
        );
        if (!retryable) throw { fatal: true, err };
        throw err;
      }
      return res.json();
    } catch (e) {
      if (e.fatal) throw e.err;
      if (attempt >= 3) throw e instanceof Error ? e : e.err;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
}

export async function complete(system, prompt, opts = {}) {
  const primary = config.llmModel || DEFAULT_MODELS[config.llmProvider];
  // Each attempt is "provider:model"; fallbacks default to the same provider.
  const attempts = [
    `${config.llmProvider}:${primary}`,
    ...config.llmFallbackModels.map((m) =>
      m.includes(':') ? m : `${config.llmProvider}:${m}`
    ),
  ];
  let lastErr;
  for (const attempt of attempts) {
    const [provider, model] = [
      attempt.slice(0, attempt.indexOf(':')),
      attempt.slice(attempt.indexOf(':') + 1),
    ];
    try {
      return await completeWith(provider, model, system, prompt, opts);
    } catch (err) {
      lastErr = err;
      console.error(`[llm] ${attempt} failed (${err.message.slice(0, 120)})`);
    }
  }
  throw lastErr;
}

async function completeWith(provider, model, system, prompt, { maxTokens = 4000 } = {}) {
  if (!model) throw new Error(`Unknown LLM_PROVIDER "${provider}" (use anthropic|openai|deepseek)`);

  if (provider === 'anthropic') {
    if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set in server/.env');
    const json = await post(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }
    );
    return json.content.map((b) => b.text || '').join('');
  }

  // openai and deepseek share the OpenAI chat-completions shape
  const base = provider === 'deepseek' ? config.deepseekBaseUrl : 'https://api.openai.com/v1';
  const key = provider === 'deepseek' ? config.deepseekApiKey : config.openaiApiKey;
  if (!key) throw new Error(`${provider.toUpperCase()}_API_KEY is not set in server/.env`);
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
  // NVIDIA-hosted DeepSeek reasoning models: keep thinking off so responses
  // are fast and don't ramble.
  if (provider === 'deepseek' && base.includes('nvidia.com')) {
    body.chat_template_kwargs = { thinking: false };
  }
  const json = await post(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, body);
  return json.choices[0].message.content;
}

// LLMs occasionally wrap JSON in markdown fences or add a preamble; recover it.
export function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(candidate.slice(start));
}
