# RetroDex Sync Scripts

## Purpose

This folder contains the minimal local-first sync bootstrap for `prototype_v0`.

The seed package does not include the original Notion scripts or git history, so
`retrodex_sync_agent.py` focuses on:

- scanning the current workspace safely
- recording sync entries locally
- creating checkpoints in `logs/checkpoints/`
- queuing Notion operations when credentials or database mappings are missing
- exporting local `Games`, `Assets`, `Market`, and backlog previews into `data/notion_exports/`

## Usage

Run from `prototype_v0/`:

```powershell
python scripts/retrodex_sync_agent.py
```

Replay the queued Notion operations once credentials and mappings are ready:

```powershell
python scripts/retrodex_sync_agent.py --replay-queue
```

## Notion setup

1. Copy `scripts/retrodex_sync_config.example.json` to `scripts/retrodex_sync_config.json`.
2. Fill the target database ids and property names for your Notion workspace.
3. Set the token in the environment variable named by `token_env_var`.

Until those values are valid, the agent writes pending Notion operations to
`logs/notion_sync_queue.jsonl` instead of dropping them.
