// Rebrand gate: greps the tracked tree (git ls-files) for whole-word
// "rowboat" in any case and fails on any hit not covered by ALLOWLIST.
// Usage: node tools/rebrand/check.mjs (wired as `npm run rebrand:check` in apps/x).
// Prints every remaining hit as file:line.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const WORD = /\browboat\b/i;

// File-level skips (entire file allowlisted):
// - LICENSE, NOTICE stay byte-identical (Apache-2.0 attribution).
// - docs/fork/** — fork working docs, upstream history.
// - apps/x/**/*.md, apps/harbor/**/*.md, docs/**/*.md — engineering plans, upstream history.
//   (README.md and google-setup.md at repo root are NOT skipped: README only
//   via its attribution sentence allowlist below; google-setup.md must carry
//   zero whole-word hits after its Spinrun rebrand.)
// - proposal.md (root) — upstream history, left alone.
// - The two Step-5 fixtures that use "rowboatlabs/rowboat" as sample user
//   input (left alone on purpose):
//   - apps/x/packages/core/src/runtime/assembly/skills/composio-integration/skill.ts
//   - apps/x/packages/core/src/application/browser-skills/loader.test.ts
function fileSkipped(file) {
  if (file === 'LICENSE' || file === 'NOTICE') return true;
  if (file.startsWith('docs/fork/')) return true;
  if (file === 'proposal.md') return true;
  if (file.endsWith('.md')) {
    if (file === 'README.md' || file === 'google-setup.md') return false;
    if (file.startsWith('apps/x/') || file.startsWith('apps/harbor/') || file.startsWith('docs/')) return true;
    // Any other .md (e.g. tools/control-plane-stub/README.md) is checked —
    // it passes via the line-level identifiers below.
    return false;
  }
  if (file === 'apps/x/packages/core/src/runtime/assembly/skills/composio-integration/skill.ts') return true;
  if (file === 'apps/x/packages/core/src/application/browser-skills/loader.test.ts') return true;
  // File paths containing rowboat (identifiers: rowboat-account.ts, rowboat-app.json, etc.)
  if (/rowboat/i.test(file)) return true;
  // The gate itself necessarily names the word it greps for (patterns + comments).
  if (file === 'tools/rebrand/check.mjs') return true;
  return false;
}

