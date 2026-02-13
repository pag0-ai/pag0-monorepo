# Glossary

> **TL;DR**: A document organizing the core terms, abbreviations, and technology stack used in the Pag0 project. Provides a quick reference for protocol, architecture, and business terminology.

## Related Documents

- [01-PRODUCT-BRIEF.md](01-PRODUCT-BRIEF.md) - Product Overview
- [02-COMPETITOR-ANALYSIS.md](02-COMPETITOR-ANALYSIS.md) - Competitor Analysis
- [03-TECH-SPEC.md](03-TECH-SPEC.md) - Technical Specification
- [04-API-SPEC.md](04-API-SPEC.md) - API Specification
- [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) - Business Model
- [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) - Security Design
- [12-SDK-GUIDE.md](12-SDK-GUIDE.md) - SDK Guide

---

## Protocols / Standards

| Term | Definition |
|------|-----------|
| **x402** | An open payment protocol based on HTTP 402 Payment Required, led by Coinbase. Enables AI agents to automatically perform micropayments when calling APIs. |
| **HTTP 402 (Payment Required)** | An HTTP status code indicating that payment is required for the server to process the request. Used as the core mechanism of the x402 protocol. |
| **ERC-8004** | An on-chain reputation system standard proposed by SlinkyLayer. An Ethereum Request for Comments specification that manages service provider trustworthiness through tokenization within the x402 ecosystem. |
| **@x402/fetch** | The official JavaScript/TypeScript SDK for the x402 protocol provided by Coinbase. Handles HTTP 402 response parsing, Payment Request generation, and payment signing. |
| **402pay** | An alternative protocol implementation of the HTTP 402 payment standard. A competing protocol with similar goals to x402. |
| **h402** | An open-source 402 payment implementation. Primarily used for educational and experimental purposes. |
| **x4Pay** | A 402 payment implementation specialized for IoT/ESP32 devices. |

---

## Product / Architecture Terms

| Term | Definition |
|------|-----------|
| **Pag0 Smart Proxy** | A smart proxy layer built on top of the x402 ecosystem. A 3-in-1 solution combining Policy Engine + Curation Engine + Cache Layer that controls and optimizes AI agents' paid API calls. |
| **Proxy Core** | The core component of Pag0. Relays x402 requests and orchestrates the payment process. The proxy never signs payments — it only relays Payment Payloads signed by the Agent. |
| **Policy Engine (Spend Firewall)** | An engine that validates budget limits, whitelists/blacklists, and approval workflows. Applies per-request/daily/monthly budget policies to prevent AI agents from overspending. |
| **Cache Layer (Smart Cache)** | A Redis-based response caching system. Prevents duplicate payments for identical API requests, achieving 40%+ cost savings. Supports TTL (Time To Live) management and pattern-based caching rules. |
| **Curation Engine** | An API scoring/recommendation engine based on real usage data. Evaluates endpoints across three axes — Cost, Latency, and Reliability — and provides category-based rankings and recommendations. |
| **Analytics Collector** | A pipeline that collects and aggregates metrics (request count, latency, success rate, cost, cache hit rate) from all proxy requests. |
| **API Curation** | A feature that objectively evaluates and recommends x402 API endpoints based on real usage data passing through the proxy. Compares APIs using measured data rather than marketing materials. |
| **Spend Policy** | A spending policy configured per project. Includes maximum amount per request (`maxPerRequest`), daily budget (`dailyBudget`), monthly budget (`monthlyBudget`), and allowed/blocked endpoint lists. |
| **Facilitator** | A service in the x402 protocol that performs payment verification and settlement. Validates the Payment Payload signed by the Agent and completes the payment. |
| **Resource Server (x402 Server)** | A server in the x402 protocol that provides paid APIs/data. Returns an HTTP 402 response along with a Payment Request when payment is required. |
| **Payment Request** | Payment request information returned by an x402 server along with a 402 response. Includes the amount, recipient address, Facilitator URL, expiration time, etc. |
| **Payment Relay** | The method by which the Pag0 proxy simply forwards the payment payload signed by the Agent to the Facilitator. The proxy does not sign — it only relays. |
| **Endpoint Score** | A composite score (0-100) for an API endpoint calculated by the Curation Engine. Computed as a weighted sum of cost score (40%), latency score (30%), and reliability score (30%). |
| **Dashboard** | A web UI providing real-time metric visualization, policy management, and an API ranking board. Built with React/Next.js. |

