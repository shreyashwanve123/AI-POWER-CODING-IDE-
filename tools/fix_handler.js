#!/usr/bin/env node
// Simple helper: take code and error as input and write a formatted FIX_RESULT.md
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node tools/fix_handler.js <output-file> "<error description>"');
  console.log('Then paste code into stdin and finish with Ctrl+D (or Ctrl+Z on Windows).');
}

if (process.argv.length < 4) {
  usage();
  process.exit(1);
}

const outFile = process.argv[2];
const errorDesc = process.argv[3];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const content = [
    '# Fix Result',
    '',
    '## Debugging (डिबगिंग)',
    `- Problem / समस्या: ${errorDesc}`,
    '- Root cause / कारण: (assistant will fill after analysis)',
    '- Fix / समाधान: (assistant will provide exact change description)',
    '- How to apply: (steps to apply changes)',
    '',
    '## Pasted Code',
    '```',
    input.trim(),
    '```',
    '',
    '## Explanation (व्याख्या)',
    '- What was wrong: (assistant explanation)',
    '- Why this fix works: (assistant explanation)',
  ].join('\n');

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, content, 'utf8');
  console.log('Wrote', outFile);
});
