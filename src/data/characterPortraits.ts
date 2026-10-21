/**
 * Official Portrait Registry for Jujutsu Kaisen: Cursed Chronicles
 *
 * Includes:
 * 1. The 5 high-resolution ArtStation portraits by KwnBlack (https://www.artstation.com/artwork/9mndGv)
 *    for Kento Nanami, Ryomen Sukuna, Satoru Gojo, Choso, and Suguru Geto.
 * 2. All 318 Character Portrait Images downloaded from https://jujutsu-kaisen.fandom.com/wiki/Category:Portrait_Images
 *    stored locally under `/portraits/wiki/*.png` (e.g., `/portraits/wiki/AoiP.png` for Aoi Todo).
 */

export interface PortraitGalleryItem {
  id: string;
  label: string;
  category: 'artstation' | 'wiki_sorcerer' | 'wiki_curse' | 'generic';
  url: string;
}

export const ARTSTATION_PORTRAITS: Record<string, string> = {
  'kento nanami': '/portraits/artstation/nanami.png',
  nanami: '/portraits/artstation/nanami.png',
  'nanami kento': '/portraits/artstation/nanami.png',
  'ryomen sukuna': '/portraits/artstation/sukuna.png',
  sukuna: '/portraits/artstation/sukuna.png',
  'rei das maldicoes': '/portraits/artstation/sukuna.png',
  'satoru gojo': '/portraits/artstation/gojo.png',
  gojo: '/portraits/artstation/gojo.png',
  'gojo satoru': '/portraits/artstation/gojo.png',
  choso: '/portraits/artstation/choso.png',
  'suguru geto': '/portraits/artstation/geto.png',
  geto: '/portraits/artstation/geto.png',
  'geto suguru': '/portraits/artstation/geto.png',
};

/**
 * Direct canonical aliases mapping character names (and common PT-BR / EN / JP variations)
 * to their downloaded Fandom Wiki Portrait in `/portraits/wiki/`.
 */
