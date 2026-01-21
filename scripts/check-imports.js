#!/usr/bin/env node

/**
 * Check for missing .js extensions in relative imports
 * This script ensures all relative imports in TypeScript files have .js extensions
 * which is required for ESM module resolution in Node.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '..', 'src');
const errors = [];

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Match relative imports: from './something' or from '../something'
    const relativeImportRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
    let match;
    
    while ((match = relativeImportRegex.exec(line)) !== null) {
      const importPath = match[1];
      
      // Skip if it already has .js extension
      if (importPath.endsWith('.js')) {
        continue;
      }
      
      // Skip if it's importing a directory (will have index.js)
      // Skip if it's a package import (starts with @ or no ./)
      if (importPath.includes('/index') || importPath.startsWith('@')) {
        continue;
      }
      
      // This is an error - missing .js extension
      errors.push({
        file: filePath.replace(srcDir + '/', ''),
        line: index + 1,
        import: importPath,
        fullLine: line.trim()
      });
    }
  });
}

function walkDir(dir) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (extname(file) === '.ts') {
      checkFile(filePath);
    }
  });
}

// Walk through src directory
walkDir(srcDir);

// Report results
if (errors.length > 0) {
  console.error('❌ Found imports missing .js extensions:\n');
  errors.forEach(error => {
    console.error(`  ${error.file}:${error.line}`);
    console.error(`    ${error.fullLine}`);
    console.error(`    Missing .js extension in: ${error.import}\n`);
  });
  console.error(`\nTotal errors: ${errors.length}`);
  console.error('\nFix: Add .js extension to all relative imports in TypeScript files.');
  process.exit(1);
} else {
  console.log('✅ All relative imports have .js extensions');
  process.exit(0);
}
