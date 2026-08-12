#!/usr/bin/env node
/**
 * Demo script for the extracted Konica sticker quotation function.
 *
 * Run with: node tests/demo-quote-konica-sticker.mjs
 */
import { loadSeedDb } from '../calculator/db-utils.js';
import { quoteKonicaSticker } from '../calculator/quote-konica-sticker.js';

const db = loadSeedDb();

const sampleParams = {
  productName: 'Sticker',
  mediaType: 'PP Matte or Gloss Sticker',
  machineName: 'Konica',
  finishedWidth: 50,
  finishedHeight: 50,
  unit: 'mm',
  bleed: 1,
  gap: 0,
  shape: 'rect',
  layout: 'grid',
  allowRotate: true,
  qty: 100
};

const result = quoteKonicaSticker(sampleParams, db);
console.log(JSON.stringify(result, null, 2));
