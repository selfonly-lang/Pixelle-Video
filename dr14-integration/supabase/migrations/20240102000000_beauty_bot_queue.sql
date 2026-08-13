-- BeautyBot Post Queue + pg_cron automation
-- Adds scheduled post queue and three daily triggers at Taiwan peak hours

-- ── Post queue table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.beauty_post_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic         text        NOT NULL,
  title         text        NOT NULL,
  post_content  jsonb       NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','publishing','published','failed','cancelled')),
  threads_post_id text,
  error_message   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);

ALTER TABLE public.beauty_post_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.beauty_post_queue
  USING (auth.role() = 'service_role');

-- Partial index for fast queue polling
CREATE INDEX IF NOT EXISTS idx_beauty_queue_due
  ON public.beauty_post_queue (scheduled_for ASC)
  WHERE status = 'scheduled';

-- ── pg_cron: Taiwan peak-hour schedule ───────────────────────────────────────
-- Taiwan CST (UTC+8) posting times:
--   08:00 CST = 00:00 UTC  (morning commute)
--   12:00 CST = 04:00 UTC  (lunch break)
--   19:00 CST = 11:00 UTC  (after work)
--
-- pg_cron calls beauty-bot-scheduler via pg_net using the Supabase anon key.
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY internally — anon key only
-- authenticates the HTTP call to the public function endpoint.

SELECT cron.schedule(
  'beauty-bot-morning',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://lfhhiwubapkgrtgkqryd.supabase.co/functions/v1/beauty-bot-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaGhpd3ViYXBrZ3J0Z2txcnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTAwMTUsImV4cCI6MjA5NjYyNjAxNX0.aF6wF83wOzGFeH-KcAXOfa71K20FaArDtbYKvKpUiAo"}'::jsonb,
    body    := '{"action":"process_queue"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'beauty-bot-noon',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://lfhhiwubapkgrtgkqryd.supabase.co/functions/v1/beauty-bot-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaGhpd3ViYXBrZ3J0Z2txcnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTAwMTUsImV4cCI6MjA5NjYyNjAxNX0.aF6wF83wOzGFeH-KcAXOfa71K20FaArDtbYKvKpUiAo"}'::jsonb,
    body    := '{"action":"process_queue"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'beauty-bot-evening',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://lfhhiwubapkgrtgkqryd.supabase.co/functions/v1/beauty-bot-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaGhpd3ViYXBrZ3J0Z2txcnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTAwMTUsImV4cCI6MjA5NjYyNjAxNX0.aF6wF83wOzGFeH-KcAXOfa71K20FaArDtbYKvKpUiAo"}'::jsonb,
    body    := '{"action":"process_queue"}'::jsonb
  );
  $$
);

-- Weekly token health check: every Monday 23:50 UTC = Tuesday 07:50 CST
SELECT cron.schedule(
  'beauty-bot-token-check',
  '50 23 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://lfhhiwubapkgrtgkqryd.supabase.co/functions/v1/beauty-bot-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaGhpd3ViYXBrZ3J0Z2txcnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTAwMTUsImV4cCI6MjA5NjYyNjAxNX0.aF6wF83wOzGFeH-KcAXOfa71K20FaArDtbYKvKpUiAo"}'::jsonb,
    body    := '{"action":"check_token"}'::jsonb
  );
  $$
);
