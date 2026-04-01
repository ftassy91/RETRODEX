// SYNC: B1 - migre le 2026-03-23 - regressions recherche et collection alignees sur Supabase
// Decision source : SYNC.md Â§ B1
const request = require('supertest')

const app = require('../src/server')
const { buildSearchResultDedupeKey } = require('../src/helpers/search')

afterAll(async () => {
  const sequelize = require('../config/database')
  await sequelize.close()
})

describe('API RetroDex', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('GET /api/games retourne items', async () => {
    const res = await request(app).get('/api/games?limit=3')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  test('GET /api/franchises retourne des donnees', async () => {
    const res = await request(app).get('/api/franchises')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items || res.body.franchises)).toBe(true)
  })

  test('GET /api/search fonctionne', async () => {
    const res = await request(app).get('/api/search?q=mario&limit=5')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)
  })

  test('GET /api/search supporte la recherche par annee', async () => {
    const res = await request(app).get('/api/search?q=1998&type=game&limit=5')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results.length).toBeGreaterThan(0)
    expect(res.body.results.some((item) => String(item.year) === '1998')).toBe(true)
  })

  test('GET /api/search retire les doublons stricts de jeux', async () => {
    const res = await request(app).get('/api/search?q=zel&type=game&limit=20')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)

    const keys = res.body.results.map((item) => buildSearchResultDedupeKey(item))
    expect(new Set(keys).size).toBe(keys.length)

    const majorasMask = res.body.results.filter((item) => item.title === "The Legend of Zelda: Majora's Mask")
    expect(majorasMask).toHaveLength(1)
  })

  test('GET /api/search preserve les variantes multi-plateformes legitimes', async () => {
    const res = await request(app).get('/api/search?q=fifa world cup&type=game&limit=20')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)

    const worldCup2002 = res.body.results.filter((item) => item.title === '2002 FIFA World Cup')
    expect(worldCup2002.length).toBeGreaterThan(1)
    expect(new Set(worldCup2002.map((item) => item.console)).size).toBeGreaterThan(1)
  })

  test('GET /api/games/:id/price-history expose des series reelles par etat', async () => {
    const res = await request(app).get('/api/games/alien-soldier-sega-genesis/price-history')
    expect(res.status).toBe(200)
    expect(res.body.gameId).toBe('alien-soldier-sega-genesis')
    expect(res.body.series.loose.available).toBe(true)
    expect(res.body.series.loose.points.length).toBeGreaterThanOrEqual(2)
    expect(res.body.series.cib.available).toBe(false)
    expect(res.body.series.mint.available).toBe(false)
    expect(Array.isArray(res.body.availableSeries)).toBe(true)
    expect(res.body.availableSeries).toContain('loose')
    expect(res.body.missingSeries).toContain('cib')
    expect(res.body.periods.map((period) => period.id)).toEqual(['1m', '6m', '1y', 'all'])
  })

  test('GET /api/games/:id/price-history ne fabrique pas de courbes pour les jeux sans observations', async () => {
    const res = await request(app).get('/api/games/tetris-game-boy/price-history')
    expect(res.status).toBe(200)
    expect(res.body.hasAnyHistory).toBe(false)
    expect(res.body.series.loose.points).toHaveLength(0)
    expect(res.body.series.cib.points).toHaveLength(0)
    expect(res.body.series.mint.points).toHaveLength(0)
  })

  test('GET /api/stats retourne les metriques enrichies', async () => {
    const res = await request(app).get('/api/stats')
    expect(res.status).toBe(200)
    expect(typeof res.body.total_games).toBe('number')
    expect(res.body.trust_stats).toBeDefined()
    expect(typeof res.body.trust_stats.t1).toBe('number')
    expect(Array.isArray(res.body.by_platform)).toBe(true)
  })

  test('GET /api/games?sort=rarity_desc place un jeu LEGENDARY en tete', async () => {
    const res = await request(app).get('/api/games?sort=rarity_desc&limit=5')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.items[0].rarity).toBe('LEGENDARY')
  })

  test('GET /api/games?sort=price_desc place le loosePrice le plus eleve en tete', async () => {
    const res = await request(app).get('/api/games?sort=price_desc&limit=5')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items.length).toBeGreaterThan(1)

    const prices = res.body.items.map((item) => Number(item.loosePrice || 0))
    expect(prices[0]).toBe(Math.max(...prices))
  })

  test("GET /api/search?q=mario place un resultat contenant mario en tete", async () => {
    const res = await request(app).get('/api/search?q=mario&limit=5')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results.length).toBeGreaterThan(0)

    const firstLabel = String(res.body.results[0].name || res.body.results[0].title || '').toLowerCase()
    expect(firstLabel).toContain('mario')
  })

  test('GET /api/games et GET /api/stats exposent le meme total de jeux', async () => {
    const [gamesRes, statsRes] = await Promise.all([
      request(app).get('/api/games?limit=1'),
      request(app).get('/api/stats'),
    ])

    expect(gamesRes.status).toBe(200)
    expect(statsRes.status).toBe(200)
    expect(gamesRes.body.total).toBe(statsRes.body.total_games)
  })

  test('GET /api/games/:id renvoie un tagline ponctue ou null', async () => {
    const res = await request(app).get('/api/games/panzer-dragoon-saga-sega-saturn')
    expect(res.status).toBe(200)

    const { tagline } = res.body
    if (tagline == null) {
      expect(tagline).toBeNull()
      return
    }

    expect(typeof tagline).toBe('string')
    expect(/[.!?]\s*$/.test(tagline)).toBe(true)
  })

  test('PATCH /api/collection/:id met a jour les metadonnees et preserve les champs omis', async () => {
    const list = await request(app).get('/api/collection')
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.items)).toBe(true)
    expect(list.body.items.length).toBeGreaterThan(0)

    const first = list.body.items[0]
    const res = await request(app)
      .patch('/api/collection/' + first.gameId)
      .send({
        condition: 'Mint',
        list_type: 'wanted',
        price_threshold: 111,
        price_paid: 44,
        purchase_date: '2025-01-15',
        personal_note: 'jest note',
        notes: 'jest patch',
      })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.item.condition).toBe('Mint')
    expect(res.body.item.list_type).toBe('wanted')
    expect(res.body.item.price_paid).toBe(44)
    expect(res.body.item.purchase_date).toBe('2025-01-15')
    expect(res.body.item.notes).toBe('jest patch')
    expect(res.body.item.price_threshold).toBe(111)
    expect(res.body.item.personal_note).toBe('jest note')

    const preserveRes = await request(app)
      .patch('/api/collection/' + first.gameId)
      .send({
        list_type: 'owned',
      })

    expect(preserveRes.status).toBe(200)
    expect(preserveRes.body.ok).toBe(true)
    expect(preserveRes.body.item.list_type).toBe('owned')
    expect(preserveRes.body.item.condition).toBe('Mint')
    expect(preserveRes.body.item.price_paid).toBe(44)
    expect(preserveRes.body.item.purchase_date).toBe('2025-01-15')
    expect(preserveRes.body.item.notes).toBe('jest patch')
    expect(preserveRes.body.item.price_threshold).toBe(111)
    expect(preserveRes.body.item.personal_note).toBe('jest note')
  })
})
