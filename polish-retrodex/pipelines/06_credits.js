#!/usr/bin/env node
'use strict';

const path = require('path');

const {
  CANONICAL_DIR,
  ensureWorkspace,
  writeJson,
} = require('./_shared');
const {
  buildConfidenceMeta,
  buildPipelinePaths,
  formatOutputPath,
  indexCompanies,
  indexPeople,
  loadEnrichedRows,
  openSourceDb,
  resolveLatestEnrichedFile,
  slugifyValue,
  writePipelineArtifacts,
} = require('./_domain_shared');
const {
  loadEncyclopediaSeedMap,
} = require('./_source_enrichment');

const DEV_TEAM_ROLES = new Set(['developer', 'director', 'producer', 'artist', 'composer', 'designer', 'writer']);

function resolveInputPath() {
  const explicit = process.argv.slice(2).find((arg) => arg.startsWith('--input='));
  if (explicit) {
    return path.resolve(process.cwd(), explicit.slice('--input='.length));
  }
  return resolveLatestEnrichedFile();
}

function loadGamePeople(db) {
  return db.prepare(`
    SELECT
      gp.game_id AS gameId,
      gp.role,
      gp.confidence,
      gp.is_inferred AS isInferred,
      gp.person_id AS personId,
      p.name,
      p.normalized_name AS normalizedName,
      p.primary_role AS primaryRole,
      sr.source_name AS sourceName,
      sr.source_type AS sourceType,
      sr.source_url AS sourceUrl,
      sr.compliance_status AS complianceStatus,
      sr.confidence_level AS sourceConfidence
    FROM game_people gp
    LEFT JOIN people p ON p.id = gp.person_id
    LEFT JOIN source_records sr ON sr.id = gp.source_record_id
  `).all();
}

function buildCreditEntry(row) {
  return {
    personId: row.personId,
    name: row.name || row.normalizedName || null,
    normalizedName: row.normalizedName || null,
    role: row.role || null,
    primaryRole: row.primaryRole || null,
    confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
    isInferred: Boolean(row.isInferred),
    source: buildConfidenceMeta({
      confidenceLevel: row.sourceConfidence ?? row.confidence,
      isInferred: row.isInferred,
      sourceName: row.sourceName,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      complianceStatus: row.complianceStatus,
    }, row.confidence, 'legacy_backfill_credit'),
  };
}

function normalizeRole(value) {
  const lower = String(value || '').trim().toLowerCase();
  if (lower.includes('director')) return 'director';
  if (lower.includes('producer')) return 'producer';
  if (lower.includes('composer')) return 'composer';
  if (lower.includes('artist')) return 'artist';
  if (lower.includes('designer')) return 'designer';
  if (lower.includes('writer')) return 'writer';
  if (lower.includes('publisher')) return 'publisher';
  if (lower.includes('studio')) return 'studio';
  return lower || 'developer';
}

function buildSupplementalCreditEntry(entry, fallbackScore, sourceName) {
  const role = normalizeRole(entry?.role);
  return {
    personId: entry?.id || null,
    name: entry?.name || null,
    normalizedName: entry?.name || null,
    role,
    primaryRole: role,
    confidence: fallbackScore,
    isInferred: false,
    source: buildConfidenceMeta({
      confidenceLevel: fallbackScore,
      isInferred: 0,
      sourceName,
      sourceType: sourceName === 'encyclopedia_seed' ? 'local_seed' : 'processed_data',
      sourceUrl: null,
      complianceStatus: sourceName === 'encyclopedia_seed' ? 'approved_with_review' : 'approved',
    }, fallbackScore, sourceName === 'encyclopedia_seed' ? 'seed_dev_team' : 'processed_dev_team'),
  };
}

function mergeCredits(baseCredits, extraCredits) {
  const merged = [...baseCredits];
  extraCredits.forEach((entry) => {
    if (!entry?.name) {
      return;
    }
    const alreadyPresent = merged.some((existing) => existing.role === entry.role && existing.name === entry.name);
    if (!alreadyPresent) {
      merged.push(entry);
    }
  });
  return merged;
}

function buildCompanyCandidate(rawId, fallbackName, relationRole, companiesById, peopleById, fallbackDeveloperName) {
  const personLookup = rawId ? peopleById.get(String(rawId)) : null;
  const companyLookup =
    (rawId && companiesById.get(String(rawId)))
    || (rawId && String(rawId).startsWith('person:') ? companiesById.get(String(rawId).slice('person:'.length)) : null)
    || null;
  const name =
    companyLookup?.name
    || personLookup?.name
    || fallbackName
    || fallbackDeveloperName
    || null;

  if (!name && !rawId) {
    return null;
  }

  const idBase = companyLookup?.id || (rawId ? String(rawId).replace(/^person:/, '') : slugifyValue(name));
  const id = idBase || slugifyValue(name);
  if (!id) {
    return null;
  }

  return {
    id,
    slug: slugifyValue(name || id),
    name: name || id,
    role: relationRole,
    country: companyLookup?.country || null,
    foundedYear: companyLookup?.foundedYear || null,
    sourceKind: companyLookup ? 'companies_table' : personLookup ? 'people_fallback' : 'row_fallback',
  };
}

function addCompanyReference(index, company, itemId, title) {
  if (!company) {
    return;
  }
  if (!index.has(company.id)) {
    index.set(company.id, {
      id: company.id,
      slug: company.slug,
      name: company.name,
      country: company.country,
      foundedYear: company.foundedYear,
      roles: new Set(),
      sourceKinds: new Set(),
      referencedBy: [],
    });
  }

  const entry = index.get(company.id);
  entry.roles.add(company.role);
  entry.sourceKinds.add(company.sourceKind);
  entry.referencedBy.push({
    itemId,
    title,
    relationRole: company.role,
  });
}

