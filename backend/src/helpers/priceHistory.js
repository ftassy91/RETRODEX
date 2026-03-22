function hashSeed(value) {
  let seed = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    seed = (seed * 31 + text.charCodeAt(index)) | 0;
  }

  return Math.abs(seed);
}

function nextSeed(seed) {
  return Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) | 0;
}

function buildMonthLabels(totalMonths = 12, referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const labels = [];

  for (let offset = totalMonths - 1; offset >= 0; offset -= 1) {
    const current = new Date(Date.UTC(year, month - offset, 1));
    labels.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return labels;
}

function generateHistory(currentPrice, gameId, priceType, monthLabels) {
  const safeCurrent = Math.max(1, Math.round(Number(currentPrice) || 0));
  const history = [];
  let seed = hashSeed(`${gameId}${priceType}`);
  let price = safeCurrent;

  history.unshift({
    month: monthLabels[monthLabels.length - 1],
    price: safeCurrent,
  });

  for (let index = monthLabels.length - 2; index >= 0; index -= 1) {
    seed = nextSeed(seed);
    const variation = ((Math.abs(seed) % 11) - 5) / 100;
    price = Math.round(price / (1 + variation));
    history.unshift({
      month: monthLabels[index],
      price: Math.max(1, price),
    });
  }

  return history;
}

function computeHistoryTrend(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return "stable";
  }

  const oldest = Number(history[0]?.price) || 0;
  const current = Number(history[history.length - 1]?.price) || 0;

  if (current > oldest * 1.03) {
    return "up";
  }

  if (current < oldest * 0.97) {
    return "down";
  }

  return "stable";
}

function computePriceTrend(gameId, currentPrice) {
  const labels = buildMonthLabels(12);
  const history = generateHistory(currentPrice, gameId, "mint", labels);
  return computeHistoryTrend(history);
}

function withGameTrend(game) {
  const plainGame = typeof game?.toJSON === "function" ? game.toJSON() : game;

  return {
    ...plainGame,
    trend: {
      mint: computePriceTrend(plainGame.id, plainGame.mintPrice),
    },
  };
}

const PRICE_HISTORY_PERIODS = [
  { id: "1m", label: "1M", days: 30 },
  { id: "6m", label: "6M", days: 180 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "all", label: "ALL", days: null },
];

const PRICE_HISTORY_STATES = [
  { key: "loose", label: "Loose", condition: "Loose", field: "loosePrice" },
  { key: "cib", label: "CIB", condition: "CIB", field: "cibPrice" },
  { key: "mint", label: "Mint", condition: "Mint", field: "mintPrice" },
];

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function toPriceNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? roundPrice(parsed) : null;
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function conditionKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "cib") return "cib";
  if (normalized === "mint") return "mint";
  return "loose";
}

function buildReportConfidence(report) {
  const reportConfidence = Number(report?.report_confidence_score);
  const userTrust = Number(report?.user_trust_score);
  const safeReport = Number.isFinite(reportConfidence) ? reportConfidence : 0.5;
  const safeUser = Number.isFinite(userTrust) ? userTrust : 0.5;
  return Math.max(1, Math.min(100, Math.round(safeReport * safeUser * 100)));
}

function buildObservedPoints(reports = []) {
  return reports
    .map((report) => {
      const date = toIsoDate(report.date_estimated || report.created_at);
      const value = toPriceNumber(report.reported_price);
      if (!date || value == null || report.editorial_excluded) {
        return null;
      }

      return {
        date,
        value,
        source: report.is_editorial ? "editorial" : "community",
        confidence_pct: buildReportConfidence(report),
        context: report.context || null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return left.value - right.value;
    });
}

function filterPointsByPeriod(points = [], period) {
  if (!points.length || !period?.days) {
    return [...points];
  }

  const latestDate = new Date(`${points[points.length - 1].date}T00:00:00Z`);
  if (Number.isNaN(latestDate.getTime())) {
    return [...points];
  }

  const cutoff = new Date(latestDate.getTime() - period.days * 24 * 60 * 60 * 1000);
  return points.filter((point) => {
    const pointDate = new Date(`${point.date}T00:00:00Z`);
    return !Number.isNaN(pointDate.getTime()) && pointDate >= cutoff;
  });
}

function buildPeriodStats(points = []) {
  return PRICE_HISTORY_PERIODS.reduce((acc, period) => {
    const scopedPoints = filterPointsByPeriod(points, period);
    const values = scopedPoints.map((point) => point.value);
    const firstPoint = scopedPoints[0] || null;
    const lastPoint = scopedPoints[scopedPoints.length - 1] || null;
    const variationValue = scopedPoints.length >= 2 ? roundPrice(lastPoint.value - firstPoint.value) : null;
    const variationPct = scopedPoints.length >= 2 && firstPoint.value > 0
      ? Math.round(((variationValue / firstPoint.value) * 100) * 10) / 10
      : null;

    acc[period.id] = {
      points_count: scopedPoints.length,
      has_history: scopedPoints.length > 0,
      has_variation: scopedPoints.length >= 2,
      min_value: values.length ? Math.min(...values) : null,
      max_value: values.length ? Math.max(...values) : null,
      first_date: firstPoint?.date || null,
      last_date: lastPoint?.date || null,
      first_value: firstPoint?.value ?? null,
      last_value: lastPoint?.value ?? null,
      variation_value: variationValue,
      variation_pct: variationPct,
    };

    return acc;
  }, {});
}

function computeObservedTrend(points = []) {
  if (points.length < 2) {
    return "stable";
  }

  return computeHistoryTrend(points.map((point) => ({ price: point.value })));
}

function buildSeriesSource(points = [], indexEntry, currentPriceSource) {
  if (points.length) {
    const editorialCount = points.filter((point) => point.source === "editorial").length;
    const communityCount = points.length - editorialCount;

    if (editorialCount && communityCount) {
      return `${editorialCount} vente(s) editoriales · ${communityCount} observation(s) communautaires`;
    }

    if (editorialCount) {
      return `${editorialCount} vente(s) editoriales`;
    }

    return `${communityCount} observation(s) communautaires`;
  }

  if (indexEntry && (toPriceNumber(indexEntry.index_value) != null || toIsoDate(indexEntry.last_sale_date || indexEntry.last_computed_at))) {
    return "Indice RetroDex";
  }

  if (currentPriceSource === "catalog") {
    return "Prix catalogue";
  }

  return "Sans historique";
}

function buildSeriesConfidence(points = [], indexEntry) {
  const indexConfidence = Number(indexEntry?.confidence_pct);
  if (Number.isFinite(indexConfidence) && indexConfidence > 0) {
    return Math.round(indexConfidence);
  }

  const pointConfidences = points
    .map((point) => Number(point.confidence_pct))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!pointConfidences.length) {
    return null;
  }

  return Math.round(pointConfidences.reduce((sum, value) => sum + value, 0) / pointConfidences.length);
}

