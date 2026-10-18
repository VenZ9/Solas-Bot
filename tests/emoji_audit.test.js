const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Regex for emojis (Unicode emoji property + Discord custom emoji format)
const EMOJI_REGEX = /(\p{Extended_Pictographic}|<a?:[a-zA-Z0-9_]+:[0-9]+>)/gu;

function getJsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // Exclude the sanitizer utility where the regex itself is defined
      if (!fullPath.includes('src/utils/embeds.js')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

test('Zero-Emoji Compliance Audit', async (t) => {
  const srcDir = path.resolve(__dirname, '../src');
  const files = getJsFiles(srcDir);

  await t.test('all src files strictly contain zero emojis in code and strings', () => {
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(EMOJI_REGEX);
      if (matches) {
        violations.push({
          file: path.relative(srcDir, file),
          matches,
        });
      }
    }

    assert.equal(violations.length, 0, `Found emojis in files: ${JSON.stringify(violations, null, 2)}`);
  });
});
