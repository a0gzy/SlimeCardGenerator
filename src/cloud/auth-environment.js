// Google rejects OAuth inside embedded webviews (VK, Instagram, Facebook, etc.).
const EMBEDDED = /(FBAN|FBAV|FB_IAB|Instagram|VKClient|VKontakte|OKApp|MicroMessenger|Snapchat|Pinterest|; wv\))/i;

export function detectAuthEnvironment({ userAgent = '' } = {}) {
  // Do not choose redirect based on iOS/PWA detection. On GitHub Pages its
  // cross-origin authDomain storage is blocked by Safari (and other browsers).
  return { embedded: EMBEDDED.test(userAgent) };
}