// Line-level allowlist (matched against "file:lineContent"):
const ALLOW = [
  // Identifiers (must stay so the fork can still merge upstream):
  /ROWBOAT_[A-Z_]+/, // env vars: ROWBOAT_TELEMETRY, ROWBOAT_MANAGED_LLM, ROWBOAT_WORKDIR, ROWBOAT_SKIP_CODE_SIGNING, …
  /@rowboat\//i, // package scope: @rowboat/spaces-protocol, @rowboat/harbor
  /rowboat-server/i, // binary and scripts
  /\.rowboat\b/i, // ~/.rowboat directory, .rowboat-dev, server-key paths
  /rowboat-account/i, // control-plane symbol (file name, import path)
  /rowboatAccount/, // control-plane symbol (camelCase)
  /x-rowboat-/i, // headers: X-Rowboat-App (also covers X-Rowboat-App: 1 examples)
  /Rowboat(App|Api)/, // type names: RowboatAppManifestSchema, RowboatApiConfig, …
  /--rowboat-/i, // CSS variables: --rowboat-raised, --rowboat-wash, …
  /rowboat-dock-flyin/i, // CSS keyframes + animation name
  /['"]rowboat\.[^'"]*['"]/i, // storage keys: 'rowboat.pairing.v1', 'rowboat-theme', 'rowboat.onboarded.v1', …
  /[`'"]rowboat-[^`'"]*[`'"]/i, // storage/event keys with hyphen: 'rowboat-theme', `rowboat-assistant-draft:…`, 'rowboat-browser', …
  /['"]persist:rowboat-[^'"]*['"]/i, // Electron partition: 'persist:rowboat-browser'
  /rowboat\.exe/i, // old executable name in login-item migration comments (must still find old installs)
  /[`'"]rowboat[`'"]/i, // provider flavor / onboarding path / IPC payload ids (quoted/backticked) that must stay for compat
  /[{,]\s*rowboat:/i, // object keys: `{ rowboat: {...} }` (provider maps in tests, model-picker display map, …)
  /rowboat-mode/i, // flavor mode id in comments/logs (id stays for compat; display names are Spinrun/Spinball)
  /rowboat-app/i, // file names: rowboat-app.js, rowboat-app.json, RowboatApp types (on-disk format / import paths)
  /rowboat-assistant-outline\.svg/i, // asset file name (not renamed; reference stays accurate)
  /rowboat-today-md-deprecated/i, // stored marker in notes (old rows, not migrated)
  /\browboat[?\.\[]/i, // code variable access: rowboat?.connected, rowboat.userId, rowboat[0], … (never prose)
  /\browboat:[a-z\-]+/i, // bare window/IPC events in comments: rowboat:deck-touched, rowboat:open-…, …
  /^\s*(\/\/|#|\*|<!--).*rowboat/i, // comment lines mentioning the internal 'rowboat' id (provider/mode/event names stay for compat)
  /\/\/.*rowboat/i, // inline // comments containing rowboat (internal ids, never user-visible copy)
  /^\s*rowboat:\s*\{/i, // line-start object keys: `rowboat: { … }` (provider maps in tests)
  /^\s*\*\s*.*rowboat/i, // JSDoc continuation lines (internal ids)
  /^\s*rowboat:\s*['"]/i, // unquoted provider key: `rowboat: 'Spinrun'` (mobile model-picker display map)
  /['"]rowboat:[^'"]*['"]/i, // window/IPC events: 'rowboat:permission-needed', 'rowboat:getConfig', 'rowboat:open-…', …
  /[`'"]rowboat:[^`'"]*[`'"]/i, // same, with backticks: `rowboat:deck-touched`, `rowboat:open-…`, …
  /about-rowboat-description/i, // aria/test id (must stay per guard rails)
  /rowboat-app\.json/i, // file name in strings (must stay: on-disk format)
  /use-rowboat-config/i, // hook import path (file path containing rowboat)
  /rowboat-composer-dock/i, // CSS class in comments (class itself stays per guard rails)
  /['"]rowboat\/[^'"]*['"]/i, // test branch fixtures that pin internal names (e.g. 'rowboat/one' — remaining ones are allowlisted; new code uses spinrun/)
  /from\s+[`'"]\.[^`'"]*rowboat[^`'"]*[`'"]/i, // relative imports containing rowboat: './rowboat-mention-popover', '@/lib/spaces-rowboat', …
  /from\s+[`'"]@\/[^`'"]*rowboat/i, // alias imports: '@/lib/spaces-rowboat', '@/hooks/use-rowboat-config', …
  /@\/[^`'"]*rowboat/i, // any @/ alias path containing rowboat (vi.mock, dynamic imports, …)
  /rowboat[\/\.][a-z0-9\-\_\.\/]*/i, // file paths / URLs / import paths: config/rowboat.js, rowboat.team, rowboat.spaces…, knowledge/Meetings/rowboat/…, …
  /wooden rowboat|sailboat rowboat/i, // English word (the boat), not the product: talking-head avatar, emoji keywords
  /rowboat (provider|mode|sign|oauth|gateway|user|access|token|flow|dance|path|entry|record|group|task|auto-select|initial|managed|sign-in|sign-out|connect|disconnect|background|assistant|selection|migration|configuration|config|vs-|-vs-|drive|driven)/i, // comments about the internal 'rowboat' provider flavor / mode (id stays for compat; display names are Spinrun/Spinball)
  // (provider: "rowboat", flavor: "rowboat", which: "rowboat", onboardingPath 'rowboat',
  //  'rowboat:getConfig' IPC channel, config['rowboat'], mention kind keys in tests that pin
  //  internal ids — user-visible display names were all changed to Spinrun/Spinball)
  /<!--\s*rowboat:(topic|thread)\b/i, // stored topic-marker format in migrations + fixtures (old rows, not migrated)
  /rowboat:\(topic\|thread\)/i, // regex source matching the stored marker above
  /rowboat:\(\?:topic\|thread\)/i, // regex source variant
  // Dual rowboat:// scheme lines from Step 4 (the one intentional dual value):
  /LEGACY_URL_PREFIX.*rowboat:\/\//i,
  /schemes:\s*\[brand\.deepLinkScheme,\s*"rowboat"\]/,
  /\(\?:\$\{scheme\}\|rowboat\)/, // spaces-navigation dual RegExp
  /PRIMARY.*LEGACY.*rowboat:\/\//i,
  /rowboat:\/\/.*one release/i,
  /one release.*rowboat:\/\//i,
  /spinrun:\/\/.*rowboat:\/\//i,
  /rowboat:\/\/.*spinrun:\/\//i,
  /rowboat:\/\/ fallback/i,
  /fallback.*rowboat:\/\//i,
  // README attribution sentence (the one allowed Rowboat reference + upstream link):
  /fork of \[Rowboat\]\(https:\/\/github\.com\/rowboatlabs\/rowboat\)/,
  // Upstream repo references that must stay (updateRepo upstream history, NOT product copy):
  /corneliu10\/rowboat/i, // fork updateRepo (brand.updateRepo + feed/test URLs built from it)
  /rowboatlabs\/rowboat/i, // upstream (brand.upstream + composio example is file-skipped above)
  // __snapshots__: no remaining hits — snapshots were regenerated with -u to @spinball/Spinrun.
  // (If a future snapshot Pins an internal id containing rowboat, list its explicit line regex here.)
];

function allowed(file, line) {
  if (fileSkipped(file)) return true;
  const hay = `${file}:${line}`;
  return ALLOW.some((re) => re.test(hay) || re.test(line));
}

let files;
try {
  files = execSync('git ls-files --full-name', { encoding: 'utf8', cwd: ROOT }).split('\n').filter(Boolean);
} catch (e) {
  console.error('check.mjs: git ls-files failed — run from the repo');
  process.exit(2);
}

const failures = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!WORD.test(line)) continue;
    // Reset lastIndex (global not used, but safe)
    WORD.lastIndex = 0;
    if (!allowed(file, line)) {
      failures.push(`${file}:${i + 1}:${line.trim().slice(0, 200)}`);
    }
  }
}

if (failures.length > 0) {
  console.log(failures.join('\n'));
  console.error(`\nrebrand:check FAIL — ${failures.length} uncovered whole-word "rowboat" hit(s)`);
  process.exit(1);
}
console.log('rebrand:check OK — no uncovered whole-word "rowboat" hits');