export const CANONICAL_WIKI_PORTRAIT_MAP: Record<string, string> = {
  // Featured ArtStation 5 (Priority 1)
  'kento nanami': '/portraits/artstation/nanami.png',
  nanami: '/portraits/artstation/nanami.png',
  'ryomen sukuna': '/portraits/artstation/sukuna.png',
  sukuna: '/portraits/artstation/sukuna.png',
  'satoru gojo': '/portraits/artstation/gojo.png',
  gojo: '/portraits/artstation/gojo.png',
  choso: '/portraits/artstation/choso.png',
  'suguru geto': '/portraits/artstation/geto.png',
  geto: '/portraits/artstation/geto.png',

  // Kyoto & Tokyo Students / Sorcerers
  'aoi todo': '/portraits/wiki/AoiP.png',
  aoi: '/portraits/wiki/AoiP.png',
  todo: '/portraits/wiki/AoiP.png',
  'todo aoi': '/portraits/wiki/AoiP.png',
  'yuji itadori': '/portraits/wiki/YujiP.png',
  yuji: '/portraits/wiki/YujiP.png',
  itadori: '/portraits/wiki/YujiP.png',
  'itadori yuji': '/portraits/wiki/YujiP.png',
  'megumi fushiguro': '/portraits/wiki/MegumiP.png',
  megumi: '/portraits/wiki/MegumiP.png',
  fushiguro: '/portraits/wiki/MegumiP.png',
  'nobara kugisaki': '/portraits/wiki/NobaraP.png',
  nobara: '/portraits/wiki/NobaraP.png',
  kugisaki: '/portraits/wiki/NobaraP.png',
  'maki zenin': '/portraits/wiki/MakiP.png',
  maki: '/portraits/wiki/MakiP.png',
  'toge inumaki': '/portraits/wiki/TogeP.png',
  toge: '/portraits/wiki/TogeP.png',
  inumaki: '/portraits/wiki/TogeP.png',
  panda: '/portraits/wiki/PandaP.png',
  'yuta okkotsu': '/portraits/wiki/YutaOkkotsuP.png',
  yuta: '/portraits/wiki/YutaOkkotsuP.png',
  okkotsu: '/portraits/wiki/YutaOkkotsuP.png',
  'kinji hakari': '/portraits/wiki/KinjiHakariP.png',
  hakari: '/portraits/wiki/KinjiHakariP.png',
  'kirara hoshi': '/portraits/wiki/KiraraHoshiP.png',
  kirara: '/portraits/wiki/KiraraHoshiP.png',
  'mai zenin': '/portraits/wiki/MaiP.png',
  mai: '/portraits/wiki/MaiP.png',
  'kasumi miwa': '/portraits/wiki/KasumiMiwaP.png',
  miwa: '/portraits/wiki/KasumiMiwaP.png',
  'kokichi muta': '/portraits/wiki/KokichiP.png',
  mechamaru: '/portraits/wiki/MechamaruP.png',
  'momo nishimiya': '/portraits/wiki/MomoNishimiyaP.png',
  momo: '/portraits/wiki/MomoNishimiyaP.png',
  nishimiya: '/portraits/wiki/MomoNishimiyaP.png',
  'noritoshi kamo': '/portraits/wiki/NoritoshiKamoP.png',
  kamo: '/portraits/wiki/NoritoshiKamoP.png',
  'arata nitta': '/portraits/wiki/ArataNittaP.png',
  arata: '/portraits/wiki/ArataNittaP.png',

  // Faculty, Managers & Pro Sorcerers
  'atsuya kusakabe': '/portraits/wiki/AtsuyaKusakabeP.png',
  kusakabe: '/portraits/wiki/AtsuyaKusakabeP.png',
  'mei mei': '/portraits/wiki/MeiMeiP.png',
  meimei: '/portraits/wiki/MeiMeiP.png',
  'ui ui': '/portraits/wiki/UiUiP.png',
  uiui: '/portraits/wiki/UiUiP.png',
  'shoko ieiri': '/portraits/wiki/ShokoIeriP.png',
  'shoko ieri': '/portraits/wiki/ShokoIeriP.png',
  shoko: '/portraits/wiki/ShokoIeriP.png',
  ieiri: '/portraits/wiki/ShokoIeriP.png',
  'masamichi yaga': '/portraits/wiki/MasamichiP.png',
  yaga: '/portraits/wiki/MasamichiP.png',
  masamichi: '/portraits/wiki/MasamichiP.png',
  'kiyotaka ijichi': '/portraits/wiki/IjichiP.png',
  ijichi: '/portraits/wiki/IjichiP.png',
  'akari nitta': '/portraits/wiki/AkariNittaP.png',
  akari: '/portraits/wiki/AkariNittaP.png',
  'utahime iori': '/portraits/wiki/UtahimeP.png',
  utahime: '/portraits/wiki/UtahimeP.png',
  'yoshinobu gakuganji': '/portraits/wiki/YoshinobuP.png',
  gakuganji: '/portraits/wiki/YoshinobuP.png',
  'yuki tsukumo': '/portraits/wiki/YukiTsukumoP.png',
  yuki: '/portraits/wiki/YukiTsukumoP.png',
  tsukumo: '/portraits/wiki/YukiTsukumoP.png',
  tengen: '/portraits/wiki/TengenP.png',
  'mestre tengen': '/portraits/wiki/TengenP.png',
  'takuma ino': '/portraits/wiki/TakumaInoP.png',
  ino: '/portraits/wiki/TakumaInoP.png',
  'yu haibara': '/portraits/wiki/YuHaibaraP.png',
  haibara: '/portraits/wiki/YuHaibaraP.png',

  // Clans & Assassins
  'toji fushiguro': '/portraits/wiki/TojiFushiguroP.png',
  'toji zenin': '/portraits/wiki/TojiFushiguroP.png',
  toji: '/portraits/wiki/TojiFushiguroP.png',
  'naobito zenin': '/portraits/wiki/NaobitoZeninP.png',
  naobito: '/portraits/wiki/NaobitoZeninP.png',
  'naoya zenin': '/portraits/wiki/NaoyaZeninP.png',
  naoya: '/portraits/wiki/NaoyaZeninP.png',
  'ogi zenin': '/portraits/wiki/OgiZeninP.png',
  ogi: '/portraits/wiki/OgiZeninP.png',
  'jinichi zenin': '/portraits/wiki/JinichiZeninP.png',
  jinichi: '/portraits/wiki/JinichiZeninP.png',
  'chojuro zenin': '/portraits/wiki/ChojuroZeninP.png',
  chojuro: '/portraits/wiki/ChojuroZeninP.png',
  'nobuaki zenin': '/portraits/wiki/NobuakiZeninP.png',

  // Cursed Spirits, Disaster Curses & Death Paintings
  mahito: '/portraits/wiki/MahitoP.png',
  jogo: '/portraits/wiki/JogoP.png',
  hanami: '/portraits/wiki/HanamiP.png',
  dagon: '/portraits/wiki/DagonP.png',
  eso: '/portraits/wiki/EsoP.png',
  kechizu: '/portraits/wiki/KechizuP.png',
  'rika orimoto': '/portraits/wiki/CursedRikaOrimotoP.png',
  rika: '/portraits/wiki/CursedRikaOrimotoP.png',
  'rainha das maldicoes': '/portraits/wiki/CursedRikaOrimotoP.png',
  mahoraga: '/portraits/wiki/MahoragaP.png',
  'general divino mahoraga': '/portraits/wiki/MahoragaP.png',
  'portador do dedo': '/portraits/wiki/FingerBearerP.png',
  'finger bearer': '/portraits/wiki/FingerBearerP.png',
  'divindade da variola': '/portraits/wiki/SmallpoxDeityP.png',
  'smallpox deity': '/portraits/wiki/SmallpoxDeityP.png',
  'kuchisake-onna': '/portraits/wiki/Kuchisake-OnnaP.png',
  'maldicao gafanhoto': '/portraits/wiki/GrasshopperCurseP.png',
  'grasshopper curse': '/portraits/wiki/GrasshopperCurseP.png',
  'ko-guy': '/portraits/wiki/GrasshopperCurseP.png',
  'maldicao da ponte': '/portraits/wiki/BridgeCurseP.png',
  'bridge curse': '/portraits/wiki/BridgeCurseP.png',
  'dragao arco-iris': '/portraits/wiki/RainbowDragonP.png',
  'rainbow dragon': '/portraits/wiki/RainbowDragonP.png',
  'maldicao do inventario': '/portraits/wiki/InventoryCurseP.png',
  'inventory curse': '/portraits/wiki/InventoryCurseP.png',
  ganesha: '/portraits/wiki/GaneshaP.png',
  'tamamo-no-mae': '/portraits/wiki/Tamamo-no-MaeP.png',
  'akuro-o otake': '/portraits/wiki/Akuro-o_OtakeP.png',

  // Kenjaku, Uraume, Curse Users & Culling Game Players
  kenjaku: '/portraits/wiki/KenjakuP.png',
  'pseudo-geto': '/portraits/wiki/KenjakuP.png',
  uraume: '/portraits/wiki/UraumeP.png',
  'hiromi higuruma': '/portraits/wiki/HiromiHigurumaP.png',
  higuruma: '/portraits/wiki/HiromiHigurumaP.png',
  judgeman: '/portraits/wiki/JudgeP.png',
  'hajime kashimo': '/portraits/wiki/HajimeKashimoP.png',
  kashimo: '/portraits/wiki/HajimeKashimoP.png',
  'fumihiko takaba': '/portraits/wiki/FumihikoTakabaP.png',
  takaba: '/portraits/wiki/FumihikoTakabaP.png',
  'hana kurusu': '/portraits/wiki/HanaKurusuP.png',
  hana: '/portraits/wiki/HanaKurusuP.png',
  angel: '/portraits/wiki/AngelP.png',
  anjo: '/portraits/wiki/AngelP.png',
  'ryu ishigori': '/portraits/wiki/RyuIshigoriP.png',
  ryu: '/portraits/wiki/RyuIshigoriP.png',
  ishigori: '/portraits/wiki/RyuIshigoriP.png',
  'takako uro': '/portraits/wiki/TakakoUroP.png',
  uro: '/portraits/wiki/TakakoUroP.png',
  'dhruv lakdawalla': '/portraits/wiki/DhruvLakdawallaP.png',
  dhruv: '/portraits/wiki/DhruvLakdawallaP.png',
  yorozu: '/portraits/wiki/YorozuP.png',
  'reggie star': '/portraits/wiki/ReggieStarP.png',
  reggie: '/portraits/wiki/ReggieStarP.png',
  'iori hazenoki': '/portraits/wiki/IoriHazenokiP.png',
  hazenoki: '/portraits/wiki/IoriHazenokiP.png',
  'charles bernard': '/portraits/wiki/CharlesBernardP.png',
  charles: '/portraits/wiki/CharlesBernardP.png',
  'hagane daido': '/portraits/wiki/HaganeDaidoP.png',
  daido: '/portraits/wiki/HaganeDaidoP.png',
  'rokujushi miyo': '/portraits/wiki/RokujushiMiyoP.png',
  miyo: '/portraits/wiki/RokujushiMiyoP.png',
  'chizuru hari': '/portraits/wiki/ChizuruHariP.png',
  remi: '/portraits/wiki/RemiP.png',
  'rin amai': '/portraits/wiki/RinAmaiP.png',
  haba: '/portraits/wiki/HabaP.png',
  hanyu: '/portraits/wiki/HanyuP.png',
  'haruta shigemo': '/portraits/wiki/HarutaShigemoP.png',
  haruta: '/portraits/wiki/HarutaShigemoP.png',
  shigemo: '/portraits/wiki/HarutaShigemoP.png',
  'juzo kumiya': '/portraits/wiki/JuzoKumiyaP.png',
  juzo: '/portraits/wiki/JuzoKumiyaP.png',
  'jiro awasaka': '/portraits/wiki/JiroAwasakaP.png',
  awasaka: '/portraits/wiki/JiroAwasakaP.png',
  ogami: '/portraits/wiki/OgamiP.png',
  'vovo ogami': '/portraits/wiki/OgamiP.png',
  'niji ebina': '/portraits/wiki/NijiEbinaP.png',
  miguel: '/portraits/wiki/MiguelP.png',
  larue: '/portraits/wiki/LarueP.png',
  'manami suda': '/portraits/wiki/ManamiSudaP.png',
  'toshihisa negi': '/portraits/wiki/ToshihisaNegiP.png',
  'mimiko hasaba': '/portraits/wiki/MimikoP.png',
  mimiko: '/portraits/wiki/MimikoP.png',
  'nanako hasaba': '/portraits/wiki/NanakoP.png',
  nanako: '/portraits/wiki/NanakoP.png',

  // Supporting & Story Characters
  'junpei yoshino': '/portraits/wiki/JunpeiYoshinoP.png',
  junpei: '/portraits/wiki/JunpeiYoshinoP.png',
  'riko amanai': '/portraits/wiki/RikoAmanaiP.png',
  riko: '/portraits/wiki/RikoAmanaiP.png',
  'misato kuroi': '/portraits/wiki/MisatoKuroiP.png',
  kuroi: '/portraits/wiki/MisatoKuroiP.png',
  'shiu kong': '/portraits/wiki/ShiuKongP.png',
  'tsumiki fushiguro': '/portraits/wiki/TsumikiFushiguroP.png',
  tsumiki: '/portraits/wiki/TsumikiFushiguroP.png',
  'jin itadori': '/portraits/wiki/JinItadoriP.png',
  'wasuke itadori': '/portraits/wiki/WasukeItadoriP.png',
  'yuko ozawa': '/portraits/wiki/YukoOzawaP.png',
  'takada-chan': '/portraits/wiki/Takada-chanP.png',
  takada: '/portraits/wiki/Takada-chanP.png',
  'setsuko sasaki': '/portraits/wiki/IguchiP.png',
  'takeshi iguchi': '/portraits/wiki/IguchiP.png',
  iguchi: '/portraits/wiki/IguchiP.png',
  'shigeru sonoda': '/portraits/wiki/ShigeruSonodaP.png',
  'tadashi okazaki': '/portraits/wiki/TadashiOkazakiP.png',
};

