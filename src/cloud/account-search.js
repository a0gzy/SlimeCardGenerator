export function matchesAccountFilter(card, person, membership, search = '', guild = '') {
  const query = search.trim().toLocaleLowerCase();
  return (!guild || membership?.guildId === guild)
    && (!query || [card.playerName, card.title, person?.displayName, person?.email]
      .some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query)));
}
