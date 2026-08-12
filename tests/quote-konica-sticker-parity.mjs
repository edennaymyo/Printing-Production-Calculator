#!/usr/bin/env node
/**
 * Parity checks between quoteKonicaSticker() and production logic from index.html.
 *
 * Run with: node tests/quote-konica-sticker-parity.mjs
 */
import assert from 'node:assert/strict';
import { loadSeedDb } from '../calculator/db-utils.js';
import { quoteKonicaSticker } from '../calculator/quote-konica-sticker.js';
import { referenceKonicaStickerQuote } from '../calculator/extract-from-html.mjs';

const db = loadSeedDb();

const cases = [
  {
    name: 'PP Matte sticker • 50×50 mm • 100 pcs • tier min 1 sheet',
    params: {
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
    }
  },
  {
    name: 'PP Matte sticker • 50×50 mm • 500 pcs • tier min 5 sheets',
    params: {
      productName: 'Sticker',
      mediaType: 'PP Matte or Gloss Sticker',
      machineName: 'Konica',
      finishedWidth: 50,
      finishedHeight: 50,
      unit: 'mm',
      bleed: 1,
      gap: 0,
      qty: 500
    }
  },
  {
    name: 'PP Matte sticker • 50×50 mm • 1200 pcs • tier min 10 sheets',
    params: {
      productName: 'Sticker',
      mediaType: 'PP Matte or Gloss Sticker',
      machineName: 'Konica',
      finishedWidth: 50,
      finishedHeight: 50,
      unit: 'mm',
      bleed: 1,
      gap: 0,
      qty: 1200
    }
  },
  {
    name: 'Warranty Seal • 30×30 mm • 60 pcs • fixed tier',
    params: {
      productName: 'Warranty Seal',
      mediaType: 'Warranty Seal',
      machineName: 'Konica',
      finishedWidth: 30,
      finishedHeight: 30,
      unit: 'mm',
      bleed: 0,
      gap: 0,
      qty: 60
    }
  },
  {
    name: 'PP Matte sticker • manual production qty override',
    params: {
      productName: 'Sticker',
      mediaType: 'PP Matte or Gloss Sticker',
      machineName: 'Konica',
      finishedWidth: 50,
      finishedHeight: 50,
      unit: 'mm',
      bleed: 1,
      gap: 0,
      qty: 100,
      productionQty: 12
    }
  }
];

function check(name, run) {
  run();
  console.log(`✓ ${name}`);
}

for (const testCase of cases) {
  check(testCase.name, () => {
    const actual = quoteKonicaSticker(testCase.params, db);
    const expected = referenceKonicaStickerQuote(db, testCase.params);

    assert.equal(actual.valid, expected.valid, 'valid flag mismatch');
    assert.equal(actual.piecesPerSheet, expected.piecesPerSheet, 'piecesPerSheet mismatch');
    assert.equal(actual.requiredSheets, expected.requiredSheets, 'requiredSheets mismatch');
    assert.equal(actual.sheets, expected.sheets, 'sheets mismatch');
    assert.equal(actual.expectedDelivery, expected.expectedDelivery, 'expectedDelivery mismatch');
    assert.equal(actual.extraPieces, expected.extraPieces, 'extraPieces mismatch');
    assert.equal(actual.pricing.model, expected.pricingModel, 'pricing model mismatch');
    assert.equal(actual.pricing.totalSellingPrice, expected.totalSellingPrice, 'totalSellingPrice mismatch');
    assert.equal(actual.pricing.perPiecePrice, expected.perPiecePrice, 'perPiecePrice mismatch');
    assert.deepEqual(actual.quotePayload, expected.quotePayload, 'quotePayload mismatch');
  });
}

console.log('\nAll Konica sticker parity checks passed.');
