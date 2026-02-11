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
-- API key: pag0_test_local_dev_key_here
-- SHA-256 hash: echo -n "pag0_test_local_dev_key_here" | sha256sum
-- = 7e5b87f920e3d1a8c4f6b2d9e1a3c5f7d9b1e3a5c7f9d1b3e5a7c9d1f3b5e7a9 (placeholder — computed at insert)
-- Password: demo123 (bcrypt hash generated offline)
INSERT INTO users (id, email, password_hash, api_key_hash, subscription_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@pag0.dev',
  '$2b$12$LJ3m4ys3Lz0nDfHvPOGGi.XBwDCPVz5yXweYZDNqjKMd3vY.w6jmK',
  encode(digest('pag0_test_local_dev_key_here', 'sha256'), 'hex'),
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

-- 5. Demo budget
INSERT INTO budgets (id, project_id, daily_spent, monthly_spent)
VALUES (
  '00000000-0000-0000-0000-000000001000',
  '00000000-0000-0000-0000-000000000010',
  0,
  0
)
ON CONFLICT (project_id) DO NOTHING;

-- 6. Sample endpoint scores (5)
INSERT INTO endpoint_scores (endpoint, category, overall_score, cost_score, latency_score, reliability_score, evidence) VALUES
  ('api.openai.com', 'AI', 82.50, 65.00, 88.00, 95.00, '{"sampleSize": 1500, "period": "30d", "avgCostPerRequest": "0.015", "avgLatencyMs": 320, "successRate": 0.987}'),
  ('api.anthropic.com', 'AI', 85.30, 70.00, 85.00, 97.00, '{"sampleSize": 1200, "period": "30d", "avgCostPerRequest": "0.012", "avgLatencyMs": 350, "successRate": 0.995}'),
  ('mainnet.infura.io', 'Blockchain', 78.00, 80.00, 75.00, 78.00, '{"sampleSize": 800, "period": "30d", "avgCostPerRequest": "0.001", "avgLatencyMs": 180, "successRate": 0.965}'),
  ('api.coingecko.com', 'Finance', 88.70, 95.00, 82.00, 88.00, '{"sampleSize": 2000, "period": "30d", "avgCostPerRequest": "0.0005", "avgLatencyMs": 150, "successRate": 0.978}'),
  ('storage.googleapis.com', 'Storage', 80.20, 72.00, 90.00, 82.00, '{"sampleSize": 500, "period": "30d", "avgCostPerRequest": "0.008", "avgLatencyMs": 95, "successRate": 0.972}')
ON CONFLICT (endpoint) DO NOTHING;
