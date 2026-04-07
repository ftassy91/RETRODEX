#!/usr/bin/env node
'use strict'

/**
 * fetch-igdb-covers.js
 *
 * Fetches cover images from IGDB for 102 games that have no cover_url,
 * then writes cover_url to games table and inserts into media_references.
 *
 * Usage:
 *   node fetch-igdb-covers.js           # dry-run (no DB writes)
 *   node fetch-igdb-covers.js --apply   # apply changes to SQLite
 */

const https = require('https')
const path = require('path')
const Database = require('better-sqlite3')

const APPLY = process.argv.includes('--apply')
const DB_PATH = path.resolve(__dirname, '../../storage/retrodex.sqlite')

const CLIENT_ID = '41yd2s4d22xsmyebyf6psh2tm1z1i6'
const CLIENT_SECRET = 'l8wxuonvigp5nsd7wtt9r2nlj73h8t'

const PLATFORM_IDS = {
  'Dreamcast': 23,
  'Game Boy': 33,
  'Game Boy Advance': 24,
  'Game Boy Color': 22,
  'Game Gear': 35,
  'NES': 18,
  'Nintendo 64': 4,
  'Nintendo DS': 20,
  'Nintendo Entertainment System': 18,
  'PlayStation': 7,
  'PlayStation 2': 8,
  'Sega Genesis': 29,
  'Sega Saturn': 32,
  'Super Nintendo': 19,
  'WonderSwan': 57,
}

