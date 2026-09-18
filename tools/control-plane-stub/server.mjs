// Control-plane stub for the spike (lanes A + G).
//
// Plain node:http, no dependencies. Answers exactly what the client needs to
// run signed-out and un-throttled, plus the managed-LLM gateway (lane G):
//
//   GET /v1/config → RowboatApiConfig shape (see
//     apps/x/packages/core/src/config/remote-config.ts:14-20 and the zod
//     schema in apps/x/packages/shared/src/rowboat-account.ts:22-57).
//     NOTE: the prompt's four-field sketch is extended with a `billing`
//     catalog because rowboat.ts:12 runs RowboatApiConfig.parse(), which
//     REQUIRES `billing: { plans: [...] }` — without it config parsing
//     throws and billing/auth break. Optional fields (creditActivations,
//     modelRecommendations) are omitted on purpose.
//   GET /v1/me     → the wire shape billing.ts:15-42 parses, with a `spike`
//     plan whose buckets hold 1e12 credits and 0 used: a plan that never
//     runs out. Auth is deliberately NOT checked (the real backend wants a
//     Bearer; the signed-out app never calls this — getAccessToken() throws
//     'Not signed into Rowboat' first — so leniency only helps scripts).
//
// Lane G — managed gateway (Spinrun in the vendor's seat, locally):
//
//   POST /v1/llm/chat/completions → streaming pass-through to
//     ${STUB_LLM_UPSTREAM:-https://ai-gateway.vercel.sh/v1}/chat/completions
//     with `Authorization: Bearer $AI_GATEWAY_API_KEY`.
//     - Requires an incoming bearer starting with `spr_`, else 401.
//     - Upstream body is built from a whitelist exactly as the real endpoint
//       will: model, messages, tools, tool_choice, parallel_tool_calls,
//       temperature, top_p, frequency_penalty, presence_penalty, stop, seed,
//       response_format, stream, and `reasoning` reduced to
//       effort/enabled/exclude. Everything else is dropped (models, provider,
//       providerOptions, n, user, …). max_tokens = min(client or 8192, 8192).
//       When stream is true, stream_options.include_usage is forced true.
//       NOTE on `reasoning`: lane C2 step 2b recorded the gateway ACCEPTS
//       `reasoning` (thoughtsTokenCount:13 in the fixture), so the stub
//       keeps the reduced form instead of dropping it.
//     - Drops every incoming x-rowboat-* and authorization header (only
//       Content-Type + the platform Authorization go upstream).
//     - Pipes the upstream body through byte-for-byte; aborts upstream when
//       the client disconnects.
//   GET /v1/llm/models → upstream /models mapped to {data:[{id}]}, language
//     models only; with ?output_modalities=image answers {data:[]}.
//     Requires the spr_ bearer, else 401.
//   POST /v1/llm/images → 501
//     {error:{code:"not_implemented",message:…,type:"invalid_request_error"}}.
//     Requires the spr_ bearer, else 401.
//
//   Env STUB_LLM_FORCE=401|402|429 makes chat/completions answer that status
//   with an OpenAI-style error body (no upstream call).
//
// Every request is logged as one line on stdout:
//   `METHOD path -> status upstream=<ms>ms usage prompt=<n> completion=<n> total=<n>`
// or `… usage -` when no usage was observed. Never a body, never a key.
//
// Run:  node tools/control-plane-stub/server.mjs            (port 4300)
//       STUB_PORT=4310 node tools/control-plane-stub/server.mjs

import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 4300;
const MAX_TOKENS_CAP = 8192;

const NEVER_OUT = 1_000_000_000_000;

// Mirrors BillingCatalogPlanSchema
// (apps/x/packages/shared/src/billing.ts:14-22).
const SPIKE_PLAN = {
  id: 'spike',
  category: 'free',
  displayName: 'Spike',
  monthlyCredits: NEVER_OUT,
  dailyCredits: NEVER_OUT,
  monthlyPriceCents: null,
};

function configBody(port) {
  return {
    appUrl: `http://127.0.0.1:${port}`,
    supabaseUrl: '',
    websocketApiUrl: '',
    spacesApexUrl: null,
    billing: { plans: [SPIKE_PLAN] },
  };
}

// Mirrors the wire shape billing.ts:15-42 reads.
function meBody() {
  const bucket = (extra = {}) => ({
    sanctionedCredits: NEVER_OUT,
    usedCredits: 0,
    availableCredits: NEVER_OUT,
    ...extra,
  });
  return {
    user: { id: 'spike-user', email: 'spike@localhost' },
    billing: {
      planId: 'spike',
      status: 'active',
      trialExpiresAt: null,
      usage: {
        monthly: bucket(),
        daily: bucket({ usageDay: new Date().toISOString().slice(0, 10) }),
        store: { availableCredits: NEVER_OUT },
      },
    },
  };
}

function stubUpstreamBase() {
  const raw = process.env.STUB_LLM_UPSTREAM || 'https://ai-gateway.vercel.sh/v1';
  return raw.replace(/\/+$/, '');
}