/**
 * Complete list of all 318 downloaded Wiki portrait filenames in `/portraits/wiki/`
 * for automatic fuzzy matching of any character from the Jujutsu Kaisen Wiki.
 */
export const WIKI_PORTRAIT_FILES: string[] = [
  '2086Healer.png',
  '2086HigherupP.png',
  'Adult_SaoriP.png',
  'AidaP.png',
  'AkariNittaP.png',
  'AkariP__Anime_.png',
  'Akuro-o_OtakeP.png',
  'AngelP.png',
  'AoiP.png',
  'AoiP__Anime_.png',
  'ArataNittaP.png',
  'AtsuyaKusakabeP.png',
  'AyaSaitoP.png',
  'BagMaskCurseUserP.png',
  'BakeryGirlP.png',
  'BoroP.png',
  'BridgeCurseP.png',
  'CharPortal1.png',
  'CharPortal2.png',
  'CharPortal3.png',
  'CharPortal4.png',
  'CharPortal5.png',
  'CharPortal6.png',
  'CharPortal7.png',
  'CharlesBernardP.png',
  'ChizuruHariP.png',
  'ChojuroZeninP.png',
  'ChosoP.png',
  'ChosoP__Anime_.png',
  'CrossP.png',
  'CurseUsertraffickerP.png',
  'CursedNaoyaP.png',
  'CursedRikaOrimotoP.png',
  'Cursed_death_paintings_momP.png',
  'CyrusVeilP.png',
  'DaburaP.png',
  'DagonP.png',
  'DagonP__Cursed_Womb_.png',
  'DapaP.png',
  'DeskunteChiefP.png',
  'DhruvLakdawallaP.png',
  'DuraP.png',
  'EmikoKaminumaP.png',
  'EsoP.png',
  'FamiresuManagerP.png',
  'FightClubP1.png',
  'FightClubP2.png',
  'FightClubP3.png',
  'FightClubP4.png',
  'FightClubP5.png',
  'FightClubP6.png',
  'FightClubP7.png',
  'FingerBearerP.png',
  'FlyHeadsP.png',
  'FoxP.png',
  'FujinumaBrotherP.png',
  'FujinumaSisterP.png',
  'FujiwaraP.png',
  'FumihikoTakabaP.png',
  'FurudateP.png',
  'GakuganjiCurseP.png',
  'GaneshaP.png',
  'GarryKJohnsonP.png',
  'GojoP.png',
  'GojoP__Anime_.png',
  'GorillaP.png',
  'GrasshopperCurseP.png',
  'HabaP.png',
  'HaganeDaidoP.png',
  'HajimeKashimoP.png',
  'HanaKurusuP.png',
  'HanamiP.png',
  'HanamiP__Anime_.png',
  'HanyuP.png',
  'HapinaCurseP.png',
  'HarutaShigemoP.png',
  'Higher-up1P.png',
  'Higher-up2P.png',
  'Higher-up3P.png',
  'Higuruma_sClientP.png',
  'HikariGenjiP.png',
  'HiroKatoP.png',
  'HiromiHigurumaP.png',
  'HiroshiYamatoP.png',
  'HitoshiMatsumotoP.png',
  'HondaP.png',
  'HonokaP.png',
  'Honoka_sdadP.png',
  'IdiotAP.png',
  'IguchiP.png',
  'IjichiP.png',
  'IjichiP__2006_.png',
  'IjichiP__Anime_.png',
  'IkezawaP.png',
  'IkezawabullyP.png',
  'InventoryCurseP.png',
  'IoriHazenokiP.png',
  'IoriOkkotsuP.png',
  'JabalomaP.png',
  'JapaneseTraitorP.png',
  'JinItadoriP.png',
  'JinichiZeninP.png',
  'JiroAwasakaP.png',
  'JogoP.png',
  'JogoP__Anime_.png',
  'John_BobbyP.png',
  'JudgeP.png',
  'JunpeiYoshinoP.png',
  'JuzoKumiyaP.png',
  'KadowakiP.png',
  'KanemoriP.png',
  'KasumiMiwaP.png',
  'KechizuP.png',
  'Kechizu_svesselP.png',
  'KenP.png',
  'KenjakuP.png',
  'KenjakuP__Anime_.png',
  'KentoNanamiP__2006_.png',
  'KentoNanamiP__2006_Color_.png',
  'KinjiHakariP.png',
  'KiraraHoshiP.png',
  'KokichiP.png',
  'KokunP.png',
  'Kuchisake-OnnaP.png',
  'KusakabeSisterP.png',
  'KyokoTomoeP.png',
  'LakeGoshoPlayerP.png',
  'LarueP.png',
  'MahitoP.png',
  'MahitoP__Anime_.png',
  'MahoragaP.png',
  'MaiP.png',
  'MaiP__Anime_.png',
  'MakiP.png',
  'MakiP__Anime_.png',
  'MakiP__Current_.png',
  'MakiP__ID_.png',
  'MakiP__Second-Year_.png',
  'MakiZeninP__Post-Shibuya_Color_.png',
  'MamaguroP.png',
  'ManamiSudaP.png',
  'MaruP.png',
  'Maruandcross_sdadP.png',
  'MasakiTakedaP.png',
  'MasamichiP.png',
  'MasamichiYagaP__2006_.png',
  'MasamichiYagaP__2006_Color_.png',
  'MechamaruAbsoluteP.png',
  'MechamaruP.png',
  'MegumiP.png',
  'MegumiP__Anime_.png',
  'MegumiP__Gray_.png',
  'MegumiP__ID_.png',
  'Megumi_JuniorHighP.png',
  'MeiMeiP.png',
  'MeiMeiP__Anime_.png',
  'MifuyuOkkotsuP.png',
  'MiguelP.png',
  'Miguel_sclan_shead.png',
  'MimikoP.png',
  'MinoP.png',
  'Mino_sfriendP.png',
  'MisatoKuroiP.png',
  'MiyaguniP.png',
  'MomAkutamiP.png',
  'MomoNishimiyaP.png',
  'NanakoP.png',
  'NanamiP.png',
  'NanamiP__Anime_.png',
  'NanamiP__Gray_.png',
  'NaobitoZeninP.png',
  'NaoyaZeninP.png',
  'NaoyaZeninP__Color_.png',
  'NewShadowStyleHeadP.png',
  'NijiEbinaP.png',
  'NishimuraP.png',
  'NobaraGrandmotherP.png',
  'NobaraMotherP.png',
  'NobaraP.png',
  'NobaraP__Anime_.png',
  'NobaraP__Gray_.png',
  'NobaraP__ID_.png',
  'NobaraP__Modulo_.png',
  'NobuakiZeninP.png',
  'NoritoshiKamoAP.png',
  'NoritoshiKamoP.png',
  'NoritoshiKamoP__Culling_Game_.png',
  'NoritoshiMotherP.png',
  'Noritoshi_sMomP.png',
  'Noritoshi_sSiblingP.png',
  'Noritoshi_sstepdadP.png',
  'OgamiGrandsonP.png',
  'OgamiP.png',
  'OgiZeninP.png',
  'Ogi_sWifeP.png',
  'OldCurseUserP.png',
  'OsadaP.png',
  'OsamuShimadaP.png',
  'OsukiP.png',
  'PandaP.png',
  'PandaP__Anime_.png',
  'PandaP__ID_.png',
  'ProsecutorP.png',
  'RainbowDragonP.png',
  'ReggieStarP.png',
  'RemiP.png',
  'RikaOrimotoP.png',
  'RikoAmanaiP.png',
  'RinAmaiP.png',
  'RokujushiMiyoP.png',
  'Roll-hair_ojousamaP.png',
  'RoppongiKidP.png',
  'Roppongi_Curse.png',
  'RumelianElderP.png',
  'RyuIshigoriP.png',
  'SaitoDaughterP.png',
  'SaitoP.png',
  'SalarymanBossP.png',
  'SatoruGojoP__2006_.png',
  'SatoruP__Gray_.png',
  'SavedgirlP.png',
  'SayakaYamaguchiP.png',
  'SayamaP.png',
  'SayuriAmanogawaP.png',
  'ShackP.png',
  'ShigeruSonodaP.png',
  'ShimizuP.png',
  'ShinoKamoP.png',
  'ShiuKongP.png',
  'ShokoIeiriP__2006_.png',
  'ShokoIeriP.png',
  'ShotaItoP.png',
  'SmallpoxDeityP.png',
  'SoldierJesusP.png',
  'SotaFianceeP.png',
  'SotaFukuzawaP.png',
  'SotomuraP.png',
  'SpejoP.png',
  'Sting-RayCurseP.png',
  'StudentCouncilPresidentP.png',
  'SuguruGetoP.png',
  'SuguruGetoP__2006_.png',
  'SukunaP.png',
  'SukunaP__Anime_.png',
  'SukunaP__Gray_.png',
  'SukunaP__Megumi_.png',
  'SukunaP__Yuji_.png',
  'SuzukaShimizuP.png',
  'SuzukiP.png',
  'TadashiOkazakiP.png',
  'Tadashi_sMomP.png',
  'TakabaNewPartnerP.png',
  'Takaba_scollegepartnerP.png',
  'Takaba_sex-partnerP.png',
  'Takada-chanP.png',
  'Takagi.png',
  'TakagiP.png',
  'TakakoUroP.png',
  'TakedaP.png',
  'Takeda_P.png',
  'TakumaInoP.png',
  'TakumaInoP__masked_.png',
  'Tamamo-no-MaeP.png',
  'TanukiP.png',
  'TasukeP.png',
  'TeamMeiMeiManagerP.png',
  'TengenP.png',
  'TengenP__Jump_GIGA_2021_AUTUMN_.png',
  'TogeP.png',
  'TogeP__Anime_.png',
  'TogeP__ID_.png',
  'TogeP__Second-Year_.png',
  'TojiFushiguroP.png',
  'ToshihisaNegiP.png',
  'TriceratopsP.png',
  'TsubasaP.png',
  'TsumikiFushiguroP.png',
  'TsumikiP__Anime_.png',
  'Tsumiki_JuniorHighP.png',
  'TsurugiP.png',
  'TsurugiP__Epilogue_.png',
  'U.S.DNIP.png',
  'U.S.PresidentP.png',
  'UiUiP.png',
  'UnknownjudgeP.png',
  'UnnamedSotaCurseUserP.png',
  'UnnamedteenP.png',
  'UraumeP.png',
  'UsamiJrP.png',
  'UsamiP.png',
  'UtahimeP.png',
  'UtahimeP__Anime_.png',
  'VayerP.png',
  'WaiterP.png',
  'WanchuoctopisellerP.png',
  'WasukeItadoriP.png',
  'YakumaruP.png',
  'YorozuP.png',
  'YoshinobuP.png',
  'YoshizawaP.png',
  'YuHaibaraP.png',
  'YuHaibaraP__Color_.png',
  'YujiP.png',
  'YujiP__Anime_.png',
  'YujiP__Gray_.png',
  'YujiP__ID_.png',
  'YujiP__Modulo_.png',
  'YukaP.png',
  'YukaP__Epilogue_.png',
  'YukiTsukumoP.png',
  'YukiYamaguchiP.png',
  'YukoOzawaP.png',
  'YumeAsagiriP.png',
  'YutaOkkotsuP.png',
  'YutaOkkotsuP__Anime_.png',
  'YutaOkkotsuP__ID_.png',
  'YutaOkkotsuP__Second-Year_.png',
  'Zenin_Mai.png',
];

