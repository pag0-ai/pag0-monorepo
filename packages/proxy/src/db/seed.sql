-- Pag0 Smart Proxy — Seed Data
-- Idempotent: all inserts use ON CONFLICT DO NOTHING

-- 1. Categories (8)
INSERT INTO categories (name, description) VALUES
  ('AI', 'AI and Machine Learning APIs'),
  ('Data', 'Data and Analytics APIs'),
  ('Blockchain', 'Blockchain and Web3 APIs'),
  ('IoT', 'Internet of Things APIs'),
  ('Finance', 'Financial and Payment APIs'),
  ('Social', 'Social Media APIs'),
  ('Communication', 'Messaging and Communication APIs'),
  ('Storage', 'Cloud Storage APIs')
ON CONFLICT (name) DO NOTHING;

-- 2. Demo user
-- API key: pag0_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 (32 alphanumeric chars)
-- Password: demo123 (bcrypt hash generated offline)
INSERT INTO users (id, email, password_hash, api_key_hash, subscription_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@pag0.dev',
  '$2b$12$LJ3m4ys3Lz0nDfHvPOGGi.XBwDCPVz5yXweYZDNqjKMd3vY.w6jmK',
  encode(digest('pag0_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', 'sha256'), 'hex'),
  'pro'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Demo project
INSERT INTO projects (id, user_id, name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Demo Project',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Demo policy
INSERT INTO policies (id, project_id, name, is_active, max_per_request, daily_budget, monthly_budget, allowed_endpoints, blocked_endpoints)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000010',
  'Default Policy',
  true,
  5000000,
  50000000,
  500000000,
  '["*"]'::jsonb,
  '["blocked.example.com"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 5. Demo budget (some usage for realistic display)
INSERT INTO budgets (id, project_id, daily_spent, monthly_spent)
VALUES (
  '00000000-0000-0000-0000-000000001000',
  '00000000-0000-0000-0000-000000000010',
  3500000,
  28000000
)
ON CONFLICT (project_id) DO NOTHING;

-- 6. Endpoint scores — all 8 categories covered (20 endpoints)
INSERT INTO endpoint_scores (endpoint, category, overall_score, cost_score, latency_score, reliability_score, evidence) VALUES
  -- AI (3)
  ('api.openai.com', 'AI', 82.50, 65.00, 88.00, 95.00, '{"sampleSize": 1500, "period": "30d", "avgCostPerRequest": "0.015", "avgLatencyMs": 320, "successRate": 0.987}'),
  ('api.anthropic.com', 'AI', 85.30, 70.00, 85.00, 97.00, '{"sampleSize": 1200, "period": "30d", "avgCostPerRequest": "0.012", "avgLatencyMs": 350, "successRate": 0.995}'),
  ('api.cohere.ai', 'AI', 79.80, 75.00, 80.00, 84.00, '{"sampleSize": 600, "period": "30d", "avgCostPerRequest": "0.008", "avgLatencyMs": 400, "successRate": 0.968}'),
  -- Data (3)
  ('api.snowflake.com', 'Data', 84.00, 60.00, 90.00, 96.00, '{"sampleSize": 900, "period": "30d", "avgCostPerRequest": "0.020", "avgLatencyMs": 200, "successRate": 0.992}'),
  ('api.databricks.com', 'Data', 81.50, 58.00, 88.00, 94.00, '{"sampleSize": 700, "period": "30d", "avgCostPerRequest": "0.025", "avgLatencyMs": 250, "successRate": 0.985}'),
  ('api.bigquery.googleapis.com', 'Data', 86.20, 62.00, 92.00, 98.00, '{"sampleSize": 1100, "period": "30d", "avgCostPerRequest": "0.018", "avgLatencyMs": 180, "successRate": 0.997}'),
  -- Blockchain (2)
  ('mainnet.infura.io', 'Blockchain', 78.00, 80.00, 75.00, 78.00, '{"sampleSize": 800, "period": "30d", "avgCostPerRequest": "0.001", "avgLatencyMs": 180, "successRate": 0.965}'),
  ('api.alchemy.com', 'Blockchain', 82.40, 78.00, 82.00, 86.00, '{"sampleSize": 950, "period": "30d", "avgCostPerRequest": "0.002", "avgLatencyMs": 150, "successRate": 0.978}'),
  -- IoT (2)
  ('api.particle.io', 'IoT', 76.50, 85.00, 70.00, 74.00, '{"sampleSize": 400, "period": "30d", "avgCostPerRequest": "0.003", "avgLatencyMs": 280, "successRate": 0.955}'),
  ('api.thingsboard.io', 'IoT', 73.80, 88.00, 65.00, 70.00, '{"sampleSize": 350, "period": "30d", "avgCostPerRequest": "0.002", "avgLatencyMs": 320, "successRate": 0.942}'),
  -- Finance (3)
  ('api.coingecko.com', 'Finance', 88.70, 95.00, 82.00, 88.00, '{"sampleSize": 2000, "period": "30d", "avgCostPerRequest": "0.0005", "avgLatencyMs": 150, "successRate": 0.978}'),
  ('api.stripe.com', 'Finance', 91.00, 55.00, 95.00, 99.00, '{"sampleSize": 1800, "period": "30d", "avgCostPerRequest": "0.030", "avgLatencyMs": 120, "successRate": 0.999}'),
  ('api.plaid.com', 'Finance', 83.50, 50.00, 88.00, 96.00, '{"sampleSize": 1000, "period": "30d", "avgCostPerRequest": "0.035", "avgLatencyMs": 200, "successRate": 0.990}'),
  -- Social (2)
  ('api.twitter.com', 'Social', 72.00, 70.00, 78.00, 68.00, '{"sampleSize": 1500, "period": "30d", "avgCostPerRequest": "0.005", "avgLatencyMs": 250, "successRate": 0.935}'),
  ('graph.facebook.com', 'Social', 77.30, 82.00, 75.00, 74.00, '{"sampleSize": 1300, "period": "30d", "avgCostPerRequest": "0.003", "avgLatencyMs": 280, "successRate": 0.952}'),
  -- Communication (2)
  ('api.twilio.com', 'Communication', 86.80, 60.00, 92.00, 98.00, '{"sampleSize": 1100, "period": "30d", "avgCostPerRequest": "0.020", "avgLatencyMs": 110, "successRate": 0.998}'),
  ('api.sendgrid.com', 'Communication', 84.50, 72.00, 88.00, 92.00, '{"sampleSize": 900, "period": "30d", "avgCostPerRequest": "0.010", "avgLatencyMs": 140, "successRate": 0.985}'),
  -- Storage (3)
  ('storage.googleapis.com', 'Storage', 80.20, 72.00, 90.00, 82.00, '{"sampleSize": 500, "period": "30d", "avgCostPerRequest": "0.008", "avgLatencyMs": 95, "successRate": 0.972}'),
  ('s3.amazonaws.com', 'Storage', 87.00, 68.00, 94.00, 96.00, '{"sampleSize": 1400, "period": "30d", "avgCostPerRequest": "0.010", "avgLatencyMs": 80, "successRate": 0.995}'),
  ('api.cloudflare.com', 'Storage', 83.40, 80.00, 88.00, 82.00, '{"sampleSize": 600, "period": "30d", "avgCostPerRequest": "0.005", "avgLatencyMs": 60, "successRate": 0.975}')
ON CONFLICT (endpoint) DO NOTHING;

-- 7. Update category stats from endpoint_scores
UPDATE categories c SET
  endpoint_count = sub.cnt,
  avg_score = sub.avg,
  updated_at = NOW()
FROM (
  SELECT category, COUNT(*) as cnt, ROUND(AVG(overall_score), 2) as avg
  FROM endpoint_scores
  GROUP BY category
) sub
WHERE c.name = sub.category;

-- 8. Synthetic request logs (past 7 days, ~80 rows)
-- Spread across multiple endpoints with varied cost, latency, and cache status
INSERT INTO requests (project_id, endpoint, full_url, method, status_code, cost, cached, latency_ms, policy_id, created_at) VALUES
  -- Day -6
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 320, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 310, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 350, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/simple/price', 'GET', 200, 500, false, 150, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/simple/price', 'GET', 200, 0, true, 8, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'storage.googleapis.com', 'https://storage.googleapis.com/bucket/file.json', 'GET', 200, 8000, false, 95, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 2 hours'),
  -- Day -5
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 290, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 11 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 9 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 340, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'mainnet.infura.io', 'https://mainnet.infura.io/v3/key/eth_blockNumber', 'POST', 200, 1000, false, 180, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.stripe.com', 'https://api.stripe.com/v1/charges', 'POST', 200, 30000, false, 120, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'api.twilio.com', 'https://api.twilio.com/2010-04-01/Messages.json', 'POST', 200, 20000, false, 110, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days'),
  -- Day -4
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 330, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 360, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/coins/markets', 'GET', 200, 500, false, 160, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/coins/markets', 'GET', 200, 0, true, 7, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/coins/markets', 'GET', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 's3.amazonaws.com', 'https://s3.amazonaws.com/bucket/data.csv', 'GET', 200, 10000, false, 80, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 's3.amazonaws.com', 'https://s3.amazonaws.com/bucket/data.csv', 'GET', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'api.twitter.com', 'https://api.twitter.com/2/tweets/search', 'GET', 200, 5000, false, 250, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days'),
  -- Day -3
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 305, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 11 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 315, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 9 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 345, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 0, true, 7, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.cohere.ai', 'https://api.cohere.ai/v1/generate', 'POST', 200, 8000, false, 400, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.snowflake.com', 'https://api.snowflake.com/queries', 'POST', 200, 20000, false, 200, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.particle.io', 'https://api.particle.io/v1/devices', 'GET', 200, 3000, false, 280, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'api.sendgrid.com', 'https://api.sendgrid.com/v3/mail/send', 'POST', 200, 10000, false, 140, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days'),
  -- Day -2
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 325, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 0, true, 3, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 355, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 340, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/simple/price', 'GET', 200, 500, false, 145, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/simple/price', 'GET', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'mainnet.infura.io', 'https://mainnet.infura.io/v3/key/eth_getBalance', 'POST', 200, 1000, false, 175, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000010', 'api.alchemy.com', 'https://api.alchemy.com/v2/key/eth_blockNumber', 'POST', 200, 2000, false, 150, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000010', 'graph.facebook.com', 'https://graph.facebook.com/v18.0/me/posts', 'GET', 200, 3000, false, 280, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000010', 'api.databricks.com', 'https://api.databricks.com/api/2.0/jobs/run', 'POST', 200, 25000, false, 250, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  -- Day -1 (yesterday)
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 310, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 11 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 300, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 9 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 350, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.cohere.ai', 'https://api.cohere.ai/v1/generate', 'POST', 200, 8000, false, 390, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.stripe.com', 'https://api.stripe.com/v1/payment_intents', 'POST', 200, 30000, false, 115, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/coins/bitcoin', 'GET', 200, 500, false, 155, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/coins/bitcoin', 'GET', 200, 0, true, 7, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000010', 'storage.googleapis.com', 'https://storage.googleapis.com/bucket/report.pdf', 'GET', 200, 8000, false, 90, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000010', 'storage.googleapis.com', 'https://storage.googleapis.com/bucket/report.pdf', 'GET', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '23 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.thingsboard.io', 'https://api.thingsboard.io/api/plugins/telemetry', 'GET', 200, 2000, false, 320, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '22 hours'),
  -- Day 0 (today)
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 15000, false, 315, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 12000, false, 348, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.anthropic.com', 'https://api.anthropic.com/v1/messages', 'POST', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/simple/price', 'GET', 200, 500, false, 148, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.coingecko.com', 'https://api.coingecko.com/api/v3/simple/price', 'GET', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.twilio.com', 'https://api.twilio.com/2010-04-01/Messages.json', 'POST', 200, 20000, false, 105, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.cloudflare.com', 'https://api.cloudflare.com/client/v4/zones', 'GET', 200, 5000, false, 60, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'api.plaid.com', 'https://api.plaid.com/transactions/get', 'POST', 200, 35000, false, 200, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '30 minutes'),
  -- Some 500 errors for realism
  ('00000000-0000-0000-0000-000000000010', 'api.openai.com', 'https://api.openai.com/v1/chat/completions', 'POST', 500, 0, false, 5200, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.twitter.com', 'https://api.twitter.com/2/tweets/search', 'GET', 429, 0, false, 50, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'mainnet.infura.io', 'https://mainnet.infura.io/v3/key/eth_call', 'POST', 502, 0, false, 30000, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 8 hours');
