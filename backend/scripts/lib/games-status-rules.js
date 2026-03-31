'use strict'

const RULES_VERSION = 'phase3-games-status-v1'

const SYNTHETIC_PRICE_SOURCES = Object.freeze([
  'seed',
  'seed_local',
  'synthetic',
  'mock',
  'fixture',
])

const EDITORIAL_PRIMARY_FIELDS = Object.freeze([
  'summary',
  'synopsis',
])

const EDITORIAL_ADDITIONAL_FIELDS = Object.freeze([
  'lore',
  'gameplay_description',
  'characters',
  'dev_anecdotes',
  'cheat_codes',
  'versions',
  'avg_duration_main',
  'avg_duration_complete',
  'speedrun_wr',
])

const MEDIA_COMPLETE_TYPES = Object.freeze([
  'manual',
  'map',
  'sprite_sheet',
  'ending',
  'archive_item',
  'youtube_video',
  'screenshot',
  'scan',
])

const MEDIA_PARTIAL_FALLBACK_FIELDS = Object.freeze([
  'manual_url',
  'youtube_id',
  'archive_id',
  'cover_url',
])

const EDITORIAL_PRIMARY_MIN_LENGTH = 70
const DIVERGENCE_SAMPLE_LIMIT = 25

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function quoteSqlList(values = []) {
  return values.map((value) => quoteSqlLiteral(value)).join(', ')
}

function normalizeSql(sql) {
  return String(sql || '').replace(/\r\n/g, '\n').trim()
}

function buildStructuredPresenceSql(expression) {
  return [
    `(${expression} IS NOT NULL)`,
    `BTRIM(${expression}::text) <> ''`,
    `BTRIM(${expression}::text) NOT IN ('[]', '{}', 'null', '\"\"')`,
  ].join(' AND ')
}

function buildTextPresenceSql(expression, minimumLength = 1) {
  return `CHAR_LENGTH(BTRIM(COALESCE(${expression}, ''))) >= ${minimumLength}`
}

function buildBooleanIntSql(conditionSql) {
  return `(CASE WHEN ${conditionSql} THEN 1 ELSE 0 END)`
}

function buildStatusCountJsonSql(columnSql, allowedValues = []) {
  const valueCounts = allowedValues.map((value) => {
    return `${quoteSqlLiteral(value)}, (SELECT COUNT(*)::int FROM derived WHERE ${columnSql} = ${quoteSqlLiteral(value)})`
  })
  const otherConditionSql = allowedValues.length
    ? `${columnSql} IS NOT NULL AND ${columnSql} NOT IN (${quoteSqlList(allowedValues)})`
    : `${columnSql} IS NOT NULL`

  return `jsonb_build_object(${[
    ...valueCounts,
    `'null', (SELECT COUNT(*)::int FROM derived WHERE ${columnSql} IS NULL)`,
    `'other', (SELECT COUNT(*)::int FROM derived WHERE ${otherConditionSql})`,
  ].join(', ')})`
}

