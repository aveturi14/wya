// The one place wya talks to its AI provider (OpenAI; docs/PHASE8.md AI-1).
//
// Every model call goes through here, like lib/payments/ for PayID, so changing
// provider or model later touches one file. Models come from secrets with a
// default in code; token counts are logged per call for cost tracking.
// 8.10's assistant adds a `complete()` with tools next to `extractJson()`.

const OPENAI_URL = 'https://api.openai.com/v1/responses';

// Override with the OPENAI_MODEL_VISION / OPENAI_MODEL secrets, no deploy needed
const DEFAULT_VISION_MODEL = 'gpt-5-mini';

export class LlmError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export function visionModel(): string {
  return Deno.env.get('OPENAI_MODEL_VISION') ?? Deno.env.get('OPENAI_MODEL') ?? DEFAULT_VISION_MODEL;
}

type ExtractArgs = {
  /** What the call is for, in the logs ("scan-receipt") */
  task: string;
  system: string;
  prompt: string;
  image: { base64: string; mime: string };
  /** A JSON schema in OpenAI's strict subset: every property required, additionalProperties false */
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
};

/** Reads an image into JSON that matches `schema`. Throws LlmError on any failure. */
export async function extractJson<T>(args: ExtractArgs): Promise<T> {
  const model = args.model ?? visionModel();
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: args.system }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: args.prompt },
            { type: 'input_image', image_url: `data:${args.image.mime};base64,${args.image.base64}`, detail: 'high' },
          ],
        },
      ],
      text: { format: { type: 'json_schema', name: args.schemaName, schema: args.schema, strict: true } },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Never log the request (it holds the photo); the provider's message is enough
    console.error(`[llm] ${args.task} ${model} failed: ${res.status} ${body?.error?.message ?? ''}`);
    throw new LlmError(res.status === 429 ? 'The reader is busy. Try again in a minute.' : 'Couldn\'t read it this time.',
      res.status === 429 ? 429 : 502);
  }
  console.log(`[llm] ${args.task} ${model} in=${body?.usage?.input_tokens ?? '?'} out=${body?.usage?.output_tokens ?? '?'}`);

  const message = (body?.output ?? []).find((o: { type: string }) => o.type === 'message');
  const part = message?.content?.find((c: { type: string }) => c.type === 'output_text' || c.type === 'refusal');
  if (!part || part.type === 'refusal') throw new LlmError('Couldn\'t read it this time.', 422);
  try {
    return JSON.parse(part.text) as T;
  } catch {
    throw new LlmError('Couldn\'t read it this time.');
  }
}
