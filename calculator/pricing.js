import { isRollMachine, sameSize } from './helpers.js';

export function digitalRateFor(db, machine) {
  if (!machine) return { model: 'sheet_side', rate: 0 };
  return db.digitalRates.find(rate => rate.machine === machine.name) || { machine: machine.name, model: machine.feedType === 'roll' ? 'sqft' : 'sheet_side', rate: 0 };
}

export function digitalTierFor(db, product, media, machine, sheets) {
  if (!product || !media || !machine || product.konicaPricingMode !== 'fixed_sheet_tier' || isRollMachine(machine)) return null;
  const sameTierMedia = tier => tier.mediaType === media.type;
  const sameTierSize = tier => !(Number(tier.mediaW) > 0 && Number(tier.mediaH) > 0) || sameSize(media.w, media.h, tier.mediaW, tier.mediaH);
  return db.digitalPriceTiers
    .filter(tier => tier.product === product.name && tier.machine === machine.name && sameTierMedia(tier) && sameTierSize(tier) && Number(tier.minSheets) <= sheets)
    .sort((a, b) => Number(b.minSheets) - Number(a.minSheets))[0] || null;
}

export function resolveDigitalPricing(db, product, media, machine, sheets) {
  const rate = digitalRateFor(db, machine);
  if (isRollMachine(machine) || rate.model === 'sqft') return { kind: 'sell_sqft', rate, tier: null };
  if (product?.konicaPricingMode === 'fixed_sheet_tier') return { kind: 'fixed_sheet_tier', rate, tier: digitalTierFor(db, product, media, machine, sheets) };
  return { kind: 'cost_plus', rate, tier: null };
}