const GAMES = [
  { id: 'tech-romancer-dreamcast', title: 'Tech Romancer', console: 'Dreamcast' },
  { id: '2nd-super-robot-wars-game-boy', title: '2nd Super Robot Wars', console: 'Game Boy' },
  { id: '3-fun-yosou-umaban-club-game-boy', title: '3-Fun Yosou Umaban Club', console: 'Game Boy' },
  { id: '4-in-1-funpak-game-boy', title: '4 in 1 Funpak', console: 'Game Boy' },
  { id: 'armored-police-metal-jack-game-boy', title: 'Armored Police Metal Jack', console: 'Game Boy' },
  { id: 'baseball-game-boy', title: 'Baseball', console: 'Game Boy' },
  { id: 'chikyu-kaiho-gun-zas-game-boy', title: 'Chikyū Kaihō Gun ZAS', console: 'Game Boy' },
  { id: '2nd-super-robot-wars-game-boy-advance', title: '2nd Super Robot Wars', console: 'Game Boy Advance' },
  { id: 'auto-zone-game-boy-color', title: 'Auto Zone', console: 'Game Boy Color' },
  { id: 'b-b-daman-bakugaiden-victory-e-no-michi-game-boy-color', title: 'B.B-Daman Bakugaiden: Victory e no Michi', console: 'Game Boy Color' },
  { id: 'babe-and-friends-game-boy-color', title: 'Babe and Friends', console: 'Game Boy Color' },
  { id: 'beatmania-gb-gatchamix2-game-boy-color', title: 'Beatmania GB GatchaMIX2', console: 'Game Boy Color' },
  { id: 'beatmania-gb2-gatchamix-game-boy-color', title: 'Beatmania GB2 GatchaMIX', console: 'Game Boy Color' },
  { id: 'bugs-bunny-lola-bunny-operation-carrot-patch-game-boy-color', title: 'Bugs Bunny & Lola Bunny: Operation Carrot Patch', console: 'Game Boy Color' },
  { id: 'the-gg-shinobi-game-gear', title: 'The GG Shinobi', console: 'Game Gear' },
  { id: 'aa-yakyu-jinsei-itchokusen-nes', title: 'Aa Yakyū Jinsei Itchokusen', console: 'NES' },
  { id: 'akagawa-jiro-no-yurei-ressha-nes', title: 'Akagawa Jirō no Yūrei Ressha', console: 'NES' },
  { id: 'akuma-kun-nes', title: 'Akuma-kun', console: 'NES' },
  { id: 'america-daitoryo-senkyo-nes', title: 'America Daitōryō Senkyo', console: 'NES' },
  { id: 'argus-nes', title: 'Argus', console: 'NES' },
  { id: 'bakushou-kinsey-gekijou-nes', title: 'Bakushou!! Kinsey Gekijou', console: 'NES' },
  { id: 'bakusho-ai-no-gekijo-nes', title: 'Bakushō! Ai no Gekijō', console: 'NES' },
  { id: 'bakusho-star-monomane-shitenno-nes', title: 'Bakushō! Star Monomane Shitennō', console: 'NES' },
  { id: 'barbie-nes', title: 'Barbie', console: 'NES' },
  { id: 'baseball-nes', title: 'Baseball', console: 'NES' },
  { id: 'aero-fighters-assault-nintendo-64', title: 'Aero Fighters Assault', console: 'Nintendo 64' },
  { id: 'bakusho-jinsei-64-mezase-resort-o-nintendo-64', title: 'Bakushō Jinsei 64: Mezase! Resort Ō', console: 'Nintendo 64' },
  { id: 'castlevania-nintendo-64', title: 'Castlevania', console: 'Nintendo 64' },
  { id: 'chrono-resurrection-nintendo-64', title: 'Chrono Resurrection', console: 'Nintendo 64' },
  { id: 'chokukan-night-pro-yakyu-king-nintendo-64', title: 'Chōkūkan Night: Pro Yakyū King', console: 'Nintendo 64' },
  { id: 'chokukan-night-pro-yakyu-king-2-nintendo-64', title: 'Chōkūkan Night: Pro Yakyū King 2', console: 'Nintendo 64' },
  { id: 'clayfighter-63-nintendo-64', title: 'ClayFighter 63⅓', console: 'Nintendo 64' },
  { id: 'cybertiger-nintendo-64', title: 'CyberTiger', console: 'Nintendo 64' },
  { id: 'eiko-no-saint-andrews-nintendo-64', title: 'Eikō no Saint Andrews', console: 'Nintendo 64' },
  { id: 'g-a-s-p-fighters-nextream-nintendo-64', title: "G.A.S.P!! Fighters' NEXTream", console: 'Nintendo 64' },
  { id: 'hercules-the-legendary-journeys-nintendo-64', title: 'Hercules: The Legendary Journeys', console: 'Nintendo 64' },
  { id: '12-family-games-nintendo-ds', title: '12 Family Games', console: 'Nintendo DS' },
  { id: '8ball-allstars-nintendo-ds', title: '8Ball Allstars', console: 'Nintendo DS' },
  { id: 'a-train-ds-nintendo-ds', title: 'A-Train DS', console: 'Nintendo DS' },
  { id: 'actionloop-nintendo-ds', title: 'Actionloop', console: 'Nintendo DS' },
  { id: 'again-nintendo-ds', title: 'Again', console: 'Nintendo DS' },
  { id: 'castlevania-nintendo-entertainment-system', title: 'Castlevania', console: 'Nintendo Entertainment System' },
  { id: '98-koshien-playstation', title: "'98 Kōshien", console: 'PlayStation' },
  { id: '99-koshien-playstation', title: "'99 Kōshien", console: 'PlayStation' },
  { id: '100-manyen-quiz-hunter-playstation', title: '100 Manyen Quiz Hunter', console: 'PlayStation' },
  { id: '10101-will-the-starship-playstation', title: '10101: "Will" The Starship', console: 'PlayStation' },
  { id: '2nd-super-robot-wars-playstation', title: '2nd Super Robot Wars', console: 'PlayStation' },
  { id: '3rd-super-robot-wars-playstation', title: '3rd Super Robot Wars', console: 'PlayStation' },
  { id: '3-3-eyes-tenrin-o-genmu-playstation', title: "3×3 Eyes Tenrin' ō Genmu", console: 'PlayStation' },
  { id: '3-3-eyes-kyusei-koshu-playstation', title: '3×3 Eyes: Kyūsei Kōshu', console: 'PlayStation' },
  { id: 'a-bug-s-life-games-workshop-playstation', title: "A Bug's Life: Games Workshop", console: 'PlayStation' },
  { id: 'actua-golf-2-playstation', title: 'Actua Golf 2', console: 'PlayStation' },
  { id: 'adibou-et-l-ombre-verte-playstation', title: "Adibou et l'Ombre verte", console: 'PlayStation' },
  { id: 'air-hockey-playstation', title: 'Air Hockey', console: 'PlayStation' },
  { id: 'aitakute-your-smiles-in-my-heart-playstation', title: 'Aitakute...Your Smiles in My Heart', console: 'PlayStation' },
  { id: 'all-star-racing-2-playstation', title: 'All-Star Racing 2', console: 'PlayStation' },
  { id: 'alnam-no-kiba-juzoku-junishinto-densetsu-playstation', title: 'Alnam no Kiba: Jūzoku Jūnishinto Densetsu', console: 'PlayStation' },
  { id: 'alnam-no-tsubasa-shoujin-no-sora-no-kanata-e-playstation', title: 'Alnam no Tsubasa: Shoujin no Sora no Kanata e', console: 'PlayStation' },
  { id: 'angelique-tenku-no-requiem-playstation', title: 'Angelique Tenkū no Requiem', console: 'PlayStation' },
  { id: 'ao-no-6-gou-antarctica-playstation', title: 'Ao No 6-Gou: Antarctica', console: 'PlayStation' },
  { id: 'apocalypse-playstation', title: 'Apocalypse', console: 'PlayStation' },
  { id: 'hack-g-u-vol-1-rebirth-playstation-2', title: '.hack//G.U. Vol. 1//Rebirth', console: 'PlayStation 2' },
  { id: 'hack-g-u-vol-2-reminisce-playstation-2', title: '.hack//G.U. Vol. 2//Reminisce', console: 'PlayStation 2' },
  { id: 'hack-g-u-vol-3-redemption-playstation-2', title: '.hack//G.U. Vol. 3//Redemption', console: 'PlayStation 2' },
  { id: '120-en-no-haru-120-yen-stories-playstation-2', title: '120-en no Haru: 120 Yen Stories', console: 'PlayStation 2' },
  { id: '2nd-super-robot-wars-alpha-playstation-2', title: '2nd Super Robot Wars Alpha', console: 'PlayStation 2' },
  { id: '3rd-super-robot-wars-alpha-to-the-end-of-the-galaxy-playstation-2', title: '3rd Super Robot Wars Alpha: To the End of the Galaxy', console: 'PlayStation 2' },
  { id: 'abarenbo-princess-playstation-2', title: 'Abarenbō Princess', console: 'PlayStation 2' },
  { id: '16-tile-mah-jongg-sega-genesis', title: '16-Tile Mah Jongg', console: 'Sega Genesis' },
  { id: '3-ninjas-kick-back-sega-genesis', title: '3 Ninjas Kick Back', console: 'Sega Genesis' },
  { id: 'a-q-renkan-awa-sega-genesis', title: 'A Q Renkan Awa', console: 'Sega Genesis' },
  { id: 'andre-agassi-tennis-sega-genesis', title: 'Andre Agassi Tennis', console: 'Sega Genesis' },
  { id: 'anetto-futatabi-sega-genesis', title: 'Anetto Futatabi', console: 'Sega Genesis' },
  { id: 'asterix-and-the-power-of-the-gods-sega-genesis', title: 'Asterix and the Power of the Gods', console: 'Sega Genesis' },
  { id: 'awogue-sega-genesis', title: 'Awogue', console: 'Sega Genesis' },
  { id: 'barbie-super-model-sega-genesis', title: 'Barbie: Super Model', console: 'Sega Genesis' },
  { id: 'battle-mania-daiginjo-sega-genesis', title: 'Battle Mania Daiginjō', console: 'Sega Genesis' },
  { id: 'bio-evil-sega-mega-drive-tech-demo-sega-genesis', title: 'Bio Evil ® (SEGA Mega Drive Tech Demo)', console: 'Sega Genesis' },
  { id: 'bonkers-sega-genesis', title: 'Bonkers', console: 'Sega Genesis' },
  { id: 'bugs-bunny-in-double-trouble-sega-genesis', title: 'Bugs Bunny in Double Trouble', console: 'Sega Genesis' },
  { id: 'story-of-thor-sega-genesis', title: 'The Story of Thor', console: 'Sega Genesis' },
  { id: '3-3-eyes-kyusei-koshu-sega-saturn', title: '3×3 Eyes: Kyūsei Kōshu', console: 'Sega Saturn' },
  { id: 'black-dawn-sega-saturn', title: 'Black Dawn', console: 'Sega Saturn' },
  { id: 'blue-seed-the-secret-records-of-kushinada-sega-saturn', title: 'Blue Seed: The Secret Records of Kushinada', console: 'Sega Saturn' },
  { id: 'daiboken-saint-elmo-s-no-kiseki-sega-saturn', title: "Daibōken: Saint Elmo's no Kiseki", console: 'Sega Saturn' },
  { id: 'daytona-usa-c-c-e-net-link-edition-sega-saturn', title: 'Daytona USA C.C.E. Net Link Edition', console: 'Sega Saturn' },
  { id: 'derby-stallion-sega-saturn', title: 'Derby Stallion', console: 'Sega Saturn' },
  { id: 'discworld-ii-missing-presumed-sega-saturn', title: 'Discworld II: Missing Presumed...!?', console: 'Sega Saturn' },
  { id: '3-ninjas-kick-back-super-nintendo', title: '3 Ninjas Kick Back', console: 'Super Nintendo' },
  { id: '3rd-super-robot-wars-super-nintendo', title: '3rd Super Robot Wars', console: 'Super Nintendo' },
  { id: '3-3-eyes-juma-hokan-super-nintendo', title: '3×3 Eyes: Jūma Hōkan', console: 'Super Nintendo' },
  { id: '3-3-eyes-seima-korinden-super-nintendo', title: '3×3 Eyes: Seima Kōrinden', console: 'Super Nintendo' },
  { id: 'ancient-magic-bazoe-mahou-sekai-super-nintendo', title: 'Ancient Magic: Bazoe! Mahou Sekai', console: 'Super Nintendo' },
  { id: 'andre-agassi-tennis-super-nintendo', title: 'Andre Agassi Tennis', console: 'Super Nintendo' },
  { id: 'appleseed-super-nintendo', title: 'Appleseed', console: 'Super Nintendo' },
  { id: 'arabian-nights-sabaku-no-seirei-o-super-nintendo', title: 'Arabian Nights: Sabaku no Seirei-ō', console: 'Super Nintendo' },
  { id: 'armored-police-metal-jack-super-nintendo', title: 'Armored Police Metal Jack', console: 'Super Nintendo' },
  { id: 'bakushou-kinsey-gekijou-super-nintendo', title: 'Bakushou!! Kinsey Gekijou', console: 'Super Nintendo' },
  { id: 'barbie-super-model-super-nintendo', title: 'Barbie: Super Model', console: 'Super Nintendo' },
  { id: 'bishojo-senshi-sailor-moon-another-story-super-nintendo', title: 'Bishōjo Senshi Sailor Moon: Another Story', console: 'Super Nintendo' },
  { id: 'bonkers-super-nintendo', title: 'Bonkers', console: 'Super Nintendo' },
  { id: 'dicing-knight-period-wonderswan', title: 'Dicing Knight Period', console: 'WonderSwan' },
]

