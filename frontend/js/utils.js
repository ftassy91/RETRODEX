/* =====================================================================
   UTILS — fonctions partagées, chargées en premier
   Disponibles globalement avant tous les autres modules.
   ===================================================================== */

const RDX_PALETTE = {
  dark: '#0F380F',
  mid: '#306230',
  light: '#8BAC0F',
  bright: '#9BBC0F'
};

/**
 * Formate une valeur numérique en devise USD.
 * Retourne "N/A" si la valeur n'est pas un nombre.
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  if (typeof value !== 'number') return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Dérive le genre d'un jeu depuis son id/titre/console.
 * @param {object} game
 * @returns {string}
 */
function getGenre(game) {
  const MAP = {
    "the-legend-of-zelda-links-awakening-game-boy":"Action Adventure",
    "the-legend-of-zelda-ocarina-of-time-nintendo-64":"Action Adventure",
    "the-legend-of-zelda-a-link-to-the-past-super-nintendo":"Action Adventure",
    "oracle-of-ages-game-boy":"Action Adventure",
    "oracle-of-seasons-game-boy":"Action Adventure",
    "super-mario-64-nintendo-64":"Platformer",
    "super-mario-world-super-nintendo":"Platformer",
    "yoshi-island-super-nintendo":"Platformer",
    "metal-gear-solid-playstation":"Stealth Action",
    "final-fantasy-vii-playstation":"RPG",
    "final-fantasy-vi-super-nintendo":"RPG","final-fantasy-vi-advance-game-boy-advance":"RPG",
    "final-fantasy-viii-playstation":"RPG","final-fantasy-ix-playstation":"RPG",
    "final-fantasy-tactics-playstation":"Strategy RPG","final-fantasy-tactics-advance-game-boy-advance":"Strategy RPG",
    "castlevania-symphony-of-the-night-playstation":"Metroidvania",
    "castlevania-symphony-of-the-night-sega-saturn":"Metroidvania",
    "castlevania-aria-of-sorrow-game-boy-advance":"Metroidvania",
    "castlevania-harmony-of-dissonance-game-boy-advance":"Metroidvania",
    "castlevania-circle-of-the-moon-game-boy-advance":"Metroidvania",
    "castlevania-dawn-of-sorrow-nintendo-ds":"Metroidvania",
    "castlevania-order-of-ecclesia-nintendo-ds":"Metroidvania",
    "metroid-fusion-game-boy-advance":"Metroidvania",
    "metroid-zero-mission-game-boy-advance":"Metroidvania",
    "chrono-trigger-super-nintendo":"RPG","chrono-trigger-nintendo-ds":"RPG",
    "earthbound-super-nintendo":"RPG",
    "suikoden-playstation":"RPG","suikoden-ii-playstation":"RPG",
    "panzer-dragoon-saga-sega-saturn":"RPG",
    "xenogears-playstation":"RPG","vagrant-story-playstation":"Action RPG",
    "chrono-cross-playstation":"RPG","legend-of-dragoon-playstation":"RPG",
    "soul-calibur-dreamcast":"Fighting","tekken-3-playstation":"Fighting",
    "gran-turismo-playstation":"Racing","mario-kart-64-nintendo-64":"Racing",
    "goldeneye-007-nintendo-64":"FPS","perfect-dark-nintendo-64":"FPS",
    "resident-evil-2-playstation":"Survival Horror","silent-hill-playstation":"Survival Horror",
    "radiant-silvergun-sega-saturn":"Shoot em Up","ikaruga-dreamcast":"Shoot em Up",
    "tetris-game-boy":"Puzzle","tetris-dx-game-boy":"Puzzle",
    "advance-wars-game-boy-advance":"Strategy","advance-wars-dual-strike-nintendo-ds":"Strategy",
    "fire-emblem-game-boy-advance":"Strategy RPG",
    "the-world-ends-with-you-nintendo-ds":"Action RPG",
    "phoenix-wright-ace-attorney-nintendo-ds":"Adventure",
    "ghost-trick-phantom-detective-nintendo-ds":"Puzzle Adventure",
    "999-nine-hours-nine-persons-nine-doors-nintendo-ds":"Visual Novel",
    "radiant-historia-nintendo-ds":"RPG",
    "tony-hawks-pro-skater-2-playstation":"Sports",
    "gunstar-heroes-sega-genesis":"Run and Gun",
    "streets-of-rage-2-sega-genesis":"Beat em Up",
    "contra-nintendo-entertainment-system":"Run and Gun",
    "shenmue-dreamcast":"Adventure","jet-set-radio-dreamcast":"Rhythm",
    "elite-beat-agents-nintendo-ds":"Rhythm",
    "mother-3-game-boy-advance":"RPG",
    "terranigma-super-nintendo":"Action RPG","illusion-of-gaia-super-nintendo":"Action RPG",
    "demons-crest-super-nintendo":"Action Platformer",
    "alien-soldier-sega-genesis":"Run and Gun",
    "contra-hard-corps-sega-genesis":"Run and Gun",
    "castlevania-rondo-of-blood-turbografx-16":"Action Platformer",
    "metal-slug-neo-geo":"Run and Gun","metal-slug-2-neo-geo":"Run and Gun","metal-slug-3-neo-geo":"Run and Gun",
    "garou-mark-of-the-wolves-neo-geo":"Fighting",
    "the-king-of-fighters-98-neo-geo":"Fighting",
    "samurai-shodown-ii-neo-geo":"Fighting",
    "judgement-silversword-wonderswan":"Shoot em Up",
    "guardian-heroes-sega-saturn":"Beat em Up",
  };
  if (MAP[game.id]) return MAP[game.id];
  const t = (game.title||'').toLowerCase();
  if (/mario kart|gran turismo|f-zero|wave race|wipeout|rally|nascar/.test(t)) return 'Racing';
  if (/street fighter|mortal kombat|tekken|king of fighters|samurai shodown|fatal fury|virtua fighter|soul blade|soul calibur|marvel vs/.test(t)) return 'Fighting';
  if (/castlevania|metroid/.test(t)) return 'Metroidvania';
  if (/final fantasy|dragon quest|tales of|chrono|suikoden|wild arms|breath of fire|xenogears|golden sun|harvest moon|lufia|phantasy star|shining|radiant historia|ogre battle|tactics ogre/.test(t)) return 'RPG';
  if (/advance wars|fire emblem|disgaea|etrian|knights in|dragon force|herzog|shining force/.test(t)) return 'Strategy RPG';
  if (/zelda|alundra|beyond oasis|landstalker|story of thor/.test(t)) return 'Action Adventure';
  if (/resident evil|silent hill|fear effect/.test(t)) return 'Survival Horror';
  if (/metal gear|syphon filter|tenchu/.test(t)) return 'Stealth Action';
  if (/streets of rage|double dragon|battletoads|guardian heroes|river city|cannon spike/.test(t)) return 'Beat em Up';
  if (/contra|gunstar|thunder force|r-type|ikaruga|radiant silvergun|gradius|metal slug|truxton/.test(t)) return 'Shoot em Up';
  if (/tetris|columns|dr\. mario|klax|puzzle|intelligent qube|meteos/.test(t)) return 'Puzzle';
  if (/goldeneye|perfect dark/.test(t)) return 'FPS';
  if (/pro skater|tony hawk|madden|golf|mario golf|mario tennis/.test(t)) return 'Sports';
  if (/phoenix wright|hotel dusk|999|ghost trick|professor layton|contact/.test(t)) return 'Adventure';
  if (/jet set|elite beat|beatmania|space channel|parappa|um jammer/.test(t)) return 'Rhythm';
  if (/sonic|mario|banjo|donkey kong|crash|spyro|kirby|mega man|earthworm|rocket knight|bonk|bubsy|ristar|vectorman/.test(t)) return 'Platformer';
  return 'Action';
}
