// Named GraphQL queries for the ERC-8004 subgraph

export const AGENT_REPUTATION = `
  query AgentReputation($agentId: String!, $since: BigInt!) {
    feedbackEvents(
      where: { agentId: $agentId, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: desc
      first: 100
    ) {
      value
      timestamp
      txHash
    }
  }
`;

export const AGENT_PROFILE = `
  query AgentProfile($agentId: String!) {
    agent(id: $agentId) {
      id
      name
      eventCount
      firstSeen
      lastSeen
    }
    feedbackEvents(
      where: { agentId: $agentId }
      orderBy: timestamp
      orderDirection: desc
      first: 10
    ) {
      id
      agentId
      agentName
      value
      tag1
      tag2
      feedbackURI
      feedbackHash
      timestamp
      txHash
    }
  }
`;

export const FEEDBACK_HISTORY = `
  query FeedbackHistory($agentId: String!, $first: Int!, $skip: Int!) {
    feedbackEvents(
      where: { agentId: $agentId }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      agentId
      agentName
      value
      tag1
      tag2
      feedbackURI
      feedbackHash
      timestamp
      txHash
    }
  }
`;

export const LEADERBOARD = `
  query Leaderboard($first: Int!) {
    agents(
      orderBy: eventCount
      orderDirection: desc
      first: $first
    ) {
      id
      name
      eventCount
      firstSeen
      lastSeen
      feedbacks(
        orderBy: timestamp
        orderDirection: desc
        first: 50
      ) {
        value
      }
    }
  }
`;
