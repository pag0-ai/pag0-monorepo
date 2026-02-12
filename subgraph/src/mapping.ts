import { BigInt } from "@graphprotocol/graph-ts";
import {
  FeedbackGiven as FeedbackGivenEvent,
} from "../generated/ReputationRegistry/ReputationRegistry";
import {
  ValidationRequested as ValidationRequestedEvent,
} from "../generated/ValidationRegistry/ValidationRegistry";
import {
  Agent,
  FeedbackEvent,
  ValidationRequestEvent,
} from "../generated/schema";

function getOrCreateAgent(agentId: string, timestamp: BigInt): Agent {
  let agent = Agent.load(agentId);
  if (agent == null) {
    agent = new Agent(agentId);
    agent.eventCount = 0;
    agent.firstSeen = timestamp;
    agent.lastSeen = timestamp;
  }
  agent.eventCount += 1;
  agent.lastSeen = timestamp;
  agent.save();
  return agent;
}

export function handleFeedbackGiven(event: FeedbackGivenEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const agentId = event.params.agentId.toHexString();
  const agent = getOrCreateAgent(agentId, event.block.timestamp);

  const entity = new FeedbackEvent(id);
  entity.agent = agent.id;
  entity.agentId = agentId;
  entity.value = event.params.value.toI32();
  entity.tag1 = event.params.tag1.toString();
  entity.tag2 = event.params.tag2.toString();
  entity.feedbackURI = event.params.feedbackURI;
  entity.feedbackHash = event.params.feedbackHash;
  entity.timestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash.toHexString();
  entity.save();
}

export function handleValidationRequested(event: ValidationRequestedEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const agentId = event.params.agentId.toHexString();
  const agent = getOrCreateAgent(agentId, event.block.timestamp);

  const entity = new ValidationRequestEvent(id);
  entity.agent = agent.id;
  entity.agentId = agentId;
  entity.requestData = event.params.data;
  entity.timestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash.toHexString();
  entity.save();
}
