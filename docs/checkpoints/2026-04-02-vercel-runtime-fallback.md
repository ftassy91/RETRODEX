# 2026-04-02 - Vercel Runtime Fallback

## Incident

- Le frontend public etait bien deploie, mais les endpoints `GET /api/items`, `GET /api/stats`, `GET /api/consoles` repondaient `500` sur `retrodex-beryl.vercel.app`.
- Effet visible : le hub tombait dans son fallback, gardait `--` sur les stats et n'affichait aucune vitrine riche.

## Cause probable retenue

- Le runtime public moderne depend de `db_supabase`.
- En environnement Vercel, si les cles Supabase ne sont pas presentes mais que `DATABASE_URL` existe, les routes publiques pouvaient retomber sur un mode non compatible avec les appels `db.from(...).select(...).eq(...)`.
- Le backend pouvait alors casser avant de servir les payloads publics, alors que les donnees etaient bien publiees en base.

## Correctif

- `backend/db_supabase.js`
  - ajout d'un adaptateur Postgres compatible avec le dialecte minimal utilise par les services publics (`from/select/eq/in/order/range/single/insert/update/delete/rpc`)
  - activation automatique de cet adaptateur quand `DATABASE_URL` est disponible
- `backend/src/server.js`
  - simplification du gate `useSupabaseServerlessRoutes` : sur Vercel, si `db_supabase` est en mode `supabase`, le runtime public serverless est utilise sans forcer le chemin legacy

## Validation

- simulation locale du scenario Vercel :
  - `NODE_ENV=production`
  - `VERCEL=1`
  - cles Supabase videes
  - `DATABASE_URL` disponible
- reponses valides en `200` pour :
  - `/api/health`
  - `/api/items?limit=3`
  - `/api/stats`
  - `/api/consoles`
- `npm run smoke` : ok
- `cd backend && npm test -- --runInBand` : ok

## Effet attendu apres redeploiement

- le hub ne doit plus rester vide
- les compteurs publics doivent se remplir
- les payloads `items`, `stats` et `consoles` doivent redevenir lisibles meme si Vercel ne fournit que `DATABASE_URL`
