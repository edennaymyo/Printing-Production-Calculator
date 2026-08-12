import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function readIndexHtmlSource() {
  return readFileSync(resolve(repoRoot, 'index.html'), 'utf8');
}

export function extractFunction(source, name) {
  const functionMarker = `function ${name}(`;
  const functionStart = source.indexOf(functionMarker);

  if (functionStart !== -1) {
    const braceStart = source.indexOf('{', functionStart);
    if (braceStart === -1) {
      throw new Error(`Malformed production helper: ${name}`);
    }

    let depth = 0;

    for (let index = braceStart; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;

      if (source[index] === '}') {
        depth -= 1;

        if (depth === 0) {
          return source.slice(functionStart, index + 1);
        }
      }
    }

    throw new Error(`Unclosed production helper: ${name}`);
  }

  const constMarker = `const ${name}=`;
  const constStart = source.indexOf(constMarker);

  if (constStart !== -1) {
    let inString = false;
    let quote = '';
    let escaped = false;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    for (let index = constStart; index < source.length; index += 1) {
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

      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        quote = char;
        continue;
      }

      if (char === '(') parenDepth += 1;
      else if (char === ')') parenDepth -= 1;
      else if (char === '[') bracketDepth += 1;
      else if (char === ']') bracketDepth -= 1;
      else if (char === '{') braceDepth += 1;
      else if (char === '}') braceDepth -= 1;

      if (
        char === ';' &&
        parenDepth === 0 &&
        bracketDepth === 0 &&
        braceDepth === 0
      ) {
        return source.slice(constStart, index + 1);
      }
    }

    throw new Error(`Unclosed production helper: ${name}`);
  }

  throw new Error(`Missing production helper: ${name}`);
}

function buildProductionReference(db, functionNames, extraSource = '') {
  const source = readIndexHtmlSource();
  const helpers = functionNames.map(name => extractFunction(source, name)).join('\n');
  return Function('db', `${helpers}\n${extraSource}\nreturn { ${functionNames.join(', ')} };`)(db);
}

export function referenceKonicaStickerQuote(db, params) {
  const production = buildProductionReference(db, [
    'norm',
    'sameSize',
    'sameName',
    'isRollMachine',
    'machineFits',
    'digitalCountGrid',
    'digitalRateFor',
    'digitalTierFor',
    'resolveDigitalPricing'
  ]);

  const product = db.products.find(item => production.sameName(item.name, params.productName));
  const media = db.papers.find(item => production.sameName(item.type, params.mediaType));
  const machine = db.machines.find(item => production.sameName(item.name, params.machineName || 'Konica'));
  const factor = (params.unit || 'mm') === 'mm' ? 1 / 25.4 : 1;
  const cutW = Number(params.finishedWidth) * factor;
  const cutH = Number(params.finishedHeight) * factor;
  const bleedIn = Number(params.bleed ?? 0) * factor;
  const layoutGap = Number(params.gap ?? 0) * factor;
  const originalW = cutW + bleedIn * 2;
  const originalH = cutH + bleedIn * 2;
  const W = Number(media.w);
  const H = Number(media.h);
  const sx = 1;
  const sy = 1;
  const mL = Number(params.marginLeft ?? media.mL ?? 0);
  const mR = Number(params.marginRight ?? media.mR ?? 0);
  const mT = Number(params.marginTop ?? media.mT ?? 0);
  const mB = Number(params.marginBottom ?? media.mB ?? 0);
  const panelW = W / sx;
  const panelH = H / sy;
  const usableW = panelW - mL - mR;
  const usableH = panelH - mT - mB;
  const allowRotate = params.allowRotate !== false;
  const shape = params.shape || 'rect';
  const layoutMode = params.layout || 'grid';
  const orderQty = Math.max(1, Math.ceil(Number(params.qty) || 0));

  const normal = production.digitalCountGrid(usableW, usableH, originalW, originalH, layoutGap, shape, layoutMode);
  let best = { ...normal, sw: originalW, sh: originalH, orientation: 'Normal' };
  if (allowRotate && Math.abs(originalW - originalH) > 1e-6) {
    const rotated = production.digitalCountGrid(usableW, usableH, originalH, originalW, layoutGap, shape, layoutMode);
    if (rotated.count > normal.count) best = { ...rotated, sw: originalH, sh: originalW, orientation: 'Rotated 90°' };
  }

  const panelsPerMedia = sx * sy;
  const piecesPerMedia = best.count * panelsPerMedia;
  const requiredMediaNeeded = piecesPerMedia ? Math.ceil(orderQty / piecesPerMedia) : 0;
  const mediaNeeded = params.productionQty != null && Number(params.productionQty) > 0
    ? Math.max(1, Math.ceil(Number(params.productionQty)))
    : requiredMediaNeeded;
  const totalCapacity = mediaNeeded * piecesPerMedia;
  const waste = Math.max(0, totalCapacity - orderQty);

  const policy = production.resolveDigitalPricing(product, media, machine, mediaNeeded);
  const tier = policy.tier;
  const total = tier ? mediaNeeded * Number(tier.pricePerSheet) : 0;

  return {
    valid: best.count > 0,
    piecesPerSheet: best.count,
    requiredSheets: requiredMediaNeeded,
    sheets: mediaNeeded,
    expectedDelivery: totalCapacity,
    extraPieces: waste,
    pricingModel: policy.kind,
    totalSellingPrice: Math.round(total),
    perPiecePrice: Math.round(total / orderQty),
    quotePayload: {
      version: 1,
      mode: 'digital',
      currency: 'MMK',
      product: {
        name: product.name,
        shape,
        unit: params.unit || 'mm',
        width: params.finishedWidth,
        height: params.finishedHeight,
        bleed: params.bleed ?? 0,
        gap: params.gap ?? 0
      },
      media: { name: media.type, route: 'konica', machine: machine.name },
      request: { orderPcs: orderQty },
      production: {
        unit: 'sheet',
        quantity: mediaNeeded,
        piecesPerUnit: piecesPerMedia,
        expectedDelivery: totalCapacity,
        extraPieces: waste
      },
      pricing: {
        model: 'fixed_sheet_tier',
        total: Math.round(total),
        perPiece: Math.round(total / orderQty),
        billable: mediaNeeded,
        billableUnit: 'Billable Sheets'
      }
    }
  };
}