function buildDerivedGamesStatusCteSql() {
  const syntheticSourcesSql = quoteSqlList(SYNTHETIC_PRICE_SOURCES)
  const completeMediaTypesSql = quoteSqlList(MEDIA_COMPLETE_TYPES)

  const editorialSummaryPresenceSql = buildTextPresenceSql('er.summary', 1)
  const editorialSynopsisPresenceSql = buildTextPresenceSql('er.synopsis', 1)
  const editorialPrimarySubstantiveSql = `(${buildTextPresenceSql('er.summary', EDITORIAL_PRIMARY_MIN_LENGTH)} OR ${buildTextPresenceSql('er.synopsis', EDITORIAL_PRIMARY_MIN_LENGTH)})`
  const editorialLorePresenceSql = buildTextPresenceSql('er.lore', 1)
  const editorialGameplayPresenceSql = buildTextPresenceSql('er.gameplay_description', 1)
  const editorialCharactersPresenceSql = buildStructuredPresenceSql('er.characters')
  const editorialAnecdotesPresenceSql = buildStructuredPresenceSql('er.dev_anecdotes')
  const editorialCheatCodesPresenceSql = buildStructuredPresenceSql('er.cheat_codes')
  const editorialVersionsPresenceSql = buildStructuredPresenceSql('er.versions')
  const editorialDurationMainPresenceSql = '(er.avg_duration_main IS NOT NULL)'
  const editorialDurationCompletePresenceSql = '(er.avg_duration_complete IS NOT NULL)'
  const editorialSpeedrunPresenceSql = buildStructuredPresenceSql('er.speedrun_wr')

  const editorialAdditionalCountSql = [
    buildBooleanIntSql(editorialLorePresenceSql),
    buildBooleanIntSql(editorialGameplayPresenceSql),
    buildBooleanIntSql(editorialCharactersPresenceSql),
    buildBooleanIntSql(editorialAnecdotesPresenceSql),
    buildBooleanIntSql(editorialCheatCodesPresenceSql),
    buildBooleanIntSql(editorialVersionsPresenceSql),
    buildBooleanIntSql(editorialDurationMainPresenceSql),
    buildBooleanIntSql(editorialDurationCompletePresenceSql),
    buildBooleanIntSql(editorialSpeedrunPresenceSql),
  ].join(' + ')

  const editorialAnySignalSql = [
    buildBooleanIntSql(editorialSummaryPresenceSql),
    buildBooleanIntSql(editorialSynopsisPresenceSql),
    editorialAdditionalCountSql,
  ].join(' + ')

  const manualFallbackSql = buildTextPresenceSql('bg.manual_url', 1)
  const youtubeFallbackSql = buildTextPresenceSql('bg.youtube_id', 1)
  const archiveFallbackSql = buildTextPresenceSql('bg.archive_id', 1)
  const coverFallbackSql = buildTextPresenceSql('bg.cover_url', 1)

  return normalizeSql(`
WITH base_games AS (
  SELECT
    g.id,
    g.title,
    g.summary AS game_summary,
    g.synopsis AS game_synopsis,
    g.lore AS game_lore,
    g.gameplay_description AS game_gameplay_description,
    g.characters AS game_characters,
    g.dev_anecdotes AS game_dev_anecdotes,
    g.cheat_codes AS game_cheat_codes,
    g.versions AS game_versions,
    g.avg_duration_main AS game_avg_duration_main,
    g.avg_duration_complete AS game_avg_duration_complete,
    g.speedrun_wr AS game_speedrun_wr,
    g.manual_url,
    g.cover_url,
    g.youtube_id,
    g.archive_id,
    g.editorial_status AS stored_editorial_status,
    g.media_status AS stored_media_status,
    g.price_status AS stored_price_status
  FROM public.games g
  WHERE g.type = 'game'
),
editorial_rows AS (
  SELECT
    bg.id,
    COALESCE(NULLIF(BTRIM(ge.summary), ''), NULLIF(BTRIM(bg.game_summary), '')) AS summary,
    COALESCE(NULLIF(BTRIM(ge.synopsis), ''), NULLIF(BTRIM(bg.game_synopsis), '')) AS synopsis,
    COALESCE(NULLIF(BTRIM(ge.lore), ''), NULLIF(BTRIM(bg.game_lore), '')) AS lore,
    COALESCE(NULLIF(BTRIM(ge.gameplay_description), ''), NULLIF(BTRIM(bg.game_gameplay_description), '')) AS gameplay_description,
    COALESCE(NULLIF(BTRIM(ge.characters::text), ''), NULLIF(BTRIM(bg.game_characters::text), '')) AS characters,
    COALESCE(NULLIF(BTRIM(ge.dev_anecdotes::text), ''), NULLIF(BTRIM(bg.game_dev_anecdotes::text), '')) AS dev_anecdotes,
    COALESCE(NULLIF(BTRIM(ge.cheat_codes::text), ''), NULLIF(BTRIM(bg.game_cheat_codes::text), '')) AS cheat_codes,
    COALESCE(NULLIF(BTRIM(ge.versions::text), ''), NULLIF(BTRIM(bg.game_versions::text), '')) AS versions,
    COALESCE(ge.avg_duration_main, bg.game_avg_duration_main) AS avg_duration_main,
    COALESCE(ge.avg_duration_complete, bg.game_avg_duration_complete) AS avg_duration_complete,
    COALESCE(NULLIF(BTRIM(ge.speedrun_wr::text), ''), NULLIF(BTRIM(bg.game_speedrun_wr::text), '')) AS speedrun_wr
  FROM base_games bg
  LEFT JOIN public.game_editorial ge ON ge.game_id = bg.id
),
editorial_signals AS (
  SELECT
    er.id AS game_id,
    ${editorialAdditionalCountSql} AS additional_signal_count,
    (${editorialAnySignalSql}) AS total_signal_count,
    ${editorialPrimarySubstantiveSql} AS primary_is_substantive
  FROM editorial_rows er
),
visible_media AS (
  SELECT
    mr.entity_id AS game_id,
    LOWER(COALESCE(mr.media_type, '')) AS media_type
  FROM public.media_references mr
  WHERE mr.entity_type = 'game'
    AND COALESCE(mr.ui_allowed, true) = true
    AND LOWER(COALESCE(mr.license_status, 'reference_only')) <> 'blocked'
    AND LOWER(COALESCE(mr.healthcheck_status, 'ok')) NOT IN ('broken', 'timeout')
),
media_agg AS (
  SELECT
    bg.id AS game_id,
    COUNT(vm.media_type)::int AS visible_media_count,
    COUNT(DISTINCT CASE WHEN vm.media_type IN (${completeMediaTypesSql}) THEN vm.media_type END)::int
      + ${buildBooleanIntSql(`(${manualFallbackSql} AND NOT EXISTS (SELECT 1 FROM visible_media vm2 WHERE vm2.game_id = bg.id AND vm2.media_type = 'manual'))`)}
      + ${buildBooleanIntSql(`(${youtubeFallbackSql} AND NOT EXISTS (SELECT 1 FROM visible_media vm3 WHERE vm3.game_id = bg.id AND vm3.media_type = 'youtube_video'))`)}
      + ${buildBooleanIntSql(`(${archiveFallbackSql} AND NOT EXISTS (SELECT 1 FROM visible_media vm4 WHERE vm4.game_id = bg.id AND vm4.media_type = 'archive_item'))`)}
      AS complete_signal_count,
    ${manualFallbackSql} AS has_manual_fallback,
    ${youtubeFallbackSql} AS has_youtube_fallback,
    ${archiveFallbackSql} AS has_archive_fallback,
    ${coverFallbackSql} AS has_cover_fallback
  FROM base_games bg
  LEFT JOIN visible_media vm ON vm.game_id = bg.id
  GROUP BY bg.id, bg.manual_url, bg.youtube_id, bg.archive_id, bg.cover_url
),
price_agg AS (
  SELECT
    bg.id AS game_id,
    COUNT(ph.game_id)::int AS price_row_count,
    COALESCE(BOOL_OR(COALESCE(LOWER(ph.source), '') NOT IN (${syntheticSourcesSql})), false) AS has_real_source
  FROM base_games bg
  LEFT JOIN public.price_history ph ON ph.game_id = bg.id
  GROUP BY bg.id
),
derived AS (
  SELECT
    bg.id,
    bg.title,
    bg.stored_editorial_status,
    bg.stored_media_status,
    bg.stored_price_status,
    CASE
      WHEN es.primary_is_substantive AND es.additional_signal_count >= 2 THEN 'complete'
      WHEN es.total_signal_count > 0 THEN 'partial'
      ELSE 'empty'
    END AS derived_editorial_status,
    CASE
      WHEN ma.complete_signal_count >= 2 THEN 'complete'
      WHEN ma.visible_media_count > 0
        OR ma.has_manual_fallback
        OR ma.has_youtube_fallback
        OR ma.has_archive_fallback
        OR ma.has_cover_fallback
      THEN 'partial'
      ELSE 'empty'
    END AS derived_media_status,
    CASE
      WHEN pa.has_real_source THEN 'real'
      WHEN pa.price_row_count > 0 THEN 'synthetic'
      ELSE 'empty'
    END AS derived_price_status
  FROM base_games bg
  LEFT JOIN editorial_signals es ON es.game_id = bg.id
  LEFT JOIN media_agg ma ON ma.game_id = bg.id
  LEFT JOIN price_agg pa ON pa.game_id = bg.id
)
`)
}

