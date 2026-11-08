export const LEGACY_BASE = '/SlimeCastleCardGenerator/';

export function siteBase(env = process.env) {
  const repository = env.GITHUB_REPOSITORY?.split('/').at(-1);
  const inferred = repository?.endsWith('.github.io') ? '/' : `/${repository || 'SlimeCardGenerator'}/`;
  const base = env.SITE_BASE || inferred;
  if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(base) || base.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('SITE_BASE must be a root-relative path ending in /, e.g. /SlimeCardGenerator/');
  }
  return base;
}

export function rewriteAssetPaths(text, base) {
  return text.replaceAll(LEGACY_BASE, base);
}

export function stripSiteBase(pathname, base) {
  if (base !== '/' && pathname.startsWith(base)) return pathname.slice(base.length - 1);
  return pathname;
}