// --- HTTP helpers ---

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': headers['Content-Type'] || 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// --- Token fetch ---

async function fetchToken() {
  const body = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
  const res = await httpsPost(
    'https://id.twitch.tv/oauth2/token',
    body,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  )
  if (res.status !== 200 || !res.body.access_token) {
    throw new Error(`Token fetch failed: ${JSON.stringify(res.body)}`)
  }
  return res.body.access_token
}

// --- IGDB search ---

function simplifyTitle(title) {
  // Remove special chars and accents for searching
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^\w\s]/g, ' ')        // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Loose title similarity check.
 * Requires that the IGDB result name shares at least one meaningful word
 * (length >= 3) with the expected title. This filters out pure false positives
 * like "4 Pics 1 Word" matching "4 in 1 Funpak".
 */
function isTitleMatch(expectedTitle, igdbName) {
  // Words too generic to be meaningful title identifiers
  const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'vol', 'de', 'no', 'ne', 'un',
    'game', 'story', 'eyes', 'bug', 'age', 'war', 'new', 'all',
    'one', 'two', 'big', 'star', 'life', 'side', 'plus',
  ])
  const normalize = (s) =>
    s.toLowerCase()
     .normalize('NFD')
     .replace(/[\u0300-\u036f]/g, '')
     .replace(/[^\w\s]/g, ' ')
     .replace(/\s+/g, ' ')
     .trim()

  // Require meaningful words of length >= 4 (avoids single-word false matches like "bug" or "eye")
  const expectedWords = normalize(expectedTitle).split(' ').filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  const igdbWords = new Set(normalize(igdbName).split(' ').filter((w) => w.length >= 4 && !STOP_WORDS.has(w)))

  if (expectedWords.length === 0) return false

  // At least one meaningful word from expected title must appear as a whole word in IGDB name
  return expectedWords.some((w) => igdbWords.has(w))
}

