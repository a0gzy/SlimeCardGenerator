// Logical names stay stable when artwork is replaced. Add new images to assets/
// and map them in art-overrides.js; original image files are not overwritten.
import { artOverrides } from './art-overrides.js';
export const GAME_ART = {
  slimes: {
    Vladaris: 'vladaris.png', 'Balenor-Slime': 'Balenor-Slime.png',
    Arp: 'Arp-1bs-BH-r.png', Veinley: 'Veinley-kSsnNkPB.png', Yulissa: 'Yulissa-BpQFEGSe.png',
    Willer: 'Willer-uUyPEgGW.png', Yana: 'Yana-C8wajZBz.png', Ysabelle: 'Ysabelle-CQTw0ocY.png', Yamilet: 'Yamilet-OzqWTs96.png',
    Chilbert: 'Chilbert-Cu32ieB2.png', Sully: 'Sully-COxNj59D.png', Doraks: 'Doraks-XgvKBGsI.png',
    Yolanda: 'Yolanda-CtsMdmsn.png', Wynne: 'Wynne-VMxjl1FM.png', Vinomera: 'Vinomera-CzlyVeNr.png', Neprus: 'Neprus-K4KKFYPO.png',
    Vulcayen: 'Vulcayen-BL9C3UXX.png', Maggie: 'Maggie-CTzfl2-9.png', Chloris: 'Chloris-DOsuf1me.png', Haku: 'Haku-4YGr7nsW.png',
    Feyria: 'Feyria-Bl81Saw8.png', Solax: 'Solax-DIl9dnu7.png', Lunax: 'Lunax-axXJrI5m.png', Silas: 'Silas-ChjpRpf6.png',
    Sylvia: 'Sylvia-C66n1lYN.png', Auralis: 'Auralis-EAfe9LVm.png', Agnaros: 'Agnaros-eoDilKNV.png', Monilia: 'Monilia-wGE7-oSg.png',
    Panpan: 'Panpan-DSDDeeXI.png', Aelwenya: 'Aelwenya-BTqPkZBm.png', Taranis: 'Taranis-CxINJIxP.png', Fenicis: 'Fenicis-CTGHidmm.png', Noxraith: 'Noxraith-BCSb2-Vp.png',
  },
  skins: {
    'Arp-1': 'Arp-1-BORAg9qp.png', 'Yulissa-1': 'Yulissa-1-zo3_XMZi.png', 'Willer-1': 'Willer-1-1FOAYg5k.png', 'Yana-1': 'Yana-1-D_AWyo-k.png',
    'Ysabelle-1': 'Ysabelle-1-BS1d_wma.png', 'Yamilet-1': 'Yamilet-1-BR7OY0ns.png', 'Chilbert-1': 'Chilbert-1-qYz5J12L.png', 'Sully-1': 'Sully-1-BzrN8X-n.png',
    'Yolanda-1': 'Yolanda-1-DAd_HqaJ.png', 'Wynne-1': 'Wynne-1-BpG9T0tu.png', 'Vinomera-1': 'Vinomera-1-D2tg7kGu.png', 'Neprus-1': 'Neprus-1-SBSFEi9s.png', 'Neprus-2': 'Neprus-2-Cm8g44PB.png',
    'Vulcayen-1': 'Vulcayen-1-C0ZVW5od.png', 'Chloris-1': 'Chloris-1-Dhutd4kv.png', 'Chloris-2': 'Chloris-2-AZAdlUwp.png', 'Haku-1': 'Haku-1-I5DtErR4.png', 'Haku-2': 'Haku-2-Dlfld9eB.png',
    'Feyria-1': 'Feyria-1-BToYIRjf.png', 'Solax-1': 'Solax-1-DaAKtMIf.png', 'Lunax-1': 'Lunax-1-B3hnGip6.png', 'Silas-1': 'Silas-1-DSuYEvly.png',
    'Sylvia-1': 'Sylvia-1-TVTnHjEI.png', 'Auralis-1': 'Auralis-1-Nn3dXd6E.png', 'Agnaros-1': 'Agnaros-1-a4461S73.png', 'Monilia-1': 'Monilia-1-Bh3Ol6OW.png',
    'Panpan-1': 'Panpan-1-phi5wQ8y.png', 'Aelwenya-1': 'Aelwenya-1-BeqeJxbr.png', 'Taranis-1': 'Taranis-1-Dgfbj-0a.png',
  },
  relics: {
    DemonClaw: 'DemonClaw-DZ-Zgjox.png', DemonMask: 'DemonMask-DsSxh6qR.png', DragonheartShield: 'DragonheartShield-CrGraAA3.png', DragonbloodBlade: 'DragonbloodBlade-Dsp4o3TW.png',
    PhilosophersStone: 'PhilosophersStone-BIm6PCaf.png', AstralCompass: 'AstralCompass-DBJdKqrQ.png', 'Soul-DevouringCrucible': 'Soul-DevouringCrucible-Z280N6Kx.png',
    SpiritInfusionElixir: 'SpiritInfusionElixir-MChHgGg7.png', BookOfProphecy: 'BookOfProphecy-qZ-AEoE1.png', StarlightBrooch: 'StarlightBrooch-C8Hrb4cu.png',
    OminousMask: 'OminousMask-DWESc3nT.png', InsightMirror: 'InsightMirror-ibNjFlhb.png', HourglassOfTime: 'HourglassOfTime-CzX696tH.png', TabletOfTruth: 'TabletOfTruth-CmvjFAry.png',
    WhisperingWindChime: 'WhisperingWindChime-Dd6V42e7.png', EternalEmber: 'EternalEmber-CjzOxehP.png', FrozenHeart: 'FrozenHeart-CR42VaY9.png',
  },
  artifacts: {
    Fenicis: 'Fenicis-BLS1lh97.png', Agnaros: 'Agnaros-DV8U4gqG.png', Panpan: 'Panpan-CDA5XQVB.png', Solax: 'Solax-vYf3bcTw.png',
    Vulcayen: 'Vulcayen-VlddrgLD.png', Wynne: 'Wynne-BGyPNSRT.png', Special: 'Special-DtPZrynG.png', Fire: 'Fire-CDz0v1v3.png',
    Water: 'Water-Zgwc_kCe.png', Earth: 'Earth-D0FCexHk.png', Wind: 'Wind-oIoJzIgn.png', EpicWater: 'EpicWater-CylvYTej.png',
    Pony: 'art-Pony.png', Nox: 'art-Nox.png', Tycha: 'art-Tycha.png',
  },
  buffs: {
    ATK: 'ATK-21kDGZxH.png', CritCh: 'CritCh-db7Nfo4h.png', CritMult: 'CritMult-BMUqs4Ig.png', CritRes: 'CritRes-CAGzlWxC.png', DeadHit: 'DeadHit-1a1BEfUm.png',
    DmgRet: 'DmgRet-CMxRuc6I.png', Dodge: 'Dodge-B4wUg9ne.png', DoubleAttack: 'DoubleAttack-B65FxP1P.png', Grievous: 'Grievous-DW3QeLIs.png',
    HitRate: 'HitRate-D_o9L9Cp.png', HP: 'HP-CMi4xDx6.png', RangeMult: 'RangeMult-DNfEu6nR.png', Regen: 'Regen-DOpYAVxe.png', Shield: 'Shield-B7gfhURS.png',
    SkillCh: 'SkillCh-BC8AQn9K.png', SkillMult: 'SkillMult-CLIT0xRv.png', SplashMult: 'SplashMult-BnSF6o_v.png',
  },
  equipment: {
    AbyssSword: 'sword-Abyss.png', AbyssHelmet: 'helmet-Abyss.png', AbyssChestplate: 'armor-Abyss.png', AbyssRing: 'ring-Abyss.png',
    AstralSword: 'sword-KK_lvQns.png', AstralHelmet: 'helmet-NMNlNAuY.png', AstralChestplate: 'chestplate-C8LLcron.png', AstralRing: 'ring-W18pwGXS.png',
    EgidaSword: 'sword-PT_BGDn6.png', EgidaHelmet: 'helmet-BcdUSLE6.png', EgidaChestplate: 'chestplate-DhGRbGSn.png', EgidaRing: 'ring-CnRdgf1c.png',
  },
};
export function artFile(category, name, skin = 0) {
  const key = `${category}/${name}${category === 'slimes' && skin > 0 ? `-${skin}` : ''}`;
  return artOverrides[key] || (category === 'slimes' && skin > 0 ? GAME_ART.skins[`${name}-${skin}`] : null) || GAME_ART[category]?.[name] || null;
}
export function artUrl(category, name, skin = 0) {
  const file = artFile(category, name, skin);
  return file ? new URL(`../assets/${file}`, import.meta.url).href : null;
}
