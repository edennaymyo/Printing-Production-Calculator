export function packGrid(SW, SH, IW, IH, rot = false, gap = 0) {
  const w = rot ? IH : IW;
  const h = rot ? IW : IH;
  const cols = Math.floor((SW + gap) / (w + gap));
  const rows = Math.floor((SH + gap) / (h + gap));
  const layout = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) layout.push({ x: c * (w + gap), y: r * (h + gap), w, h, rot });
  return { count: cols * rows, cols, rows, layout, note: (rot ? 'rotated' : 'normal') + ' grid' };
}

export function packArea(a, IW, IH, gap = 0) {
  const best = [packGrid(a.w, a.h, IW, IH, false, gap), packGrid(a.w, a.h, IW, IH, true, gap)].sort((x, y) => y.count - x.count)[0];
  return { ...best, area: { ...a }, layout: best.layout.map(r => ({ ...r, x: r.x + a.x, y: r.y + a.y })) };
}

export function packGuillotine(SW, SH, IW, IH, gap = 0) {
  let best = { count: 0, layout: [], note: 'none', cols: 0, rows: 0 };
  const xs = new Set();
  const ys = new Set();
  for (let k = 1; k < 20; k++) { xs.add(k * (IW + gap)); xs.add(k * (IH + gap)); ys.add(k * (IW + gap)); ys.add(k * (IH + gap)); }
  for (const x of xs) {
    if (x <= 0 || x >= SW) continue;
    const a = packArea({ x: 0, y: 0, w: x, h: SH }, IW, IH, gap);
    const b = packArea({ x, y: 0, w: SW - x, h: SH }, IW, IH, gap);
    if (a.count + b.count > best.count) best = { count: a.count + b.count, layout: [...a.layout, ...b.layout], note: 'vertical mixed', split: 'vertical', blocks: [a, b], cols: 0, rows: 0 };
  }
  for (const y of ys) {
    if (y <= 0 || y >= SH) continue;
    const a = packArea({ x: 0, y: 0, w: SW, h: y }, IW, IH, gap);
    const b = packArea({ x: 0, y, w: SW, h: SH - y }, IW, IH, gap);
    if (a.count + b.count > best.count) best = { count: a.count + b.count, layout: [...a.layout, ...b.layout], note: 'horizontal mixed', split: 'horizontal', blocks: [a, b], cols: 0, rows: 0 };
  }
  return best;
}

export function bestPack(SW, SH, IW, IH, gap = 0) {
  return [packGrid(SW, SH, IW, IH, false, gap), packGrid(SW, SH, IW, IH, true, gap), packGuillotine(SW, SH, IW, IH, gap)].sort((a, b) => b.count - a.count)[0];
}

export function digitalCountGrid(uw, uh, sw, sh, gap, shape, layout) {
  if (uw <= 0 || uh <= 0 || sw <= 0 || sh <= 0 || gap < 0) return { count: 0, cols: 0, rows: 0, layout: [], mode: 'Invalid' };
  if (shape === 'oval' && layout === 'honey') {
    const dx = sw + gap;
    const dy = (sh + gap) * .8660254;
    const out = [];
    let row = 0;
    let maxCols = 0;
    let minCols = Infinity;
    for (let y = 0; y + sh <= uh + 1e-6; y += dy) {
      const offset = row % 2 ? dx / 2 : 0;
      let cols = 0;
      for (let x = offset; x + sw <= uw + 1e-6; x += dx) { out.push({ x, y, w: sw, h: sh, oval: true }); cols++; }
      maxCols = Math.max(maxCols, cols);
      minCols = Math.min(minCols, cols);
      row++;
    }
    return { count: out.length, cols: maxCols, minCols: minCols === Infinity ? 0 : minCols, rows: row, layout: out, mode: 'Honeycomb' };
  }
  const cols = Math.floor((uw + gap + 1e-6) / (sw + gap));
  const rows = Math.floor((uh + gap + 1e-6) / (sh + gap));
  const out = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) out.push({ x: col * (sw + gap), y: row * (sh + gap), w: sw, h: sh, oval: shape === 'oval' });
  return { count: cols * rows, cols, rows, layout: out, mode: 'Grid' };
}

export function calculateCustomerSheetLayout(width, height, insets, artworkW, artworkH, gap, shape, layout, allowArtworkRotate) {
  const safeInsets = {
    left: Math.max(0, Number(insets?.left) || 0),
    right: Math.max(0, Number(insets?.right) || 0),
    top: Math.max(0, Number(insets?.top) || 0),
    bottom: Math.max(0, Number(insets?.bottom) || 0)
  };
  const usableW = Math.max(0, width - safeInsets.left - safeInsets.right);
  const usableH = Math.max(0, height - safeInsets.top - safeInsets.bottom);
  const normal = digitalCountGrid(usableW, usableH, artworkW, artworkH, gap, shape, layout);
  let best = { ...normal, sw: artworkW, sh: artworkH, orientation: 'Original' };
  if (allowArtworkRotate && Math.abs(artworkW - artworkH) > 1e-6) {
    const rotated = digitalCountGrid(usableW, usableH, artworkH, artworkW, gap, shape, layout);
    if (rotated.count > best.count) best = { ...rotated, sw: artworkH, sh: artworkW, orientation: 'Rotated 90°' };
  }
  return { width, height, insets: safeInsets, usableW, usableH, best, valid: best.count > 0 };
}

