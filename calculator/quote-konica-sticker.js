import { digitalCountGrid } from './layout.js';
import { resolveDigitalPricing } from './pricing.js';
import { isRollMachine, machineFits, isStickerProduct } from './helpers.js';
import { findProductByName, findMediaByType, findMachineByName } from './db-utils.js';

function unitFactor(unit) {
  return unit === 'mm' ? 1 / 25.4 : 1;
}

export function calculateKonicaStickerLayout(params) {
  const {
    media,
    machine,
    finishedWidth,
    finishedHeight,
    unit = 'mm',
    bleed = 0,
    gap = 0,
    shape = 'rect',
    layout = 'grid',
    allowRotate = true,
    qty,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    productionQty = null
  } = params;

  const W = Number(media.w);
  const H = Number(media.h);
  const sx = 1;
  const sy = 1;
  const mL = Number(marginLeft ?? media.mL ?? 0);
  const mR = Number(marginRight ?? media.mR ?? 0);
  const mT = Number(marginTop ?? media.mT ?? 0);
  const mB = Number(marginBottom ?? media.mB ?? 0);
  const factor = unitFactor(unit);
  const cutW = Number(finishedWidth) * factor;
  const cutH = Number(finishedHeight) * factor;
  const bleedIn = Number(bleed) * factor;
  const layoutGap = Number(gap) * factor;
  const originalW = cutW + bleedIn * 2;
  const originalH = cutH + bleedIn * 2;
  const panelW = W / sx;
  const panelH = H / sy;
  const usableW = panelW - mL - mR;
  const usableH = panelH - mT - mB;
  const orderQty = Math.max(1, Math.ceil(Number(qty) || 0));
  const invalid = [W, H, originalW, originalH].some(n => n <= 0) || [mL, mR, mT, mB, layoutGap].some(n => n < 0) || usableW <= 0 || usableH <= 0 || !media || !machine || !machineFits(machine, { w: W, h: H });

  if (invalid) {
    return {
      valid: false,
      media,
      machine,
      W,
      H,
      sx,
      sy,
      panelW,
      panelH,
      usableW,
      usableH,
      orderQty
    };
  }

  const normal = digitalCountGrid(usableW, usableH, originalW, originalH, layoutGap, shape, layout);
  let best = { ...normal, sw: originalW, sh: originalH, orientation: 'Normal' };
  if (allowRotate && Math.abs(originalW - originalH) > 1e-6) {
    const rotated = digitalCountGrid(usableW, usableH, originalH, originalW, layoutGap, shape, layout);
    if (rotated.count > normal.count) best = { ...rotated, sw: originalH, sh: originalW, orientation: 'Rotated 90°' };
  }

  const panelsPerMedia = sx * sy;
  const piecesPerMedia = best.count * panelsPerMedia;
  const panelsNeeded = best.count ? Math.ceil(orderQty / best.count) : 0;
  const requiredMediaNeeded = piecesPerMedia ? Math.ceil(orderQty / piecesPerMedia) : 0;
  const mediaNeeded = productionQty != null && Number(productionQty) > 0
    ? Math.max(1, Math.ceil(Number(productionQty)))
    : requiredMediaNeeded;
  const totalCapacity = mediaNeeded * piecesPerMedia;
  const efficiency = usableW * usableH ? Math.min(100, best.count * best.sw * best.sh / (usableW * usableH) * 100) : 0;

  return {
    valid: best.count > 0,
    media,
    machine,
    W,
    H,
    sx,
    sy,
    panelW,
    panelH,
    usableW,
    usableH,
    gap: layoutGap,
    layoutGap,
    bleed: bleedIn,
    cutW,
    cutH,
    artworkW: originalW,
    artworkH: originalH,
    best,
    panelsPerMedia,
    piecesPerMedia,
    panelsNeeded,
    requiredMediaNeeded,
    mediaNeeded,
    totalCapacity,
    efficiency,
    waste: Math.max(0, totalCapacity - orderQty),
    orderQty
  };
}

