#!/usr/bin/env node

import { promises } from 'fs';
import { dirname } from 'path';
import glob from 'fast-glob';
import {resolve } from 'path';

// Získání argumentu z CLI
const outFile = process.argv[2];
const target = process.argv[3];

if (!outFile) {
  console.error("Usage: node generate-vue-deps.js <output.dep>");
  process.exit(1);
}

async function run() {
  const sources = (await glob([
    './src/**/*',
    './public/**/*',
    './index.html'
  ], { onlyFiles: true })).map(file => resolve(file));

  
//  const target = 'index.html'; // Tento řetězec musí odpovídat tomu, co CMake očekává v OUTPUT
  const depLine = `${target}: ${sources.join(' ')}`;

  const outDir = dirname(outFile);
  await promises.mkdir(outDir, { recursive: true });
  await promises.writeFile(outFile, depLine + '\n');
}

run();
