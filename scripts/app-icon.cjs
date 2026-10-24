const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// End is exclusive: the limited icon is used through November 15 in Japan.
const START = Date.parse('2026-10-24T00:00:00+09:00');
const END = Date.parse('2026-11-16T00:00:00+09:00');
const STANDARD_SHA256 = '61f380994a3068a93a41d560be164df8695844f467fd5c23ca870196770e750f';
function iconRelease(now = new Date()) {
  const time = now.getTime();
  if (!Number.isFinite(time)) throw new Error('Invalid icon release date');
  return time >= START && time < END
    ? { version: 'limited-20261115', source: 'limited-20261115.png' }
    : { version: 'standard', source: 'standard.png' };
}
function applyIconRelease(root, now = new Date()) {
  const release = iconRelease(now);
  const standard = fs.readFileSync(path.join(root, 'public/icons/standard.png'));
  if (crypto.createHash('sha256').update(standard).digest('hex') !== STANDARD_SHA256) {
    throw new Error('Original icon does not match the preserved version');
  }
  const image = fs.readFileSync(path.join(root, 'public/icons', release.source));
  // Generated public assets only. Never access Firebase or user records here.
  fs.writeFileSync(path.join(root, 'public/icon.png'), image);
  fs.writeFileSync(path.join(root, 'public/apple-touch-icon.png'), image);
  fs.writeFileSync(path.join(root, 'src/lib/app-icon-release.json'), JSON.stringify(release, null, 2) + '\n');
  const manifestPath = path.join(root, 'public/manifest.webmanifest');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.icons = [{ src: `/icon.png?v=${release.version}`, sizes: '1254x1254', type: 'image/png', purpose: 'any' }];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`App icon: ${release.version} (Asia/Tokyo expiry: 2026-11-16 00:00)`);
  return release;
}
module.exports = { iconRelease, applyIconRelease, STANDARD_SHA256 };
if (require.main === module) applyIconRelease(path.resolve(__dirname, '..'));
