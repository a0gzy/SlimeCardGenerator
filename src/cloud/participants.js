export function participantName(person) {
  return person.cardNickname?.trim() || person.displayName?.trim() || 'Игрок';
}

// fetchPage returns this owner's cards, ordered by updatedAt descending.
export async function loadParticipantNickname({ fetchPage, isCurrent = () => true }) {
  let cursor = null;
  do {
    if (!isCurrent()) return '';
    const page = await fetchPage(cursor);
    if (!isCurrent()) return '';
    for (const card of page.rows) {
      if (card.deleted) continue;
      const name = card.playerName?.trim() || card.config?.playerName?.trim();
      if (name) return name;
    }
    if (!page.more) return '';
    if (!page.cursor || page.cursor === cursor) throw new Error('Не удалось загрузить ник участника. Обнови список.');
    cursor = page.cursor;
  } while (true);
}
