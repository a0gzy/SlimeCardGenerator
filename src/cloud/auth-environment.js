const IOS = /iPad|iPhone|iPod/;
// Google rejects OAuth inside embedded webviews (VK, Instagram, Facebook, etc.).
const EMBEDDED = /(FBAN|FBAV|FB_IAB|Instagram|VKClient|VKontakte|OKApp|MicroMessenger|Snapchat|Pinterest|; wv\))/i;

export function detectAuthEnvironment({ userAgent = '', platform = '', maxTouchPoints = 0, standalone = false } = {}) {
  const ios = IOS.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const embedded = EMBEDDED.test(userAgent);
  // Safari and standalone PWAs on iOS cannot keep the popup channel alive; redirect works there.
  return { ios, embedded, redirect: ios || standalone };
}
