import { normalizeConfig } from './profile.js';
import { equipmentRank, equipmentSets, permanentProgress, relicLevel, totalSlimeBonus } from './progress.js';

export function matchesAccountFilter(card, person, membership, search = '', guild = '') {
  const query = search.trim().toLocaleLowerCase();
  return (!guild || membership?.guildId === guild)
    && (!query || [card.playerName, card.title, person?.displayName, person?.email]
      .some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query)));
}

const owned = entry => entry && entry.state !== 'no' && entry.state !== undefined;

export function accountProgress(card) {
  try {
    const config = normalizeConfig(card.config);
    const slimes = config.modules.slimes?.slimesList || [];
    const buffs = config.modules.buffs?.buffsList || [];
    return {
      bonus: slimes.length ? totalSlimeBonus(slimes) : null,
      perms: buffs.length ? permanentProgress(buffs) : null,
      sets: equipmentSets(config.modules.equipment?.equipmentList || []),
      slimes,
      artifacts: config.modules.artifacts?.artifactsList || [],
      relics: config.modules.relics?.relicsList || [],
    };
  } catch {
    return { bonus: null, perms: null, sets: [], slimes: [], artifacts: [], relics: [] };
  }
}

function hasEvery(entries, names, minimum = 0, value = () => true) {
  return names.every(name => entries.some(entry => entry.name === name && owned(entry) && value(entry) >= minimum));
}

export function matchesProgressFilter(progress, filters = {}) {
  const minimum = Number(filters.minBonus) || 0;
  if (minimum > 0 && (progress.bonus === null || progress.bonus + 1e-9 < minimum)) return false;
  if (filters.phase) {
    if (!progress.perms) return false;
    if (filters.phase === 'closed' && !progress.perms.complete) return false;
    if (filters.phase === 'open' && progress.perms.complete) return false;
    if (['1', '2'].includes(filters.phase) && String(progress.perms.phase) !== filters.phase) return false;
  }
  if (filters.set || filters.quality || Number(filters.pieces) > 0) {
    const rank = equipmentRank(filters.quality || 'no');
    const required = Math.max(1, Number(filters.pieces) || 1);
    const matched = progress.sets.some(set => (!filters.set || set.key === filters.set)
      && set.items.filter(item => item.owned && equipmentRank(item.grade) >= rank).length >= required);
    if (!matched) return false;
  }
  const slimes = filters.slimes || [];
  if (slimes.length && !hasEvery(progress.slimes, slimes)) return false;
  const artifacts = filters.artifacts || [];
  if (artifacts.length && !hasEvery(progress.artifacts, artifacts, Number(filters.artifactLevel) || 0, entry => entry.level)) return false;
  const relics = filters.relics || [];
  if (relics.length && !hasEvery(progress.relics, relics, Number(filters.relicLevel) || 0, entry => relicLevel(entry.state))) return false;
  return true;
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
