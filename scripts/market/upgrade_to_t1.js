'use strict'

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '../..')
const sequelize = require(path.join(ROOT, 'backend', 'config', 'database'))
const RetrodexIndex = require(path.join(ROOT, 'backend', 'models', 'RetrodexIndex'))
const { Op } = require(path.join(ROOT, 'backend', 'node_modules', 'sequelize'))

function getFreshnessMultiplier(lastDate) {
  if (!lastDate) return 0.5

  const parsed = new Date(lastDate)
  if (Number.isNaN(parsed.getTime())) return 0.5

  const days = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  if (days < 30) return 1.0
  if (days < 90) return 0.85
  if (days < 180) return 0.7
  if (days < 365) return 0.5
  return 0.3
}

async function main() {
  await RetrodexIndex.sync({ alter: false })

  const dataDir = path.join(ROOT, 'data')
  const priceFiles = fs.readdirSync(dataDir)
    .filter((file) => {
      if (!file.endsWith('.json')) return false
      if (file === 'prices_editorial.json') return true
      if (file.startsWith('prices_epic_batch')) return true
      if (file.startsWith('prices_t1_batch')) return true
      return false
    })

  console.log(`[INFO] ${priceFiles.length} fichiers prices trouves`)

  let upgraded = 0
  let notFound = 0

  for (const file of priceFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
    const items = data.items || []

    for (const item of items) {
      if (!item.id || !item.conditions) continue

      for (const [condKey, condData] of Object.entries(item.conditions)) {
        const condition = condKey === 'loose'
          ? 'Loose'
          : condKey === 'cib'
            ? 'CIB'
            : condKey === 'mint'
              ? 'Mint'
              : null

        if (!condition || !condData.median) continue

        const existing = await RetrodexIndex.findOne({
          where: {
            item_id: item.id,
            condition,
          }
        })

        const latestSaleDate = Array.isArray(condData.sales) && condData.sales.length
          ? condData.sales
            .map((sale) => sale.date)
            .filter(Boolean)
            .sort()
            .at(-1)
          : null

        const freshnessDate = latestSaleDate || existing?.last_sale_date || existing?.last_computed_at || null
        const adjustedConfidence = Math.round(85 * getFreshnessMultiplier(freshnessDate))

        const updated = await RetrodexIndex.update({
          confidence_pct: adjustedConfidence,
          index_value: condData.median,
          range_low: Math.round(condData.median * 0.8 * 100) / 100,
          range_high: Math.round(condData.median * 1.25 * 100) / 100,
          sources_editorial: condData.sampleCount || 5,
          sample_count: condData.sampleCount || 5,
          last_sale_date: latestSaleDate || existing?.last_sale_date || null,
          last_computed_at: new Date()
        }, {
          where: {
            item_id: item.id,
            condition
          }
        })

        if (updated[0] > 0) upgraded += 1
        else notFound += 1
      }
    }
  }

  const t1 = await RetrodexIndex.count({ where: { confidence_pct: { [Op.gte]: 60 } } })
  const t3 = await RetrodexIndex.count({ where: { confidence_pct: { [Op.between]: [25, 59] } } })
  const t4 = await RetrodexIndex.count({ where: { confidence_pct: { [Op.lt]: 25 } } })

  console.log('\n========================================')
  console.log('RESUME UPGRADE T1')
  console.log('========================================')
  console.log(`  Upgrades vers T1 : ${upgraded}`)
  console.log(`  Non trouves      : ${notFound}`)
  console.log(`  T1 en base       : ${t1}`)
  console.log(`  T3 en base       : ${t3}`)
  console.log(`  T4 en base       : ${t4}`)

  await sequelize.close()
}

main().catch(async (err) => {
  console.error('[FATAL]', err.message)
  try {
    await sequelize.close()
  } catch (_error) {}
  process.exit(1)
})
