#!/usr/bin/env node
/**
 * Offline regression checks for the calculator's existing pure layout helpers.
 *
 * Run with: node tests/calculation-regression.mjs
 */
import assert from 'node:assert/strict';
import {
  defaultEpsonBillingPolicy,
  epsonBillingPolicy,
  rollBillableSqft,
  bestPack,
  digitalCountGrid,
  calculateCustomerSheetLayout,
  calculateRollPanelCandidate
} from '../calculator/engine.js';

function check(name, run) {
  run();
  console.log(`✓ ${name}`);
}

check('50-inch Epson media uses the 4 sqft / 12-inch row policy', () => {
  const policy = epsonBillingPolicy({ rollWidth: 50 });
  assert.deepEqual(policy, { blockSqft: 4, blockLength: 12 });
  assert.equal(rollBillableSqft(12, policy), 4);
  assert.equal(rollBillableSqft(12.01, policy), 8);
});

check('59.84-inch Epson media uses the 5 sqft / 12.45-inch row policy', () => {
  const policy = epsonBillingPolicy({ rollWidth: 59.84 });
  assert.deepEqual(policy, { blockSqft: 5, blockLength: 12.45 });
  assert.equal(rollBillableSqft(12.45, policy), 5);
  assert.equal(rollBillableSqft(12.46, policy), 10);
});

check('Offset best-fit packing keeps the 31 × 43 sheet yield at twelve 10-inch products', () => {
  const layout = bestPack(31, 43, 10, 10, 0);
  assert.equal(layout.count, 12);
});

check('a 12 × 12 customer panel fits nine 3.2-inch artwork pieces', () => {
  const layout = calculateCustomerSheetLayout(12, 12, {}, 3.2, 3.2, 0, 'rect', 'grid', true);
  assert.equal(layout.best.count, 9);
  assert.equal(layout.best.cols, 3);
  assert.equal(layout.best.rows, 3);
});

check('48.5-inch roll with 0.5-inch machine edges splits into four equal 11.875-inch columns', () => {
  const result = calculateRollPanelCandidate({
    rollW: 48.5, usableRollW: 47.5, edgeMarginLeft: 0.5, edgeMarginRight: 0.5,
    customerW: 12, customerH: 12, panelGap: 0, artworkW: 3.2, artworkH: 3.2,
    gap: 0, qty: 36, shape: 'rect', layout: 'grid', allowArtworkRotate: true,
    useRemainder: true, forcedPanels: 4, billingPolicy: { blockSqft: 4, blockLength: 12 }, productionQty: 0
  });
  assert.equal(result.panelAcrossW, 11.875);
  assert.equal(result.standardRowCapacity, 36);
});

check('59.8-inch roll accepts two 29.35-inch columns with a 0.1-inch internal gap', () => {
  const result = calculateRollPanelCandidate({
    rollW: 59.8, usableRollW: 58.8, edgeMarginLeft: 0.5, edgeMarginRight: 0.5,
    customerW: 29.35, customerH: 2, panelGap: 0.1, artworkW: 29.35, artworkH: 2,
    gap: 0, qty: 2, shape: 'rect', layout: 'grid', allowArtworkRotate: true,
    useRemainder: true, forcedPanels: 2, billingPolicy: { blockSqft: 5, blockLength: 12.45 }, productionQty: 0
  });
  assert.ok(Math.abs(result.panelAcrossW - 29.35) < 1e-9);
  assert.equal(result.standardRowCapacity, 2);
});

check('a margin-free Konica 13 × 19 sheet fits twenty 3.2-inch artwork pieces', () => {
  const layout = calculateCustomerSheetLayout(13, 19, { left: 0, right: 0, top: 0, bottom: 0 }, 3.2, 3.2, 0, 'rect', 'grid', true);
  assert.equal(layout.best.count, 20);
});

console.log('\nAll calculation regression checks passed.');