async function searchIGDB(token, title, platformId) {
  const simplified = simplifyTitle(title)
  // Try with platform filter first
  const query = `fields name,cover.image_id,platforms.name,platforms.id; search "${simplified}"; where platforms = (${platformId}); limit 3;`
  const res = await httpsPost(
    'https://api.igdb.com/v4/games',
    query,
    {
      'Content-Type': 'text/plain',
      'Client-ID': CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    }
  )
  if (res.status !== 200) {
    throw new Error(`IGDB error ${res.status}: ${JSON.stringify(res.body)}`)
  }
  const results = res.body
  // Find first result with a cover AND a plausible title match
  const withCover = results.find((r) => r.cover && r.cover.image_id && isTitleMatch(title, r.name))
  if (withCover) return withCover

  // Fallback: try first 2-3 words without platform filter
  const shortTitle = simplified.split(' ').slice(0, 3).join(' ')
  const query2 = `fields name,cover.image_id,platforms.name,platforms.id; search "${shortTitle}"; limit 3;`
  await sleep(250)
  const res2 = await httpsPost(
    'https://api.igdb.com/v4/games',
    query2,
    {
      'Content-Type': 'text/plain',
      'Client-ID': CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    }
  )
  if (res2.status !== 200) {
    throw new Error(`IGDB error ${res2.status}: ${JSON.stringify(res2.body)}`)
  }
  return res2.body.find((r) => r.cover && r.cover.image_id && isTitleMatch(title, r.name)) || null
}