---

## Technology Stack

| Term | Definition |
|------|-----------|
| **Bun** | A high-performance JavaScript/TypeScript runtime. Offers faster execution speed compared to Node.js and is used as the default runtime for the Pag0 proxy. |
| **Hono** | A lightweight web framework. Excellent compatibility with edge environments (Cloudflare Workers, etc.) and fast routing. Used as the framework for the Pag0 API server. |
| **Upstash Redis** | A serverless Redis service. Provides global multi-region replication, low latency (<5ms), and pay-per-use pricing. Used for Pag0's cache layer, budget counters, and rate limiter. |
| **Supabase PostgreSQL** | An open-source PostgreSQL hosting service. Used as the relational data store for managing policies, request logs, analytics data, and endpoint scores. Supports Row-Level Security (RLS). |
| **SKALE** | An EVM-compatible Layer-1 blockchain featuring Zero Gas (no gas fees). Used in Pag0 for on-chain metric storage and immutable audit trails. |
| **The Graph** | A blockchain data indexing protocol. Indexes x402 payment events through subgraphs to provide transparent payment history. |
| **Subgraph** | A unit in The Graph that indexes specific smart contract events. Pag0 operates a subgraph that indexes Payment Events and Endpoint Aggregates. |
| **Cloudflare Workers** | An edge computing platform. Provides low latency (<50ms P99) through globally distributed deployment. One of the production deployment options for Pag0. |
| **Fly.io** | A globally distributed application hosting platform. Supports multi-region deployment and auto-scaling. One of the production deployment options for Pag0. |
| **ethers.js** | A JavaScript library for interacting with Ethereum and EVM-compatible blockchains. Used for recording on-chain metrics on SKALE. |
| **Docker Compose** | A tool for managing services such as Redis and PostgreSQL as containers in a local development environment. |
| **TypeScript** | A statically-typed extension of JavaScript. Used across the entire Pag0 codebase. |

---

## Blockchain / Payment Terms

| Term | Definition |
|------|-----------|
| **USDC** | USD Coin. A dollar-pegged stablecoin issued by Circle and the default payment method for the x402 protocol. Uses 6 decimals, where 1 USDC = 1,000,000 (stored value). |
| **Base (L2)** | An Ethereum Layer 2 network operated by Coinbase. The default chain on which x402 payments are processed. Uses Base Sepolia (testnet) and Base Mainnet (production). |
| **Zero Gas** | SKALE network's zero gas fee feature. Enables on-chain operations without transaction fees, making it suitable for high-frequency metric recording. |
| **pSLINKY** | SlinkyLayer's reputation token. Tokenizes service provider trustworthiness based on the ERC-8004 standard. |
| **Nonce** | A one-time identifier to prevent payment replay attacks. A used Payment ID is stored in Redis for 1 hour to block duplicate submissions. |
| **Payment Replay Prevention** | A security mechanism that prevents the same payment signature from being submitted more than once. Implemented using nonces. |
| **Coinbase CDP** | Coinbase Developer Platform. Provides x402 Facilitator and payment processing infrastructure. |

---

## SDK / Development Tools

| Term | Definition |
|------|-----------|
| **@pag0/sdk** | The official Pag0 TypeScript SDK. Creates a client with `createPag0Client` and calls x402 APIs via the proxy using `pag0.fetch()`. Provides policy configuration, caching, and analytics querying in 3 lines of code. |
| **@pag0/cli** | The Pag0 CLI (Command Line Interface) tool. Manages project creation, API key issuance, and policy management from the terminal. |
| **createPag0Client** | The main factory function of @pag0/sdk. Creates a Pag0 client instance by accepting API Key, policy, and cache settings as arguments. |
| **pag0.fetch()** | The core method of @pag0/sdk. Sends x402 requests through the Pag0 proxy using the same interface as the standard `fetch()` API. |
| **X-Pag0-API-Key** | An HTTP header used for Pag0 API authentication. Format: `pag0_live_{32_char_random}` (production) or `pag0_test_{32_char_random}` (test). |

