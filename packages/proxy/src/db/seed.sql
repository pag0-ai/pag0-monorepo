-- Pag0 Smart Proxy — Seed Data
-- Idempotent: all inserts use ON CONFLICT DO NOTHING
-- Source: base-sepolia-x402-apis.json (408 real x402 endpoints on Base Sepolia)

-- 1. Categories (8) — consolidated from 50+ x402 ecosystem categories
INSERT INTO categories (name, description) VALUES
  ('AI Agents',             'AI research, personal, swarm, and trading agents'),
  ('Data & Analytics',      'Data feeds, dashboards, and visualization services'),
  ('IPFS & Storage',        'IPFS content delivery and decentralized storage'),
  ('Content & Media',       'Text, image, video generation and creative content'),
  ('Web & Automation',      'Web search, crawling, browser automation, and document services'),
  ('Agent Infrastructure',  'Agent protocols, deployment, marketplaces, and API funding'),
  ('Crypto & NFT',          'Crypto analytics, NFT minting, token creation, and on-chain services'),
  ('Developer Tools',       'Starter demos, math APIs, randomness, and developer utilities')
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

-- 6. Endpoint scores — real x402 Base Sepolia endpoints (20 endpoints, all 8 categories)
--    Costs are USDC 6-decimal (1 USDC = 1,000,000)
INSERT INTO endpoint_scores (endpoint, category, overall_score, cost_score, latency_score, reliability_score, evidence) VALUES
  -- AI Agents (3) — largest x402 category (~246 resources on dctx.link alone)
  ('api-dev.intra-tls2.dctx.link',    'AI Agents', 86.50, 72.00, 88.00, 96.00, '{"sampleSize": 2400, "period": "30d", "avgCostPerRequest": "37967", "avgLatencyMs": 280, "successRate": 0.992, "network": "base-sepolia", "resourceCount": 246}'),
  ('api-staging.intra-tls2.dctx.link', 'AI Agents', 82.30, 68.00, 85.00, 93.00, '{"sampleSize": 450, "period": "30d", "avgCostPerRequest": "60909", "avgLatencyMs": 320, "successRate": 0.978, "network": "base-sepolia", "resourceCount": 22}'),
  ('api-dev.agents.skillfulai.io',     'AI Agents', 78.00, 88.00, 80.00, 82.00, '{"sampleSize": 120, "period": "30d", "avgCostPerRequest": "10000", "avgLatencyMs": 350, "successRate": 0.965, "network": "base-sepolia", "resourceCount": 1}'),
  -- Data & Analytics (2) — Grapevine data feed platform
  ('api.grapevine.markets',            'Data & Analytics', 84.20, 55.00, 90.00, 97.00, '{"sampleSize": 900, "period": "30d", "avgCostPerRequest": "163571", "avgLatencyMs": 180, "successRate": 0.995, "network": "base-sepolia", "resourceCount": 14}'),
  ('chat-paal-staging.vercel.app',     'Data & Analytics', 75.80, 40.00, 78.00, 88.00, '{"sampleSize": 200, "period": "30d", "avgCostPerRequest": "800000", "avgLatencyMs": 420, "successRate": 0.958, "network": "base-sepolia", "resourceCount": 1}'),
  -- IPFS & Storage (3) — Pinata gateways dominate
  ('grapevine.dev-mypinata.cloud',                   'IPFS & Storage', 83.40, 50.00, 92.00, 95.00, '{"sampleSize": 1800, "period": "30d", "avgCostPerRequest": "185500", "avgLatencyMs": 120, "successRate": 0.988, "network": "base-sepolia", "resourceCount": 56}'),
  ('brown-voluntary-aardwolf-402.mypinata.cloud',    'IPFS & Storage', 80.70, 82.00, 88.00, 90.00, '{"sampleSize": 350, "period": "30d", "avgCostPerRequest": "15000", "avgLatencyMs": 145, "successRate": 0.975, "network": "base-sepolia", "resourceCount": 6}'),
  ('purple-peculiar-wolf-522.dev-mypinata.cloud',    'IPFS & Storage', 79.20, 95.00, 85.00, 86.00, '{"sampleSize": 180, "period": "30d", "avgCostPerRequest": "1000", "avgLatencyMs": 160, "successRate": 0.968, "network": "base-sepolia", "resourceCount": 5}'),
  -- Content & Media (3) — diverse content generators
  ('x402-motivate-api.vercel.app', 'Content & Media', 81.00, 88.00, 82.00, 78.00, '{"sampleSize": 250, "period": "30d", "avgCostPerRequest": "10000", "avgLatencyMs": 280, "successRate": 0.952, "network": "base-sepolia", "resourceCount": 1}'),
  ('nickeljoke.vercel.app',        'Content & Media', 85.50, 92.00, 90.00, 80.00, '{"sampleSize": 400, "period": "30d", "avgCostPerRequest": "5000", "avgLatencyMs": 150, "successRate": 0.970, "network": "base-sepolia", "resourceCount": 1}'),
  ('x402.xseer.fun',               'Content & Media', 74.30, 45.00, 75.00, 82.00, '{"sampleSize": 150, "period": "30d", "avgCostPerRequest": "1775000", "avgLatencyMs": 500, "successRate": 0.942, "network": "base-sepolia", "resourceCount": 4}'),
  -- Web & Automation (2) — entropy.rip offers free tier
  ('entropy.rip',                                'Web & Automation', 88.00, 100.00, 85.00, 90.00, '{"sampleSize": 600, "period": "30d", "avgCostPerRequest": "0", "avgLatencyMs": 200, "successRate": 0.985, "network": "base-sepolia", "resourceCount": 10}'),
  ('link-sign-402.turboservercap.workers.dev',   'Web & Automation', 77.50, 35.00, 88.00, 92.00, '{"sampleSize": 80, "period": "30d", "avgCostPerRequest": "1000000", "avgLatencyMs": 160, "successRate": 0.975, "network": "base-sepolia", "resourceCount": 1}'),
  -- Agent Infrastructure (3) — Virtuals, Grove, x402-chat
  ('dev-acp-x402.virtuals.io',    'Agent Infrastructure', 82.80, 95.00, 80.00, 85.00, '{"sampleSize": 300, "period": "30d", "avgCostPerRequest": "1000", "avgLatencyMs": 300, "successRate": 0.972, "network": "base-sepolia", "resourceCount": 1}'),
  ('testnet.api.grove.city',      'Agent Infrastructure', 80.20, 35.00, 82.00, 94.00, '{"sampleSize": 500, "period": "30d", "avgCostPerRequest": "1000000", "avgLatencyMs": 250, "successRate": 0.990, "network": "base-sepolia", "resourceCount": 1}'),
  ('x402-chat-tau.vercel.app',    'Agent Infrastructure', 79.00, 60.00, 78.00, 88.00, '{"sampleSize": 220, "period": "30d", "avgCostPerRequest": "125500", "avgLatencyMs": 380, "successRate": 0.962, "network": "base-sepolia", "resourceCount": 2}'),
  -- Crypto & NFT (2) — on-chain minting and fortune services
  ('saliferous-cris-unbleaching.ngrok-free.dev', 'Crypto & NFT', 72.50, 30.00, 65.00, 78.00, '{"sampleSize": 100, "period": "30d", "avgCostPerRequest": "2018333", "avgLatencyMs": 600, "successRate": 0.940, "network": "base-sepolia", "resourceCount": 6}'),
  ('www.ritmex.one',                             'Crypto & NFT', 76.80, 95.00, 82.00, 74.00, '{"sampleSize": 60, "period": "30d", "avgCostPerRequest": "1000", "avgLatencyMs": 220, "successRate": 0.920, "network": "base-sepolia", "resourceCount": 1}'),
  -- Developer Tools (2) — starter apps and discovery
  ('x402-ai-starter.vercel.app',                 'Developer Tools', 90.00, 92.00, 94.00, 96.00, '{"sampleSize": 2000, "period": "30d", "avgCostPerRequest": "5000", "avgLatencyMs": 95, "successRate": 0.998, "network": "base-sepolia", "resourceCount": 1}'),
  ('x402-prompt-store.vercel.app',               'Developer Tools', 84.60, 90.00, 88.00, 86.00, '{"sampleSize": 350, "period": "30d", "avgCostPerRequest": "4000", "avgLatencyMs": 130, "successRate": 0.978, "network": "base-sepolia", "resourceCount": 3}')
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
-- Real x402 Base Sepolia endpoints with varied cost, latency, and cache status
-- Costs in USDC 6-decimal (e.g., 10000 = $0.01)
INSERT INTO requests (project_id, endpoint, full_url, method, status_code, cost, cached, latency_ms, policy_id, created_at) VALUES
  -- Day -6
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f8bc96e8c89ccc1da83cf4', 'POST', 200, 10000, false, 290, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f0cc109c162996ee719438', 'POST', 200, 10000, false, 310, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019adc77-9858-7c1e-97ed-e6e100d7bea2/entries', 'GET', 200, 100000, false, 180, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'grapevine.dev-mypinata.cloud', 'https://grapevine.dev-mypinata.cloud/x402/cid/bafybeiffjwkdfy5lemdom3jmt2cb3uixtrbptq46gkznyyoqvdgeswqebm', 'GET', 200, 185500, false, 120, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'grapevine.dev-mypinata.cloud', 'https://grapevine.dev-mypinata.cloud/x402/cid/bafybeiffjwkdfy5lemdom3jmt2cb3uixtrbptq46gkznyyoqvdgeswqebm', 'GET', 200, 0, true, 8, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'x402-ai-starter.vercel.app', 'https://x402-ai-starter.vercel.app/api/add', 'POST', 200, 5000, false, 95, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '6 days 2 hours'),
  -- Day -5
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f8a8ed88e91d0ba6c989aa', 'POST', 200, 10000, false, 275, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 11 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f8a8ed88e91d0ba6c989aa', 'POST', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 9 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-staging.intra-tls2.dctx.link', 'https://api-staging.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68fb421a94745594d2d03e19', 'POST', 200, 10000, false, 330, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-staging.intra-tls2.dctx.link', 'https://api-staging.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68fb421a94745594d2d03e19', 'POST', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'entropy.rip', 'https://entropy.rip/api/browser/manifest', 'POST', 200, 0, false, 200, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'testnet.api.grove.city', 'https://testnet.api.grove.city/v1/fund', 'POST', 200, 1000000, false, 250, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'x402-motivate-api.vercel.app', 'https://x402-motivate-api.vercel.app/motivate', 'POST', 200, 10000, false, 280, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 days'),
  -- Day -4
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/agent/qrn:agent:6823065f5380bd59df4992e4', 'POST', 200, 10000, false, 300, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/agent/qrn:agent:6823065f5380bd59df4992e4', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019ae572-50d9-78a2-a959-d29d95bcec81/entries', 'GET', 200, 100000, false, 175, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019ae572-50d9-78a2-a959-d29d95bcec81/entries', 'GET', 200, 0, true, 7, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds', 'GET', 200, 990000, false, 190, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'brown-voluntary-aardwolf-402.mypinata.cloud', 'https://brown-voluntary-aardwolf-402.mypinata.cloud/x402/cid/bafybeiew7aih35pjmydori62qtsq7ytyf7i3srztfnpupouxmdxdjtccuy', 'GET', 200, 15000, false, 145, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'brown-voluntary-aardwolf-402.mypinata.cloud', 'https://brown-voluntary-aardwolf-402.mypinata.cloud/x402/cid/bafybeiew7aih35pjmydori62qtsq7ytyf7i3srztfnpupouxmdxdjtccuy', 'GET', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'nickeljoke.vercel.app', 'https://nickeljoke.vercel.app/api/joke', 'GET', 200, 5000, false, 150, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'dev-acp-x402.virtuals.io', 'https://dev-acp-x402.virtuals.io/acp-budget', 'POST', 200, 1000, false, 300, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 days'),
  -- Day -3
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f98fd90f57b44388fa4031', 'POST', 200, 10000, false, 285, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 11 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/copilot/qrn:copilot:tars', 'POST', 200, 100000, false, 320, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 9 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/copilot/qrn:copilot:tars', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/agent/qrn:agent:686e427e62eed6598f066dfd', 'POST', 200, 10000, false, 350, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'grapevine.dev-mypinata.cloud', 'https://grapevine.dev-mypinata.cloud/x402/cid/bafybeiczoniae6yteqfxvhvqbhxd4joertnaletcl5fc7z6xwfaukisyzu', 'GET', 200, 185500, false, 115, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'grapevine.dev-mypinata.cloud', 'https://grapevine.dev-mypinata.cloud/x402/cid/bafybeiczoniae6yteqfxvhvqbhxd4joertnaletcl5fc7z6xwfaukisyzu', 'GET', 200, 0, true, 7, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'x402-prompt-store.vercel.app', 'https://x402-prompt-store.vercel.app/api/prompts', 'GET', 200, 5000, false, 130, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'entropy.rip', 'https://entropy.rip/api/storage/relic/create', 'POST', 200, 0, false, 210, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'x402-chat-tau.vercel.app', 'https://x402-chat-tau.vercel.app/api/agents/use', 'POST', 200, 1000, false, 380, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days'),
  -- Day -2
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68ec591f7938a7458fbcaf66', 'POST', 200, 10000, false, 295, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68ec591f7938a7458fbcaf66', 'POST', 200, 0, true, 3, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68fa06abc87f09b65914c428', 'POST', 200, 340000, false, 340, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/agent/qrn:agent:68f59a6a93d1a55ee56c7d3b', 'POST', 200, 100000, false, 305, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/agent/qrn:agent:68f59a6a93d1a55ee56c7d3b', 'POST', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019adc77-9858-7c1e-97ed-e6e100d7bea2/entries', 'GET', 200, 100000, false, 172, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019adc77-9858-7c1e-97ed-e6e100d7bea2/entries', 'GET', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'x402.xseer.fun', 'https://x402.xseer.fun/report/full', 'POST', 200, 100000, false, 500, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000010', 'link-sign-402.turboservercap.workers.dev', 'https://link-sign-402.turboservercap.workers.dev/api/create', 'POST', 200, 1000000, false, 160, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000010', 'entropy.rip', 'https://entropy.rip/api/notary/sign', 'POST', 200, 0, false, 195, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  ('00000000-0000-0000-0000-000000000010', 'saliferous-cris-unbleaching.ngrok-free.dev', 'https://saliferous-cris-unbleaching.ngrok-free.dev/report/full', 'POST', 200, 100000, false, 600, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days'),
  -- Day -1 (yesterday)
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f8b26f88e91d0ba6c9abe2', 'POST', 200, 500000, false, 310, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 11 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f8b26f88e91d0ba6c9abe2', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 9 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68dbd9a87706fb5081dcc99d', 'POST', 200, 10000, false, 265, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-staging.intra-tls2.dctx.link', 'https://api-staging.intra-tls2.dctx.link/x402/agent/qrn:agent:686e427e62eed6598f066dfd', 'POST', 200, 100000, false, 340, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-staging.intra-tls2.dctx.link', 'https://api-staging.intra-tls2.dctx.link/x402/agent/qrn:agent:686e427e62eed6598f066dfd', 'POST', 200, 0, true, 6, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.agents.skillfulai.io', 'https://api-dev.agents.skillfulai.io/api/x402/demo/testnet/premium', 'POST', 200, 10000, false, 350, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'x402-ai-starter.vercel.app', 'https://x402-ai-starter.vercel.app/api/add', 'POST', 200, 5000, false, 90, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'grapevine.dev-mypinata.cloud', 'https://grapevine.dev-mypinata.cloud/x402/cid/bafybeiffjwkdfy5lemdom3jmt2cb3uixtrbptq46gkznyyoqvdgeswqebm', 'GET', 200, 185500, false, 118, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'grapevine.dev-mypinata.cloud', 'https://grapevine.dev-mypinata.cloud/x402/cid/bafybeiffjwkdfy5lemdom3jmt2cb3uixtrbptq46gkznyyoqvdgeswqebm', 'GET', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day'),
  ('00000000-0000-0000-0000-000000000010', 'purple-peculiar-wolf-522.dev-mypinata.cloud', 'https://purple-peculiar-wolf-522.dev-mypinata.cloud/x402/cid/bafkreihqoybdolvloa6pqlksh6sggaf24vncv2kynn77mfblx3nue67qye', 'GET', 200, 1000, false, 160, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '23 hours'),
  ('00000000-0000-0000-0000-000000000010', 'www.ritmex.one', 'https://www.ritmex.one/x402/test', 'POST', 200, 1000, false, 220, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '22 hours'),
  -- Day 0 (today)
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f9dcfbc87f09b659144239', 'POST', 200, 10000, false, 288, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '10 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f9dcfbc87f09b659144239', 'POST', 200, 0, true, 4, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019adc77-9858-7c1e-97ed-e6e100d7bea2/entries', 'GET', 200, 100000, false, 168, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '7 hours'),
  ('00000000-0000-0000-0000-000000000010', 'api.grapevine.markets', 'https://api.grapevine.markets/v1/feeds/019adc77-9858-7c1e-97ed-e6e100d7bea2/entries', 'GET', 200, 0, true, 5, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0000-000000000010', 'entropy.rip', 'https://entropy.rip/api/storage/create', 'POST', 200, 0, false, 205, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0000-000000000010', 'nickeljoke.vercel.app', 'https://nickeljoke.vercel.app/api/joke', 'GET', 200, 5000, false, 148, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0000-000000000010', 'x402-chat-tau.vercel.app', 'https://x402-chat-tau.vercel.app/api/agents/create', 'POST', 200, 250000, false, 380, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-000000000010', 'testnet.api.grove.city', 'https://testnet.api.grove.city/v1/fund', 'POST', 200, 1000000, false, 245, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0000-000000000010', 'x402-prompt-store.vercel.app', 'https://x402-prompt-store.vercel.app/api/prompts', 'GET', 200, 5000, false, 125, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '30 minutes'),
  -- Errors for realism (x402 payment failures, timeouts, rate limits)
  ('00000000-0000-0000-0000-000000000010', 'api-dev.intra-tls2.dctx.link', 'https://api-dev.intra-tls2.dctx.link/x402/swarm/qrn:swarm:68f8bc96e8c89ccc1da83cf4', 'POST', 500, 0, false, 5200, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 days 8 hours'),
  ('00000000-0000-0000-0000-000000000010', 'saliferous-cris-unbleaching.ngrok-free.dev', 'https://saliferous-cris-unbleaching.ngrok-free.dev/mint/nft', 'POST', 502, 0, false, 30000, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 days 6 hours'),
  ('00000000-0000-0000-0000-000000000010', 'chat-paal-staging.vercel.app', 'https://chat-paal-staging.vercel.app/api/account', 'POST', 429, 0, false, 50, '00000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 day 8 hours');
