# RetroDex Prompt Pack Review

Decision values:
- `APPROVED`: pack can be sent to image generation
- `RETRY`: pack needs prompt refinement before generation
- `REJECT`: pack direction is wrong and must be rebuilt

Review criteria:
- subject readable in under one second
- franchise evocation without direct copying
- platform identity visible
- strong GameDetail hero potential
- legal risk acceptable

Workflow:
1. Open the `.md` brief for the game
2. Read the prompt and legal notes
3. Set `decision` in `review_queue.csv`
4. Add `decision_reason` and `reviewer_notes`
5. Mark `selected_for_generation=yes` only for approved packs
