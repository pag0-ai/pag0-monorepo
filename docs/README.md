# Pag0 - Smart Proxy Layer for x402

> AI 에이전트의 유료 API 사용을 제어하는 스마트 프록시 플랫폼

---

## 문서 목록

### 공통

| # | 문서 | 파일 | 설명 |
|---|------|------|------|
| 0 | 용어집 | [00-GLOSSARY.md](00-GLOSSARY.md) | 핵심 용어 및 약어 정리 |

### Tier 1: 기반 문서

| # | 문서 | 파일 | 설명 |
|---|------|------|------|
| 1 | Product Brief | [01-PRODUCT-BRIEF.md](01-PRODUCT-BRIEF.md) | 피봇 후 최종 제품 정의 |
| 2 | 경쟁사 분석 v2 | [02-COMPETITOR-ANALYSIS.md](02-COMPETITOR-ANALYSIS.md) | Smart Proxy 기준 경쟁사 분석 |

### Tier 2: 개발 문서

| # | 문서 | 파일 | 설명 |
|---|------|------|------|
| 3 | Tech Spec | [03-TECH-SPEC.md](03-TECH-SPEC.md) | 아키텍처, 컴포넌트, 데이터 플로우 |
| 4 | API Spec | [04-API-SPEC.md](04-API-SPEC.md) | 전 엔드포인트 정의 (OpenAPI) |
| 5 | DB Schema | [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | PostgreSQL + Redis 상세 |
| 6 | Dev Tasks | [06-DEV-TASKS.md](06-DEV-TASKS.md) | Day별 구현 체크리스트 |

### Tier 3: 사업/발표 문서

| # | 문서 | 파일 | 설명 |
|---|------|------|------|
| 7-1 | 피치 스크립트 | [07-01-PITCH-SCRIPT.md](07-01-PITCH-SCRIPT.md) | 발표 스크립트 + 라이브 데모 + Q&A |
| 7-2 | 발표 준비 | [07-02-PITCH-PREPARATION.md](07-02-PITCH-PREPARATION.md) | 발표 팁 + 심사위원 설득 + 체크리스트 |
| 8 | Business Model | [08-BUSINESS-MODEL.md](08-BUSINESS-MODEL.md) | 수익 모델, 가격, TAM/SAM |
| 9-0 | 유스케이스 목록 | [09-00-USE-CASES-INDEX.md](09-00-USE-CASES-INDEX.md) | 전체 유스케이스 인덱스 |
| 9-1 | UC1: AI 리서치 | [09-01-UC-AI-RESEARCH.md](09-01-UC-AI-RESEARCH.md) | AI 리서치 에이전트 |
| 9-2 | UC2: 엔터프라이즈 | [09-02-UC-ENTERPRISE.md](09-02-UC-ENTERPRISE.md) | 엔터프라이즈 팀 관리 |
| 9-3 | UC3: DeFi | [09-03-UC-DEFI-TRADING.md](09-03-UC-DEFI-TRADING.md) | DeFi 트레이딩 에이전트 |
| 9-4 | UC4: MCP | [09-04-UC-MCP-ORCHESTRATION.md](09-04-UC-MCP-ORCHESTRATION.md) | MCP 서버 오케스트레이션 |
| 9-5 | UC5: API 큐레이션 | [09-05-UC-API-CURATION.md](09-05-UC-API-CURATION.md) | API 큐레이션 자동 최적화 |
| 9-6 | UC6: Claude Code | [09-06-UC-CLAUDE-CODE.md](09-06-UC-CLAUDE-CODE.md) | Claude Code 멀티에이전트 |

### Tier 4: 확장 문서

| # | 문서 | 파일 | 설명 |
|---|------|------|------|
| 10 | Security Design | [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) | 인증, 보안 설계 |
| 11 | Deployment Guide | [11-DEPLOYMENT-GUIDE.md](11-DEPLOYMENT-GUIDE.md) | 배포/운영 절차 |
| 12 | SDK Guide | [12-SDK-GUIDE.md](12-SDK-GUIDE.md) | @pag0/sdk 사용자 문서 |
| 13 | Go-to-Market | [13-GO-TO-MARKET.md](13-GO-TO-MARKET.md) | 초기 사용자 확보 전략 |
| 14 | Investor One-Pager | [14-INVESTOR-ONE-PAGER.md](14-INVESTOR-ONE-PAGER.md) | 투자 유치용 요약 |

---

## 읽는 순서 (권장)

**제품 이해**: 00 → 01 → 02 → 09-00

**개발 시작**: 03 → 04 → 05 → 06

**발표 준비**: 07-01 → 07-02 → 08

**확장/운영**: 10 → 11 → 12 → 13 → 14

---

## 원본 자료

소스 문서는 `hackathons/0001-x402/` 디렉토리에 위치:

| 문서 | 상태 | 비고 |
|------|------|------|
| `IDEA-A1-Pag0.md` | Deprecated | 원본 아이디어 (피봇 전) |
| `IDEA-A1-Pag0-PIVOT-PLAN.md` | 최신 | 피봇 분석 + Smart Proxy 아키텍처 |
| `IDEA-A1-Pag0-PRD.md` | 최신 | 제품 요구사항 정의서 |
| `IDEA-A1-Pag0-Competitors.md` | 부분 outdated | 피봇 전 경쟁사 분석 |
| `IDEA-A1-Pag0-UseCases.md` | Deprecated | 피봇 전 유스케이스 (구 SDK 패턴) |
| `IDEA-A1-Pag0-DOCS-ROADMAP.md` | 최신 | 문서 로드맵 |
