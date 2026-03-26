/* ═══════════════════════════════════════════════════════════════════
   RETRODEX TOP SCREEN — Image System v3
   
   Problème v1 : fetch() bloqué depuis file:// (restriction Chrome)
   Problème v2 : script injection externe aussi bloquée depuis file://
   Solution v3  : <img> tag + CSS background-image sur une <div>
                  Aucune restriction CORS / canvas / file://
                  Le canvas reste pour le fallback procédural uniquement
   ═══════════════════════════════════════════════════════════════════ */

const TOP_SCREEN = (() => {

  const CACHE = {};
  const C = { D: RDX_PALETTE.dark, M: RDX_PALETTE.mid, L: RDX_PALETTE.light, B: RDX_PALETTE.bright };
  function renderFallbackGameBoyIllustration(game, width, height) {
    return TOP_SCREEN_GENERATOR.generateGBSprite({
      game: game,
      width: width,
      height: height,
      drawFallback: drawFallback
    });
  }

  function renderLoadedGameBoyIllustration(loaded, sourceType) {
    return TOP_SCREEN_GENERATOR.generateGBSprite({
      image: loaded.image,
      sourceType: sourceType,
      width: TOP_SCREEN_LOADER.GB_RENDER_SIZE.width,
      height: TOP_SCREEN_LOADER.GB_RENDER_SIZE.height
    });
  }

  function loadTopImage(game, context) {
    return TOP_SCREEN_LOADER.resolveTopImage(game, context, {
      loadImageTag: loadImageTag,
      getManualArtworkEntry: getManualArtworkEntry,
      getAssetLibraryEntry: getAssetLibraryEntry,
      renderFallbackGameBoyIllustration: renderFallbackGameBoyIllustration,
      renderLoadedGameBoyIllustration: renderLoadedGameBoyIllustration
    });
  }

  function isCachedTopImage(entry) {
    return !!entry && entry !== 'failed';
  }

  /* ─────────────────────────────────────────────────────────────
     WIKI MAP  game_id → titre article Wikipedia
     ───────────────────────────────────────────────────────────── */
      const WIKI = {

    /* ════════════════════════════════════════════════════════════
       NES — 28 jeux · personnages/éléments uniques à chaque jeu
       ════════════════════════════════════════════════════════════ */
    "super-mario-bros-nintendo-entertainment-system":
      "Mario",                              // Mario sautant rouge iconique
    "super-mario-bros-3-nintendo-entertainment-system":
      "Princess_Peach",                     // Peach kidnappée, Tanooki univers SMB3
    "the-legend-of-zelda-nintendo-entertainment-system":
      "Link_(The_Legend_of_Zelda)",         // Link NES artwork épée/bouclier
    "zelda-ii-the-adventure-of-link-nintendo-entertainment-system":
      "Princess_Zelda",                     // Zelda endormie — thème central du jeu
    "metroid-nintendo-entertainment-system":
      "Samus_Aran",                         // Samus combinaison orange
    "mega-man-nintendo-entertainment-system":
      "Mega_Man_(character)",               // Mega Man bleu classique
    "mega-man-2-nintendo-entertainment-system":
      "Dr._Wily",                           // Wily dans sa soucoupe — boss ultime MM2
    "mega-man-3-nintendo-entertainment-system":
      "Proto_Man",                          // Proto Man introduit dans MM3
    "mega-man-4-nintendo-entertainment-system":
      "Mega_Man_4",                         // artwork jeu (pas de perso unique connu)
    "mega-man-6-nintendo-entertainment-system":
      "Rush_(Mega_Man)",                    // Rush le chien robot de Mega Man
    "castlevania-nintendo-entertainment-system":
      "Simon_Belmont",                      // Simon avec fouet, artwork classique
    "castlevania-iii-draculas-curse-nintendo-entertainment-system":
      "Alucard_(Castlevania)",              // Alucard demi-vampire, exclusif CV3
    "kirby-adventure-nintendo-entertainment-system":
      "Kirby_(character)",                  // Kirby rose
    "contra-nintendo-entertainment-system":
      "Contra_(series)",                    // artwork soldats biceps
    "duck-tales-nintendo-entertainment-system":
      "Scrooge_McDuck",                     // Picsou canne de golf
    "duck-tales-2-nintendo-entertainment-system":
      "Huey,_Dewey,_and_Louie",            // Les neveux — exclusifs DuckTales 2
    "ninja-gaiden-nintendo-entertainment-system":
      "Ryu_Hayabusa",                       // Ryu Hayabusa ninja en noir
    "mike-tysons-punch-out-nintendo-entertainment-system":
      "Little_Mac",                         // Little Mac boxeur vert
    "battletoads-nintendo-entertainment-system":
      "Battletoads",                        // Les 3 crapauds Zitz/Pimple/Rash
    "bionic-commando-nintendo-entertainment-system":
      "Bionic_Commando_(1988_video_game)",  // bras bionique, artwork jeu
    "double-dragon-nintendo-entertainment-system":
      "Double_Dragon_(series)",             // frères Billy/Jimmy Lee
    "final-fantasy-nintendo-entertainment-system":
      "Final_Fantasy_(series)",             // artwork Amano — guerriers de lumière
    "final-fantasy-ii-nintendo-entertainment-system":
      "Firion",                             // Firion épée/arc, héros de FF2
    "final-fantasy-iii-nintendo-entertainment-system":
      "Final_Fantasy_III",                  // Onion Knights artwork Amano
    "ghosts-n-goblins-nintendo-entertainment-system":
      "Arthur_(Ghosts_%27n_Goblins)",       // Arthur en armure avec lance
    "river-city-ransom-nintendo-entertainment-system":
      "Kunio-kun",                          // Kunio/Ryan artwork brawler
    "tmnt-nintendo-entertainment-system":
      "Teenage_Mutant_Ninja_Turtles",       // Les 4 tortues artwork classique
    "tecmo-super-bowl-nintendo-entertainment-system":
      "Tecmo_Super_Bowl",                   // artwork football américain

    /* ════════════════════════════════════════════════════════════
       SNES — 36 jeux
       ════════════════════════════════════════════════════════════ */
    "super-mario-world-super-nintendo":
      "Bowser_(character)",                 // Bowser roi des Koopas, boss SMW
    "the-legend-of-zelda-a-link-to-the-past-super-nintendo":
      "The_Legend_of_Zelda:_A_Link_to_the_Past", // artwork Link+Ganon+Zelda
    "super-metroid-super-nintendo":
      "Ridley_(Metroid)",                   // Ridley boss iconique de Super Metroid
    "chrono-trigger-super-nintendo":
      "Chrono_Trigger",                     // artwork Toriyama Crono/Marle/Lucca
    "final-fantasy-vi-super-nintendo":
      "Kefka_Palazzo",                      // Kefka le fou dieu — villain unique
    "final-fantasy-iv-super-nintendo":
      "Cecil_Harvey",                       // Cecil chevalier noir→paladin
    "final-fantasy-v-super-nintendo":
      "Gilgamesh_(Final_Fantasy)",          // Gilgamesh 4 bras artwork reconnaissable
    "donkey-kong-country-super-nintendo":
      "Donkey_Kong",                        // DK cravate rouge, artwork officiel
    "donkey-kong-country-2-super-nintendo":
      "Diddy_Kong",                         // Diddy casquette rouge
    "super-mario-kart-super-nintendo":
      "Mario_Kart",                         // artwork karts franchise
    "mega-man-x-super-nintendo":
      "X_(Mega_Man)",                       // X armure bleu/blanc artwork
    "mega-man-x2-super-nintendo":
      "Mega_Man_X2",                    // Zero sabre laser rouge — exclusif X2
    "earthbound-super-nintendo":
      "Ness_(EarthBound)",                  // Ness chapeau/batte de baseball
    "secret-of-mana-super-nintendo":
      "Secret_of_Mana",                     // artwork épée de mana + 3 persos
    "street-fighter-ii-super-nintendo":
      "Ryu_(Street_Fighter)",               // Ryu hadouken pose iconique
    "super-mario-rpg-super-nintendo":
      "Super_Mario_RPG",                    // artwork Geno+Mallow+Mario
    "yoshi-island-super-nintendo":
      "Yoshi_(Nintendo)",                   // Yoshi portant bébé Mario
    "kirby-super-star-super-nintendo":
      "Kirby_Super_Star",                   // artwork Kirby étoile multipouvoirs
    "f-zero-super-nintendo":
      "Captain_Falcon",                     // Captain Falcon Falcon PUNCH
    "starfox-super-nintendo":
      "Fox_McCloud",                        // Fox dans son Arwing
    "tales-of-phantasia-super-nintendo":
      "Tales_of_Phantasia",                 // artwork Cless/Mint première Tales
    "contra-iii-alien-wars-super-nintendo":
      "Contra_III:_The_Alien_Wars",         // artwork soldats futuristes Contra III
    "super-probotector-super-nintendo":
      "Probotector",                        // robots version EU — visuel distinct
    "super-ghouls-n-ghosts-super-nintendo":
      "Super_Ghouls_%27n_Ghosts",           // Arthur sans armure — plus difficile
    "actraiser-super-nintendo":
      "ActRaiser",                          // ange+dieu+démons artwork épique
    "terranigma-super-nintendo":
      "Terranigma",                         // Ark artwork, jeu exclusif JP/EU
    "illusion-of-gaia-super-nintendo":
      "Illusion_of_Gaia",                   // Will artwork aventure Quintet
    "lufia-ii-rise-of-the-sinistrals-super-nintendo":
      "Lufia_II:_Rise_of_the_Sinistrals",  // Maxim+Selan artwork
    "harvest-moon-super-nintendo":
      "Story_of_Seasons_(video_game)",      // artwork ferme/animaux Harvest Moon
    "zombies-ate-my-neighbors-super-nintendo":
      "Zombies_Ate_My_Neighbors",           // artwork Zeke+Julie vs zombies rétro
    "pilot-wings-super-nintendo":
      "Pilotwings",                         // artwork avion/parachute SNES
    "breath-of-fire-super-nintendo":
      "Ryu_(Breath_of_Fire)",               // Ryu aux cheveux bleus, dragon power
    "breath-of-fire-ii-super-nintendo":
      "Nina_(Breath_of_Fire)",              // Nina ailes d'oiseau BoFII
    "gradius-iii-super-nintendo":
      "Vic_Viper",                          // Vic Viper le vaisseau Gradius
    "demons-crest-super-nintendo":
      "Firebrand_(character)",              // Firebrand gargouille rouge
    "super-punch-out-super-nintendo":
      "Super_Punch-Out!!",                  // artwork boxeurs colorés
    "rock-n-roll-racing-super-nintendo":
      "Rock_%27n%27_Roll_Racing",           // artwork voitures+crâne rock

    /* ════════════════════════════════════════════════════════════
       GAME BOY — 21 jeux (inclut GBC)
       ════════════════════════════════════════════════════════════ */
    "metal-gear-ghost-babel-game-boy":
      "Solid_Snake",                        // Snake Ghost Babel GBC artwork
    "tetris-game-boy":
      "Tetris",                             // blocs Tetromino artwork classique
    "tetris-dx-game-boy":
      "Tetromino",                          // pièces colorées Tetris DX
    "pokemon-red-game-boy":
      "Charizard",                          // Charizard — icône de Pokémon Rouge
    "pokemon-blue-game-boy":
      "Blastoise",                          // Blastoise — icône de Pokémon Bleu
    "pokemon-yellow-game-boy":
      "Pikachu",                            // Pikachu — version Jaune suit le joueur
    "pokemon-gold-game-boy":
      "Ho-Oh_(Pok%C3%A9mon)",              // Ho-Oh — artwork jaquette Gold
    "pokemon-silver-game-boy":
      "Lugia",                              // Lugia — artwork jaquette Silver
    "pokemon-crystal-game-boy":
      "Suicune",                            // Suicune — mascotte Crystal
    "super-mario-land-game-boy":
      "Princess_Daisy",                     // Daisy introduite dans SML
    "super-mario-land-2-game-boy":
      "Wario",                              // Wario — ennemi/rival introduit SML2
    "the-legend-of-zelda-links-awakening-game-boy":
      "The_Legend_of_Zelda:_Link%27s_Awakening", // Wind Fish artwork iconique
    "kirby-dream-land-game-boy":
      "Kirby%27s_Dream_Land",              // premier Kirby — artwork simple/fort
    "metroid-ii-return-of-samus-game-boy":
      "Metroid_(creature)",                 // la créature Metroid elle-même
    "donkey-kong-game-boy":
      "Pauline_(Nintendo)",                 // Pauline retrouvée dans DK94
    "wario-land-super-mario-land-3-game-boy":
      "Wario_Land:_Super_Mario_Land_3",                              // Wario chapeau jaune
    "gargoyles-quest-game-boy":
      "Gargoyle%27s_Quest",              // Firebrand première apparition solo
    "dr-mario-game-boy":
      "Dr._Mario_(video_game)",             // Dr Mario capsules/virus
    "oracle-of-ages-game-boy":
      "Nayru",                              // Nayru Oracle du Temps — OoA
    "oracle-of-seasons-game-boy":
      "Din_(The_Legend_of_Zelda)",          // Din Oracle des Saisons — OoS
    "mole-mania-game-boy":
      "Mole_Mania",                         // jeu Miyamoto méconnu
    "final-fantasy-legend-ii-game-boy":
      "SaGa_(series)",                      // artwork SaGa/FFL série

    /* ════════════════════════════════════════════════════════════
       SEGA GENESIS — 32 jeux
       ════════════════════════════════════════════════════════════ */
    "sonic-the-hedgehog-sega-genesis":
      "Sonic_the_Hedgehog_(character)",     // Sonic classique index levé
    "sonic-the-hedgehog-2-sega-genesis":
      "Miles_%22Tails%22_Prower",           // Tails introduit dans Sonic 2
    "sonic-the-hedgehog-3-sega-genesis":
      "Knuckles_the_Echidna",               // Knuckles introduit dans Sonic 3
    "sonic-spinball-sega-genesis":
      "Sonic_Spinball",                     // Sonic en mode flipper
    "streets-of-rage-2-sega-genesis":
      "Streets_of_Rage",                    // artwork Axel/Blaze/Skate
    "gunstar-heroes-sega-genesis":
      "Gunstar_Heroes",                     // artwork Red/Blue Treasure
    "phantasy-star-iv-sega-genesis":
      "Phantasy_Star_IV",                   // artwork Alys Brangwin+Chaz
    "shining-force-sega-genesis":
      "Shining_Force",                      // artwork Max et son équipe
    "shining-force-ii-sega-genesis":
      "Shining_Force_II",                   // artwork Bowie/Sarah
    "ecco-the-dolphin-sega-genesis":
      "Ecco_the_Dolphin",                   // dauphin bleu ocean
    "castlevania-bloodlines-sega-genesis":
      "Castlevania:_Bloodlines",            // John Morris/Eric Lecarde — Castlevania Genesis
    "mortal-kombat-sega-genesis":
      "Scorpion_(Mortal_Kombat)",           // Scorpion "GET OVER HERE"
    "mortal-kombat-ii-sega-genesis":
      "Sub-Zero_(Mortal_Kombat)",           // Sub-Zero, rival de Scorpion MK2
    "earthworm-jim-sega-genesis":
      "Earthworm_Jim_(character)",          // Jim ver de terre avec combinaison
    "altered-beast-sega-genesis":
      "Altered_Beast",                      // guerrier se transformant en bête
    "comix-zone-sega-genesis":
      "Comix_Zone",                         // Sketch Turner dans la BD
    "toejam-and-earl-sega-genesis":
      "ToeJam_%26_Earl",                    // aliens funky ToeJam & Earl
    "ristar-sega-genesis":
      "Ristar",                             // étoile jaune bras extensibles
    "dynamite-headdy-sega-genesis":
      "Dynamite_Headdy",                    // Headdy avec tête interchangeable
    "rocket-knight-adventures-sega-genesis":
      "Sparkster",                          // Sparkster opossum chevalier-fusée
    "beyond-oasis-sega-genesis":
      "Beyond_Oasis",                       // Ali prince artwork
    "landstalker-sega-genesis":
      "Landstalker:_The_Treasures_of_King_Nole", // Nigel dans les ruines isométriques
    "thunder-force-iv-sega-genesis":
      "Thunder_Force_IV",             // vaisseau Thunder Force IV
    "herzog-zwei-sega-genesis":
      "Herzog_Zwei",                        // RTS precurseur artwork mecha
    "battletoads-double-dragon-sega-genesis":
      "Battletoads_%26_Double_Dragon",             // crossover Battletoads+Double Dragon
    "alien-soldier-sega-genesis":
      "Alien_Soldier_(video_game)",         // Epsilon-Eagle artwork Treasure
    "contra-hard-corps-sega-genesis":
      "Contra:_Hard_Corps",                 // Raygun/Sheena artwork Hard Corps
    "vectorman-sega-genesis":
      "Vectorman",                          // robot écosphère
    "truxton-sega-genesis":
      "Toaplan",                            // shoot-em-up Toaplan
    "madden-nfl-94-sega-genesis":
      "John_Madden",                        // John Madden lui-même
    "kid-chameleon-sega-genesis":
      "Kid_Chameleon",                      // Kid avec casque et masques
    "story-of-thor-sega-genesis":
      "The_Story_of_Thor",                       // Story of Thor = Beyond Oasis EU

    /* ════════════════════════════════════════════════════════════
       PLAYSTATION — 42 jeux · INCHANGÉ (user satisfait)
       ════════════════════════════════════════════════════════════ */
    "final-fantasy-vii-playstation":
      "Cloud_Strife",                       // Cloud épée buster iconique
    "final-fantasy-viii-playstation":
      "Squall_Leonhart",                    // Squall gunblade — FFVIII
    "final-fantasy-tactics-playstation":
      "Ramza_Beoulve",                      // Ramza chevalier Ivalice artwork
    "metal-gear-solid-playstation":
      "Solid_Snake",                        // Snake bandana artwork Shinkawa
    "castlevania-symphony-of-the-night-playstation":
      "Dracula_(Castlevania)",              // Alucard manteau SotN
    "resident-evil-2-playstation":
      "Leon_S._Kennedy",                    // Leon RE2 artwork officiel
    "crash-bandicoot-playstation":
      "Crash_Bandicoot_(character)",        // Crash dansant iconique
    "gran-turismo-playstation":
      "Gran_Turismo_(video_game)",          // artwork voitures GT
    "tekken-3-playstation":
      "Jin_Kazama",                         // Jin Kazama introduit Tekken 3
    "silent-hill-playstation":
      "Pyramid_Head",                       // Pyramid Head — icône Silent Hill
    "tomb-raider-playstation":
      "Lara_Croft",                         // Lara Croft archéologue artwork
    "final-fantasy-ix-playstation":
      "Vivi_Ornitier",                      // Vivi mage noir — perso le plus iconique FF9
    "spyro-the-dragon-playstation":
      "Spyro_the_Dragon_(character)",       // Spyro dragon violet
    "xenogears-playstation":
      "Xenogears",                          // Fei+Elly artwork Takahashi
    "vagrant-story-playstation":
      "Vagrant_Story",                      // Ashley Riot artwork Matsuno
    "parasite-eve-playstation":
      "Aya_Brea",                           // Aya Brea mitochondries artwork
    "wild-arms-playstation":
      "Wild_Arms_(video_game)",             // artwork western fantasy
    "suikoden-playstation":
      "Suikoden",                           // artwork 108 étoiles
    "suikoden-ii-playstation":
      "Suikoden_II",                        // artwork Riou/Jowy/Nanami
    "chrono-cross-playstation":
      "Serge_(Chrono_Cross)",               // Serge+Harle artwork Nobuteru Yuki
    "alundra-playstation":
      "Alundra_(video_game)",               // Alundra dreamwalker
    "legend-of-dragoon-playstation":
      "The_Legend_of_Dragoon",              // Dart+Dragoon armure
    "klonoa-door-to-phantomile-playstation":
      "Klonoa:_Door_to_Phantomile",         // Klonoa chapeau oreilles
    "tony-hawks-pro-skater-2-playstation":
      "Tony_Hawk%27s_Pro_Skater_2",         // Tony Hawk skateboard artwork
    "crash-bandicoot-3-warped-playstation":
      "Crash_Bandicoot:_Warped",            // Crash avec masque Aku Aku
    "crash-team-racing-playstation":
      "Crash_Team_Racing",                  // Crash en kart
    "spyro-2-riptos-rage-playstation":
      "Ripto",                              // Ripto le villain de Spyro 2
    "syphon-filter-playstation":
      "Gabe_Logan",                         // Gabe Logan agent NSA
    "tenchu-stealth-assassins-playstation":
      "Tenchu:_Stealth_Assassins",          // ninja Rikimaru/Ayame
    "breath-of-fire-iii-playstation":
      "Breath_of_Fire_III",                 // Ryu jeune+dragon BoFIII
    "breath-of-fire-iv-playstation":
      "Breath_of_Fire_IV",                  // Ryu/Fou-Lu artwork BoFIV
    "twisted-metal-2-playstation":
      "Sweet_Tooth_(Twisted_Metal)",        // Clown Sweet Tooth camion-glace
    "soul-blade-playstation":
      "Sophitia_Alexandra",                 // Sophitia Soul Edge artwork
    "wipeout-xl-playstation":
      "Wipeout_2097",                       // vaisseau futuriste Wipeout
    "dragon-quest-vii-playstation":
      "Dragon_Quest_VII",                   // artwork Maeru+Kiefer DQ7
    "diablo-playstation":
      "Diablo_(character)",                 // Diablo seigneur terreur artwork
    "bushido-blade-playstation":
      "Bushido_Blade_(video_game)",         // duel samouraï artwork
    "castlevania-chronicles-playstation":
      "Castlevania_Chronicles",                      // Simon fouet — remake CV1 PS1
    "legend-of-mana-playstation":
      "Legend_of_Mana",                     // artwork Akitoshi Kawazu pastel
    "fear-effect-playstation":
      "Fear_Effect",                        // Hana+Glas artwork cel-shaded
    "intelligent-qube-playstation":
      "Intelligent_Qube",                   // cubes artwork abstrait
    "um-jammer-lammy-playstation":
      "Um_Jammer_Lammy",                    // Lammy agneau guitare
    "colin-mcrae-rally-playstation":
      "Colin_McRae",                        // Colin McRae pilote WRC
    "azure-dreams-playstation":
      "Azure_Dreams",                       // Koh+monstre tower dungeon
    "omega-boost-playstation":
      "Omega_Boost",                        // mecha spatial Polyphony

    /* ════════════════════════════════════════════════════════════
       NINTENDO 64 — 20 jeux
       ════════════════════════════════════════════════════════════ */
    "super-mario-64-nintendo-64":
      "Mario",                              // Mario saut poing levé — SM64 fondateur 3D
    "the-legend-of-zelda-ocarina-of-time-nintendo-64":
      "Link_(The_Legend_of_Zelda)",         // Link adulte armure Ocarina
    "goldeneye-007-nintendo-64":
      "GoldenEye_007_(1997_video_game)",    // Bond Pierce Brosnan — boîte N64
    "banjo-kazooie-nintendo-64":
      "Banjo-Kazooie",                      // Banjo+Kazooie artwork Rare
    "mario-kart-64-nintendo-64":
      "Mario_Kart_64",                      // karts N64 Rainbow Road artwork
    "the-legend-of-zelda-majoras-mask-nintendo-64":
      "Majora%27s_Mask",                    // masque lunaire artwork Majora's Mask
    "conkers-bad-fur-day-nintendo-64":
      "Conker_(character)",                 // Conker écureuil avec faux
    "perfect-dark-nintendo-64":
      "Perfect_Dark",                       // Joanna Dark artwork Rare
    "majoras-mask-nintendo-64":
      "Skull_Kid",                          // Skull Kid portant le masque — ICONIQUE
    "kirby-64-crystal-shards-nintendo-64":
      "Kirby_64:_The_Crystal_Shards",       // Kirby avec éclats de cristal
    "f-zero-x-nintendo-64":
      "F-Zero_X",                           // courses à 30 vaisseaux F-Zero X
    "wave-race-64-nintendo-64":
      "Wave_Race_64",                       // jet-ski vagues artwork N64
    "mario-party-nintendo-64":
      "Mario_Party",                        // plateau Mario Party
    "pokemon-snap-nintendo-64":
      "Pok%C3%A9mon_Snap",                 // appareil photo + Pokemon
    "1080-snowboarding-nintendo-64":
      "1080%C2%B0_Snowboarding",           // snowboarder montagne
    "diddy-kong-racing-nintendo-64":
      "Diddy_Kong_Racing",                  // Diddy dans son kart bananier
    "pokemon-stadium-nintendo-64":
      "Mewtwo",                             // Mewtwo artwork — boss PS
    "harvest-moon-64-nintendo-64":
      "Harvest_Moon_64",                    // ferme animaux artwork N64
    "ogre-battle-64-nintendo-64":
      "Ogre_Battle_(series)",               // artwork chevaliers épiques
    "bomberman-64-nintendo-64":
      "Bomberman_(character)",              // Bomberman blanc avec bombe
    "jet-force-gemini-nintendo-64":
      "Jet_Force_Gemini",                   // Juno+Vela+Lupus artwork Rare
    "lylat-wars-nintendo-64":
      "Falco_Lombardi",                     // Falco — compagnon unique Lylat Wars
    "castlevania-nintendo-64":
      "Castlevania_(Nintendo_64)",              // Dracula N64 version 3D
    "blast-corps-nintendo-64":
      "Blast_Corps",                        // robots démolisseurs artwork
    "body-harvest-nintendo-64":
      "Body_Harvest",                       // Adam Drake vs aliens N64
    "buck-bumble-nintendo-64":
      "Buck_Bumble",                        // abeille cybernétique Argonaut

    /* ════════════════════════════════════════════════════════════
       GAME BOY ADVANCE — 18 jeux
       ════════════════════════════════════════════════════════════ */
    "golden-sun-game-boy-advance":
      "Isaac_(Golden_Sun)",                 // Isaac djinn GBA artwork
    "castlevania-aria-of-sorrow-game-boy-advance":
      "Soma_Cruz",                          // Soma Cruz — Aria of Sorrow
    "fire-emblem-game-boy-advance":
      "Lyn_(Fire_Emblem)",                  // Lyn épée — Fire Emblem GBA
    "metroid-zero-mission-game-boy-advance":
      "Metroid:_Zero_Mission",              // Samus Varia Suit GBA
    "golden-sun-the-lost-age-game-boy-advance":
      "Isaac_(Golden_Sun)",                 // Isaac Venus Adept
    "warioware-inc-game-boy-advance":
      "WarioWare,_Inc.:_Mega_Microgame%24", // Wario microjeux artwork
    "mario-kart-super-circuit-game-boy-advance":
      "Mario_Kart:_Super_Circuit",          // karts GBA artwork
    "kirby-nightmare-in-dream-land-game-boy-advance":
      "Meta_Knight",                        // Meta Knight épée cape — GBA
    "boktai-the-sun-is-in-your-hand-game-boy-advance":
      "Boktai:_The_Sun_Is_in_Your_Hand",   // Django chasseur de vampires solaire
    "tactics-ogre-the-knight-of-lodis-game-boy-advance":
      "Tactics_Ogre:_The_Knight_of_Lodis", // Alphonse Loeher GBA
    "mother-3-game-boy-advance":
      "Lucas_(EarthBound)",                 // Lucas baguette magique Mother 3
    "megaman-zero-game-boy-advance":
      "Zero_(Mega_Man)",                    // Zero sabre Z-Saber MMZ
    "pokemon-emerald-game-boy-advance":
      "Rayquaza",                           // Rayquaza dragon ciel — mascotte Emerald
    "castlevania-circle-of-the-moon-game-boy-advance":
      "Castlevania:_Circle_of_the_Moon",   // Nathan Graves whip GBA
    "sonic-advance-game-boy-advance":
      "Amy_Rose",                           // Amy rose marteau — Sonic Advance
    "final-fantasy-vi-advance-game-boy-advance":
      "Terra_Branford",                     // Terra magic esper artwork Amano
    "astro-boy-omega-factor-game-boy-advance":
      "Astro_Boy",                          // Astro Boy artwork Tezuka
    "megaman-zero-2-game-boy-advance":
      "Mega_Man_Zero_2",                    // Zero EX skills MMZ2
    "sword-of-mana-game-boy-advance":
      "Sword_of_Mana",                      // Heroine/Hero Mana remake GBA
    "mario-golf-advance-tour-game-boy-advance":
      "Mario_Golf",                         // artwork golf Mario GBA
    "rebelstar-tactical-command-game-boy-advance":
      "Rebelstar:_Tactical_Command",        // tactique tour par tour GBA

    /* ════════════════════════════════════════════════════════════
       SEGA SATURN — 16 jeux
       ════════════════════════════════════════════════════════════ */
    "panzer-dragoon-saga-sega-saturn":
      "Panzer_Dragoon",                     // dragon ailé Panzer Dragoon saga
    "nights-into-dreams-sega-saturn":
      "NiGHTS_(character)",                 // NiGHTS jester violet artwork
    "guardian-heroes-sega-saturn":
      "Guardian_Heroes",                    // artwork Han Tenzan+Undead Warrior
    "dragon-force-sega-saturn":
      "Dragon_Force_(video_game)",          // stratégie avec dragons artwork
    "radiant-silvergun-sega-saturn":
      "Radiant_Silvergun",                  // vaisseau Silhouette Mirage Treasure
    "castlevania-symphony-of-the-night-sega-saturn":
      "Castlevania:_Symphony_of_the_Night",              // Alucard cape SotN Saturn
    "burning-rangers-sega-saturn":
      "Burning_Rangers",                    // pompiers futuristes Sonic Team
    "shining-the-holy-ark-sega-saturn":
      "Shining_(series)",                   // Arthur+Melody Shining Holy Ark
    "albert-odyssey-sega-saturn":
      "Albert_Odyssey:_Legend_of_Eldean",  // Arc+Fina artwork rpg Saturn
    "fighters-megamix-sega-saturn":
      "Fighters_Megamix",                   // crossover VF+Fighting Vipers artwork
    "virtua-fighter-2-sega-saturn":
      "Akira_Yuki",                         // Akira Yuki pose Virtua Fighter
    "vampire-savior-sega-saturn":
      "Morrigan_Aensland",                  // Morrigan succube — icône Darkstalkers
    "house-of-the-dead-sega-saturn":
      "The_House_of_the_Dead_(video_game)", // zombies rail-shooter artwork
    "street-fighter-alpha-3-sega-saturn":
      "Akuma_(Street_Fighter)",             // Akuma/Gouki poing tendu SFA3
    "thunder-force-v-sega-saturn":
      "Thunder_Force_(series)",             // vaisseau RVR Saturn
    "dungeons-dragons-collection-sega-saturn":
      "Dungeons_%26_Dragons",              // D&D artwork Tower of Doom/Shadow

    /* ════════════════════════════════════════════════════════════
       DREAMCAST — 16 jeux
       ════════════════════════════════════════════════════════════ */
    "soul-calibur-dreamcast":
      "Soulcalibur",                        // Sophitia+Siegfried artwork DC
    "shenmue-dreamcast":
      "Shenmue",                            // Ryo Hazuki Yokosuka artwork
    "jet-set-radio-dreamcast":
      "Jet_Set_Radio",                      // Beat rollers graffiti artwork
    "power-stone-dreamcast":
      "Power_Stone_(series)",              // artwork Power Stone combat
    "crazy-taxi-dreamcast":
      "Crazy_Taxi",                        // taxi jaune artwork Sega
    "seaman-dreamcast":
      "Seaman_(video_game)",               // Seaman visage humain poisson
    "ikaruga-dreamcast":
      "Ikaruga",                           // vaisseau noir/blanc polarité
    "tech-romancer-dreamcast":
      "Tech_Romancer",                     // mechas géants Capcom
    "marvel-vs-capcom-2-dreamcast":
      "Marvel_vs._Capcom_2",              // artwork 56 persos crossover
    "grandia-ii-dreamcast":
      "Grandia_II",                        // Ryudo+Elena artwork Grandia II
    "space-channel-5-dreamcast":
      "Ulala",                             // Ulala reporter rose iconique
    "virtua-fighter-3tb-dreamcast":
      "Virtua_Fighter_3",                  // VF3 arcade Dreamcast
    "cannon-spike-dreamcast":
      "Cannon_Spike",                      // Cammy+Charlie patins Cannon Spike
    "rival-schools-evolution-dreamcast":
      "Project_Justice",                   // lycéens bagarreurs Capcom
    "virtual-on-oratorio-tangram-dreamcast":
      "Cyber_Troopers_Virtual-On",         // méchas Virtual-On artwork
    "sega-rally-2-dreamcast":
      "Sega_Rally_Championship",           // rally tout terrain Sega
    "record-of-lodoss-war-dreamcast":
      "Record_of_Lodoss_War",             // Parn+Deedlit elfes fantasy
    "capcom-vs-snk-dreamcast":
      "Capcom_vs._SNK:_Millennium_Fight_2000", // crossover Ryu vs Kyo
    "evolution-the-world-of-sacred-device-dreamcast":
      "Evolution:_The_World_of_Sacred_Device", // Mag+Linear dungeon DC

    /* ════════════════════════════════════════════════════════════
       SEGA MASTER SYSTEM — 11 jeux
       ════════════════════════════════════════════════════════════ */
    "alex-kidd-in-miracle-world-sega-master-system":
      "Alex_Kidd",                         // Alex Kidd oreilles larges
    "phantasy-star-sega-master-system":
      "Phantasy_Star_(video_game)",        // Alis Landale première PS 1987
    "wonder-boy-iii-the-dragons-trap-sega-master-system":
      "Wonder_Boy_(series)",               // Wonder Boy dragon transformations
    "sonic-the-hedgehog-sega-master-system":
      "Sonic_the_Hedgehog_(8-bit)",        // Sonic SMS 8-bit sprite
    "golvellius-valley-of-doom-sega-master-system":
      "Golvellius",                        // Kelesis épée SMS
    "castle-of-illusion-sega-master-system":
      "Mickey_Mouse",                      // Mickey Mouse — Castle of Illusion
    "r-type-sega-master-system":
      "R-Type",                            // vaisseau R-9 Bydo Empire
    "double-dragon-sega-master-system":
      "Double_Dragon_(video_game)",        // version arcade original DD
    "shinobi-sega-master-system":
      "Joe_Musashi",                       // Joe Musashi shinobi noir
    "streets-of-rage-sega-master-system":
      "Axel_Stone",                        // Axel Streets of Rage
    "mortal-kombat-sega-master-system":
      "Mortal_Kombat_(franchise)",         // franchise artwork MK

    /* ════════════════════════════════════════════════════════════
       GAME GEAR — 10 jeux
       ════════════════════════════════════════════════════════════ */
    "sonic-the-hedgehog-game-gear":
      "Sonic_the_Hedgehog_(8-bit_video_game)",    // Sonic GG 8-bit
    "columns-game-gear":
      "Columns_(video_game)",              // puzzle Columns Sega
    "shinobi-game-gear":
      "Shinobi_(video_game_series)",       // shinobi série artwork
    "streets-of-rage-game-gear":
      "Blaze_Fielding",                    // Blaze — SoR GG artwork
    "defenders-of-oasis-game-gear":
      "Defenders_of_Oasis",               // rpg Game Gear Orient
    "the-gg-shinobi-game-gear":
      "The_GG_Shinobi",                   // GG Shinobi 5 ninjas couleurs
    "tails-adventure-game-gear":
      "Tails_Adventure",         // Tails aventure solo GG
    "sonic-the-hedgehog-2-game-gear":
      "Sonic_the_Hedgehog_2_(8-bit)",     // Sonic 2 GG 8-bit version
    "baku-baku-animal-game-gear":
      "Baku_Baku_Animal",                 // puzzle animaux Sega GG
    "dragon-crystal-game-gear":
      "Dragon_Crystal",                   // donjon RPG GG

    /* ════════════════════════════════════════════════════════════
       TURBOGRAFX-16 — 9 jeux
       ════════════════════════════════════════════════════════════ */
    "bonk-revenge-turbografx-16":
      "Bonk_(character)",                  // Bonk tête chauve
    "castlevania-rondo-of-blood-turbografx-16":
      "Richter_Belmont",                   // Richter fouet — Rondo of Blood
    "lords-of-thunder-turbografx-16":
      "Lords_of_Thunder",                  // shoot-em-up metal TG16
    "y-s-book-i-ii-turbografx-16":
      "Adol_Christin",                     // Adol the Red aventurier Ys
    "military-madness-turbografx-16":
      "Military_Madness",                  // stratégie hexagonale TG16
    "dungeon-explorer-turbografx-16":
      "Dungeon_Explorer",                  // action RPG HudsonSoft TG16
    "galaga-90-turbografx-16":
      "Galaga",                            // vaisseau insectes arcade
    "neutopia-turbografx-16":
      "Neutopia",                          // Jazeta aventure Zelda-like TG16
    "splatterhouse-turbografx-16":
      "Splatterhouse",                     // Rick Taylor masque Jason horreur

    /* ════════════════════════════════════════════════════════════
       NEO GEO — 8 jeux
       ════════════════════════════════════════════════════════════ */
    "metal-slug-neo-geo":
      "Marco_Rossi_(Metal_Slug)",          // Marco soldat Metal Slug
    "metal-slug-2-neo-geo":
      "Metal_Slug_2",                      // Metal Slug 2 gameplay artwork
    "metal-slug-3-neo-geo":
      "Metal_Slug_3",                      // Metal Slug 3 aliens boss
    "the-king-of-fighters-98-neo-geo":
      "Kyo_Kusanagi",                      // Kyo flammes KoF98 artwork
    "samurai-shodown-ii-neo-geo":
      "Haohmaru",                          // Haohmaru samourai Samurai Shodown
    "fatal-fury-special-neo-geo":
      "Terry_Bogard",                      // Terry Bogard casquette ARE YOU OK
    "the-last-blade-2-neo-geo":
      "The_Last_Blade",                    // Kaede/Moriya artwork Last Blade
    "garou-mark-of-the-wolves-neo-geo":
      "Rock_Howard",                       // Rock Howard fils de Geese Garou

    /* ════════════════════════════════════════════════════════════
       NINTENDO DS — 19 jeux
       ════════════════════════════════════════════════════════════ */
    "castlevania-dawn-of-sorrow-nintendo-ds":
      "Soma_Cruz",                          // Soma Cruz artwork DS — Dawn of Sorrow
    "chrono-trigger-nintendo-ds":
      "Magus_(Chrono_Trigger)",                    // artwork Toriyama DS remake
    "radiant-historia-nintendo-ds":
      "Radiant_Historia",                  // Stocke+Rosch artwork Atlus
    "the-world-ends-with-you-nintendo-ds":
      "The_World_Ends_with_You",           // Neku écouteurs Tokyo artwork
    "pokemon-heartgold-nintendo-ds":
      "Pok%C3%A9mon_HeartGold_and_SoulSilver",             // Ho-Oh HeartGold remake
    "dragon-quest-ix-nintendo-ds":
      "Dragon_Quest_IX",                   // artwork héros Celestrian DQ9
    "castlevania-order-of-ecclesia-nintendo-ds":
      "Castlevania:_Order_of_Ecclesia",   // Shanoa glyphs — OoE
    "ghost-trick-phantom-detective-nintendo-ds":
      "Ghost_Trick:_Phantom_Detective",   // Sissel fantôme Shu Takumi
    "phoenix-wright-ace-attorney-nintendo-ds":
      "Phoenix_Wright",                    // Phoenix poing en l'air OBJECTION
    "999-nine-hours-nine-persons-nine-doors-nintendo-ds":
      "Zero_Escape_(series)",             // jeu d'évasion 999 Zero Escape
    "mario-and-luigi-bowsers-inside-story-nintendo-ds":
      "Fawful",               // Bowser géant Bowser's Inside Story
    "hotel-dusk-room-215-nintendo-ds":
      "Hotel_Dusk:_Room_215",             // Kyle Hyde crayon artwork
    "infinite-space-nintendo-ds":
      "Infinite_Space",                   // space opera DS artwork
    "disgaea-ds-nintendo-ds":
      "Laharl",                           // Laharl prince démon Disgaea
    "knights-in-the-nightmare-nintendo-ds":
      "Knights_in_the_Nightmare",         // Wisp+chevaliers artwork Sting
    "etrian-odyssey-nintendo-ds":
      "Etrian_Odyssey",                   // dungeon crawler carte DS
    "contact-nintendo-ds":
      "Contact_(video_game)",             // Terry le vieux gameplay DS
    "final-fantasy-xii-revenant-wings-nintendo-ds":
      "Vaan_(Final_Fantasy)",             // Vaan ailes DS FF12RW
    "meteos-nintendo-ds":
      "Meteos",                           // blocs spatiaux Q Entertainment
    "children-of-mana-nintendo-ds":
      "Children_of_Mana",                 // Ferrick+Ellia artwork Mana DS

    /* ════════════════════════════════════════════════════════════
       ATARI LYNX — 5 jeux
       ════════════════════════════════════════════════════════════ */
    "chip-and-dales-rescue-rangers-atari-lynx":
      "Chip_%27n_Dale_Rescue_Rangers",    // Chip & Dale Rangers Lynx
    "blue-lightning-atari-lynx":
      "Blue_Lightning_(video_game)",      // avion de chasse Lynx
    "vikings-child-atari-lynx":
      "Viking_Child_(video_game)",        // viking enfant Lynx
    "roadblasters-atari-lynx":
      "RoadBlasters",                     // voiture combat arcade
    "klax-atari-lynx":
      "Klax_(video_game)",                // puzzle tuiles Atari Lynx

    /* ════════════════════════════════════════════════════════════
       WONDERSWAN — 5 jeux
       ════════════════════════════════════════════════════════════ */
    "final-fantasy-wonderswan":
      "Final_Fantasy_(video_game)",       // FF1 WonderSwan remake
    "final-fantasy-ii-wonderswan":
      "Final_Fantasy_II",                           // Firion épée FF2 WonderSwan
    "gunpey-wonderswan":
      "Gunpey",                           // puzzle Gunpey Yokoi hommage
    "judgement-silversword-wonderswan":
      "Judgement_Silversword",            // shoot WonderSwan collector
    "beatmania-wonderswan":
      "Beatmania",                        // DJ turntable Konami WS

    /* ════ ACTIFS PROTOTYPE — entrées WIKI manquantes ═══════════ */
    "paper-mario-nintendo-64":           "Paper_Mario_(video_game)",
    "advance-wars-game-boy-advance":     "Advance_Wars",
    "mario-kart-ds-nintendo-ds":         "Mario_Kart_DS",
    "panzer-dragoon-ii-zwei-sega-saturn":"Panzer_Dragoon_II_Zwei",
    "tony-hawks-pro-skater-2-dreamcast": "Tony_Hawk%27s_Pro_Skater_2",
    "skies-of-arcadia-dreamcast":        "Skies_of_Arcadia",
    "sonic-adventure-dreamcast":         "Sonic_Adventure",
    "gunstar-heroes-game-gear":          "Gunstar_Heroes",
    "ristar-game-gear":                  "Ristar",
    "devil-crash-turbografx-16":         "Devil_Crush",
    "puzzle-bobble-neo-geo":             "Puzzle_Bobble",
    "california-games-atari-lynx":       "California_Games",
    "electrocop-atari-lynx":             "Electrocop",
    "warbirds-atari-lynx":               "Warbirds_(1990_video_game)",
    "final-fantasy-iv-wonderswan":       "Final_Fantasy_IV",
    "klonoa-moonlight-museum-wonderswan":"Klonoa:_Moonlight_Museum",
    "dicing-knight-period-wonderswan":   "WonderSwan",
  };

  var INSPECT_STATE = { logged: false };
  var ARTWORK_ARCHIVE = [];
  var ARTWORK_ARCHIVE_INDEX = {};
  var SUMMARY_IMAGE_CACHE = {};
  var ARTWORK_PRIORITY = {
    gameSpecificSprite: 60,
    mainSprite: 50,
    bossSprite: 40,
    iconicObject: 30,
    ingameShot: 24,
    pixelArt: 20,
    artwork: 10,
    keyArt: 8,
    promo: 7,
    editorial: 6,
    magazine: 5,
    coverIllustration: 1
  };
  window.RETRODEX_MISSING_TOP_ARTWORK = ARTWORK_ARCHIVE;
  window.archivedGames = ARTWORK_ARCHIVE;
  var WIKI_TITLE_OVERRIDES = {
    'simcity-super-nintendo': ['SimCity (1989 video game)'],
    'teenage-mutant-ninja-turtles-iv-super-nintendo': ['Teenage Mutant Ninja Turtles: Turtles in Time'],
    'nba-jam-super-nintendo': ['NBA Jam (1993 video game)'],
    'zelda-oracle-of-ages-game-boy': ['The Legend of Zelda: Oracle of Seasons and Oracle of Ages'],
    'spy-vs-spy-sega-master-system': ['Spy vs. Spy (1984 video game)'],
    'shadow-of-the-beast-atari-lynx': ['Shadow of the Beast (1989 video game)']
  };
  var CONSOLE_ARTWORK_PROFILES = {
    'Atari Lynx': { preferredFit: 'contain', preferredPosition: 'center center', cropBias: 'portrait' },
    'Dreamcast': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Game Boy': { preferredFit: 'contain', preferredPosition: 'center center', cropBias: 'portrait' },
    'Game Boy Advance': { preferredFit: 'contain', preferredPosition: 'center center', cropBias: 'portrait' },
    'Game Gear': { preferredFit: 'contain', preferredPosition: 'center center', cropBias: 'portrait' },
    'Neo Geo': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Nintendo 64': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Nintendo DS': { preferredFit: 'contain', preferredPosition: 'center center', cropBias: 'portrait' },
    'Nintendo Entertainment System': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'PlayStation': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Sega Genesis': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Sega Master System': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Sega Saturn': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'Super Nintendo': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'TurboGrafx-16': { preferredFit: 'cover', preferredPosition: 'center center', cropBias: 'landscape' },
    'WonderSwan': { preferredFit: 'contain', preferredPosition: 'center center', cropBias: 'portrait' }
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveConsoleArtworkProfile(consoleName) {
    return CONSOLE_ARTWORK_PROFILES[consoleName] || {
      preferredFit: 'cover',
      preferredPosition: 'center center',
      cropBias: 'balanced'
    };
  }

  function normalizeWikiTitle(title) {
    return String(title || '')
      .replace(/[’]/g, '\'')
      .replace(/[:]/g, ':')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildInferredWikiTitles(game) {
    var title = normalizeWikiTitle(game && game.title);
    if (!title) return [];

    var year = game && game.year ? String(game.year) : '';
    var variants = [
      title,
      title + ' (video game)',
      year ? title + ' (' + year + ' video game)' : '',
      title.replace(/\s+-\s+/g, ': '),
      title.replace(/:\s+/g, ' - '),
      title.replace(/&/g, 'and')
    ].filter(Boolean);

    var deduped = [];
    variants.forEach(function(item) {
      if (deduped.indexOf(item) === -1) deduped.push(item);
    });
    return deduped.slice(0, 4);
  }

  function getGameById(gameId) {
    var catalog = window.CATALOG_DATA || [];
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i] && catalog[i].id === gameId) return catalog[i];
    }
    return null;
  }

  function getTopScreenArtworkData() {
    return window.TOP_SCREEN_ARTWORK_DATA || {};
  }

  function getManualArtworkEntry(gameId) {
    var data = getTopScreenArtworkData();
    return data.manual && data.manual[gameId] ? data.manual[gameId] : null;
  }

  function getIdentityArtworkEntries(gameId) {
    var data = getTopScreenArtworkData();
    return data.identity && data.identity[gameId] ? data.identity[gameId] : [];
  }

  function getBacklogArtworkEntry(gameId) {
    var data = getTopScreenArtworkData();
    return data.backlog && data.backlog[gameId] ? data.backlog[gameId] : null;
  }

  function getAssetLibraryEntry(gameId) {
    var data = window.RETRODECK_ASSET_LIBRARY || {};
    return data.entries && data.entries[gameId] ? data.entries[gameId] : null;
  }

  function assetLibraryTypeToCandidateType(assetType) {
    if (assetType === 'character_sprite') return 'mainSprite';
    if (assetType === 'boss_sprite') return 'bossSprite';
    if (assetType === 'iconic_item') return 'iconicObject';
    if (assetType === 'symbol_logo') return 'symbolLogo';
    return 'artwork';
  }

  function formatEpisodeLabel(assetRecord) {
    if (!assetRecord || assetRecord.episode_number === null || typeof assetRecord.episode_number === 'undefined') {
      return 'Standalone';
    }
    return 'Episode ' + assetRecord.episode_number;
  }

  function decodeWikiTitleForApi(value) {
    try {
      return decodeURIComponent(String(value || '').replace(/_/g, ' '));
    } catch (_) {
      return String(value || '').replace(/_/g, ' ');
    }
  }

  function isGenericWikiTitle(wikiTitle) {
    var label = String(wikiTitle || '').toLowerCase();
    return label.indexOf('(series)') >= 0
      || label.indexOf('list_of_') === 0
      || label.indexOf('list of ') === 0
      || label.indexOf('(disambiguation)') >= 0
      || label.indexOf('(franchise)') >= 0;
  }

  function getWikiTitleCandidates(game) {
    var candidates = [];
    var seen = {};
    var curatedTitle = WIKI[game.id];
    var data = getTopScreenArtworkData();
    var externalOverrides = data.overrides && data.overrides[game.id] ? data.overrides[game.id] : [];
    var overrideTitles = externalOverrides.length ? externalOverrides : (WIKI_TITLE_OVERRIDES[game.id] || []);
    var inferredTitles = buildInferredWikiTitles(game);

    function pushTitle(title, source, hasTooMuchText) {
      var normalized = normalizeWikiTitle(title);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      candidates.push({
        wikiTitle: normalized,
        source: source,
        hasTooMuchText: !!hasTooMuchText,
        isGeneric: isGenericWikiTitle(normalized)
      });
    }

    if (curatedTitle) pushTitle(curatedTitle, 'wiki-curated', false);
    overrideTitles.forEach(function(title) { pushTitle(title, 'wiki-override', false); });
    inferredTitles.forEach(function(title, index) {
      pushTitle(title, 'wiki-inferred', index > 0);
    });

    return candidates;
  }

  function collectIdentityCandidates(game, entry, topVisual, manualArtwork, profile) {
    var candidates = [];
    var candidateFields = [
      'gameSpecificSprite',
      'mainSprite',
      'bossSprite',
      'iconicObject',
      'ingameShot',
      'pixelArt',
      'artwork'
    ];

    candidateFields.forEach(function(field) {
      var snakeField = field.replace(/[A-Z]/g, function(letter) {
        return '_' + letter.toLowerCase();
      });

      [
        { value: manualArtwork && manualArtwork[field], source: 'manual-asset' },
        { value: manualArtwork && manualArtwork[snakeField], source: 'manual-asset' },
        { value: game[field], source: 'project' },
        { value: game[snakeField], source: 'project' },
        { value: entry[field], source: 'project' },
        { value: entry[snakeField], source: 'project' },
        { value: topVisual[field], source: 'project' },
        { value: topVisual[snakeField], source: 'project' }
      ].forEach(function(item) {
        pushArtworkCandidate(candidates, item.value, {
          field: field,
          source: item.source,
          isLocal: item.source !== 'wiki-curated' && item.source !== 'wiki-override' && item.source !== 'wiki-inferred',
          isOfficial: true,
          isCenteredSubject: true,
          isEasyToCrop43: !isSpriteType(field),
          preferredFit: isSpriteType(field) ? 'identity-card' : profile.preferredFit
        });
      });
    });

    return candidates;
  }

  function injectTopScreenStyles() {
    if (document.getElementById('rdx-top-screen-style')) return;

    var style = document.createElement('style');
    style.id = 'rdx-top-screen-style';
    style.textContent = [
      '#rdx-cover-bg{position:absolute;inset:0;z-index:2;background-size:cover;background-position:center center;background-repeat:no-repeat;opacity:0;transition:opacity .06s linear;filter:grayscale(1) sepia(.34) hue-rotate(28deg) brightness(.34) contrast(1.18) saturate(.7) blur(7px);transform:scale(1.05);will-change:opacity,background-image,filter}',
      '#rdx-cover-stage{position:absolute;left:5px;right:5px;top:5px;bottom:20px;z-index:3;overflow:hidden;border:1px solid rgba(15,56,15,.72);background:linear-gradient(180deg, rgba(155,188,15,.08), rgba(15,56,15,.1));box-shadow:inset 0 0 0 1px rgba(181,209,166,.18),inset 0 0 14px rgba(15,56,15,.3)}',
      '#rdx-cover{position:absolute;inset:0;background-size:contain;background-position:center center;background-repeat:no-repeat;opacity:0;transition:opacity .06s linear;filter:contrast(1.06) brightness(.98) saturate(.86);will-change:opacity,background-image,filter}',
      '#rdx-cover.rdx-cover-sprite{image-rendering:pixelated;filter:contrast(1.04) brightness(.98)}',
      '#rdx-cover-stage.rdx-cover-sprite-stage{background:linear-gradient(180deg, rgba(230,242,216,.07), rgba(44,74,63,.16));box-shadow:inset 0 0 0 1px rgba(181,209,166,.18)}',
      '#rdx-cover-stage::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg, rgba(230,242,216,.05), rgba(44,74,63,.03)),repeating-linear-gradient(180deg, rgba(15,56,15,.12) 0px, rgba(15,56,15,.12) 1px, transparent 1px, transparent 3px);mix-blend-mode:multiply}',
      '#rdx-asset-card{position:absolute;inset:0;z-index:4;display:none;align-items:center;gap:12px;padding:8px 10px 7px;box-sizing:border-box}',
      '#rdx-asset-card.rdx-asset-card-visible{display:flex}',
      '#rdx-asset-card.rdx-asset-card-sprite #rdx-asset-sprite{width:48%;background-size:112% auto;filter:contrast(1.04) brightness(.98)}',
      '#rdx-asset-card.rdx-asset-card-art #rdx-asset-sprite{width:50%;background-size:contain;filter:grayscale(1) sepia(.2) hue-rotate(22deg) brightness(.98) contrast(1.1) saturate(.78)}',
      '#rdx-asset-sprite{height:100%;background-repeat:no-repeat;background-position:center center;background-size:contain;image-rendering:pixelated;border:1px solid rgba(181,209,166,.18);background-color:rgba(155,188,15,.05);box-shadow:inset 0 0 0 1px rgba(15,56,15,.42)}',
      '#rdx-asset-info{flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:0}',
      '#rdx-asset-title{font:normal 12px "Jersey 10",cursive;color:#F0F7E6;text-shadow:1px 1px 0 #0F380F;line-height:1.05;word-break:break-word;letter-spacing:.02em}',
      '#rdx-asset-row{display:flex;justify-content:space-between;gap:10px;font:normal 10px "VT323",monospace;color:#D7E7C9;border-top:1px solid rgba(181,209,166,.16);padding-top:3px}',
      '#rdx-asset-label{color:#5F8F73;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0}',
      '#rdx-asset-value{color:#F0F7E6;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#rdx-vignette{position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(ellipse at center, transparent 30%, rgba(15,56,15,.58) 100%)}',
      '#rdx-titlebar{position:absolute;left:0;right:0;bottom:0;z-index:5;background:linear-gradient(180deg, rgba(15,56,15,.94), rgba(48,98,48,.98));border-top:1px solid rgba(155,188,15,.38);padding:1px 6px 2px;pointer-events:none}',
      '#rdx-title-main{font:normal 11px "Jersey 10",cursive;color:#F0F7E6;text-shadow:1px 1px 0 #0F380F;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em}',
      '#rdx-title-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:0;font:normal 9px "VT323",monospace;color:#D7E7C9;line-height:1}',
      '#rdx-titlebar.rdx-titlebar-compact{padding:1px 6px 1px}',
      '#rdx-titlebar.rdx-titlebar-compact #rdx-title-main{font-size:10px}',
      '#rdx-titlebar.rdx-titlebar-compact #rdx-title-meta{font-size:8px}',
      '#rdx-title-label{color:#5F8F73;letter-spacing:.08em}',
      '#rdx-title-publisher{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}',
      '.rdx-lcd-boot{animation:rdx-lcd-boot .12s linear}',
      '@keyframes rdx-lcd-boot{0%{opacity:.72;filter:brightness(.82) contrast(.96)}100%{opacity:1}}'
    ].join('');
    document.head.appendChild(style);
  }

  function resolvePublisher(game, entry) {
    return game.publisher || game.editor || game.publisherName
      || (entry && (entry.publisher || entry.editor || entry.publisherName))
      || game.developer || game.console || 'Unknown';
  }

  function updateTitleBar(game, context) {
    var titleNode = document.getElementById('rdx-title-main');
    var publisherNode = document.getElementById('rdx-title-publisher');
    var titleBar = document.getElementById('rdx-titlebar');
    if (!titleNode || !publisherNode || !titleBar) return;
    var publisher = resolvePublisher(game, context && context.entry);
    var compact = String(game.title || '').length > 22 || String(publisher || '').length > 16;

    titleNode.innerHTML = escapeHtml(game.title);
    publisherNode.innerHTML = escapeHtml(publisher);
    titleBar.classList.toggle('rdx-titlebar-compact', compact);
  }

  function hideAssetCard() {
    var assetCard = document.getElementById('rdx-asset-card');
    var titleBar = document.getElementById('rdx-titlebar');
    if (assetCard) assetCard.className = '';
    if (titleBar) titleBar.style.display = '';
  }

  function updateAssetCard(game, context, artwork) {
    var assetCard = document.getElementById('rdx-asset-card');
    var spriteNode = document.getElementById('rdx-asset-sprite');
    var titleNode = document.getElementById('rdx-asset-title');
    var yearNode = document.getElementById('rdx-asset-year');
    var publisherNode = document.getElementById('rdx-asset-publisher');
    var episodeNode = document.getElementById('rdx-asset-episode');
    var titleBar = document.getElementById('rdx-titlebar');
    var assetRecord = artwork && artwork.assetRecord ? artwork.assetRecord : null;
    if (!assetCard || !spriteNode || !titleNode || !yearNode || !publisherNode || !episodeNode || !assetRecord) {
      hideAssetCard();
      return;
    }

    spriteNode.style.backgroundImage = 'url("' + artwork.src + '")';
    assetCard.className = 'rdx-asset-card rdx-asset-card-visible '
      + ((assetRecord.asset_type && assetRecord.asset_type.indexOf('sprite') >= 0) ? 'rdx-asset-card-sprite' : 'rdx-asset-card-art');
    titleNode.style.fontFamily = '"Jersey 10", cursive';
    titleNode.innerHTML = escapeHtml(game.title);
    yearNode.innerHTML = escapeHtml(String(assetRecord.year || game.year || 'Unknown'));
    publisherNode.innerHTML = escapeHtml(assetRecord.publisher || resolvePublisher(game, context && context.entry));
    episodeNode.innerHTML = escapeHtml(formatEpisodeLabel(assetRecord));
    if (titleBar) titleBar.style.display = 'none';
  }

  function triggerBootAnimation() {
    ['rdx-cover-bg', 'rdx-cover', 'rdx-titlebar', 'rdx-asset-card'].forEach(function(id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.classList.remove('rdx-lcd-boot');
      void node.offsetWidth;
      node.classList.add('rdx-lcd-boot');
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SETUP — crée la div d'overlay image une seule fois au boot
     Appelé depuis index.html après DOMContentLoaded
     ───────────────────────────────────────────────────────────── */
  function setup() {
    var top = document.getElementById('rdx-top');
    if (!top || document.getElementById('rdx-cover')) return;
    injectTopScreenStyles();

    /* Couche 1 — fond flouté (cover) — remplit l'espace autour de l'image */
    var coverBg = document.createElement('div');
    coverBg.id = 'rdx-cover-bg';
    coverBg.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:2',
      'background-size:cover',
      'background-position:center center',
      'background-repeat:no-repeat',
      'opacity:0',
      'transition:opacity 0.06s linear',
      'filter:grayscale(1) sepia(.34) hue-rotate(28deg) brightness(.34) contrast(1.18) saturate(.7) blur(7px)',
      'transform:scale(1.05)', /* cache les bords du blur */
    ].join(';');
    top.appendChild(coverBg);
    coverBg.style.cssText = '';

    var coverStage = document.createElement('div');
    coverStage.id = 'rdx-cover-stage';
    top.appendChild(coverStage);

    /* Couche 2 — image nette (contain) — jaquette complète, jamais croppée */
    var cover = document.createElement('div');
    cover.id = 'rdx-cover';
    cover.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:3',
      'background-size:contain',
      'background-position:center center',
      'background-repeat:no-repeat',
      'opacity:0',
      'transition:opacity 0.3s ease',
      'filter:grayscale(0.6) sepia(0.45) hue-rotate(50deg) brightness(0.88) saturate(1.45)',
    ].join(';');
    top.appendChild(cover);
    coverStage.appendChild(cover);
    cover.style.cssText = '';

    var assetCard = document.createElement('div');
    assetCard.id = 'rdx-asset-card';
    assetCard.innerHTML =
      '<div id="rdx-asset-sprite"></div>' +
      '<div id="rdx-asset-info">' +
      '<div id="rdx-asset-title"></div>' +
      '<div class="rdx-asset-row"><span class="rdx-asset-label">YEAR</span><span class="rdx-asset-value" id="rdx-asset-year"></span></div>' +
      '<div class="rdx-asset-row"><span class="rdx-asset-label">PUBLISHER</span><span class="rdx-asset-value" id="rdx-asset-publisher"></span></div>' +
      '<div class="rdx-asset-row"><span class="rdx-asset-label">EPISODE</span><span class="rdx-asset-value" id="rdx-asset-episode"></span></div>' +
      '</div>';
    coverStage.appendChild(assetCard);

    /* Vignette par-dessus l'image */
    var vignette = document.createElement('div');
    vignette.id = 'rdx-vignette';
    vignette.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:4',
      'pointer-events:none',
      'background:radial-gradient(ellipse at center, transparent 30%, rgba(15,56,15,0.55) 100%)',
    ].join(';');
    top.appendChild(vignette);
    vignette.style.cssText = '';

    /* Bande titre en bas */
    var titleBar = document.createElement('div');
    titleBar.id = 'rdx-titlebar';
    titleBar.style.cssText = [
      'position:absolute',
      'left:0','right:0','bottom:0',
      'z-index:5',
      'background:rgba(15,56,15,0.92)',
      'border-top:1px solid #8BAC0F',
      'padding:3px 5px 4px',
      'pointer-events:none',
    ].join(';');
    top.appendChild(titleBar);
    titleBar.style.cssText = '';
    titleBar.innerHTML =
      '<div id="rdx-title-main"></div>' +
      '<div id="rdx-title-meta">' +
      '<span id="rdx-title-label">PUBLISHER</span>' +
      '<span id="rdx-title-publisher"></span>' +
      '</div>';
  }

  function inferCandidateType(meta) {
    var label = String(meta && (meta.type || meta.field || meta.source) || '').toLowerCase();
    if (label.indexOf('gamespecificsprite') >= 0 || label.indexOf('game_specific_sprite') >= 0) return 'gameSpecificSprite';
    if (label.indexOf('mainsprite') >= 0 || label.indexOf('main_sprite') >= 0) return 'mainSprite';
    if (label.indexOf('bosssprite') >= 0 || label.indexOf('boss_sprite') >= 0) return 'bossSprite';
    if (label.indexOf('iconicobject') >= 0 || label.indexOf('iconic_object') >= 0) return 'iconicObject';
    if (label.indexOf('pixelart') >= 0 || label.indexOf('pixel_art') >= 0) return 'pixelArt';
    if (label.indexOf('artwork') >= 0) return 'artwork';
    if (label.indexOf('key') >= 0) return 'keyArt';
    if (label.indexOf('promo') >= 0) return 'promo';
    if (label.indexOf('magazine') >= 0) return 'magazine';
    if (label.indexOf('editorial') >= 0) return 'editorial';
    if (label.indexOf('cover') >= 0) return 'coverIllustration';
    return meta && meta.type ? meta.type : 'artwork';
  }

  function isSpriteType(type) {
    return type === 'gameSpecificSprite'
      || type === 'mainSprite'
      || type === 'bossSprite'
      || type === 'iconicObject'
      || type === 'pixelArt';
  }

  function pushArtworkCandidate(list, rawValue, meta) {
    if (!rawValue) return;

    if (Array.isArray(rawValue)) {
      rawValue.forEach(function(item) { pushArtworkCandidate(list, item, meta); });
      return;
    }

    if (typeof rawValue === 'string') {
      var trimmed = rawValue.trim();
      if (!trimmed || /^maps\//i.test(trimmed)) return;
      list.push({
        src: trimmed,
        type: inferCandidateType(meta),
        source: meta && meta.source || 'project',
        isLocal: meta && meta.isLocal !== false,
        isOfficial: meta && meta.isOfficial !== false,
        hasBoxFrame: !!(meta && meta.hasBoxFrame),
        hasTooMuchText: !!(meta && meta.hasTooMuchText),
        isLowQuality: !!(meta && meta.isLowQuality),
        isCenteredSubject: meta && meta.isCenteredSubject !== false,
        isEasyToCrop43: meta && meta.isEasyToCrop43 !== false,
        preferredFit: meta && meta.preferredFit || null,
        position: meta && meta.position || null,
        assetRecord: meta && meta.assetRecord || null
      });
      return;
    }

    if (typeof rawValue === 'object') {
      var src = rawValue.src || rawValue.url || rawValue.image;
      if (!src || /^maps\//i.test(String(src))) return;
      list.push({
        src: src,
        type: rawValue.type || inferCandidateType(meta),
        source: rawValue.source || (meta && meta.source) || 'project',
        isLocal: rawValue.isLocal !== false && !(meta && meta.isLocal === false),
        isOfficial: rawValue.isOfficial !== false,
        hasBoxFrame: !!rawValue.hasBoxFrame,
        hasTooMuchText: !!rawValue.hasTooMuchText,
        isLowQuality: !!rawValue.isLowQuality,
        isCenteredSubject: rawValue.isCenteredSubject !== false,
        isEasyToCrop43: rawValue.isEasyToCrop43 !== false,
        preferredFit: rawValue.preferredFit || (meta && meta.preferredFit) || null,
        position: rawValue.position || (meta && meta.position) || null,
        assetRecord: rawValue.assetRecord || (meta && meta.assetRecord) || null
      });
    }
  }

  function inspectExistingSystem(canvas, game) {
    var entry = window.ENTRIES_DATA ? window.ENTRIES_DATA[game.id] || null : null;
    var context = {
      canvas: canvas,
      game: game,
      entry: entry,
      consoleProfile: resolveConsoleArtworkProfile(game.console),
      inferredWikiTitles: [],
      artworkCandidates: [],
      selectedArtwork: null,
      normalizedArtwork: null,
      lcdStyle: null,
      missingArtwork: false,
      missingReason: ''
    };

    if (!INSPECT_STATE.logged && typeof console !== 'undefined' && console.info) {
      console.info('[TOP_SCREEN] inspectExistingSystem', {
        hasEntriesData: !!window.ENTRIES_DATA,
        gameFields: Object.keys(game || {}),
        entryFields: entry ? Object.keys(entry) : [],
        topVisualKeys: entry && entry.top_visual ? Object.keys(entry.top_visual) : []
      });
      INSPECT_STATE.logged = true;
    }

    return context;
  }

  function prepareArtworkCandidates(context) {
    var game = context.game;
    var entry = context.entry || {};
    var topVisual = entry.top_visual || {};
    var candidates = [];
    var profile = context.consoleProfile || resolveConsoleArtworkProfile(game.console);
    var identityEntries = getIdentityArtworkEntries(game.id);
    var wikiTitleCandidates = getWikiTitleCandidates(game);
    var manualArtwork = getManualArtworkEntry(game.id);
    var assetLibraryEntry = getAssetLibraryEntry(game.id);
    var seenSrc = {};

    if (assetLibraryEntry && assetLibraryEntry.status === 'ready' && assetLibraryEntry.sprite_path) {
      candidates.push({
        src: assetLibraryEntry.sprite_path,
        type: assetLibraryTypeToCandidateType(assetLibraryEntry.asset_type),
        source: 'asset-library',
        isLocal: true,
        isOfficial: true,
        hasBoxFrame: false,
        hasTooMuchText: false,
        isLowQuality: false,
        isCenteredSubject: true,
        isEasyToCrop43: false,
        preferredFit: 'identity-card',
        position: 'center center',
        assetRecord: assetLibraryEntry
      });
    }

    candidates = candidates.concat(
      collectIdentityCandidates(game, entry, topVisual, manualArtwork, profile)
    );

    if (topVisual['3']) {
      pushArtworkCandidate(candidates, topVisual['3'], {
        type: 'ingameShot',
        source: 'entry-top-visual',
        isLocal: true,
        isOfficial: true,
        hasBoxFrame: false,
        hasTooMuchText: false,
        isLowQuality: false,
        isCenteredSubject: true,
        isEasyToCrop43: true,
        preferredFit: 'cover',
        position: 'center center'
      });
    }

    [
      { value: manualArtwork && manualArtwork.src, field: manualArtwork && manualArtwork.type || 'artwork', source: 'manual-asset', isOfficial: manualArtwork ? manualArtwork.isOfficial !== false : true },
      { value: game.keyArt, field: 'keyArt' },
      { value: game.promoImage, field: 'promoImage' },
      { value: game.magazineArt, field: 'magazineArt' },
      { value: game.coverIllustration, field: 'coverIllustration' },
      { value: game.editorialArt, field: 'editorialArt' },
      { value: entry.keyArt || entry.key_art, field: 'keyArt' },
      { value: entry.promoImage || entry.promo_image, field: 'promoImage' },
      { value: entry.magazineArt || entry.magazine_art, field: 'magazineArt' },
      { value: entry.coverIllustration || entry.cover_illustration, field: 'coverIllustration' },
      { value: entry.editorialArt || entry.editorial_art, field: 'editorialArt' },
      { value: topVisual.artwork || topVisual.top || topVisual.keyArt || topVisual.key_art, field: 'artwork' }
    ].forEach(function(item) {
      if (!item.value) return;
      pushArtworkCandidate(candidates, item.value, {
        field: item.field,
        source: item.source || 'project',
        isLocal: true,
        isOfficial: item.isOfficial !== false,
        preferredFit: profile.preferredFit
      });
    });

    identityEntries.forEach(function(identityEntry) {
      if (!identityEntry || !identityEntry.wikiTitle) return;
      candidates.push({
        wikiTitle: identityEntry.wikiTitle,
        type: identityEntry.type || 'mainSprite',
        source: 'identity-override',
        isLocal: false,
        isOfficial: identityEntry.isOfficial !== false,
        hasBoxFrame: !!identityEntry.hasBoxFrame,
        hasTooMuchText: !!identityEntry.hasTooMuchText,
        isLowQuality: !!identityEntry.isLowQuality,
        isCenteredSubject: identityEntry.isCenteredSubject !== false,
        isEasyToCrop43: false,
        preferredFit: identityEntry.preferredFit || 'identity-card',
        position: identityEntry.position || 'center center',
        isGeneric: false
      });
    });

    candidates = candidates.filter(function(candidate) {
      var key = candidate.src || '';
      if (!key) return true;
      if (seenSrc[key]) return false;
      seenSrc[key] = true;
      return true;
    });

    wikiTitleCandidates.forEach(function(wikiCandidate) {
      candidates.push({
        wikiTitle: wikiCandidate.wikiTitle,
        type: 'keyArt',
        source: wikiCandidate.source,
        isLocal: false,
        isOfficial: true,
        hasBoxFrame: false,
        hasTooMuchText: wikiCandidate.hasTooMuchText,
        isLowQuality: false,
        isCenteredSubject: true,
        isEasyToCrop43: profile.cropBias !== 'portrait',
        preferredFit: profile.preferredFit,
        isGeneric: !!wikiCandidate.isGeneric
      });
    });

    context.inferredWikiTitles = wikiTitleCandidates
      .filter(function(candidate) { return candidate.source === 'wiki-inferred'; })
      .map(function(candidate) { return candidate.wikiTitle; });
    context.wikiTitleCandidates = wikiTitleCandidates.slice();
    context.archivedGames = ARTWORK_ARCHIVE;

    context.artworkCandidates = candidates;
    return context;
  }

  function scoreArtwork(candidate) {
    var score = 0;
    var typePriority = ARTWORK_PRIORITY[candidate.type] || 0;

    if (candidate.isLocal) score += 5;
    if (candidate.isOfficial) score += 4;
    score += typePriority;

    if (candidate.source === 'asset-library') score += 10;
    if (candidate.source === 'manual-asset') score += 6;
    if (candidate.source === 'identity-override') score += 5;
    if (candidate.source === 'entry-top-visual') score += 4;
    if (candidate.source === 'wiki-curated') score += 3;
    if (candidate.source === 'wiki-override') score += 2;
    if (candidate.source === 'wiki-inferred') score += 1;
    if (candidate.hasBoxFrame) score -= 6;
    if (candidate.hasTooMuchText) score -= 3;
    if (candidate.isLowQuality) score -= 2;
    if (candidate.isCenteredSubject) score += 2;
    if (candidate.isEasyToCrop43) score += 2;
    if (candidate.isGeneric) score -= 12;
    if (candidate.source && String(candidate.source).indexOf('wiki') >= 0 && typePriority < ARTWORK_PRIORITY.artwork) {
      score -= 8;
    }

    return score;
  }

  function selectBestArtwork(context) {
    if (!context.artworkCandidates.length) {
      context.missingArtwork = true;
      context.missingReason = 'missing artwork';
      return context;
    }

    context.artworkCandidates = context.artworkCandidates
      .map(function(candidate) {
        candidate.score = scoreArtwork(candidate);
        return candidate;
      })
      .sort(function(a, b) { return b.score - a.score; });

    context.selectedArtwork = context.artworkCandidates[0] || null;
    if (!context.selectedArtwork) {
      context.missingArtwork = true;
      context.missingReason = 'missing artwork';
    }

    return context;
  }

  function normalizeImages(context) {
    if (!context.selectedArtwork) {
      context.missingArtwork = true;
      context.missingReason = context.missingReason || 'missing artwork';
      return context;
    }

    context.normalizedArtwork = {
      ratio: '4:3',
      crop: 'center',
      preserveMainSubject: true,
      fit: context.selectedArtwork.preferredFit || context.consoleProfile.preferredFit,
      position: 'center center',
      isSprite: isSpriteType(context.selectedArtwork.type)
    };
    return context;
  }

  function applyLCDStyle(context) {
    context.lcdStyle = {
      palette: ['#E6F2D8', '#B5D1A6', '#5F8F73', '#2C4A3F'],
      bootClass: 'rdx-lcd-boot'
    };
    return context;
  }

  function archiveMissingArtwork(game, reason) {
    if (ARTWORK_ARCHIVE_INDEX[game.id]) return;

    var backlog = getBacklogArtworkEntry(game.id);

    ARTWORK_ARCHIVE_INDEX[game.id] = true;
    ARTWORK_ARCHIVE.push({
      id: game.id,
      title: game.title,
      platform: game.console || null,
      year: game.year || null,
      publisher: game.publisher || game.developer || null,
      reason: reason || (backlog && backlog.status) || 'missing artwork',
      curationStatus: backlog ? backlog.status : 'unresolved',
      preferredAssetPath: backlog ? backlog.preferredAssetPath || null : null,
      wikiCandidates: getWikiTitleCandidates(game).map(function(candidate) {
        return { title: candidate.wikiTitle, source: candidate.source };
      }),
      note: backlog ? backlog.note || '' : ''
    });

    window.RETRODEX_MISSING_TOP_ARTWORK = ARTWORK_ARCHIVE;
    window.archivedGames = ARTWORK_ARCHIVE;
  }

  function handleIncompleteGames(context) {
    if (context.missingArtwork) {
      archiveMissingArtwork(context.game, context.missingReason || 'missing artwork');
    }
    return context;
  }

  /* ─────────────────────────────────────────────────────────────
     FETCH IMAGE depuis Wikipedia via <img> tag
     new Image() n'a PAS les restrictions file:// du canvas
     Wikimedia envoie les bons headers CORS pour les images
     ───────────────────────────────────────────────────────────── */
  function fetchWikiImage(wikiTitle, gameId) {
    /* URL de la thumbnail Wikipedia directe
       Format : Special:FilePath/{title}?width=400
       Redirige vers upload.wikimedia.org — CORS ouvert */
    var directUrl = 'https://en.wikipedia.org/wiki/Special:FilePath/'
      + encodeURIComponent(wikiTitle.replace(/ /g,'_'))
      + '_video_game_cover.jpg?width=400';

    /* Fallback : thumbnail via pageimages — on construit l'URL
       directement depuis le title sans API call */
    var wikiUrl = 'https://en.wikipedia.org/w/index.php?title='
      + encodeURIComponent(wikiTitle.replace(/_/g,' '))
      + '&action=render';

    /* Approche la plus fiable : img.src vers l'URL de thumb Wikipedia
       Le format est prévisible pour les articles de jeux vidéo */
    return buildThumbUrl(wikiTitle, gameId);
  }

  /* Construit l'URL de thumbnail Wikimedia directement
     Sans appel API — basé sur le hash du nom de fichier */
  function buildThumbUrl(wikiTitle, gameId) {
    /* Wikipedia expose les images via commons.wikimedia.org
       URL pattern : /wikipedia/en/thumb/{a}/{ab}/{Filename}/{width}px-{Filename}
       Mais le hash est difficile à calculer côté client.
       
       Alternative plus simple et fiable :
       Utiliser l'API REST de Wikipedia (v1) qui supporte CORS depuis file://
       endpoint: /api/rest_v1/page/summary/{title}
       Retourne thumbnail.source dans le JSON */
    return 'https://en.wikipedia.org/api/rest_v1/page/summary/'
      + encodeURIComponent(decodeWikiTitleForApi(wikiTitle));
  }

  /* ─────────────────────────────────────────────────────────────
     CHARGER une image via <img> (pas de canvas → pas de taint)
     ───────────────────────────────────────────────────────────── */
  function loadImageTag(url) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload  = function() {
        resolve({
          src: url,
          image: img,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        });
      };
      img.onerror = function() { reject(); };
      img.src = url;
    });
  }

  function resolveSummaryImage(wikiTitle) {
    if (SUMMARY_IMAGE_CACHE[wikiTitle]) {
      return SUMMARY_IMAGE_CACHE[wikiTitle];
    }

    SUMMARY_IMAGE_CACHE[wikiTitle] = new Promise(function(resolve, reject) {
      var apiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
        + encodeURIComponent(wikiTitle.replace(/_/g, ' '));

      var xhr = new XMLHttpRequest();
      xhr.open('GET', apiUrl, true);
      xhr.timeout = 6000;
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status !== 200) { reject(); return; }

        try {
          var data = JSON.parse(xhr.responseText);
          var src = (data && data.thumbnail && data.thumbnail.source)
            || (data && data.originalimage && data.originalimage.source);

          if (!src) { reject(); return; }
          if (src.indexOf('/thumb/') >= 0) {
            src = src.replace(/\/\d+px-/, '/480px-');
          }

          resolve(src);
        } catch (error) {
          reject(error);
        }
      };
      xhr.onerror = function(error) {
        delete SUMMARY_IMAGE_CACHE[wikiTitle];
        reject(error);
      };
      xhr.ontimeout = function(error) {
        delete SUMMARY_IMAGE_CACHE[wikiTitle];
        reject(error);
      };
      xhr.send();
    });

    return SUMMARY_IMAGE_CACHE[wikiTitle];
  }

  function resolveArtworkCandidate(candidate) {
    if (candidate.src) {
      return loadImageTag(candidate.src).then(function(loaded) {
        loaded.candidate = candidate;
        return loaded;
      });
    }

    if (candidate.wikiTitle) {
      return resolveSummaryImage(candidate.wikiTitle)
        .then(function(src) { return loadImageTag(src); })
        .then(function(loaded) {
          loaded.candidate = candidate;
          return loaded;
        });
    }

    return Promise.reject();
  }

  function finalizeNormalizedArtwork(context, loadedArtwork) {
    var width = loadedArtwork.width || 0;
    var height = loadedArtwork.height || 1;
    var ratio = width / height;
    var profile = context.consoleProfile || resolveConsoleArtworkProfile(context.game && context.game.console);
    var isSprite = isSpriteType(context.selectedArtwork.type);
    var fit = context.normalizedArtwork && context.normalizedArtwork.fit
      ? context.normalizedArtwork.fit
      : profile.preferredFit;
    var position = profile.preferredPosition || 'center center';

    if (isSprite) {
      if (ratio >= 1.2) fit = '90% auto';
      else if (ratio <= 0.82) fit = 'auto 88%';
      else fit = '84% 84%';
      position = 'center 46%';
    } else if (!context.selectedArtwork.preferredFit) {
      if (ratio < 0.78) {
        fit = 'auto 100%';
        position = 'center 42%';
      } else if (ratio >= 0.78 && ratio <= 2.2) {
        fit = 'cover';
      } else {
        fit = 'contain';
      }
    }

    return {
      src: loadedArtwork.src,
      fit: fit,
      position: context.selectedArtwork.position || position,
      ratio: '4:3',
      isSprite: isSprite,
      type: context.selectedArtwork.type,
      assetRecord: context.selectedArtwork.assetRecord || null,
      width: width,
      height: height
    };
  }

  /* ─────────────────────────────────────────────────────────────
     AFFICHER l'image officielle dans la div cover
     ───────────────────────────────────────────────────────────── */
  function showCoverLegacy(artwork, game, context) {
    var cover    = document.getElementById('rdx-cover');
    var coverBg  = document.getElementById('rdx-cover-bg');
    var canvas   = document.getElementById('rdxCanvas');
    if (!cover) return;
    var imgUrl = artwork && artwork.src ? artwork.src : artwork;

    /* Fond flouté */
    if (coverBg) {
      coverBg.style.backgroundImage = 'url("' + imgUrl + '")';
      coverBg.style.backgroundSize = 'cover';
      coverBg.style.backgroundPosition = 'center center';
      coverBg.style.opacity = '1';
    }

    /* Image nette (contain — jaquette complète) */
    cover.style.backgroundImage = 'url("' + imgUrl + '")';
    cover.style.backgroundSize = artwork && artwork.fit ? artwork.fit : 'contain';
    cover.style.backgroundPosition = artwork && artwork.position ? artwork.position : 'center center';
    cover.style.backgroundRepeat = 'no-repeat';
    cover.style.opacity = '1';

    /* Cacher le canvas procédural sous l'image */
    if (canvas) canvas.style.opacity = '0';

    /* Mettre à jour la barre de titre */
    if (titleBar) {
      var title = game.title.length > 24
        ? game.title.slice(0, 23) + '\u2026'
        : game.title;
      titleBar.innerHTML =
        '<div style="font:bold 10px \'Courier New\',monospace;color:#9BBC0F;' +
        'text-shadow:1px 1px 0 #0F380F;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + title + '</div>' +
        '<div style="font:bold 7px \'Courier New\',monospace;color:#8BAC0F;' +
        'display:flex;justify-content:space-between;margin-top:1px">' +
        '<span>' + game.console + '</span>' +
        (game.year ? '<span style="color:#306230">' + game.year + '</span>' : '') +
        '</div>';
    }
  }

  /* Masquer la cover et remontrer le canvas */
  function hideCoverLegacy() {
    var cover   = document.getElementById('rdx-cover');
    var coverBg = document.getElementById('rdx-cover-bg');
    var canvas  = document.getElementById('rdxCanvas');
    if (cover)   { cover.style.opacity   = '0'; cover.style.backgroundImage   = 'none'; }
    if (coverBg) { coverBg.style.opacity = '0'; coverBg.style.backgroundImage = 'none'; }
    if (canvas)  canvas.style.opacity = '1';
  }

  /* ─────────────────────────────────────────────────────────────
     FALLBACK sur le canvas (procédural)
     ───────────────────────────────────────────────────────────── */
  function drawFallback(ctx, W, H, game) {
    /* Déléguer au moteur d'illustration procédural v5 */
    if (typeof ILLUSTRATOR !== 'undefined' && ILLUSTRATOR.draw) {
      ILLUSTRATOR.draw(ctx, W, H, game);
      return;
    }
    /* Fallback ultra-minimal si ILLUSTRATOR non chargé */
    var t = (game.title + ' ' + (game.developer || '')).toLowerCase();
    ctx.fillStyle = C.D; ctx.fillRect(0, 0, W, H);

    var isRPG = ['final fantasy','chrono','dragon quest','xenogears','earthbound',
      'secret of mana','wild arms','suikoden','breath of fire','vagrant',
      'lufia','phantasy'].some(function(k){ return t.indexOf(k) >= 0; });
    var isAction = ['zelda','mario','kirby','donkey','metroid','mega man','contra',
      'castlevania','crash','sonic','wario','spyro','tomb','silent hill',
      'metal gear'].some(function(k){ return t.indexOf(k) >= 0; });

    if (isRPG) {
      for (var i=0;i<55;i++) {
        ctx.fillStyle = i%5===0 ? C.B : C.L;
        ctx.fillRect((i*73+i*i*2)%W,(i*41+i*11)%Math.floor(H*.65),i%4===0?2:1,i%4===0?2:1);
      }
      ctx.fillStyle=C.L; ctx.beginPath(); ctx.arc(W*.17,32,18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=C.M; ctx.beginPath(); ctx.arc(W*.14,28,15,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=C.M; ctx.beginPath();
      ctx.moveTo(0,H); ctx.lineTo(50,H*.42); ctx.lineTo(110,H*.58);
      ctx.lineTo(160,H*.35); ctx.lineTo(215,H*.52); ctx.lineTo(W,H*.48); ctx.lineTo(W,H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle=C.D; ctx.fillRect(W*.38,H*.45,62,H*.4);
      [W*.38,W*.44,W*.52,W*.58].forEach(function(tx){ctx.fillRect(tx,H*.45-12,10,14);});
      [[W*.41,H*.52],[W*.51,H*.52],[W*.41,H*.62],[W*.51,H*.62]].forEach(function(p){
        ctx.fillStyle=C.L;ctx.fillRect(p[0],p[1],5,7);
        ctx.fillStyle=C.B;ctx.fillRect(p[0]+1,p[1]+1,3,5);
      });
    } else if (isAction) {
      ctx.fillStyle=C.B; ctx.fillRect(0,0,W,H*.6);
      ctx.fillStyle=C.L; ctx.fillRect(0,H*.45,W,H*.15);
      [[18,14,3],[80,8,3],[175,16,2],[240,10,3]].forEach(function(p){
        ctx.fillStyle=C.B;
        ctx.fillRect(p[0],p[1]+4,p[2]*4,p[2]*2);
        ctx.fillRect(p[0]+4,p[1],p[2]*5,p[2]*3);
        ctx.fillRect(p[0]-2,p[1]+4,p[2]*5,p[2]*2);
      });
      ctx.fillStyle=C.M; ctx.fillRect(0,H*.72,W,H*.28);
      ctx.fillStyle=C.L; ctx.fillRect(0,H*.72,W,4);
      [55,85,115,145].forEach(function(bx,i){
        ctx.fillStyle=C.M;ctx.fillRect(bx,H*.44,16,16);
        ctx.fillStyle=C.L;ctx.fillRect(bx+1,H*.44+1,14,14);
        ctx.fillStyle=C.M;ctx.fillRect(bx+2,H*.44+2,12,12);
        ctx.fillStyle=C.B;ctx.font='bold 11px monospace';ctx.textBaseline='top';
        ctx.fillText(i%2===0?'?':'#',bx+4,H*.44+3);
      });
      ctx.fillStyle=C.M;ctx.fillRect(28,H*.52,16,H*.2);
      ctx.fillStyle=C.L;ctx.fillRect(25,H*.52,22,6);
      ctx.fillStyle=C.M;ctx.fillRect(240,H*.60,16,H*.12);
      ctx.fillStyle=C.L;ctx.fillRect(237,H*.60,22,6);
    } else {
      ctx.fillStyle=C.B; ctx.fillRect(0,0,W,H*.58);
      ctx.fillStyle=C.B; ctx.beginPath();ctx.arc(W*.78,30,18,0,Math.PI*2);ctx.fill();
      [[0,H*.68,55],[70,H*.6,68],[160,H*.65,62],[240,H*.62,72]].forEach(function(p){
        ctx.fillStyle=C.M;ctx.beginPath();ctx.arc(p[0]+p[2]/2,p[1],p[2]/2,Math.PI,0);ctx.fill();
      });
      ctx.fillStyle=C.D;ctx.fillRect(0,H*.73,W,H*.27);
      ctx.fillStyle=C.M;ctx.fillRect(0,H*.73,W,3);
    }

    for (var y=0;y<H;y+=2){ctx.fillStyle='rgba(0,0,0,0.09)';ctx.fillRect(0,y,W,1);}

    /* Bande titre sur le canvas aussi */
    ctx.fillStyle='rgba(15,56,15,0.88)';ctx.fillRect(0,H-38,W,38);
    ctx.fillStyle=C.M;ctx.fillRect(0,H-39,W,1);
    ctx.fillStyle=C.L;ctx.fillRect(0,H-40,W,1);
    ctx.textBaseline='top';ctx.textAlign='left';
    var ttl=game.title.length>24?game.title.slice(0,23)+'\u2026':game.title;
    ctx.fillStyle=C.D;ctx.font='bold 10px "Courier New"';ctx.fillText(ttl,6,H-34);
    ctx.fillStyle=C.B;ctx.fillText(ttl,5,H-35);
    ctx.fillStyle=C.L;ctx.font='bold 7px "Courier New"';ctx.fillText(game.console,5,H-22);
    if(game.year){ctx.textAlign='right';ctx.fillStyle=C.M;ctx.fillText(String(game.year),W-5,H-22);}
    ctx.textAlign='right';ctx.fillStyle=C.M;ctx.font='6px "Courier New"';ctx.fillText('RETRODEX',W-4,H-8);
    ctx.textAlign='left';
  }

  /* ─────────────────────────────────────────────────────────────
     WORLDMAP — affiche une carte en top screen (Screen 3)
     value = URL directe (https://...) OU titre Wikipedia (sans https)
     ───────────────────────────────────────────────────────────── */
  var _worldmapActive = false;
  var _worldmapUrl    = null;

  function _applyMapImage(src) {
    setup();
    var cover   = document.getElementById('rdx-cover');
    var coverBg = document.getElementById('rdx-cover-bg');
    var canvas  = document.getElementById('rdxCanvas');
    if (!cover) return;
    if (canvas)  canvas.style.opacity = '0';
    if (coverBg) {
      coverBg.style.backgroundImage    = 'url("' + src + '")';
      coverBg.style.backgroundSize     = 'cover';
      coverBg.style.backgroundPosition = 'center';
      coverBg.style.opacity            = '1';
    }
    cover.style.backgroundImage    = 'url("' + src + '")';
    cover.style.backgroundSize     = 'contain';
    cover.style.backgroundPosition = 'center';
    cover.style.backgroundRepeat   = 'no-repeat';
    cover.style.opacity            = '1';
  }

  function setWorldmap(value) {
    if (!value) return;
    _worldmapActive = true;
    _worldmapUrl    = value;
    setup();
    var canvas = document.getElementById('rdxCanvas');
    if (canvas) canvas.style.opacity = '0';

    /* Chemin relatif (maps/*.png) → chargement direct comme URL https */
    if (value.indexOf('https://') !== 0 && value.indexOf('http://') !== 0) {
      /* Chemin local : maps/xxx.png  — même logique que URL directe */
      var imgL = new Image();
      imgL.onload = function() {
        if (_worldmapActive && _worldmapUrl === value) _applyMapImage(value);
      };
      imgL.onerror = function() {
        if (_worldmapActive) { _worldmapActive = false; if (canvas) canvas.style.opacity = '1'; }
      };
      imgL.src = value;
    } else if (value.indexOf('https://') === 0) {
      /* URL directe — tester avant affichage */
      var img = new Image();
      img.onload = function() {
        if (_worldmapActive && _worldmapUrl === value) _applyMapImage(value);
      };
      img.onerror = function() {
        if (_worldmapActive) { _worldmapActive = false; if (canvas) canvas.style.opacity = '1'; }
      };
      img.src = value;
    } else {
      /* Titre Wikipedia → même API REST que fetchWikiImage */
      var apiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
        + encodeURIComponent(decodeWikiTitleForApi(value));
      var xhr = new XMLHttpRequest();
      xhr.open('GET', apiUrl, true);
      xhr.timeout = 6000;
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || !_worldmapActive || _worldmapUrl !== value) return;
        if (xhr.status !== 200) { if (canvas) canvas.style.opacity = '1'; return; }
        try {
          var data = JSON.parse(xhr.responseText);
          var src  = data && data.thumbnail && data.thumbnail.source;
          if (!src) { if (canvas) canvas.style.opacity = '1'; return; }
          src = src.replace(/\/\d+px-/, '/400px-');
          var img2 = new Image();
          img2.onload  = function() { if (_worldmapActive) _applyMapImage(src); };
          img2.onerror = function() { if (canvas) canvas.style.opacity = '1'; };
          img2.src = src;
        } catch(e) { if (canvas) canvas.style.opacity = '1'; }
      };
      xhr.onerror   = function() { if (canvas) canvas.style.opacity = '1'; };
      xhr.ontimeout = function() { if (canvas) canvas.style.opacity = '1'; };
      xhr.send();
    }
  }

  function clearWorldmap() {
    if (!_worldmapActive) return;
    _worldmapActive = false;
    _worldmapUrl    = null;
    hideCover();
    var canvas = document.getElementById('rdxCanvas');
    if (canvas) canvas.style.opacity = '1';
  }

  /* ─────────────────────────────────────────────────────────────
     ENTRÉE PRINCIPALE
     ───────────────────────────────────────────────────────────── */
  function showCover(artwork, game, context) {
    var cover = document.getElementById('rdx-cover');
    var coverBg = document.getElementById('rdx-cover-bg');
    var coverStage = document.getElementById('rdx-cover-stage');
    var canvas = document.getElementById('rdxCanvas');
    if (!cover) return;

    var imgUrl = artwork && artwork.src ? artwork.src : artwork;
    var isSprite = !!(artwork && artwork.isSprite);
    var hasAssetCard = false;

    if (coverBg) {
      coverBg.style.backgroundImage = 'url("' + imgUrl + '")';
      coverBg.style.backgroundSize = 'cover';
      coverBg.style.backgroundPosition = 'center center';
      coverBg.style.opacity = hasAssetCard ? (isSprite ? '.42' : '.56') : '1';
    }

    cover.style.backgroundImage = 'url("' + imgUrl + '")';
    cover.style.backgroundSize = artwork && artwork.fit ? artwork.fit : 'contain';
    cover.style.backgroundPosition = artwork && artwork.position ? artwork.position : 'center center';
    cover.style.backgroundRepeat = 'no-repeat';
    cover.style.opacity = '1';
    cover.classList.toggle('rdx-cover-sprite', isSprite);
    if (coverStage) coverStage.classList.toggle('rdx-cover-sprite-stage', isSprite);

    if (canvas) canvas.style.opacity = '0';

    hideAssetCard();
    updateTitleBar(game, context);
    triggerBootAnimation();
  }

  function hideCover() {
    var cover = document.getElementById('rdx-cover');
    var coverBg = document.getElementById('rdx-cover-bg');
    var coverStage = document.getElementById('rdx-cover-stage');
    var canvas = document.getElementById('rdxCanvas');

    if (cover) {
      cover.style.opacity = '0';
      cover.style.backgroundImage = 'none';
      cover.style.backgroundSize = 'contain';
      cover.style.backgroundPosition = 'center center';
      cover.style.backgroundRepeat = 'no-repeat';
      cover.classList.remove('rdx-cover-sprite');
    }

    if (coverBg) {
      coverBg.style.opacity = '0';
      coverBg.style.backgroundImage = 'none';
      coverBg.style.backgroundSize = 'cover';
      coverBg.style.backgroundPosition = 'center center';
    }

    if (coverStage) coverStage.classList.remove('rdx-cover-sprite-stage');
    hideAssetCard();

    if (canvas) canvas.style.opacity = '1';
  }

  function generateLegacy(canvas, game) {
    /* Fixer les dimensions intrinsèques au rendu réel (évite flou/crop) */
    var rect = canvas.getBoundingClientRect();
    var W = Math.round(rect.width)  || 268;
    var H = Math.round(rect.height) || 147;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* Setup DOM overlay si pas encore fait */
    setup();

    /* Si une worldmap est active, ne pas l'écraser */
    if (_worldmapActive && _worldmapUrl) {
      setWorldmap(_worldmapUrl);
      return Promise.resolve();
    }

    /* 1. Toujours montrer le canvas + masquer l'ancienne cover */
    canvas.style.opacity = '1';
    hideCover();

    /* 2. Fallback procédural immédiat */
    drawFallback(ctx, W, H, game);

    /* 3. Essayer de charger l'image officielle */
    var wikiTitle = WIKI[game.id];
    if (!wikiTitle) return Promise.resolve();

    /* Cache hit */
    if (isCachedTopImage(CACHE[game.id])) {
      showCover(CACHE[game.id], game);
      return Promise.resolve();
    }

    /* 4. API REST Wikipedia — renvoie JSON avec thumbnail.source
          Fonctionne depuis file:// (pas de canvas, juste un <img>) */
      var apiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
        + encodeURIComponent(decodeWikiTitleForApi(wikiTitle));

    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);
    xhr.timeout = 6000;
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { delete CACHE[game.id]; return; }
      try {
        var data = JSON.parse(xhr.responseText);
        var src  = data && data.thumbnail && data.thumbnail.source;
        if (!src) { delete CACHE[game.id]; return; }

        /* Agrandir la thumbnail : remplacer /220px- par /400px- */
        src = src.replace(/\/\d+px-/, '/400px-');

        /* Vérifier que l'image charge bien */
        var img = new Image();
        img.onload = function() {
          CACHE[game.id] = src;
          /* Vérifier que c'est toujours le même jeu affiché */
          var currentCanvas = document.getElementById('rdxCanvas');
          if (currentCanvas === canvas) {
            showCover(src, game);
          }
        };
        img.onerror = function() { delete CACHE[game.id]; };
        img.src = src;

      } catch(e) {
        delete CACHE[game.id];
      }
    };
    xhr.onerror   = function() { delete CACHE[game.id]; };
    xhr.ontimeout = function() { delete CACHE[game.id]; };
    xhr.send();
  }

  /* ─────────────────────────────────────────────────────────────
     setWorldmapFallback(gameId)
     Screen 3 sans map : afficher l'illustration Wikipedia du jeu
     (même image que Screen 2) plutôt que le canvas procédural.
     Si aucun titre WIKI connu → clearWorldmap() (procédural S1).
  ───────────────────────────────────────────────────────────── */
  function setWorldmapFallback(gameId) {
    var wikiTitle = WIKI[gameId];
    if (wikiTitle) {
      /* Passer le titre Wikipedia : setWorldmap gérera le XHR */
      setWorldmap(wikiTitle);
    } else {
      clearWorldmap();
    }
  }

  function generate(canvas, game) {
    var rect = canvas.getBoundingClientRect();
    var W = Math.round(rect.width) || 268;
    var H = Math.round(rect.height) || 147;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve();

    setup();

    if (_worldmapActive && _worldmapUrl) {
      setWorldmap(_worldmapUrl);
      return Promise.resolve();
    }

    canvas.style.opacity = '1';
    hideCover();
    drawFallback(ctx, W, H, game);

    var context = inspectExistingSystem(canvas, game);
    applyLCDStyle(context);
    updateTitleBar(game, context);

    if (isCachedTopImage(CACHE[game.id])) {
      showCover(CACHE[game.id], game, context);
      return Promise.resolve(context);
    }

    return loadTopImage(game, context)
      .then(function(artwork) {
        CACHE[game.id] = artwork;
        context.selectedArtwork = {
          type: artwork.type,
          source: artwork.type,
          src: artwork.src
        };
        context.normalizedArtwork = artwork;
        context.missingArtwork = artwork.type === 'placeholder';
        context.missingReason = artwork.type === 'placeholder' ? 'placeholder fallback' : '';
        if (context.missingArtwork) {
          handleIncompleteGames(context);
        }

        var currentCanvas = document.getElementById('rdxCanvas');
        if (currentCanvas === canvas) {
          showCover(artwork, game, context);
        }

        return context;
      })
      .catch(function() {
        delete CACHE[game.id];
        context.missingArtwork = true;
        context.missingReason = 'placeholder fallback unavailable';
        handleIncompleteGames(context);
        return context;
      });
  }

  function setWorldmapFallback(gameId) {
    var game = getGameById(gameId);
    var wikiTitle = WIKI[gameId];
    if (!wikiTitle && game) {
      var wikiCandidates = getWikiTitleCandidates(game);
      wikiTitle = wikiCandidates.length ? wikiCandidates[0].wikiTitle : '';
    }

    if (wikiTitle) setWorldmap(wikiTitle);
    else clearWorldmap();
  }

  function getArtworkDiagnostic(gameId) {
    var game = getGameById(gameId);
    if (!game) return null;

    var manualArtwork = getManualArtworkEntry(gameId);
    var backlog = getBacklogArtworkEntry(gameId);

    var context = inspectExistingSystem(null, game);
    applyLCDStyle(context);
    context.topImageSlug = TOP_SCREEN_LOADER.slugify(game.title);
    context.topImagePaths = TOP_SCREEN_LOADER.buildTopImagePaths(context.topImageSlug).map(function(item) {
      return { type: item.type, path: item.path };
    });

    return {
      id: game.id,
      title: game.title,
      console: game.console,
      selectedType: context.selectedArtwork ? context.selectedArtwork.type : null,
      selectedSource: context.selectedArtwork ? context.selectedArtwork.source : null,
      selectedWikiTitle: context.selectedArtwork ? (context.selectedArtwork.wikiTitle || null) : null,
      candidateCount: context.artworkCandidates.length,
      identityCandidates: getIdentityArtworkEntries(gameId).slice(),
      wikiCandidates: (context.wikiTitleCandidates || []).slice(),
      inferredWikiTitles: (context.inferredWikiTitles || []).slice(),
      manualArtwork: manualArtwork,
      backlog: backlog,
      normalizedArtwork: context.normalizedArtwork,
      missingArtwork: !!context.missingArtwork,
      archivedMissingArtwork: !!ARTWORK_ARCHIVE_INDEX[game.id],
      topImageSlug: context.topImageSlug,
      topImagePaths: context.topImagePaths
    };
  }

  return { generate: generate, setup: setup,
           setWorldmap: setWorldmap, clearWorldmap: clearWorldmap,
           setWorldmapFallback: setWorldmapFallback,
           getMissingArtworkArchive: function() { return ARTWORK_ARCHIVE.slice(); },
           getArtworkDiagnostic: getArtworkDiagnostic };

})();
