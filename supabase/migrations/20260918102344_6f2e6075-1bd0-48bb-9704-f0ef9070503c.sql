CREATE TABLE public.omnifrog_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  request TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IDLE',
  build_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_url TEXT,
  deployment_url TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.omnifrog_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.omnifrog_projects(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  agent_id TEXT,
  agent_name TEXT,
  file_path TEXT,
  operation TEXT,
  provider TEXT,
  model TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX omnifrog_activity_project_idx ON public.omnifrog_activity (project_id, created_at);
CREATE INDEX omnifrog_projects_updated_idx ON public.omnifrog_projects (updated_at DESC);

GRANT ALL ON public.omnifrog_projects TO service_role;
GRANT ALL ON public.omnifrog_activity TO service_role;

ALTER TABLE public.omnifrog_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnifrog_activity ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.omnifrog_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER omnifrog_projects_touch
BEFORE UPDATE ON public.omnifrog_projects
FOR EACH ROW EXECUTE FUNCTION public.omnifrog_touch_updated_at();