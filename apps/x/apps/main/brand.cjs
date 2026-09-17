// Canonical brand values live in ../../packages/shared/src/brand.ts
// (single source of truth). Forge config is CJS and runs before `shared`
// is built, so it cannot require the compiled dist. This reader parses
// brand.ts source — no brand literals are duplicated here.
const fs = require('fs');
const path = require('path');

const brandSrc = fs.readFileSync(
  path.join(__dirname, '../../packages/shared/src/brand.ts'),
  'utf8',
);

function pick(key) {
  const m = brandSrc.match(new RegExp(key + '\\s*:\\s*"([^"]+)"'));
  if (!m) throw new Error(`brand.cjs: key ${key} not found in brand.ts`);
  return m[1];
}

module.exports = {
  productName: pick('productName'),
  executableName: pick('executableName'),
  appBundleId: pick('appBundleId'),
  updateRepo: pick('updateRepo'),
  deepLinkScheme: pick('deepLinkScheme'),
  upstream: pick('upstream'),
  assistantName: pick('assistantName'),
  mentionHandle: pick('mentionHandle'),
  companyName: pick('companyName'),
  siteUrl: pick('siteUrl'),
  docsUrl: pick('docsUrl'),
  supportUrl: pick('supportUrl'),
};
