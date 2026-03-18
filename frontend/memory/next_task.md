# NEXT TASK - REQUALIFY REMAINING CSV FRONTEND ITEMS AGAINST THE CURRENT BEGINNER SURFACE

## What was just completed
- Sprint 4 collection is fully validated on the live backend on port `3000`:
  - `GET /api/collection`
  - `POST /api/collection`
  - `DELETE /api/collection/:id`
  - `backend/public/collection.html`
  - `backend/public/game-detail.html`
- Product framing is now explicit:
  - single user
  - no auth
  - local-first beginner backend
- Historical React backlog items are now explicitly treated as:
  - intent references only
  - to be requalified before implementation
- Sprint 5 collection stats are now visible:
  - `GET /api/collection/stats`
  - stats section on `backend/public/collection.html`

## Next recommended task
- Requalify the next remaining CSV frontend items instead of executing them literally.
- Priority order:
  - verify which Sprint 5 / week-2 items are already implicitly done
  - mark duplicates / requalified items
  - then implement only the next missing visible behavior in the current HTML/Express surface

## After that
- The most likely next visible candidate is:
  - refine collection presentation only if the user spots a real UI issue
  - otherwise move to one lightweight discoverability improvement already aligned with the current backend pages

## Guardrails
- backend stays on port `3000`
- do not break:
  - `launcher.html`
  - `index.html`
  - `modules/retromarket/market.html`
- test over `http://`, never `file://`
- keep collection behavior minimal and beginner-readable
