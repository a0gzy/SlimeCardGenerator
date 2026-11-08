export function accountTitle(config, user) {
  return (config.playerName.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'Аккаунт').slice(0, 120);
}
export function chooseSaveTarget({ cards, context, uid, playerName, forceNew = false }) {
  if (forceNew) return { action: 'create' };
  if (context?.uid === uid && context.cardId) return { action: 'update', context, confirm: context.ownerId !== uid };
  if (!cards.length) return { action: 'create' };
  const matches = cards.filter(card => card.playerName?.trim().toLocaleLowerCase() === playerName.trim().toLocaleLowerCase());
  const card = matches.length === 1 ? matches[0] : cards.length === 1 ? cards[0] : null;
  if (!card) return { action: 'choose' };
  return { action: 'update', confirm: true, context: { uid, cardId: card.id, ownerId: card.ownerId, revision: card.revision, title: card.title } };
}
