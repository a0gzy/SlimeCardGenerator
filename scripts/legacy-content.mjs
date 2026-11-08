// Guarded transformations of deployment copies only; the original bundle stays intact.
export function extendLegacyContent(source) {
  if (!source.includes('function Vn(){')) throw new Error('Unsupported legacy editor: update the content integration.');
  const replace = (from, to) => {
    if (!source.includes(from)) throw new Error(`Legacy content integration changed: ${from.slice(0, 70)}`);
    source = source.replace(from, to);
  };
  replace('on=[`Yolanda`', 'on=[`Vladaris`,`Balenor-Slime`,`Yolanda`');
  replace('get imageUrl(){if(this._skin>0)', 'get imageUrl(){if(this.name===`Vladaris`||this.name===`Balenor-Slime`)return new URL(`/SlimeCastleCardGenerator/assets/${this.name===`Vladaris`?`vladaris.png`:`Balenor-Slime.png`}`,import.meta.url).href;if(this._skin>0)');
  replace('get itemUrl(){return', 'get itemUrl(){if(this.set===`abyss`)return new URL(`/SlimeCastleCardGenerator/assets/${this.type===`chestplate`?`armor`:this.type}-Abyss.png`,import.meta.url).href;return');
  replace('function Vn(){let e=[],t=', 'function Vn(){let e=[`sword`,`helmet`,`chestplate`,`ring`].map(t=>new zn(`Abyss${t.charAt(0).toUpperCase()+t.slice(1)}`,t,`abyss`,`no`)),t=');
  replace('t.toLowerCase().includes(`astral`)?`astral`:`egida`', 't.toLowerCase().includes(`abyss`)?`abyss`:t.toLowerCase().includes(`astral`)?`astral`:`egida`');
  replace('`Wind`,`EpicWater`]', '`Wind`,`EpicWater`,`Pony`,`Nox`,`Tycha`]');
  replace('get imageUrl(){return new URL(Object.assign({"../assets/artifacts/Agnaros.png":Fi,', 'get imageUrl(){if([`Pony`,`Nox`,`Tycha`].includes(this.name))return new URL(`/SlimeCastleCardGenerator/assets/art-${this.name}.png`,import.meta.url).href;return new URL(Object.assign({"../assets/artifacts/Agnaros.png":Fi,');
  source = source.replaceAll('{rows:5,cols:6}', '{rows:6,cols:6}');
  return source;
}
