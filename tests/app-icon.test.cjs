const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { iconRelease, applyIconRelease, STANDARD_SHA256 } = require('../scripts/app-icon.cjs');
const root = path.resolve(__dirname, '..');

test('limited icon starts and expires at Japanese midnight, inclusive through November 15', () => {
  for (const [date, version] of [
    ['2026-10-23T14:59:59.999Z', 'standard'],
    ['2026-10-23T15:00:00.000Z', 'limited-20261115'],
    ['2026-11-15T14:59:59.999Z', 'limited-20261115'],
    ['2026-11-15T15:00:00.000Z', 'standard'],
    ['2027-11-01T00:00:00.000Z', 'standard'],
  ]) assert.equal(iconRelease(new Date(date)).version, version);
  assert.throws(() => iconRelease(new Date('invalid')));
});

test('limited then standard build preserves original and manifest identity', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'periop-icon-test-'));
  try {
    fs.mkdirSync(path.join(temp, 'public/icons'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'src/lib'), { recursive: true });
    for (const name of ['standard.png', 'limited-20261115.png']) {
      fs.copyFileSync(path.join(root, 'public/icons', name), path.join(temp, 'public/icons', name));
    }
    const originalManifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest')));
    fs.writeFileSync(path.join(temp, 'public/manifest.webmanifest'), JSON.stringify(originalManifest));
    for (const [date, version, name] of [
      ['2026-10-24', 'limited-20261115', 'limited-20261115.png'],
      ['2026-11-16', 'standard', 'standard.png'],
    ]) {
      applyIconRelease(temp, new Date(date));
      const expected = fs.readFileSync(path.join(root, 'public/icons', name));
      for (const target of ['icon.png', 'apple-touch-icon.png']) {
        assert.deepEqual(fs.readFileSync(path.join(temp, 'public', target)), expected);
      }
      const { icons, ...identity } = JSON.parse(fs.readFileSync(path.join(temp, 'public/manifest.webmanifest')));
      const { icons: oldIcons, ...oldIdentity } = originalManifest;
      assert.deepEqual(identity, oldIdentity);
      assert.equal(icons[0].src, `/icon.png?v=${version}`);
    }
    const original = fs.readFileSync(path.join(temp, 'public/icons/standard.png'));
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), STANDARD_SHA256);
    assert.deepEqual(original, fs.readFileSync(path.join(root, 'icon.png')));
    fs.writeFileSync(path.join(temp, 'public/icons/standard.png'), 'corrupt');
    assert.throws(() => applyIconRelease(temp), /Original icon/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
