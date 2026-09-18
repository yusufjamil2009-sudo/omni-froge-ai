CREATE TABLE public.omnifrog_providers (
  provider_id text PRIMARY KEY,
  provider_name text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  connection_status text NOT NULL DEFAULT 'NOT CONFIGURED',
  credential_ref text,
  credential_cipher text,
  credential_hint jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_model text,
  is_default boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  models_refreshed_at timestamptz,
  last_tested_at timestamptz,
  last_error jsonb,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.omnifrog_providers TO service_role;

ALTER TABLE public.omnifrog_providers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER omnifrog_providers_touch
BEFORE UPDATE ON public.omnifrog_providers
FOR EACH ROW EXECUTE FUNCTION public.omnifrog_touch_updated_at();

CREATE UNIQUE INDEX omnifrog_providers_single_default
ON public.omnifrog_providers ((is_default)) WHERE is_default;