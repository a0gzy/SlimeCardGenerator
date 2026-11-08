// Game values and phase rules mirror the supplied generator, not guessed caps.
export const SLIME_RARITIES = {
  B: ['Arp', 'Veinley', 'Yulissa'], A: ['Willer', 'Yana'], S: ['Ysabelle', 'Yamilet', 'Chilbert', 'Sully', 'Doraks'],
  SS: ['Vladaris', 'Balenor-Slime', 'Yolanda', 'Wynne', 'Vinomera', 'Neprus', 'Vulcayen', 'Maggie', 'Chloris', 'Haku', 'Feyria', 'Solax', 'Lunax', 'Silas', 'Sylvia', 'Auralis', 'Agnaros', 'Monilia'],
  SSS: ['Panpan', 'Aelwenya', 'Taranis', 'Fenicis', 'Noxraith'],
};
export const BUFF_ORDER = ['ATK', 'CritMult', 'DoubleAttack', 'DeadHit', 'HP', 'Shield', 'Regen', 'RangeMult', 'SplashMult', 'HitRate', 'DmgRet', 'Dodge', 'SkillCh', 'SkillMult', 'CritCh', 'CritRes', 'Grievous'];
export const BUFF_RULES = {
  ATK: { min: 200, max: 277, cap: 200000 }, CritCh: { min: 1, max: 2, cap: 200 }, CritMult: { min: 7, max: 20, cap: 1000 },
  CritRes: { min: 6, max: 9, cap: 3000 }, DeadHit: { min: 8, max: 11, cap: 750 }, DmgRet: { min: 6, max: 17, cap: 900 },
  Dodge: { min: .8, max: 1.1, cap: 50 }, DoubleAttack: { min: 2, max: 7, cap: 400 }, Grievous: { min: 4, max: 7, cap: 600 },
  HitRate: { min: 2, max: 4, cap: 200 }, HP: { min: 210, max: 396, cap: 250000 }, RangeMult: { min: 3, max: 13, cap: 800 },
  Regen: { min: 100, max: 199, cap: 20000 }, Shield: { min: 800, max: 1199, cap: 90100 }, SkillCh: { min: 1, max: 2, cap: 100 },
  SkillMult: { min: 2, max: 5, cap: 300 }, SplashMult: { min: 2, max: 7, cap: 320 },
};
export const EQUIPMENT_SLOTS = ['Sword', 'Helmet', 'Chestplate', 'Ring'];
// Row-major display order: sword/chestplate above helmet/ring.
export const SET_GRID_SLOTS = ['Sword', 'Chestplate', 'Helmet', 'Ring'];
export const SLOT_NAMES = { Sword: 'Меч', Helmet: 'Шлем', Chestplate: 'Броня', Ring: 'Кольцо' };
export const GRADE_NAMES = { no: 'Нет', epic: 'Эпик', legendary: 'Легендарный', mythic: 'Мифический', mythic1: 'Мифический I', mythic2: 'Мифический II', mythic3: 'Мифический III', fantasy: 'Фэнтези', fantasy1: 'Фэнтези I', fantasy2: 'Фэнтези II' };
export function equipmentQuality(grade = 'no') {
  const labels = { no: 'Нет', epic: 'Фиол', legendary: 'Лег', mythic: 'Миф', mythic1: 'Миф I', mythic2: 'Миф II', mythic3: 'Миф III', fantasy: 'Фен', fantasy1: 'Фен I', fantasy2: 'Фен II' };
  const family = grade === 'epic' ? 'epic' : grade === 'legendary' ? 'legendary' : /^mythic[123]?$/.test(grade) ? 'mythic' : /^fantasy[12]?$/.test(grade) ? 'fantasy' : 'none';
  return { family, label: labels[grade] || grade, fullName: GRADE_NAMES[grade] || grade };
}
const secondPhase = new Set(['ATK', 'HP', 'CritRes']);
const starStates = ['0', '1y', '2y', '3y', '4y', '5y', '1r', '2r', '3r', '4r', '5r'];
const starIncrements = { B: [1, 1.5, 2, 2.5, 3], A: [2, 2.5, 3, 3.5, 4], S: [4, 5, 6, 7, 8], SS: [8, 10, 12, 14, 16], SSS: [12, 15, 18, 21, 24] };
const levelBonus = { B: 2.5, A: 2.5, S: 5, SS: 10, SSS: 20 };
const clamp = (number, max) => Math.min(max, Math.max(0, Number(number) || 0));