// --- DB writes ---

function applyToDB(db, gameId, coverUrl) {
  // Update games.cover_url
  db.prepare('UPDATE games SET cover_url = ? WHERE id = ?').run(coverUrl, gameId)

  // Upsert into media_references (insert or ignore if already exists for this game+type)
  const existing = db.prepare(
    "SELECT id FROM media_references WHERE entity_type='game' AND entity_id=? AND media_type='cover'"
  ).get(gameId)

  if (!existing) {
    db.prepare(`
      INSERT INTO media_references
        (entity_type, entity_id, media_type, url, provider, compliance_status,
         storage_mode, license_status, ui_allowed, healthcheck_status, source_context)
      VALUES
        ('game', ?, 'cover', ?, 'igdb', 'approved_with_review',
         'external_reference', 'reference_only', 1, 'unchecked', 'igdb_cover_fetch')
    `).run(gameId, coverUrl)
  } else {
    db.prepare(
      "UPDATE media_references SET url=?, provider='igdb', source_context='igdb_cover_fetch', updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).run(coverUrl, existing.id)
  }
}

// --- Main ---

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Processing ${GAMES.length} games...\n`)

  const token = await fetchToken()
  console.log('IGDB token obtained.\n')

  const db = APPLY ? new Database(DB_PATH) : null

  const found = []
  const notFound = []

  for (const game of GAMES) {
    const platformId = PLATFORM_IDS[game.console]
    if (!platformId) {
      console.log(`[SKIP]  ${game.id} — unknown platform: ${game.console}`)
      notFound.push({ ...game, reason: 'unknown platform' })
      continue
    }

    try {
      const result = await searchIGDB(token, game.title, platformId)
      if (result && result.cover && result.cover.image_id) {
        const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${result.cover.image_id}.jpg`
        console.log(`[FOUND] ${game.id}`)
        console.log(`        IGDB match: "${result.name}" → ${coverUrl}`)
        found.push({ ...game, coverUrl, igdbName: result.name })

        if (APPLY && db) {
          applyToDB(db, game.id, coverUrl)
          console.log(`        Written to DB.`)
        }
      } else {
        console.log(`[MISS]  ${game.id} — no cover found on IGDB`)
        notFound.push({ ...game, reason: 'no IGDB result with cover' })
      }
    } catch (err) {
      console.error(`[ERR]   ${game.id} — ${err.message}`)
      notFound.push({ ...game, reason: `error: ${err.message}` })
    }

    await sleep(250)
  }

  if (db) db.close()

  console.log('\n========== SUMMARY ==========')
  console.log(`Found:     ${found.length}`)
  console.log(`Not found: ${notFound.length}`)

  if (notFound.length > 0) {
    console.log('\nGames not found:')
    for (const g of notFound) {
      console.log(`  - ${g.id} (${g.console}) [${g.reason}]`)
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