function resolveCurrentPrice(game, state, indexEntry) {
  const indexValue = toPriceNumber(indexEntry?.index_value);
  if (indexValue != null) {
    return { value: indexValue, source: "retrodex_index" };
  }

  const gameValue = toPriceNumber(game?.[state.field]);
  if (gameValue != null) {
    return { value: gameValue, source: "catalog" };
  }

  return { value: null, source: "unavailable" };
}

function resolveLastObservation(points = [], indexEntry, currentPrice) {
  if (points.length) {
    const latestPoint = points[points.length - 1];
    return {
      date: latestPoint.date,
      value: latestPoint.value,
      source: latestPoint.source,
      confidence_pct: latestPoint.confidence_pct ?? null,
      context: latestPoint.context || null,
    };
  }

  const indexDate = toIsoDate(indexEntry?.last_sale_date || indexEntry?.last_computed_at);
  const indexValue = toPriceNumber(indexEntry?.index_value);
  if (indexDate || indexValue != null) {
    return {
      date: indexDate,
      value: indexValue,
      source: "retrodex_index",
      confidence_pct: Number.isFinite(Number(indexEntry?.confidence_pct)) ? Math.round(Number(indexEntry.confidence_pct)) : null,
      context: null,
    };
  }

  if (currentPrice?.value != null) {
    return {
      date: null,
      value: currentPrice.value,
      source: currentPrice.source,
      confidence_pct: null,
      context: null,
    };
  }

  return null;
}

function buildLegacyHistory(seriesByState) {
  const dates = new Set();

  PRICE_HISTORY_STATES.forEach((state) => {
    (seriesByState[state.key]?.points || []).forEach((point) => dates.add(point.date));
  });

  return Array.from(dates)
    .sort()
    .map((date) => {
      const row = { date };

      PRICE_HISTORY_STATES.forEach((state) => {
        const point = (seriesByState[state.key]?.points || []).find((entry) => entry.date === date);
        row[state.key] = point ? point.value : null;
      });

      return row;
    });
}

function buildPriceHistoryPayload(game, { reports = [], indexEntries = [] } = {}) {
  const reportsByState = {
    loose: [],
    cib: [],
    mint: [],
  };
  const indexByState = new Map();

  reports.forEach((report) => {
    const key = conditionKey(report.condition);
    reportsByState[key].push(report);
  });

  indexEntries.forEach((entry) => {
    indexByState.set(conditionKey(entry.condition), entry);
  });

  const series = {};
  const currentPrices = {};
  const trend = {};
  const availableSeries = [];
  const missingSeries = [];

  PRICE_HISTORY_STATES.forEach((state) => {
    const observedPoints = buildObservedPoints(reportsByState[state.key]);
    const currentPrice = resolveCurrentPrice(game, state, indexByState.get(state.key));
    const lastObservation = resolveLastObservation(observedPoints, indexByState.get(state.key), currentPrice);
    const confidencePct = buildSeriesConfidence(observedPoints, indexByState.get(state.key));

    series[state.key] = {
      key: state.key,
      label: state.label,
      condition: state.condition,
      available: observedPoints.length > 0,
      points: observedPoints,
      periods: buildPeriodStats(observedPoints),
      current_price: currentPrice.value,
      current_price_source: currentPrice.source,
      last_observation: lastObservation,
      confidence_pct: confidencePct,
      source_label: buildSeriesSource(observedPoints, indexByState.get(state.key), currentPrice.source),
    };

    currentPrices[state.key] = currentPrice.value || 0;
    trend[state.key] = computeObservedTrend(observedPoints);

    if (observedPoints.length) {
      availableSeries.push(state.key);
    } else {
      missingSeries.push(state.key);
    }
  });

  return {
    gameId: game.id,
    title: game.title,
    periods: PRICE_HISTORY_PERIODS,
    series,
    currentPrices,
    trend,
    availableSeries,
    missingSeries,
    hasAnyHistory: availableSeries.length > 0,
    history: buildLegacyHistory(series),
    sourceNotice: "Courbes basees sur observations datees. Les etats sans observations restent affiches sans courbe.",
  };
}

module.exports = {
  PRICE_HISTORY_PERIODS,
  buildPriceHistoryPayload,
  conditionKey,
  computePriceTrend,
  filterPointsByPeriod,
  withGameTrend,
};