---

## Security Terms

| Term | Definition |
|------|-----------|
| **Zero Trust** | A security architecture principle of "never trust any request." Applies the same authentication/authorization/validation to all API requests without distinguishing between internal and external. |
| **Defense in Depth** | A strategy that does not rely on a single security layer but instead provides layered defense across 6 layers: Network, Authentication, Authorization, Application, Data, and Audit. |
| **Least Privilege** | A security principle where each component holds only the minimum required permissions. For example, API Keys are scoped to specific projects, and database access is separated into read/write. |
| **Rate Limiting** | A mechanism that limits the number of API requests per unit of time. Free tier is limited to 60 requests/min, Pro tier to 1,000 requests/min. |
| **Anomaly Detection** | A feature that automatically detects abnormal spending/request patterns compared to normal patterns and sends alerts. Sends webhook notifications when configured deviation thresholds (e.g., 200% = 2x normal) are exceeded. |
| **Row-Level Security (RLS)** | Row-level access control in PostgreSQL. Ensures users can only query data from their own projects. |
| **Approval Workflow** | A process that automatically requests administrator approval for high-value payment requests. Calls a webhook and waits for approval/rejection when a configured threshold is exceeded. |

---

## Business Terms

| Term | Definition |
|------|-----------|
| **Freemium** | A business model that offers basic features for free and charges for premium features. Pag0 operates 3 tiers: Free (1,000 req/day), Pro ($49/month), and Enterprise ($299/month). |
| **Savings Share** | A revenue model where Pag0 takes 15% of cache savings as a fee. Pag0 only earns revenue when the customer saves money — a value-aligned pricing structure. |
| **TAM (Total Addressable Market)** | The total market size. Combined API Management + AI Agent Payments market estimated at ~$20B (2028 projection). |
| **SAM (Serviceable Addressable Market)** | The actually reachable market size. x402 Ecosystem + Enterprise AI Agents market at ~$2B/year. |
| **SOM (Serviceable Obtainable Market)** | The short-term obtainable market size. Year 1 target ARR of $1.17M (0.58% of SAM). |
| **LTV (Lifetime Value)** | Customer lifetime value. Total revenue generated by a customer over their service usage period. Pro tier LTV $16,133, Enterprise tier LTV $275,174. |
| **CAC (Customer Acquisition Cost)** | The cost of acquiring one paying customer. Pro tier CAC $150, Enterprise tier CAC $3,000. |
| **LTV/CAC** | The ratio of customer lifetime value to acquisition cost. In the SaaS industry, 3x+ is healthy, 5x+ is excellent. Pag0 blended: 94.4x. |
| **MRR (Monthly Recurring Revenue)** | Monthly recurring revenue. A core metric for SaaS businesses. |
| **ARR (Annual Recurring Revenue)** | Annual recurring revenue. Calculated as MRR x 12. Year 1 target: $1.31M. |
| **ARPU (Average Revenue Per User)** | Average revenue per user. Pro tier ARPU $949/month (subscription $49 + Savings Share $900). |
| **NPS (Net Promoter Score)** | Customer recommendation likelihood score (-100 to +100). Phase 1 target: NPS 50+. |
| **MAU (Monthly Active Users)** | Monthly active user count. Target: 100 MAU within 3 months post-hackathon. |
| **Churn Rate** | Customer attrition rate. Assumed 5%/month for Pro tier, 3%/month for Enterprise tier. |
| **Payback Period** | CAC recovery period. Pag0 blended: 0.22 months (~6.6 days). |
| **Product-Market Fit (PMF)** | The state where a product meets the market's needs. The core validation goal for Phase 1. |
| **Blue Ocean Strategy** | A strategy of creating a new market with no competition. Pag0 captures the vacant market of the Proxy/Control layer in the x402 ecosystem. |
| **Data Moat** | A competitive advantage where accumulated usage data makes it difficult for latecomers to enter. More proxy requests → more accurate curation → more users — a virtuous cycle. |
| **Network Effect** | The phenomenon where service value increases as users grow. Pag0's curation quality improves proportionally with usage data. |

