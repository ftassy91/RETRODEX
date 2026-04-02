# RetroDex Personas And UX/UI Improvement Spec

Date: 2026-04-02

## Why This Exists

This note captures the confrontation between three reusable RetroDex personas:
- the curious reader
- the collector
- the scholar

The goal is not to redesign by taste.
The goal is to turn three real reading modes into a clearer UX/UI direction for RetroDex.

## What The Three Personas Agree On

### The current product promise is visible, but under-expressed
- people can tell that RetroDex is serious
- they can tell that a fiche game is supposed to be the core surface
- they can tell there is real data behind the pages

But they still feel too much of the system before they feel the product.

### The main problem is hierarchy, not missing features
The shared diagnosis is structural:
- too much secondary text
- too many panels of similar importance
- too many labels explaining the system
- too much mental competition between surfaces

This lowers:
- clarity
- perceived premium quality
- desire to open more fiches
- authority of the frontend

### The game page is already the strongest asset
All three personas point to the same truth:
- the fiche game is the best part of RetroDex
- when RetroDex feels credible, it is because the fiche starts to feel archival and worth reading

Therefore:
- every public surface should lead into the fiche
- no secondary surface should feel more central than the fiche

## Persona-Specific Findings

## 1. Curieux Du Jeu Video

### What works
- the hub is understandable as an entry point
- the product promise of discovery is visible
- a strong fiche can already feel worth opening

### What fails
- too much system framing
- too many panels and explanatory layers
- exploration still feels partly like interpreting a tool instead of following curiosity

### What this persona needs next
- less text
- more tension
- stronger reasons to open a fiche quickly
- a calmer index with a dominant list

## 2. Collectionneur De Jeux Video

### What works
- the collection surface already contains useful signals
- the fiche-to-collection link is directionally correct
- value, condition, and status are relevant and not cosmetic

### What fails
- collection still reads too much like a structured tool
- status is visible, but not yet noble or decision-first
- market context and collection context are still too separate

### What this persona needs next
- a real cockpit
- more hierarchy around priority and action
- stronger fiche links from collection
- less explanation, more decision

## 3. Savant Du Jeu Video

### What works
- RetroDex can already feel like an archive
- the fiche carries real documentary potential
- the cold terminal identity is directionally right

### What fails
- depth is still staged too weakly
- too much UI structure competes with reading
- the archive does not yet feel precious enough

### What this persona needs next
- more proof, less scaffolding
- stronger editorial hierarchy
- quieter market presence
- richer highlighting of documentary depth when present

## UX/UI Specification

## A. Product Hierarchy To Enforce

The frontend should be perceived as:
1. `Hub` = orientation
2. `RetroDex` = exploration
3. `Game page` = central reading surface
4. `Collection` = personal cockpit
5. `Stats / market` = expert qualification

This must be true:
- in the header
- in page composition
- in CTA hierarchy
- in amount of copy
- in where visual emphasis is spent

## B. Navigation Rules

The public header should read as one coherent family:
- `Hub`
- `RetroDex`
- `Collection`

Rules:
- no isolated home object that feels detached from the rest of the product
- no parallel-product framing for search
- no primary-nav prominence for `stats`
- no copy that suggests several equal universes competing for attention

## C. Copy Rules

Every visible line must justify itself.

Keep only lines that:
- orient
- qualify
- help choose
- help decide

Cut aggressively:
- explanatory subtitles
- system narration
- labels with no clear job
- repeated context between kicker, title, subtitle, and banner

Target effect:
- more authority
- less friction
- less “frontend as explanation”

## D. Hub Rules

The hub must become a real cockpit:
- one strong search entry
- one short orientation block
- one short continuation block
- one short block of strong fiches

The hub must not:
- explain the product at length
- behave like a mini-dashboard
- compete with the fiche

Measure of success:
- the user knows where to go in one glance
- the hub creates momentum, not dwell time

## E. RetroDex Index Rules

`RetroDex` should read as a noble index, not a hybrid tool board.

Rules:
- the list dominates
- filters are compact and quiet
- no persistent preview panel competing with results
- primary visible signals limited to:
  - `Richesse`
  - `Etat`
  - `Confiance`
  - one extra signal only if it clearly helps a decision

Target effect:
- calmer scan
- faster comparison
- stronger desire to open the fiche

## F. Game Page Rules

The fiche game must become the undeniable center.

Order of reading:
1. identity
2. why this fiche is worth reading
3. richness / state / confidence
4. editorial and archival reading
5. collection layer
6. market qualification
7. conditional deep sections

Rules:
- less escort text
- fewer equal-weight blocks
- collection shown earlier
- market integrated, never dominant
- rich fiches must feel precious
- weaker fiches must feel stable and in progress, never broken

## G. Collection Rules

Collection should feel like a personal cockpit, not a ledger.

Required hierarchy:
1. summary
2. value and delta
3. active shelves and wishlist
4. priority items
5. list with obvious path back to the fiche

Rules:
- fewer accounting cues
- more sense of personal stewardship
- market signals only where they help decide
- no mini-RetroMarket feeling

## H. Terminal Style Rules

Keep:
- palette
- typography
- cold archive tone
- monitor/reference identity

Reduce:
- repeated frames
- panel overload
- equal-weight modules
- decorative system cues that do not improve reading

The terminal style should become:
- quieter
- more implicit
- more disciplined
- more supportive of hierarchy

## Priority Order

1. Reduce secondary text hard
2. Unify navigation and remove modular feeling
3. Strengthen the fiche game as the central surface
4. Simplify RetroDex index into a calmer list-first surface
5. Turn Collection into a more noble cockpit
6. Demote stats/market visually without deleting them
7. Calm the terminal framing and increase contrast between primary and secondary

## Review Output Rule

Use the three personas together in future UX reviews:
- Curieux asks: “Do I want to open a fiche now?”
- Collectionneur asks: “Can I decide and act now?”
- Savant asks: “Does this feel worth reading deeply?”

If the frontend satisfies all three at once, it is likely moving from `5/10` toward `7/10+`.