function buildStatusPreviewSql() {
  const derivedEditorialCounts = buildStatusCountJsonSql('derived_editorial_status', ['complete', 'partial', 'empty'])
  const derivedMediaCounts = buildStatusCountJsonSql('derived_media_status', ['complete', 'partial', 'empty'])
  const derivedPriceCounts = buildStatusCountJsonSql('derived_price_status', ['real', 'synthetic', 'empty'])
  const storedEditorialCounts = buildStatusCountJsonSql('stored_editorial_status', ['complete', 'partial', 'empty'])
  const storedMediaCounts = buildStatusCountJsonSql('stored_media_status', ['complete', 'partial', 'empty'])
  const storedPriceCounts = buildStatusCountJsonSql('stored_price_status', ['real', 'synthetic', 'empty'])

  return normalizeSql(`
-- GENERATED FROM backend/scripts/lib/games-status-rules.js
-- DO NOT EDIT THIS FILE MANUALLY.
${buildDerivedGamesStatusCteSql()}
SELECT jsonb_build_object(
  'rulesVersion', ${quoteSqlLiteral(RULES_VERSION)},
  'totalGamesAudited', (SELECT COUNT(*)::int FROM derived),
  'derivedCounts', jsonb_build_object(
    'editorial_status', ${derivedEditorialCounts},
    'media_status', ${derivedMediaCounts},
    'price_status', ${derivedPriceCounts}
  ),
  'storedCounts', jsonb_build_object(
    'editorial_status', ${storedEditorialCounts},
    'media_status', ${storedMediaCounts},
    'price_status', ${storedPriceCounts}
  ),
  'divergenceCounts', jsonb_build_object(
    'editorial_status', (SELECT COUNT(*)::int FROM derived WHERE stored_editorial_status IS DISTINCT FROM derived_editorial_status),
    'media_status', (SELECT COUNT(*)::int FROM derived WHERE stored_media_status IS DISTINCT FROM derived_media_status),
    'price_status', (SELECT COUNT(*)::int FROM derived WHERE stored_price_status IS DISTINCT FROM derived_price_status),
    'any_status', (SELECT COUNT(*)::int FROM derived WHERE stored_editorial_status IS DISTINCT FROM derived_editorial_status OR stored_media_status IS DISTINCT FROM derived_media_status OR stored_price_status IS DISTINCT FROM derived_price_status)
  ),
  'missingDerivedCount', (
    SELECT COUNT(*)::int
    FROM derived
    WHERE derived_editorial_status IS NULL
       OR derived_media_status IS NULL
       OR derived_price_status IS NULL
  ),
  'allGamesHaveDerivedStatuses', (
    SELECT COUNT(*) = 0
    FROM derived
    WHERE derived_editorial_status IS NULL
       OR derived_media_status IS NULL
       OR derived_price_status IS NULL
  ),
  'divergenceSamples', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', sample.id,
        'title', sample.title,
        'stored', jsonb_build_object(
          'editorial_status', sample.stored_editorial_status,
          'media_status', sample.stored_media_status,
          'price_status', sample.stored_price_status
        ),
        'derived', jsonb_build_object(
          'editorial_status', sample.derived_editorial_status,
          'media_status', sample.derived_media_status,
          'price_status', sample.derived_price_status
        )
      )
    )
    FROM (
      SELECT *
      FROM derived
      WHERE stored_editorial_status IS DISTINCT FROM derived_editorial_status
         OR stored_media_status IS DISTINCT FROM derived_media_status
         OR stored_price_status IS DISTINCT FROM derived_price_status
      ORDER BY id ASC
      LIMIT ${DIVERGENCE_SAMPLE_LIMIT}
    ) AS sample
  ), '[]'::jsonb)
) AS report;
`)
}

