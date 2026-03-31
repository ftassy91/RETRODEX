'use strict'

const fs = require('fs')
const path = require('path')

const {
  buildStatusPreviewSql,
  buildStatusApplySql,
} = require('./lib/games-status-rules')

const OUTPUT_DIR = path.join(__dirname, '..', 'migrations', '_pending_review')
const PREVIEW_PATH = path.join(OUTPUT_DIR, '20260331_009_games_status_backfill_preview.sql')
const APPLY_PATH = path.join(OUTPUT_DIR, '20260331_010_games_status_backfill_apply.sql')

function writeFile(targetPath, content) {
  fs.writeFileSync(targetPath, `${content}\n`, 'utf8')
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  writeFile(PREVIEW_PATH, buildStatusPreviewSql())
  writeFile(APPLY_PATH, buildStatusApplySql())

  console.log(JSON.stringify({
    ok: true,
    previewPath: PREVIEW_PATH,
    applyPath: APPLY_PATH,
  }, null, 2))
}

main()
