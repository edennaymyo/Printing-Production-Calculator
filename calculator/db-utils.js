import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sameName, sameSize } from './helpers.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadSeedDb() {
  const source = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');
  const marker = 'db={';
  const markerIndex = source.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error('Could not locate seed db in index.html');
  }

  const braceStart = markerIndex + marker.length - 1;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quote) {
        inString = false;
        quote = '';
      }

      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return JSON.parse(source.slice(braceStart, index + 1));
      }
    }
  }

  throw new Error('Could not parse seed db from index.html');
}

export function findProductByName(db, productName) {
  return db.products.find(product => sameName(product.name, productName)) || null;
}

export function findMachineByName(db, machineName) {
  return db.machines.find(machine => sameName(machine.name, machineName)) || null;
}

export function findMediaByType(db, mediaType, mediaWidth, mediaHeight) {
  const matches = db.papers.filter(media => sameName(media.type, mediaType));
  if (!matches.length) return null;
  if (mediaWidth == null || mediaHeight == null) return matches[0];
  return matches.find(media => sameSize(media.w, media.h, mediaWidth, mediaHeight)) || matches[0];
}