export function quoteKonicaSticker(params, db) {
  const product = findProductByName(db, params.productName);
  if (!product) return { valid: false, error: `Unknown product: ${params.productName}` };

  const media = findMediaByType(db, params.mediaType, params.mediaWidth, params.mediaHeight);
  if (!media) return { valid: false, error: `Unknown media: ${params.mediaType}` };

  const machine = findMachineByName(db, params.machineName || 'Konica');
  if (!machine) return { valid: false, error: `Unknown machine: ${params.machineName || 'Konica'}` };

  if (isRollMachine(machine)) return { valid: false, error: 'Konica sticker quotation supports sheet machines only' };
  if (product.konicaPricingMode !== 'fixed_sheet_tier') {
    return { valid: false, error: `Product ${product.name} is not configured for fixed_sheet_tier pricing` };
  }
  if (!isStickerProduct(product)) {
    return { valid: false, error: `Product ${product.name} is not a sticker product` };
  }

  const layout = calculateKonicaStickerLayout({
    media,
    machine,
    finishedWidth: params.finishedWidth,
    finishedHeight: params.finishedHeight,
    unit: params.unit || 'mm',
    bleed: params.bleed ?? 0,
    gap: params.gap ?? 0,
    shape: params.shape || 'rect',
    layout: params.layout || 'grid',
    allowRotate: params.allowRotate !== false,
    qty: params.qty,
    marginLeft: params.marginLeft,
    marginRight: params.marginRight,
    marginTop: params.marginTop,
    marginBottom: params.marginBottom,
    productionQty: params.productionQty ?? null
  });

  if (!layout.valid) {
    return {
      valid: false,
      error: 'No valid Konica sticker layout for the supplied size, media, and margins',
      product: { name: product.name },
      media: { name: media.type, width: media.w, height: media.h },
      machine: { name: machine.name }
    };
  }

  const policy = resolveDigitalPricing(db, product, media, machine, layout.mediaNeeded);
  if (policy.kind !== 'fixed_sheet_tier') {
    return { valid: false, error: `Expected fixed_sheet_tier pricing but received ${policy.kind}` };
  }

  const tier = policy.tier;
  const billable = layout.mediaNeeded;
  const pricePerSheet = tier ? Number(tier.pricePerSheet) : 0;
  const total = tier ? billable * pricePerSheet : 0;
  const perPiece = Math.round(total / layout.orderQty);
  const pricingError = tier ? null : `Missing fixed sheet tier for ${product.name} + ${media.type} + ${machine.name}`;

  const quotePayload = {
    version: 1,
    mode: 'digital',
    currency: 'MMK',
    product: {
      name: product.name,
      shape: params.shape || 'rect',
      unit: params.unit || 'mm',
      width: params.finishedWidth,
      height: params.finishedHeight,
      bleed: params.bleed ?? 0,
      gap: params.gap ?? 0
    },
    media: { name: media.type, route: 'konica', machine: machine.name },
    request: { orderPcs: layout.orderQty },
    production: {
      unit: 'sheet',
      quantity: layout.mediaNeeded,
      piecesPerUnit: layout.piecesPerMedia,
      expectedDelivery: layout.totalCapacity,
      extraPieces: layout.waste
    },
    pricing: {
      model: 'fixed_sheet_tier',
      total: Math.round(total),
      perPiece,
      billable,
      billableUnit: 'Billable Sheets'
    }
  };

  return {
    valid: true,
    product: {
      name: product.name,
      pricingMode: product.konicaPricingMode
    },
    finishedSize: {
      width: params.finishedWidth,
      height: params.finishedHeight,
      unit: params.unit || 'mm',
      bleed: params.bleed ?? 0,
      gap: params.gap ?? 0
    },
    shape: params.shape || 'rect',
    layoutMode: params.layout || 'grid',
    media: {
      name: media.type,
      width: media.w,
      height: media.h,
      sizeLabel: media.sizeLabel || null
    },
    machine: { name: machine.name },
    orderQuantity: layout.orderQty,
    piecesPerSheet: layout.best.count,
    requiredSheets: layout.requiredMediaNeeded,
    sheets: layout.mediaNeeded,
    expectedDelivery: layout.totalCapacity,
    extraPieces: layout.waste,
    orientation: layout.best.orientation,
    layoutPattern: layout.best.mode === 'Honeycomb'
      ? `${layout.best.cols}/${layout.best.minCols} × ${layout.best.rows}`
      : `${layout.best.cols} × ${layout.best.rows}`,
    efficiency: layout.efficiency,
    pricing: {
      model: 'fixed_sheet_tier',
      tier: tier ? { minSheets: tier.minSheets, pricePerSheet: tier.pricePerSheet } : null,
      billableSheets: billable,
      totalSellingPrice: Math.round(total),
      perPiecePrice: perPiece,
      error: pricingError
    },
    quotePayload
  };
}
