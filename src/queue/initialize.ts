import { PubSub, Topic, Subscription, GetTopicResponse, CreateSubscriptionResponse } from '@google-cloud/pubsub';
// createSubscription(name: string, options?: CreateSubscriptionOptions): Promise<CreateSubscriptionResponse>;
import debug from 'debug';
import type { QueueConfig, QueueConnection } from './queue.class';
import { BadRequest } from '@feathersjs/errors';

const log = debug('pubsub:init');

export interface QueueConnectionMap {
  [queueName: string]: QueueConnection;
}

export async function initializeQueue(
  pubsub: PubSub,
  options: {
    projectId: string;
    apiEndpoint: string;
    queues: Record<string, QueueConfig>;
  }
): Promise<QueueConnectionMap> {
  const { queues } = options;

  if (!queues || Object.keys(queues).length === 0) {
    throw new BadRequest('Queue configuration is required. At least one queue must be configured.');
  }

  const queueConnections: QueueConnectionMap = {};

  try {
    // Iterate over the queues and create the topics and subscriptions
    for (const [queueName, queueConfig] of Object.entries(queues)) {
      log(`\nInitializing queue: ${queueName}`);

      // Validate required queue configuration
      if (!queueConfig.topic || !queueConfig.subscription) {
        throw new BadRequest(
          `Invalid configuration for queue "${queueName}". Both topic and subscription are required.`
        );
      }

      const topicName = queueConfig.topic;
      const subscriptionName = queueConfig.subscription;
      let subscription: Subscription;

      // Check if topic exists
      const [topics] = await pubsub.getTopics();
      const topicExists = topics?.some(topic => topic.name.endsWith(topicName)) || false;
      log(`Topic Name: ${topicName}`);
      log(`Topic Exists: ${topicExists}`);

      let topic: Topic;
      if (!topicExists) {
        const [newTopic] = await pubsub.createTopic(topicName) as GetTopicResponse;
        topic = newTopic;
        log(`Created topic: ${topic.name}`);
      } else {
        topic = pubsub.topic(topicName);
      }

      // Check if subscription exists
      const [subscriptions] = await pubsub.getSubscriptions();
      const subscriptionExists =
        subscriptions?.some(sub => sub.name.endsWith(subscriptionName)) || false;
      log(`Subscription Name: ${subscriptionName}`);
      log(`Subscription Exists: ${subscriptionExists}`);

      // Create dead letter topic if configured
      let deadLetterTopic: Topic | null = null;
      if (queueConfig.deadLetterTopic) {
        const deadLetterTopicName = queueConfig.deadLetterTopic;
        const deadLetterTopicExists = topics.some(t => t.name.endsWith(deadLetterTopicName));

        if (!deadLetterTopicExists) {
          const [newTopic] = await pubsub.createTopic(deadLetterTopicName) as GetTopicResponse;
          deadLetterTopic = newTopic;
          log(`Created dead letter topic: ${deadLetterTopic.name}`);
        } else {
          deadLetterTopic = pubsub.topic(deadLetterTopicName);
        }
      }

      if (!subscriptionExists) {
        // Configure subscription options with retry policy and dead letter queue
        const subscriptionOptions: any = {
          pushConfig: queueConfig.pushEndpoint
            ? {
                pushEndpoint: queueConfig.pushEndpoint,
              }
            : undefined,
        };

        // Configure retry policy with exponential backoff
        if (queueConfig.maxRetries !== undefined) {
          subscriptionOptions.retryPolicy = {
            minimumBackoff: {
              seconds: queueConfig.retryDelay || 10,
              nanos: 0,
            },
            maximumBackoff: {
              seconds: (queueConfig.retryDelay || 10) * 10,
              nanos: 0,
            },
          };
        }

        // Configure dead letter policy if a dead letter topic is specified
        if (deadLetterTopic) {
          subscriptionOptions.deadLetterPolicy = {
            deadLetterTopic: deadLetterTopic.name,
            maxDeliveryAttempts: queueConfig.maxRetries || 5,
          };
        }

        // Create subscription with configured options
        const result = await topic.createSubscription(subscriptionName, subscriptionOptions);
        const [newSubscription] = result as unknown as [Subscription, any];
        subscription = newSubscription;
        log(`Created subscription: ${subscription.name}`);
      } else {
        subscription = topic.subscription(subscriptionName);
      }

      // Store the queue connection
      queueConnections[queueName] = {
        topic,
        subscription,
        deadLetterTopic,
        config: queueConfig,
      };
    }

    return queueConnections;
  } catch (error) {
    log('Error initializing queues:', error);
    throw error;
  }
}
