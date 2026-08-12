export const norm = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y).map(x => x.toFixed(4)).join('x');
export const sameSize = (a, b, c, d) => norm(a, b) === norm(c, d);
export const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

export function isRollMachine(machine) {
  return machine?.feedType === 'roll';
}

export function machineFits(m, c) {
  if (!m || !c) return false;
  const cw = Math.max(c.w, c.h);
  const ch = Math.min(c.w, c.h);
  return cw <= m.w && ch <= m.h;
}

export function isStickerProduct(product) {
  return !!product?.singleSideOnly || String(product?.name || '').toLowerCase().includes('sticker');
}
