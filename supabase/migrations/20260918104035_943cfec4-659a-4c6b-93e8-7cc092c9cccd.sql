ALTER TABLE public.omnifrog_providers
  ADD COLUMN fallback_eligible boolean NOT NULL DEFAULT true;