export function defaultEpsonBillingPolicy(width) {
  const w = Number(width) || 0;
  return w >= 58 ? { blockSqft: 5, blockLength: 12.45 } : { blockSqft: 4, blockLength: 12 };
}

export function epsonBillingPolicy(media) {
  return defaultEpsonBillingPolicy(Number(media?.rollWidth || media?.w));
}

export function rollBillableSqft(printLength, policy) {
  return Math.max(policy.blockSqft, Math.ceil((Number(printLength) || 0) / (policy.blockLength || 1) - 1e-9) * policy.blockSqft);
}

export function calculateRollPanelCandidate(options) {
  const { rollW, usableRollW, edgeMarginLeft, edgeMarginRight, customerW, customerH, panelGap, artworkW, artworkH, gap, qty, shape, layout, allowArtworkRotate, useRemainder, forcedPanels, billingPolicy, productionQty } = options;
  const countMode = Number(forcedPanels) > 0;
  const panelLength = customerH;
  let panelsAcross = countMode ? Math.max(1, Math.floor(forcedPanels)) : 0;
  let panelAcrossW = countMode ? 0 : customerW;
  if (countMode) {
    const totalPanelGaps = Math.max(0, panelsAcross - 1) * panelGap;
    panelAcrossW = (usableRollW - totalPanelGaps) / panelsAcross;
  } else if (panelAcrossW > 0) panelsAcross = Math.floor((usableRollW + panelGap + 1e-6) / (panelAcrossW + panelGap));
  if (panelAcrossW <= 0 || panelLength <= 0 || panelsAcross <= 0) return null;
  const fullPanelsWidth = panelsAcross * panelAcrossW + Math.max(0, panelsAcross - 1) * panelGap;
  const remainderSpace = countMode ? 0 : Math.max(0, usableRollW - fullPanelsWidth);
  const remainderGap = remainderSpace > 1e-6 ? Math.min(panelGap, remainderSpace) : 0;
  const remainderWidth = Math.max(0, remainderSpace - remainderGap);
  const hasRemainder = remainderWidth > 1e-6;
  const sheet = calculateCustomerSheetLayout(panelAcrossW, panelLength, { left: 0, right: 0, top: 0, bottom: 0 }, artworkW, artworkH, gap, shape, layout, allowArtworkRotate);
  if (!sheet.valid) return null;
  const panelCapacity = sheet.best.count;
  const remainderSheet = hasRemainder
    ? calculateCustomerSheetLayout(remainderWidth, panelLength, { left: 0, right: 0, top: 0, bottom: 0 }, artworkW, artworkH, gap, shape, layout, allowArtworkRotate)
    : null;
  const remainderCapacity = useRemainder && remainderSheet?.valid ? remainderSheet.best.count : 0;
  const standardRowCapacity = panelCapacity * panelsAcross;
  const rowCapacity = standardRowCapacity + remainderCapacity;
  if (rowCapacity <= 0) return null;
  const requiredRollRows = Math.ceil(qty / rowCapacity);
  const rollRows = Number(productionQty) > 0 ? Math.max(1, Math.ceil(Number(productionQty))) : requiredRollRows;
  const customerSheets = rollRows * panelsAcross;
  const remainderStrips = remainderCapacity ? rollRows : 0;
  const standardDeliveredPieces = rollRows * standardRowCapacity;
  const remainderDeliveredPieces = rollRows * remainderCapacity;
  const printLength = rollRows * panelLength;
  const usedSqft = rollW * printLength / 144;
  const policy = billingPolicy || defaultEpsonBillingPolicy(rollW);
  const billableSqft = rollBillableSqft(printLength, policy);
  const totalCapacity = rollRows * rowCapacity;
  const waste = Math.max(0, totalCapacity - qty);
  return { customerW: panelAcrossW, customerH, panelAcrossW, panelLength, panelsAcross, panelGap, fullPanelsWidth, remainderSpace, remainderGap, remainderWidth, remainderSheet, remainderCapacity, remainderUsed: remainderCapacity > 0, panelCapacity, standardRowCapacity, rowCapacity, customerSheets, remainderStrips, standardDeliveredPieces, remainderDeliveredPieces, rollRows, requiredRollRows, printLength, usedSqft, billableSqft, billingPolicy: policy, totalCapacity, waste, sheet, best: sheet.best, edgeMarginLeft, edgeMarginRight, score: [billableSqft, usedSqft, waste, -rowCapacity] };
}
