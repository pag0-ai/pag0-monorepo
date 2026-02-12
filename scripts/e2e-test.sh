#!/bin/bash
set -e

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

# Color helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

assert_status() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Pag0 Smart Proxy E2E Test Suite${NC}"
echo -e "${YELLOW}================================${NC}"

# ===== 1. Health Check =====
echo -e "\n${YELLOW}=== 1. Health Check ===${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
assert_status "Health check" "200" "$STATUS"

# ===== 2. 404 Handler =====
echo -e "\n${YELLOW}=== 2. 404 Handler ===${NC}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/nonexistent)
assert_status "404 not found" "404" "$STATUS"

# ===== 3. Auth Flow =====
echo -e "\n${YELLOW}=== 3. Auth Flow ===${NC}"

# Register
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e-$(date +%s)@pag0.io\",\"password\":\"Test1234!\",\"name\":\"E2E Test\"}")
STATUS=$(echo "$REGISTER_RESPONSE" | grep -o '"apiKey"' | head -1)
# Extract API key for subsequent requests
API_KEY=$(echo "$REGISTER_RESPONSE" | grep -o '"pag0_live_[^"]*"' | tr -d '"' | head -1)
if [ -n "$API_KEY" ]; then
  echo -e "${GREEN}✓ PASS${NC}: Register user (got API key)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✗ FAIL${NC}: Register user (no API key in response)"
  FAIL=$((FAIL + 1))
  echo -e "${YELLOW}! WARN${NC}: Skipping auth-dependent tests"
  # Try to use seed data API key if register fails
  API_KEY=""
fi

# Auth failure
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/policies \
  -H "X-Pag0-API-Key: invalid_key")
assert_status "Auth failure (invalid key)" "401" "$STATUS"

# Auth success (if we have a key)
if [ -n "$API_KEY" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/policies \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Auth success" "200" "$STATUS"

  # /me endpoint
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/auth/me \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Get current user (/me)" "200" "$STATUS"
fi

# ===== 4. Policy CRUD =====
echo -e "\n${YELLOW}=== 4. Policy CRUD ===${NC}"
if [ -n "$API_KEY" ]; then
  # Create
  CREATE_RESP=$(curl -s -X POST $BASE_URL/api/policies \
    -H "Content-Type: application/json" \
    -H "X-Pag0-API-Key: $API_KEY" \
    -d '{"name":"E2E Policy","maxPerRequest":"5000000","dailyBudget":"50000000","monthlyBudget":"500000000"}')
  # extract policy id
  POLICY_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$POLICY_ID" ]; then
    echo -e "${GREEN}✓ PASS${NC}: Create policy (id: ${POLICY_ID:0:8}...)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: Create policy (no id in response)"
    FAIL=$((FAIL + 1))
  fi

  # List
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/policies \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "List policies" "200" "$STATUS"

  # Get by ID
  if [ -n "$POLICY_ID" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/policies/$POLICY_ID \
      -H "X-Pag0-API-Key: $API_KEY")
    assert_status "Get policy by ID" "200" "$STATUS"

    # Update
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT $BASE_URL/api/policies/$POLICY_ID \
      -H "Content-Type: application/json" \
      -H "X-Pag0-API-Key: $API_KEY" \
      -d '{"dailyBudget":"100000000"}')
    assert_status "Update policy" "200" "$STATUS"

    # Delete (soft) - accept both 200 and 204
    DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE_URL/api/policies/$POLICY_ID \
      -H "X-Pag0-API-Key: $API_KEY")
    if [ "$DELETE_STATUS" = "200" ] || [ "$DELETE_STATUS" = "204" ]; then
      echo -e "${GREEN}✓ PASS${NC}: Delete policy (soft) (HTTP $DELETE_STATUS)"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}✗ FAIL${NC}: Delete policy (expected 200/204, got $DELETE_STATUS)"
      FAIL=$((FAIL + 1))
    fi
  fi
else
  echo -e "${YELLOW}! SKIP${NC}: Policy CRUD tests (no API key)"
fi

# ===== 5. Analytics =====
echo -e "\n${YELLOW}=== 5. Analytics ===${NC}"
if [ -n "$API_KEY" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/analytics/summary?period=7d" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Analytics summary" "200" "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/analytics/endpoints?period=7d&limit=5" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Analytics endpoints" "200" "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/analytics/costs?period=7d&granularity=daily" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Analytics costs" "200" "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/analytics/cache?period=7d" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Analytics cache" "200" "$STATUS"
else
  echo -e "${YELLOW}! SKIP${NC}: Analytics tests (no API key)"
fi

# ===== 6. Curation =====
echo -e "\n${YELLOW}=== 6. Curation ===${NC}"
if [ -n "$API_KEY" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/curation/categories" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Curation categories" "200" "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/curation/rankings?category=AI" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Curation rankings" "200" "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/curation/recommend?category=AI&limit=3" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Curation recommend" "200" "$STATUS"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/curation/compare?endpoints=api.openai.com,api.anthropic.com" \
    -H "X-Pag0-API-Key: $API_KEY")
  assert_status "Curation compare" "200" "$STATUS"
else
  echo -e "${YELLOW}! SKIP${NC}: Curation tests (no API key)"
fi

# ===== 7. CORS =====
echo -e "\n${YELLOW}=== 7. CORS ===${NC}"
CORS_HEADER=$(curl -s -D - -o /dev/null -X OPTIONS $BASE_URL/api/policies \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control-allow-origin")
if echo "$CORS_HEADER" | grep -qi "localhost:3001\|*"; then
  echo -e "${GREEN}✓ PASS${NC}: CORS preflight"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✗ FAIL${NC}: CORS preflight (missing allow-origin header)"
  FAIL=$((FAIL + 1))
fi

# ===== 8. Rate Limiting =====
echo -e "\n${YELLOW}=== 8. Rate Limiting ===${NC}"
if [ -n "$API_KEY" ]; then
  # Free tier: 60 req/min. Send 65 rapid requests and check for 429.
  GOT_429=false
  for i in $(seq 1 65); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/policies \
      -H "X-Pag0-API-Key: $API_KEY")
    if [ "$STATUS" = "429" ]; then
      GOT_429=true
      break
    fi
  done
  if [ "$GOT_429" = true ]; then
    echo -e "${GREEN}✓ PASS${NC}: Rate limit triggered (429 after $i requests)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: Rate limit not triggered after 65 requests"
    FAIL=$((FAIL + 1))
  fi

  # Verify X-RateLimit-* headers present
  HEADERS=$(curl -s -D - -o /dev/null $BASE_URL/api/policies \
    -H "X-Pag0-API-Key: $API_KEY" 2>&1)
  if echo "$HEADERS" | grep -qi "x-ratelimit-limit"; then
    echo -e "${GREEN}✓ PASS${NC}: X-RateLimit-* headers present"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: X-RateLimit-* headers missing"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "${YELLOW}! SKIP${NC}: Rate limit tests (no API key)"
fi

# ===== Summary =====
echo -e "\n${YELLOW}================================${NC}"
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo -e "${YELLOW}================================${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Tests failed!${NC}"
  exit 1
fi

echo -e "${GREEN}All tests passed!${NC}"
exit 0
