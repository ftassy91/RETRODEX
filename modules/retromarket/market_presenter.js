const RETROMARKET_PRESENTATION = (() => {
  function getRecord(gameOrId) {
    if (!gameOrId || typeof RETROMARKET_DATA === 'undefined' || typeof RETROMARKET_DATA.getMarketRecord !== 'function') {
      return null;
    }
    const gameId = typeof gameOrId === 'string' ? gameOrId : gameOrId.id;
    if (!gameId) return null;
    try {
      return RETROMARKET_DATA.getMarketRecord(gameId);
    } catch (_error) {
      return null;
    }
  }

  function getCondition(record, label) {
    if (!record || !Array.isArray(record.conditions)) return null;
    const target = String(label || '').toUpperCase() === 'MINT' ? 'SEALED' : String(label || '').toUpperCase();
    return record.conditions.find((condition) => String(condition.label || '').toUpperCase() === target) || null;
  }

  function formatCompactCurrency(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? '$' + Math.round(value).toLocaleString('en-US')
      : 'N/A';
  }

  function getDisplayPrice(label, fallbackValue, record) {
    const condition = getCondition(record, label);
    if (!condition || typeof condition.average !== 'number' || !Number.isFinite(condition.average)) {
      return fallbackValue;
    }
    return formatCompactCurrency(condition.average);
  }

  function getCoverageLevel(record) {
    if (!record) return 'SNAPSHOT';
    const tracked = ['Loose', 'CIB', 'Sealed']
      .map((label) => getCondition(record, label))
      .filter(Boolean);
    const verifiedCount = tracked.filter((condition) => condition.status === 'verified').length;
    if (record.history && record.history.status === 'ready' && verifiedCount >= 2) return 'VERIFIED';
    if (verifiedCount >= 1 || record.sourceMeta) return 'PARTIAL';
    return 'SNAPSHOT';
  }

  function getSourceLabel(record) {
    if (!record) return 'Local snapshot';
    if (record.sourceMeta && record.sourceMeta.sourceName) return record.sourceMeta.sourceName;
    if (record.sourceMeta && record.sourceMeta.sourceType) return record.sourceMeta.sourceType;
    return 'Local snapshot';
  }

  function getHistoryStatusLabel(record) {
    if (!record || !record.history) return 'data unavailable';
    return record.history.status === 'ready'
      ? 'verified 10-year history'
      : 'yearly history unavailable';
  }

  function getChartNote(record) {
    if (!record || !record.history) return '';
    if (record.history.status === 'ready') {
      return '<div class="rm-chart-note"><strong>Verified history active.</strong> 10-year chart is rendered from imported yearly market data.</div>';
    }
    return '<div class="rm-chart-note"><strong>Snapshot mode.</strong> Prices are available, but yearly market history is still missing.</div>';
  }

  function getFootnote(record) {
    if (!record) return 'Local price snapshot only. Verified source and yearly history are not loaded for this title.';
    const sourceName = getSourceLabel(record);
    const verifiedAt = record.sourceMeta && record.sourceMeta.verifiedAt
      ? 'verified ' + record.sourceMeta.verifiedAt
      : 'source date unavailable';
    const lastSale = record.marketSignals && record.marketSignals.lastSaleDate && record.marketSignals.lastSaleDate !== 'data unavailable'
      ? 'last sale ' + record.marketSignals.lastSaleDate
      : 'no recent verified sale';
    return [sourceName, verifiedAt, lastSale, getHistoryStatusLabel(record)].join(' · ');
  }

  return {
    getRecord,
    getCondition,
    getDisplayPrice,
    getCoverageLevel,
    getSourceLabel,
    getHistoryStatusLabel,
    getChartNote,
    getFootnote
  };
})();