function incomingBearer(req) {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function hasStaticBearer(req) {
  const token = incomingBearer(req);
  return typeof token === 'string' && token.startsWith('spr_');
}

function openAiError(status, message, type, code) {
  return { error: { message, type, code } };
}

function forcedErrorBody(status) {
  if (status === 401) {
    return openAiError(401, 'Invalid API key', 'authentication_error', 'invalid_api_key');
  }
  if (status === 402) {
    return openAiError(402, 'Insufficient credits', 'billing_error', 'insufficient_credits');
  }
  if (status === 429) {
    return openAiError(429, 'Rate limit exceeded', 'rate_limit_error', 'rate_limit_exceeded');
  }
  return openAiError(status, `Forced status ${status}`, 'invalid_request_error', 'forced');
}

function reduceReasoning(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = {};
  if (typeof value.effort === 'string') out.effort = value.effort;
  if (typeof value.enabled === 'boolean') out.enabled = value.enabled;
  if (typeof value.exclude === 'boolean') out.exclude = value.exclude;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Build the upstream chat body from the whitelist exactly as the real
 * Spinrun endpoint will. Drops everything else (models, provider,
 * providerOptions, n, user, …).
 */
export function buildUpstreamChatBody(clientBody) {
  const src = clientBody && typeof clientBody === 'object' && !Array.isArray(clientBody) ? clientBody : {};
  const out = {};
  for (const key of [
    'model',
    'messages',
    'tools',
    'tool_choice',
    'parallel_tool_calls',
    'temperature',
    'top_p',
    'frequency_penalty',
    'presence_penalty',
    'stop',
    'seed',
    'response_format',
    'stream',
  ]) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  const reasoning = reduceReasoning(src.reasoning);
  if (reasoning) out.reasoning = reasoning;
  const clientMax = typeof src.max_tokens === 'number' ? src.max_tokens : MAX_TOKENS_CAP;
  out.max_tokens = Math.min(clientMax, MAX_TOKENS_CAP);
  if (out.stream === true) {
    out.stream_options = { include_usage: true };
  }
  return out;
}

function readRequestBody(req, limitBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseUsageFromSseText(text) {
  let last = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const obj = JSON.parse(payload);
      if (obj && typeof obj === 'object' && obj.usage && typeof obj.usage === 'object') {
        last = obj.usage;
      }
    } catch {
      // Non-JSON data line — ignore for usage purposes.
    }
  }
  return last;
}

function usageNumbers(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const p = usage.prompt_tokens;
  const c = usage.completion_tokens;
  const t = usage.total_tokens;
  if (typeof p !== 'number' || typeof c !== 'number' || typeof t !== 'number') return null;
  return { prompt: p, completion: c, total: t };
}

function usageSuffix(numbers) {
  if (!numbers) return 'usage -';
  return `usage prompt=${numbers.prompt} completion=${numbers.completion} total=${numbers.total}`;
}

function logLine(method, pathWithQuery, status, upstreamMs, numbers) {
  console.log(`${method} ${pathWithQuery} -> ${status} upstream=${upstreamMs}ms ${usageSuffix(numbers)}`);
}

function isLanguageModelEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || entry.id.length === 0) {
    return null;
  }
  const modalities = entry.architecture?.output_modalities;
  if (Array.isArray(modalities)) {
    const lowered = modalities.map((m) => String(m).toLowerCase());
    if (!lowered.includes('text')) return null;
  }
  return { id: entry.id };
}

