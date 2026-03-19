# RetroMarket Local Import Format

RetroMarket is local-first. Verified market history and verified sales can be added without changing the module code.

## Files
- `frontend/data/market_history.js`
- `frontend/data/market_sales.js`
- `frontend/data/market_sources.js`

## History format
```js
window.MARKET_HISTORY_DATA = {
  "super-mario-bros": [
    { year: 2017, value: 42 },
    { year: 2018, value: 44 }
  ]
};
```

## Sales format
```js
window.MARKET_SALES_DATA = {
  "super-mario-bros": [
    { date: "2026-02-18", price: 52, condition: "Loose" },
    { date: "2026-02-11", price: 87, condition: "CIB" }
  ]
};
```

## Rules
- Only add verified data
- Keep prices numeric
- Use `YYYY-MM-DD` dates for sales when possible
- Keep game keys aligned with catalog `id`
- If no verified data exists, leave the objects empty

## Validation
```bash
python frontend/data/validate_market_imports.py --verbose
```

## Template workflow
Generate empty templates for a first batch:
```bash
python frontend/data/generate_market_import_templates.py --top 12
```

Rebuild the JS files after filling the JSON templates:
```bash
python frontend/data/build_market_import_js.py
python frontend/data/validate_market_imports.py --verbose
```

Generated helper files:
- `frontend/data/market_history_template.json`
- `frontend/data/market_sales_template.json`
- `frontend/data/market_sources_template.json`
- `frontend/data/market_import_manifest.json`
- `frontend/data/market_curation_batch_001.json`
- `frontend/data/market_curation_batch_001.md`

Generate the first curation workspace:
```bash
python frontend/data/generate_market_curation_workspace.py
```

This workspace mirrors the priority manifest plus current local snapshot prices so verified market entry can be prepared without inventing values.

## Source metadata format
```js
window.MARKET_SOURCE_DATA = {
  "super-mario-bros": {
    "sourceType": "auction archive",
    "sourceName": "Heritage Auctions",
    "sourceUrl": "https://example.com/listing",
    "verifiedAt": "2026-03-14",
    "notes": "Used for first verified batch"
  }
};
```

## Full refresh workflow
```bash
python frontend/data/refresh_market_imports.py
```

## Coverage report
Refresh also generates:
- `frontend/data/market_coverage_report.json`
- `frontend/data/market_coverage_report.md`
