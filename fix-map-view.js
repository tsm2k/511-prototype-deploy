#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(process.cwd(), 'components/map-view.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Create a backup
fs.writeFileSync(`${filePath}.bak2`, content);

// Fix the syntax error by ensuring the useEffect hook is properly formatted
const fixedContent = content.replace(
  /useEffect\(\(\) => \{([^]*?)\}\, \[queryResults, visibleLayers\]\);/s,
  (match, body) => {
    return `useEffect(() => {${body}}, [queryResults, visibleLayers]);`;
  }
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent);
console.log('Fixed MapView component syntax errors');
