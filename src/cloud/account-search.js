import { normalizeConfig } from './profile.js';
import { equipmentQuality, equipmentSets, totalSlimeBonus } from './progress.js';

export function matchesAccountFilter(card, person, membership, search = '', guild = '') {
  const query = search.trim().toLocaleLowerCase();
  return (!guild || membership?.guildId === guild)
    && (!query || [card.playerName, card.title, person?.displayName, person?.email]
      .some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query)));
}

export function accountProgress(card) {
  try {
    const config = normalizeConfig(card.config);
    const slimes = config.modules.slimes?.slimesList;
    return { bonus: slimes?.length ? totalSlimeBonus(slimes) : null, sets: equipmentSets(config.modules.equipment?.equipmentList || []) };
  } catch { return { bonus: null, sets: [] }; }
}
export function matchesProgressFilter(progress, filters = {}) {
  const minimum = Number(filters.minBonus) || 0;
  if (minimum > 0 && (progress.bonus === null || progress.bonus + 1e-9 < minimum)) return false;
  if (!filters.set && !filters.quality && !(Number(filters.pieces) > 0)) return true;
  const ranks = { none: 0, epic: 1, legendary: 2, mythic: 3, fantasy: 4 };
  const rank = ranks[filters.quality] || 0;
  const required = Math.max(1, Number(filters.pieces) || 1);
  return progress.sets.some(set => (!filters.set || set.key === filters.set)
    && set.items.filter(item => item.owned && (ranks[equipmentQuality(item.grade).family] || 0) >= rank).length >= required);
}
const timestamp = value => value?.toMillis?.() ?? (value?.seconds ? value.seconds * 1000 : 0);
export function sortProgressAccounts(rows, order = 'recent') {
  const progress = new Map(rows.map(card => [card.id, accountProgress(card)]));
  return [...rows].sort((a, b) => {
    if (order === 'bonus-desc' || order === 'bonus-asc') {
      const left = progress.get(a.id).bonus, right = progress.get(b.id).bonus;
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== right) return (left - right) * (order === 'bonus-asc' ? 1 : -1);
    } else {
      const byDate = timestamp(b.updatedAt) - timestamp(a.updatedAt);
      if (byDate) return byDate;
    }
    return (a.playerName || '').localeCompare(b.playerName || '', 'ru') || a.id.localeCompare(b.id);
  });
}

// Global sorting requires ALL pages, not just the first 25. Returned snapshots
// are kept in memory only and sliced by the UI for cheap "show more" operations.
export async function loadAllianceAccounts({ fetchPage, fetchPerson, fetchMembership, filters, isCurrent = () => true }) {
  const rows = [], people = new Map(), memberships = new Map();
  let cursor = null;
  do {
    const page = await fetchPage(cursor);
    if (!isCurrent()) return null;
    for (const card of page.rows) {
      if (!matchesProgressFilter(accountProgress(card), filters)) continue;
      let person = null, membership = null;
      if (filters.search) {
        if (!people.has(card.ownerId)) people.set(card.ownerId, await fetchPerson(card.ownerId));
        person = people.get(card.ownerId);
      }
      if (filters.guild) {
        if (!memberships.has(card.ownerId)) memberships.set(card.ownerId, await fetchMembership(card.ownerId));
        membership = memberships.get(card.ownerId);
      }
      if (!isCurrent()) return null;
      if (matchesAccountFilter(card, person, membership, filters.search, filters.guild)) rows.push(card);
    }
    if (!page.more) break;
    if (!page.cursor || page.cursor === cursor) throw new Error('Не удалось продолжить загрузку аккаунтов. Обнови список.');
    cursor = page.cursor;
  } while (true);
  return sortProgressAccounts(rows, filters.sort);
}