function main() {
  ensureWorkspace();

  const inputPath = resolveInputPath();
  const { rows } = loadEnrichedRows(inputPath);
  const startedAt = new Date();
  const { dateStamp, timestampStamp, outputPath, logPath } = buildPipelinePaths('credits', startedAt);
  const companiesPath = path.join(CANONICAL_DIR, `companies_${dateStamp}.json`);
  const db = openSourceDb();

  try {
    const peopleById = indexPeople(db);
    const companiesById = indexCompanies(db);
    const encyclopediaSeed = loadEncyclopediaSeedMap();
    const creditsRows = loadGamePeople(db);
    const creditsByGame = new Map();
    const companiesIndex = new Map();

    creditsRows.forEach((row) => {
      if (!creditsByGame.has(row.gameId)) {
        creditsByGame.set(row.gameId, []);
      }
      creditsByGame.get(row.gameId).push(buildCreditEntry(row));
    });

    const payload = rows.map((row) => {
      const seedRow = encyclopediaSeed.get(row.sourceId || row.id) || null;
      const itemCredits = mergeCredits(
        creditsByGame.get(row.sourceId || row.id) || [],
        [
          ...(Array.isArray(row.devTeam) ? row.devTeam : []).map((entry) => buildSupplementalCreditEntry(entry, row.sourceConfidence || 0.7, 'processed_dev_team')),
          ...(Array.isArray(seedRow?.dev_team) ? seedRow.dev_team : []).map((entry) => buildSupplementalCreditEntry(entry, 0.88, 'encyclopedia_seed')),
        ]
      );
      const developerCompany = buildCompanyCandidate(
        row.developerId,
        row.developer,
        'developer',
        companiesById,
        peopleById,
        row.developer
      );
      const publisherCompany = buildCompanyCandidate(
        row.publisherId,
        null,
        'publisher',
        companiesById,
        peopleById,
        null
      );
      const studioCompanies = itemCredits
        .filter((entry) => entry.role === 'developer' || entry.role === 'studio')
        .map((entry) => buildCompanyCandidate(entry.personId, entry.name, 'studio', companiesById, peopleById, null))
        .filter(Boolean);
      const publisherCompanies = itemCredits
        .filter((entry) => entry.role === 'publisher')
        .map((entry) => buildCompanyCandidate(entry.personId, entry.name, 'publisher', companiesById, peopleById, null))
        .filter(Boolean);

      const companyEntries = [];
      if (developerCompany) {
        companyEntries.push(developerCompany);
      }
      if (publisherCompany) {
        companyEntries.push(publisherCompany);
      }
      studioCompanies.forEach((company) => companyEntries.push(company));
      publisherCompanies.forEach((company) => companyEntries.push(company));

      const dedupedCompanies = Array.from(new Map(companyEntries.map((company) => [`${company.id}:${company.role}`, company])).values());
      dedupedCompanies.forEach((company) => addCompanyReference(companiesIndex, company, row.id, row.title));

      return {
        itemId: row.id,
        sourceId: row.sourceId || row.id,
        slug: row.slug,
        title: row.title,
        console: row.console,
        credits: {
          roles: itemCredits,
          devTeam: itemCredits.filter((entry) => DEV_TEAM_ROLES.has(entry.role)),
          companies: dedupedCompanies,
          studios: dedupedCompanies.filter((entry) => entry.role === 'studio' || entry.role === 'developer'),
          publishers: dedupedCompanies.filter((entry) => entry.role === 'publisher'),
        },
      };
    });

    const companiesPayload = Array.from(companiesIndex.values())
      .map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        country: entry.country,
        foundedYear: entry.foundedYear,
        roles: Array.from(entry.roles).sort(),
        sourceKinds: Array.from(entry.sourceKinds).sort(),
        referencedByCount: entry.referencedBy.length,
        referencedBy: entry.referencedBy.sort((left, right) => left.itemId.localeCompare(right.itemId)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const totals = {
      items: payload.length,
      itemsWithRoles: payload.filter((entry) => entry.credits.roles.length).length,
      itemsWithDevTeam: payload.filter((entry) => entry.credits.devTeam.length).length,
      itemsWithCompanies: payload.filter((entry) => entry.credits.companies.length).length,
      itemsWithPublishers: payload.filter((entry) => entry.credits.publishers.length).length,
      totalRoleEntries: payload.reduce((sum, entry) => sum + entry.credits.roles.length, 0),
      totalUniqueCompanies: companiesPayload.length,
    };

    writePipelineArtifacts(outputPath, payload, logPath, {
      pipeline: '06_credits',
      run_at: startedAt.toISOString(),
      input: formatOutputPath(inputPath),
      outputs: {
        credits: formatOutputPath(outputPath),
        companies: formatOutputPath(companiesPath),
      },
      counts: totals,
      nulls: {
        devTeam: payload.filter((entry) => !entry.credits.devTeam.length).length,
        companies: payload.filter((entry) => !entry.credits.companies.length).length,
        publishers: payload.filter((entry) => !entry.credits.publishers.length).length,
      },
      errors: 0,
      skipped: 0,
    });
    writeJson(companiesPath, companiesPayload);

    console.log(`[CREDITS] ${payload.length} items traités, ${totals.totalRoleEntries} rôles, ${totals.totalUniqueCompanies} companies, 0 erreur, rapport: ${formatOutputPath(logPath)}`);
    console.log(`[CREDITS] credits: ${formatOutputPath(outputPath)}`);
    console.log(`[CREDITS] companies: ${formatOutputPath(companiesPath)}`);
  } finally {
    db.close();
  }
}

main();
