const request = require('supertest')

const app = require('../src/server')

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
})
