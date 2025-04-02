import { PubSub } from '@google-cloud/pubsub';
import { afterAll, beforeAll } from 'vitest';

const EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST || 'localhost:8085';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'some-project-id';

export const pubsub = new PubSub({
  projectId: PROJECT_ID,
  apiEndpoint: EMULATOR_HOST,
});

export const setupPubSubEmulator = async () => {
  // Create test topics and subscriptions if they don't exist
  const topics = ['default-topic', 'test-topic', 'test-topic-1', 'test-topic-2'];
  const subscriptions = ['default-subscription', 'test-subscription', 'test-sub-1', 'test-sub-2'];

  for (const topicName of topics) {
    try {
      await pubsub.createTopic(topicName);
    } catch (error) {
      // Topic might already exist
    }
  }

  for (const subscriptionName of subscriptions) {
    try {
      await pubsub.topic(topics[0]).createSubscription(subscriptionName);
    } catch (error) {
      // Subscription might already exist
    }
  }
};

export const cleanupPubSubEmulator = async () => {
  // Clean up test topics and subscriptions
  const topics = ['default-topic', 'test-topic', 'test-topic-1', 'test-topic-2'];
  const subscriptions = ['default-subscription', 'test-subscription', 'test-sub-1', 'test-sub-2'];

  for (const subscriptionName of subscriptions) {
    try {
      await pubsub.subscription(subscriptionName).delete();
    } catch (error) {
      // Subscription might not exist
    }
  }

  for (const topicName of topics) {
    try {
      await pubsub.topic(topicName).delete();
    } catch (error) {
      // Topic might not exist
    }
  }
};

// Setup and teardown hooks for tests
beforeAll(async () => {
  await setupPubSubEmulator();
});

afterAll(async () => {
  await cleanupPubSubEmulator();
});