function buildStatusApplySql() {
  return normalizeSql(`
-- GENERATED FROM backend/scripts/lib/games-status-rules.js
-- DO NOT EDIT THIS FILE MANUALLY.
-- PREPARED ONLY. DO NOT EXECUTE IN PRODUCTION WITHOUT EXPLICIT HUMAN VALIDATION.
${buildDerivedGamesStatusCteSql()}
UPDATE public.games AS g
SET
  editorial_status = d.derived_editorial_status,
  media_status = d.derived_media_status,
  price_status = d.derived_price_status
FROM derived AS d
WHERE g.id = d.id
  AND (
    g.editorial_status IS DISTINCT FROM d.derived_editorial_status
    OR g.media_status IS DISTINCT FROM d.derived_media_status
    OR g.price_status IS DISTINCT FROM d.derived_price_status
  );
`)
}

function buildRulesDocFragment() {
  const editorialAdditionalList = EDITORIAL_ADDITIONAL_FIELDS.map((field) => `- \`${field}\``).join('\n')
  const mediaCompleteList = MEDIA_COMPLETE_TYPES.map((field) => `- \`${field}\``).join('\n')
  const mediaFallbackList = MEDIA_PARTIAL_FALLBACK_FIELDS.map((field) => `- \`${field}\``).join('\n')
  const syntheticSourcesList = SYNTHETIC_PRICE_SOURCES.map((field) => `- \`${field}\``).join('\n')

  return [
    '## Canonical Status Rules',
    '',
    `Rules version: \`${RULES_VERSION}\``,
    '',
    '### `editorial_status`',
    '',
    '- `complete` if `summary` or `synopsis` is substantive (minimum 70 chars) and at least 2 additional signals exist among:',
    editorialAdditionalList,
    '- `partial` if at least one editorial signal exists',
    '- `empty` otherwise',
    '',
    '### `media_status`',
    '',
    '- `complete` if at least 2 distinct media signals exist among:',
    mediaCompleteList,
    '- `partial` if at least one visible media signal exists, including fallback via:',
    mediaFallbackList,
    '- visible media rows exclude `ui_allowed = false`, `license_status = blocked`, and `healthcheck_status IN (broken, timeout)`',
    '- `empty` otherwise',
    '',
    '### `price_status`',
    '',
    '- `real` if at least one `price_history` row exists with a non-synthetic source',
    '- `synthetic` if `price_history` rows exist but only with synthetic sources',
    '- `empty` otherwise',
    '',
    '### `SYNTHETIC_PRICE_SOURCES`',
    '',
    syntheticSourcesList,
    '',
    '- `pricecharting` is treated as `real`',
  ].join('\n')
}

module.exports = {
  RULES_VERSION,
  SYNTHETIC_PRICE_SOURCES,
  EDITORIAL_PRIMARY_FIELDS,
  EDITORIAL_ADDITIONAL_FIELDS,
  MEDIA_COMPLETE_TYPES,
  MEDIA_PARTIAL_FALLBACK_FIELDS,
  EDITORIAL_PRIMARY_MIN_LENGTH,
  DIVERGENCE_SAMPLE_LIMIT,
  normalizeSql,
  buildDerivedGamesStatusCteSql,
  buildStatusPreviewSql,
  buildStatusApplySql,
  buildRulesDocFragment,
}