/**
 * Curated Portrait Gallery for Character Creation & Sorcerer Sheet
 */
export const FEATURED_PORTRAIT_GALLERY: PortraitGalleryItem[] = [
  // ArtStation Featured 5
  {
    id: 'artstation-gojo',
    label: 'Satoru Gojo (ArtStation)',
    category: 'artstation',
    url: '/portraits/artstation/gojo.png',
  },
  {
    id: 'artstation-sukuna',
    label: 'Ryomen Sukuna (ArtStation)',
    category: 'artstation',
    url: '/portraits/artstation/sukuna.png',
  },
  {
    id: 'artstation-nanami',
    label: 'Kento Nanami (ArtStation)',
    category: 'artstation',
    url: '/portraits/artstation/nanami.png',
  },
  {
    id: 'artstation-choso',
    label: 'Choso (ArtStation)',
    category: 'artstation',
    url: '/portraits/artstation/choso.png',
  },
  {
    id: 'artstation-geto',
    label: 'Suguru Geto (ArtStation)',
    category: 'artstation',
    url: '/portraits/artstation/geto.png',
  },
  // Wiki Sorcerers
  { id: 'wiki-yuji', label: 'Yuji Itadori', category: 'wiki_sorcerer', url: '/portraits/wiki/YujiP.png' },
  { id: 'wiki-megumi', label: 'Megumi Fushiguro', category: 'wiki_sorcerer', url: '/portraits/wiki/MegumiP.png' },
  { id: 'wiki-nobara', label: 'Nobara Kugisaki', category: 'wiki_sorcerer', url: '/portraits/wiki/NobaraP.png' },
  { id: 'wiki-aoi', label: 'Aoi Todo (AoiP.png)', category: 'wiki_sorcerer', url: '/portraits/wiki/AoiP.png' },
  { id: 'wiki-yuta', label: 'Yuta Okkotsu', category: 'wiki_sorcerer', url: '/portraits/wiki/YutaOkkotsuP.png' },
  { id: 'wiki-maki', label: 'Maki Zenin', category: 'wiki_sorcerer', url: '/portraits/wiki/MakiP.png' },
  { id: 'wiki-toge', label: 'Toge Inumaki', category: 'wiki_sorcerer', url: '/portraits/wiki/TogeP.png' },
  { id: 'wiki-hakari', label: 'Kinji Hakari', category: 'wiki_sorcerer', url: '/portraits/wiki/KinjiHakariP.png' },
  { id: 'wiki-higuruma', label: 'Hiromi Higuruma', category: 'wiki_sorcerer', url: '/portraits/wiki/HiromiHigurumaP.png' },
  { id: 'wiki-kashimo', label: 'Hajime Kashimo', category: 'wiki_sorcerer', url: '/portraits/wiki/HajimeKashimoP.png' },
  { id: 'wiki-toji', label: 'Toji Fushiguro', category: 'wiki_sorcerer', url: '/portraits/wiki/TojiFushiguroP.png' },
  { id: 'wiki-kusakabe', label: 'Atsuya Kusakabe', category: 'wiki_sorcerer', url: '/portraits/wiki/AtsuyaKusakabeP.png' },
  { id: 'wiki-yuki', label: 'Yuki Tsukumo', category: 'wiki_sorcerer', url: '/portraits/wiki/YukiTsukumoP.png' },
  { id: 'wiki-meimei', label: 'Mei Mei', category: 'wiki_sorcerer', url: '/portraits/wiki/MeiMeiP.png' },
  { id: 'wiki-shoko', label: 'Shoko Ieiri', category: 'wiki_sorcerer', url: '/portraits/wiki/ShokoIeriP.png' },
  { id: 'wiki-utahime', label: 'Utahime Iori', category: 'wiki_sorcerer', url: '/portraits/wiki/UtahimeP.png' },
  { id: 'wiki-miwa', label: 'Kasumi Miwa', category: 'wiki_sorcerer', url: '/portraits/wiki/KasumiMiwaP.png' },
  { id: 'wiki-ino', label: 'Takuma Ino', category: 'wiki_sorcerer', url: '/portraits/wiki/TakumaInoP.png' },
  { id: 'wiki-ryu', label: 'Ryu Ishigori', category: 'wiki_sorcerer', url: '/portraits/wiki/RyuIshigoriP.png' },
  { id: 'wiki-uro', label: 'Takako Uro', category: 'wiki_sorcerer', url: '/portraits/wiki/TakakoUroP.png' },
  // Curses & Antagonists
  { id: 'wiki-mahito', label: 'Mahito', category: 'wiki_curse', url: '/portraits/wiki/MahitoP.png' },
  { id: 'wiki-jogo', label: 'Jogo', category: 'wiki_curse', url: '/portraits/wiki/JogoP.png' },
  { id: 'wiki-hanami', label: 'Hanami', category: 'wiki_curse', url: '/portraits/wiki/HanamiP.png' },
  { id: 'wiki-dagon', label: 'Dagon', category: 'wiki_curse', url: '/portraits/wiki/DagonP.png' },
  { id: 'wiki-kenjaku', label: 'Kenjaku', category: 'wiki_curse', url: '/portraits/wiki/KenjakuP.png' },
  { id: 'wiki-uraume', label: 'Uraume', category: 'wiki_curse', url: '/portraits/wiki/UraumeP.png' },
  { id: 'wiki-mahoraga', label: 'General Mahoraga', category: 'wiki_curse', url: '/portraits/wiki/MahoragaP.png' },
  { id: 'wiki-rika', label: 'Rika Orimoto', category: 'wiki_curse', url: '/portraits/wiki/CursedRikaOrimotoP.png' },
];

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolves a character speaker name or NPC name to an official ArtStation or Fandom Wiki portrait URL.
 * Returns `null` if the character is an original/exclusive narrative character (e.g., player OC or custom NPC)
 * so the caller can render a dedicated generic narrative portrait.
 */
