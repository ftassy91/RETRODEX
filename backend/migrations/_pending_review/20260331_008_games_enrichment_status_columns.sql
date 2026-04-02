-- Phase 3 preparation only.
-- Do not apply in production without explicit human validation.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS editorial_status
    TEXT CHECK (editorial_status IN ('complete', 'partial', 'empty'))
    DEFAULT 'empty';

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS media_status
    TEXT CHECK (media_status IN ('complete', 'partial', 'empty'))
    DEFAULT 'empty';

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS price_status
    TEXT CHECK (price_status IN ('real', 'synthetic', 'empty'))
    DEFAULT 'empty';