async function handleChatCompletions(req, res, url) {
  const pathWithQuery = url.pathname + url.search;
  const forceRaw = process.env.STUB_LLM_FORCE;
  const forced = forceRaw === '401' || forceRaw === '402' || forceRaw === '429' ? Number(forceRaw) : null;
  if (forced !== null) {
    const body = forcedErrorBody(forced);
    res.writeHead(forced, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, forced, 0, null);
    return;
  }
  if (!hasStaticBearer(req)) {
    const body = openAiError(401, 'Missing or invalid bearer token', 'authentication_error', 'unauthorized');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, 401, 0, null);
    return;
  }
  let clientBody;
  try {
    const raw = await readRequestBody(req);
    clientBody = raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {};
  } catch {
    const body = openAiError(400, 'Invalid JSON body', 'invalid_request_error', 'invalid_json');
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, 400, 0, null);
    return;
  }
  const upstreamBody = buildUpstreamChatBody(clientBody);
  const upstreamUrl = `${stubUpstreamBase()}/chat/completions`;
  const platformKey = process.env.AI_GATEWAY_API_KEY || '';
  const controller = new AbortController();
  // Abort upstream when the client disconnects. Use the response's close
  // (not the request's): req 'close' fires normally after the body is read,
  // while res 'close' with !writableEnded means the client went away.
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);
  const started = Date.now();
  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${platformKey}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });
  } catch (err) {
    res.off('close', onClose);
    if (controller.signal.aborted) {
      // Client went away; upstream aborted. Nothing left to answer.
      try {
        res.destroy();
      } catch {}
      return;
    }
    const body = openAiError(502, 'Upstream fetch failed', 'invalid_request_error', 'upstream_error');
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, 502, Date.now() - started, null);
    return;
  }
  const status = upstreamRes.status;
  const contentType = upstreamRes.headers.get('content-type') || 'application/json';
  res.writeHead(status, { 'Content-Type': contentType });
  const chunks = [];
  try {
    if (upstreamRes.body) {
      for await (const chunk of upstreamRes.body) {
        const buf = Buffer.from(chunk);
        chunks.push(buf);
        if (!res.write(buf)) {
          await new Promise((resolve) => res.once('drain', resolve));
        }
      }
    }
  } catch {
    // Upstream aborted mid-stream (client disconnect) — stop piping.
    res.off('close', onClose);
    try {
      res.destroy();
    } catch {}
    return;
  }
  res.off('close', onClose);
  res.end();
  const upstreamMs = Date.now() - started;
  const text = Buffer.concat(chunks).toString('utf8');
  let numbers = null;
  if (contentType.includes('text/event-stream')) {
    numbers = usageNumbers(parseUsageFromSseText(text));
  } else {
    try {
      const parsed = JSON.parse(text);
      numbers = usageNumbers(parsed?.usage);
    } catch {
      numbers = null;
    }
  }
  logLine(req.method, pathWithQuery, status, upstreamMs, numbers);
}

async function handleListModels(req, res, url) {
  const pathWithQuery = url.pathname + url.search;
  if (!hasStaticBearer(req)) {
    const body = openAiError(401, 'Missing or invalid bearer token', 'authentication_error', 'unauthorized');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, 401, 0, null);
    return;
  }
  if (url.searchParams.get('output_modalities') === 'image') {
    const body = { data: [] };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, 200, 0, null);
    return;
  }
  const upstreamUrl = `${stubUpstreamBase()}/models`;
  const platformKey = process.env.AI_GATEWAY_API_KEY || '';
  const started = Date.now();
  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${platformKey}` },
    });
  } catch {
    const body = openAiError(502, 'Upstream fetch failed', 'invalid_request_error', 'upstream_error');
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, 502, Date.now() - started, null);
    return;
  }
  const upstreamMs = Date.now() - started;
  if (!upstreamRes.ok) {
    const body = openAiError(
      upstreamRes.status,
      `Upstream /models failed: ${upstreamRes.status}`,
      'invalid_request_error',
      'upstream_error',
    );
    res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, upstreamRes.status, upstreamMs, null);
    return;
  }
  let parsed;
  try {
    parsed = await upstreamRes.json();
  } catch {
    parsed = null;
  }
  const data = Array.isArray(parsed?.data) ? parsed.data : [];
  const mapped = data.flatMap((entry) => {
    const kept = isLanguageModelEntry(entry);
    return kept ? [kept] : [];
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: mapped }));
  logLine(req.method, pathWithQuery, 200, upstreamMs, null);
}

export function startStub(port = Number(process.env.STUB_PORT) || DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathWithQuery = url.pathname + url.search;
    // Async LLM routes handle their own response + logging.
    if (req.method === 'POST' && url.pathname === '/v1/llm/chat/completions') {
      void handleChatCompletions(req, res, url).catch(() => {
        try {
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(openAiError(500, 'Stub handler failed', 'invalid_request_error', 'stub_error')));
          }
        } catch {}
        logLine(req.method, pathWithQuery, 500, 0, null);
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/llm/models') {
      void handleListModels(req, res, url).catch(() => {
        try {
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(openAiError(500, 'Stub handler failed', 'invalid_request_error', 'stub_error')));
          }
        } catch {}
        logLine(req.method, pathWithQuery, 500, 0, null);
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/llm/images') {
      if (!hasStaticBearer(req)) {
        const body = openAiError(401, 'Missing or invalid bearer token', 'authentication_error', 'unauthorized');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
        logLine(req.method, pathWithQuery, 401, 0, null);
        return;
      }
      const body = {
        error: {
          code: 'not_implemented',
          message: 'Image generation is not implemented in the spike stub',
          type: 'invalid_request_error',
        },
      };
      res.writeHead(501, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      logLine(req.method, pathWithQuery, 501, 0, null);
      return;
    }
    let status = 200;
    let body;
    if (req.method === 'GET' && url.pathname === '/v1/config') {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      body = configBody(actualPort);
    } else if (req.method === 'GET' && url.pathname === '/v1/me') {
      body = meBody();
    } else {
      status = 404;
      body = { error: { code: 'not_found', message: `no stub route for ${req.method} ${url.pathname}` } };
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    logLine(req.method, pathWithQuery, status, 0, null);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const server = await startStub();
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : DEFAULT_PORT;
  console.log(`control-plane stub listening on http://127.0.0.1:${actualPort}`);
}
