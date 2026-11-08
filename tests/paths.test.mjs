import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_BASE, rewriteAssetPaths, siteBase, stripSiteBase } from '../scripts/paths.mjs';

test('uses the new repository path locally and infers the repository in Actions', () => {
  assert.equal(siteBase({}), '/SlimeCardGenerator/');
  assert.equal(siteBase({ GITHUB_REPOSITORY: 'a0gzy/SlimeCardGenerator' }), '/SlimeCardGenerator/');
  assert.equal(siteBase({ GITHUB_REPOSITORY: 'someone/another-repo' }), '/another-repo/');
  assert.equal(siteBase({ GITHUB_REPOSITORY: 'a0gzy/a0gzy.github.io' }), '/');
  assert.equal(siteBase({ SITE_BASE: '/', GITHUB_REPOSITORY: 'a0gzy/SlimeCardGenerator' }), '/');
});
test('rejects invalid deployment paths', () => {
  for (const base of ['relative/', '/missing-trailing-slash', '/../', '/foo/./', '//', '/path/?x', '/back\\slash/']) {
    assert.throws(() => siteBase({ SITE_BASE: base }));
  }
});
test('rewrites every original asset URL without changing asset filenames', () => {
  const input = `const image='${LEGACY_BASE}assets/test.png'; url(${LEGACY_BASE}assets/font.ttf)`;
  const output = rewriteAssetPaths(input, '/SlimeCardGenerator/');
  assert.equal(output, "const image='/SlimeCardGenerator/assets/test.png'; url(/SlimeCardGenerator/assets/font.ttf)");
  assert.ok(!output.includes(LEGACY_BASE));
  assert.equal(rewriteAssetPaths(input, '/'), "const image='/assets/test.png'; url(/assets/font.ttf)");
});
test('local routing strips only the complete configured base', () => {
  assert.equal(stripSiteBase('/SlimeCardGenerator/assets/a.png', '/SlimeCardGenerator/'), '/assets/a.png');
  assert.equal(stripSiteBase('/SlimeCardGenerator/', '/SlimeCardGenerator/'), '/');
  assert.equal(stripSiteBase('/SlimeCardGeneratorOther/a', '/SlimeCardGenerator/'), '/SlimeCardGeneratorOther/a');
  assert.equal(stripSiteBase('/assets/a.png', '/'), '/assets/a.png');
});
