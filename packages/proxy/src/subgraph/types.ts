// Subgraph GraphQL response types

export interface SubgraphAgent {
  id: string;
  eventCount: number;
  firstSeen: string;  // BigInt as string
  lastSeen: string;
}

export interface SubgraphFeedbackEvent {
  id: string;
  agentId: string;
  value: number;
  tag1: string;
  tag2: string;
  feedbackURI: string;
  feedbackHash: string;
  timestamp: string;  // BigInt as string
  txHash: string;
}

export interface SubgraphValidationRequestEvent {
  id: string;
  agentId: string;
  requestData: string;
  timestamp: string;
  txHash: string;
}

export interface AgentReputation {
  avgScore: number;
  feedbackCount: number;
  lastSeen: number;  // unix timestamp
}

export interface AgentProfile {
  agentId: string;
  eventCount: number;
  firstSeen: number;
  lastSeen: number;
  recentFeedbacks: SubgraphFeedbackEvent[];
}

export interface AgentSummary {
  agentId: string;
  eventCount: number;
  avgScore: number;
}
