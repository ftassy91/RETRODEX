# RetroDex Personas And Review Agents

This document stores three reusable UX review personas for RetroDex.

Use them whenever a change affects:
- [backend/public/hub.html](../backend/public/hub.html)
- [backend/public/games-list.html](../backend/public/games-list.html)
- [backend/public/search.html](../backend/public/search.html)
- [backend/public/game-detail.html](../backend/public/game-detail.html)
- [backend/public/collection.html](../backend/public/collection.html)
- [backend/public/stats.html](../backend/public/stats.html)

They are aligned with [AGENTS.md](./AGENTS.md):
- RetroDex is a retro knowledge engine
- game pages are the center
- market is a context layer
- collection is personal but secondary
- hub is orientation only
- search traverses the system, it is not a separate product

## Persona 1: Le Curieux Du Jeu Video

### Core profile
- Opens a site to find the next good thing to read
- Wants a game, a hook, and a reason to click in seconds
- Likes discovery loops more than dashboards
- Gives up quickly if the interface explains itself too much

### Interests
- strong game identity
- short reasons to open a fiche
- franchise and console links
- signals that tell whether a page is worth the time

### Needs
- immediate orientation
- one obvious next step
- a few useful signals, not a wall of labels
- visible reward for opening a rich fiche

### Preferred sites and habits
- discovery and list-first products in the orbit of Backloggd
- recommendation-heavy browse flows
- short result lists with strong titles and clear next clicks

### Navigation behavior
- scans the header, title, main CTA, and two or three signals
- opens one fiche if the promise is strong
- avoids layered panels, explanatory copy, and system framing

### What RetroDex must do for this persona
- make the hub feel like a launch pad
- make RetroDex feel like a calm index
- surface a handful of strong fiches fast
- reduce secondary text hard

### Review lens
- Do I know where to start immediately?
- Do I want to open a fiche now?
- Do I feel a product, or do I feel a system?

## Persona 2: Le Collectionneur De Jeux Video

### Core profile
- Tracks ownership, condition, value, and wishlist over time
- Thinks in terms of decisions: keep, buy, compare, sell, revisit
- Cares about variants, completeness, and price context
- Wants a collection cockpit, not a spreadsheet in costume

### Interests
- owned vs missing
- value and delta
- condition and completeness
- wishlist, sell list, and priorities

### Needs
- fast decision support
- clear status of each entry
- obvious path back to the fiche game
- value context close to the owned item

### Preferred sites and habits
- collection/value products in the orbit of PriceCharting
- collection tracking flows similar to VGCollect
- filter, export, compare, then jump to the item detail

### Navigation behavior
- enters through collection or search with intent
- checks the fiche to validate a decision
- returns to collection to act
- loses trust when too much screen space goes to explanations

### What RetroDex must do for this persona
- make Collection feel noble and operational
- make condition and delta legible at a glance
- keep the fiche as the source of truth
- keep market signals useful but subordinate

### Review lens
- Can I decide what matters fast?
- Does collection feel personal and serious?
- Is the market helping me act, or stealing attention?

## Persona 3: Le Savant Du Jeu Video

### Core profile
- Reads for provenance, credits, versions, context, and preservation
- Accepts density only if the hierarchy is disciplined
- Trusts structure and proof more than surface excitement
- Wants an archive, not a product demo

### Interests
- credits and teams
- production context
- version history and preservation clues
- media, references, manuals, and deep sections

### Needs
- a strong hierarchy from top to bottom
- evidence that a fiche is worth reading deeply
- archival depth staged progressively
- little market noise in the reading flow

### Preferred sites and habits
- documentation-heavy products in the orbit of MobyGames
- preservation-minded references such as Unseen64 and TCRF
- long-form archive pages that reward careful reading

### Navigation behavior
- reads top to bottom once trust is established
- looks for signals of proof, not just quantity
- abandons pages where depth exists but is badly staged
- prefers quiet authority over visual noise

### What RetroDex must do for this persona
- make the game page the strongest surface
- stage editorial and archival depth clearly
- keep market below reading and context
- expose media, credits, and references when present

### Review lens
- Does this feel like a serious archive surface?
- Is the depth easy to see and worth entering?
- Does the page reward reading instead of listing?

## Shared Diagnosis

These three personas converge on the same main issues:
- too much secondary text
- too many equal-weight panels
- navigation still partly reads as product structure, not user path
- the game page is good in intent but not yet dominant enough in perception
- collection still risks reading as a tracking tool before it reads as a personal cockpit
- market still takes too much mental space relative to its supporting role

They also converge on the same strengths:
- the data ambition is real
- the archive identity is credible
- the fiche game already carries the best part of the product promise
- hierarchy, reduction, and staging can unlock a much stronger perceived product without changing the backend

## Reuse Rule

Use these personas as the default UX review lens:
- Curieux = desire and discovery
- Collectionneur = action and value confidence
- Savant = depth and proof

If a frontend change fails all three, it is almost certainly too system-facing and not product-facing enough.

## Source Grounding

These personas are informed by public product patterns and current tracking/documentation ecosystems:
- Backloggd / game tracking market overview: the category leader is valued for community, discovery, and low-friction logging, with mobile and friction still cited as key gaps.
  Source: [State of Game Tracking 2026](https://s3.us-east-2.amazonaws.com/tag-media-bucket/2026/02/25035915/state-of-game-tracking-2026.pdf)
- PriceCharting foregrounds collection tracking, historic value, search, quantity, notes, and collection value over time.
  Source: [PriceCharting blog and product pages](https://blog.pricecharting.com/2023/)
- MobyGames publicly emphasizes documentary breadth such as soundtracks, screenshots, trailers, reviews, and credits depth.
  Source: [MobyGames home and changelog](https://www.mobygames.com/)
