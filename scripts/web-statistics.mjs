import { readFileSync, writeFileSync } from 'node:fs';

const entry = 'dist/index.html';
const tag = '<script id="openaec-analytics-loader" defer src="https://open-aec.com/shared/analytics.js?v=20261026"></script>';
const html = readFileSync(entry, 'utf8');
if (!html.includes('</head>')) throw new Error('Web entry has no closing head');
if (!html.includes('id="openaec-analytics-loader"')) {
  writeFileSync(entry, html.replace('</head>', `  ${tag}\n</head>`));
}