---

## Ecosystem / Partners

| Term | Definition |
|------|-----------|
| **x402 Bazaar** | A service discovery platform in the x402 ecosystem. Provides x402 service listings and search functionality centered around the Facilitator. Complementary to Pag0. |
| **SlinkyLayer** | A reputation system + marketplace in the x402 ecosystem. Operates a reputation system based on the ERC-8004 standard and the pSLINKY token. Based on subjective reviews (vs Pag0's objective data-based approach). |
| **Virtuals G.A.M.E. SDK** | A game agent creation SDK. Integrates with Pag0 to support use cases for managing game agents' API spending. |
| **Google ADK (Agent Development Kit)** | Google's AI agent development kit. Used in Pag0 demos for agent orchestration scenarios. |
| **Claude Code** | Anthropic's AI coding tool. One of the tools used alongside Pag0 in AI agent development workflows. |
| **MCP (Model Context Protocol)** | An interaction protocol between AI models and external tools. Through MCP Servers, AI agents can manage costs via Pag0 when calling APIs. |
| **MCP Server** | A server implementing the MCP protocol. Provides an interface for AI agents to access external tools/APIs, and can be integrated with the Pag0 proxy for cost optimization. |
| **LangChain** | An LLM-based application development framework. Automatically manages agents' x402 costs through official integration with the Pag0 SDK. |
| **CrewAI** | A multi-agent orchestration framework. A target for Pag0 SDK integration. |

---

## Regulatory / Compliance

| Term | Definition |
|------|-----------|
| **EU AI Act** | The European Union's AI regulation law. Scheduled to take effect in August 2026. Requires audit trails and spending controls for AI agents' autonomous financial activities. |
| **Colorado AI Act** | The US state of Colorado's AI regulation law. Scheduled to take effect in June 2026. Requires transparency and accountability for AI systems. |
| **SOC2** | Service Organization Control 2. A standard certifying the security/availability/confidentiality of SaaS companies. Target for Year 2 acquisition. |
| **ISO 27001** | An international standard for information security management systems. Target for Year 2 acquisition to support Enterprise customers. |
| **Agentic Commerce** | A commerce paradigm where AI agents autonomously perform payments/transactions. Visa TAP, Google AP2, PayPal Agentic, etc. launched in 2025. |

---

## Metrics / Performance Indicators

| Term | Definition |
|------|-----------|
| **Cache Hit Rate** | The ratio of total requests served from cache. Pag0 target: 40%+. Higher rates mean greater cost savings. |
| **P50 / P95 / P99 Latency** | The 50th, 95th, and 99th percentile response times (milliseconds) respectively. P95 targets: Cache Hit <10ms, Cache Miss <200ms, Overall API <300ms. |
| **Success Rate** | The ratio of total requests returning 2xx status codes. Used for calculating the Curation Engine's reliability score. |
| **TTL (Time To Live)** | The validity duration (seconds) of a cache entry. Automatically deleted after expiration; custom TTL settings per endpoint are supported. Default: 300 seconds (5 minutes). |
| **Uptime** | Service availability ratio. Target: 99.9%. |
| **Rule of 40** | A SaaS company health metric. Revenue growth rate (%) + profit margin (%) should be 40 or above for excellence. Pag0 target: 70+. |
| **Magic Number** | A SaaS sales efficiency metric. New ARR / previous quarter S&M expenses. 0.75+ is efficient. Pag0 target: 1.5. |
| **Net Revenue Retention (NRR)** | Net revenue retention rate from the existing customer base. 100%+ means revenue expansion from existing customers exceeds churn. Pag0 target: 120%+. |

---

**Version**: 1.0
**Last Updated**: 2026-02-10
