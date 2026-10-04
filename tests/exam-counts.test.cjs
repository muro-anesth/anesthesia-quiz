const test = require('node:test');
const assert = require('node:assert/strict');
const counts = require('../src/lib/historicalQuestionCounts.json');
const years = require('../src/lib/questionYears.json');
test('every published exam year has A/B counts; existing years use actual document totals', () => {
  for (const year of new Set(years.map(y => y.slice(0,4)))) {
    assert.ok(Number.isInteger(counts[year]?.a) && counts[year].a > 0);
    assert.ok(Number.isInteger(counts[year]?.b) && counts[year].b > 0);
  }
  assert.deepEqual(counts['2023'], {a:59,b:60});
  assert.deepEqual(counts['2024'], {a:60,b:59});
  assert.deepEqual(counts['2025'], {a:60,b:60});
});