export function resolveCanonicalPortraitUrl(rawName: string): string | null {
  if (!rawName || !rawName.trim()) return null;

  // Clean titles like "Aoi Todo — Feiticeiro Grau 1" or "Satoru Gojo (Professor)"
  const basePart = rawName
    .split(/[—–\-|(]/)[0]
    .replace(/\*+/g, '')
    .trim();
  const normFull = normalizeText(rawName);
  const normBase = normalizeText(basePart);

  // Exclude obvious player/custom OCs from accidentally matching a canon family member
  // e.g. "Ren Fushiguro" shouldn't become Megumi Fushiguro unless the first name matches
  const firstToken = normBase.split(/\s+/)[0] || '';

  // 1. Exact match in CANONICAL_WIKI_PORTRAIT_MAP
  if (CANONICAL_WIKI_PORTRAIT_MAP[normBase]) {
    return CANONICAL_WIKI_PORTRAIT_MAP[normBase];
  }
  if (CANONICAL_WIKI_PORTRAIT_MAP[normFull]) {
    return CANONICAL_WIKI_PORTRAIT_MAP[normFull];
  }

  // 2. Check ArtStation 5 first
  if (
    normBase === 'nanami' ||
    normBase.includes('kento nanami') ||
    normFull.includes('kento nanami') ||
    firstToken === 'nanami'
  ) {
    return '/portraits/artstation/nanami.png';
  }
  if (
    normBase === 'sukuna' ||
    normBase.includes('ryomen sukuna') ||
    normFull.includes('ryomen sukuna') ||
    firstToken === 'sukuna'
  ) {
    return '/portraits/artstation/sukuna.png';
  }
  if (
    normBase === 'gojo' ||
    normBase.includes('satoru gojo') ||
    normFull.includes('satoru gojo') ||
    firstToken === 'gojo' ||
    firstToken === 'satoru'
  ) {
    return '/portraits/artstation/gojo.png';
  }
  if (normBase === 'choso' || firstToken === 'choso') {
    return '/portraits/artstation/choso.png';
  }
  if (
    normBase === 'geto' ||
    normBase.includes('suguru geto') ||
    normFull.includes('suguru geto') ||
    firstToken === 'suguru'
  ) {
    return '/portraits/artstation/geto.png';
  }

  // 3. Token-level match in CANONICAL_WIKI_PORTRAIT_MAP
  if (CANONICAL_WIKI_PORTRAIT_MAP[firstToken]) {
    return CANONICAL_WIKI_PORTRAIT_MAP[firstToken];
  }

  for (const [key, url] of Object.entries(CANONICAL_WIKI_PORTRAIT_MAP)) {
    if (key.length >= 4 && (normBase === key || normBase.startsWith(`${key} `) || normBase.endsWith(` ${key}`))) {
      // Guard against custom OC sharing a clan surname like "Ren Fushiguro" or "Kaito Zenin"
      const clanSurnames = ['fushiguro', 'zenin', 'kamo', 'gojo', 'itadori', 'okkotsu'];
      if (clanSurnames.includes(key) && normBase.split(/\s+/).length > 1 && firstToken !== key) {
        continue;
      }
      return url;
    }
  }

  // 4. Match against all 318 downloaded Wiki portrait filenames
  const compactName = normBase.replace(/[^a-z0-9]/g, '');
  if (compactName.length >= 3) {
    for (const file of WIKI_PORTRAIT_FILES) {
      const stem = file
        .replace(/P(__.*)?\.png$/i, '')
        .replace(/\.png$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (stem.length >= 3 && (compactName === stem || stem === firstToken)) {
        return `/portraits/wiki/${file}`;
      }
    }
  }

  return null;
}
