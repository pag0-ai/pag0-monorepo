import { BigInt } from "@graphprotocol/graph-ts";
import {
  FeedbackGiven as FeedbackGivenEvent,
} from "../generated/ReputationRegistry/ReputationRegistry";
import {
  ValidationRequested as ValidationRequestedEvent,
} from "../generated/ValidationRegistry/ValidationRegistry";
import {
  FeedbackEvent,
  ValidationRequestEvent,
} from "../generated/schema";

export function handleFeedbackGiven(event: FeedbackGivenEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const entity = new FeedbackEvent(id);

  entity.agentId = event.params.agentId.toHexString();
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
  const entity = new ValidationRequestEvent(id);

  entity.agentId = event.params.agentId.toHexString();
  entity.requestData = event.params.data;
  entity.timestamp = event.block.timestamp;
  entity.txHash = event.transaction.hash.toHexString();

  entity.save();
}
