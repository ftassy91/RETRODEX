# RetroDex - Development Workflow

## Triangle Claude / Codex / Notion
- Claude  = Architecture, audit, planification
- Codex   = Execution de code, commits Git
- Notion  = Memoire, tickets, documentation

## Session type
1. Lire Guide Reprise Codex dans Notion
2. Claude genere le prompt Codex exact
3. Codex execute + commit Git
4. Claude valide via navigateur
5. Notion mis a jour

## Regles absolues
- Port backend = 3000
- Tester sur http:// jamais file://
- Une tache = un commit
- RETRODEXseed uniquement
