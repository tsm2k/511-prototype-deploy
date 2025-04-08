#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(process.cwd(), 'components/map-view.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error by ensuring the clearMarkers function is defined before it's used
// This moves the function definition to the top of the component
const fixedContent = content.replace(
  /export function MapView\(\{ queryResults \}: \{ queryResults\?: any \}\) \{([^]*?)\/\/ Function to clear all markers([^]*?)const clearMarkers = \(\) => \{([^]*?)\};/s,
  (match, beforeClearMarkers, commentText, clearMarkersBody) => {
    return `export function MapView({ queryResults }: { queryResults?: any }) {
  // Function to clear all markers
  const clearMarkers = () => {${clearMarkersBody}};
  ${beforeClearMarkers}`;
  }
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, fixedContent);
console.log('Fixed MapView component syntax errors');