export function slimeBonus(slime) {
  if (slime.state === 'no') return 0;
  const rarity = Object.keys(SLIME_RARITIES).find(key => SLIME_RARITIES[key].includes(slime.name));
  if (!rarity) return 0;
  const tier = Math.max(0, Math.floor(starStates.indexOf(slime.state) / 2));
  return starIncrements[rarity].slice(0, tier).reduce((sum, value) => sum + value, 0) + clamp(slime.level, 250) / 250 * levelBonus[rarity];
}
export function totalSlimeBonus(slimes = []) {
  return [...new Map(slimes.map(slime => [slime.name, slime])).values()].reduce((sum, slime) => sum + slimeBonus(slime), 0);
}
export function permanentProgress(buffs = []) {
  const values = new Map(buffs.map(buff => [buff.name, buff.value]));
  const all = BUFF_ORDER.map(name => ({ name, ...BUFF_RULES[name], value: clamp(values.get(name), BUFF_RULES[name].cap) }));
  const first = all.filter(buff => !secondPhase.has(buff.name));
  const second = all.filter(buff => secondPhase.has(buff.name));
  const phase = first.every(buff => buff.value >= buff.cap) ? 2 : 1;
  const active = phase === 1 ? first : second;
  const remaining = active.filter(buff => buff.value < buff.cap);
  const side = phase === 1 ? second.filter(buff => buff.value < buff.cap) : [];
  const percent = active.reduce((sum, buff) => sum + buff.value / buff.cap * 100, 0) / active.length;
  // Same range-of-increments estimate as the original generator. This is NOT a
  // guarantee about randomly chosen buff types or a hard maximum of attempts.
  const inflation = remaining.length ? (remaining.length + side.length) / remaining.length : 0;
  const estimatedDrops = {
    min: remaining.reduce((sum, buff) => sum + Math.ceil((buff.cap - buff.value) / buff.max), 0),
    avg: Math.ceil(remaining.reduce((sum, buff) => sum + (buff.cap - buff.value) / ((buff.min + buff.max) / 2), 0) * inflation),
    smallIncrements: [...remaining, ...side].reduce((sum, buff) => sum + Math.ceil((buff.cap - buff.value) / buff.min), 0),
  };
  return { phase, percent, complete: remaining.length === 0, closed: active.length - remaining.length, total: active.length, estimatedDrops };
}
export function equipmentSets(equipment = []) {
  const byName = new Map(equipment.map(item => [item.name, item]));
  return [{ key: 'astral', prefix: 'Astral', label: 'Астрал' }, { key: 'egida', prefix: 'Egida', label: 'Эгида' }, { key: 'abyss', prefix: 'Abyss', label: 'Abyss' }].map(set => {
    const items = EQUIPMENT_SLOTS.map(slot => ({ name: set.prefix + slot, slot, label: SLOT_NAMES[slot], grade: byName.get(set.prefix + slot)?.grade || 'no', owned: !!byName.get(set.prefix + slot)?.grade && byName.get(set.prefix + slot).grade !== 'no' }));
    return { ...set, items, owned: items.filter(item => item.owned).length, total: 4 };
  });
}

// Lanczos log-gamma and the regularized incomplete beta give the exact binomial
// tail for an integer drop target, without an inaccurate normal approximation.
function logGamma(z) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1; let x = .99999999999980993;
  coefficients.forEach((value, i) => { x += value / (z + i + 1); });
  const t = z + 7.5;
  return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(x);
}
function betaFraction(a, b, x) {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    let aa = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 3e-12) break;
  }
  return h;
}
function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  const result = x < (a + 1) / (a + b + 2) ? factor * betaFraction(a, b, x) / a : 1 - factor * betaFraction(b, a, 1 - x) / b;
  return Math.max(0, Math.min(1, result));
}
export function dropProbability(attempts, target, probability) {
  if (target === 0) return 1;
  if (attempts < target) return 0;
  return regularizedBeta(probability, target, attempts - target + 1);
}
export function attemptsQuantile(target, probability, confidence = .95) {
  if (!Number.isSafeInteger(target) || target < 0 || target > 1e7 || !Number.isFinite(probability) || probability <= 0 || probability > 1 || !Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) throw new Error('Invalid probability model');
  if (!target || probability === 1) return target;
  let low = target, high = Math.ceil(target / probability + 8 * Math.sqrt(target * (1 - probability)) / probability + 10);
  while (dropProbability(high, target, probability) < confidence) high *= 2;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dropProbability(middle, target, probability) >= confidence) high = middle; else low = middle + 1;
  }
  return low;
}
export function expectedPityCost(probability, pity = 30) {
  if (!(probability > 0 && probability <= 1) || !Number.isInteger(pity) || pity < 1) throw new Error('Invalid pity model');
  return -Math.expm1(pity * Math.log1p(-probability)) / probability;
}
export function tearsEstimates(buffs = []) {
  const progress = permanentProgress(buffs);
  return { ...progress, chances: [.045, .09].map(probability => ({ probability, min: progress.estimatedDrops.min, average: Math.ceil(progress.estimatedDrops.avg * expectedPityCost(probability)), max: progress.estimatedDrops.smallIncrements * 30, targetDrops: progress.estimatedDrops.avg })) };
}
