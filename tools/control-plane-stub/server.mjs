// Control-plane stub for the spike (lane A).
//
// Plain node:http, no dependencies. Answers exactly what the client needs to
// run signed-out and un-throttled:
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
//   anything else  → 404 JSON.
//
// Every request is logged as one line on stdout: `METHOD path -> status`.
//
// Run:  node tools/control-plane-stub/server.mjs            (port 4300)
//       STUB_PORT=4310 node tools/control-plane-stub/server.mjs

import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 4300;

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

export function startStub(port = Number(process.env.STUB_PORT) || DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
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
    console.log(`${req.method} ${url.pathname} -> ${status}`);
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
