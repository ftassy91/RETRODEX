Initialize a clean working session for RetroDex.

## Steps

1. Read state: check git status, read CLAUDE.md header, identify any in-progress lot.
2. Detect mode: THINK, BUILD, or CONTROL.
3. Recommend model: Opus for audit/architecture, Sonnet for code, Opusplan for hybrid.
4. Ask for objective: if no active lot exists, propose /operator-audit or /product-audit.

## Return format

MODE:        [THINK | BUILD | CONTROL]
MODEL:       [opus | sonnet | opusplan]
OBJECTIVE:   [one sentence]
ACTIVE LOT:  [lot name or none]
NEXT:        [exact command to run]

Do not write code. Just orient the session.
