import { PubSub } from '@google-cloud/pubsub';
import debug from 'debug';

const log = debug('pubsub:init');

export async function initializePubSub(options) {
  const { projectId, apiEndpoint, queues } = options;

  const pubsub = new PubSub({
    projectId,
    apiEndpoint
  });

  try {
    for (const [queueName, queueConfig] of Object.entries(queues)) {
      log(`\n`);
      const topicName = queueConfig.topic;
      const subscriptionName = queueConfig.subscription;
      
      // Check if topic exists
      const [topics] = await pubsub.getTopics();
      const topicExists = topics.some(topic => topic.name.endsWith(topicName));
      log(`Topic Name: ${topicName}`);
      log(`Topic Exists: ${topicExists}`);

      if (!topicExists) {
        const [topic] = await pubsub.createTopic(topicName);
        log(`Created topic: ${topic.name}`);
      }

      // Check if subscription exists
      const [subscriptions] = await pubsub.getSubscriptions();
      const subscriptionExists = subscriptions.some(sub => sub.name.endsWith(subscriptionName));
      log(`Subscription Name: ${subscriptionName}`);
      log(`Subscription Exists: ${subscriptionExists}`);
      
      if (!subscriptionExists) {
        const subscriptionOptions = {
          pushConfig: queueConfig.pushEndpoint ? {
            pushEndpoint: queueConfig.pushEndpoint
          } : undefined
        };
        
        const [subscription] = await pubsub
          .topic(topicName)
          .createSubscription(subscriptionName, subscriptionOptions);
          
        log(`Created subscription: ${subscription.name}`);
      }
    }

    log('Pub/Sub initialization completed successfully');

  } catch (error) {
    log('Error initializing Pub/Sub:', error);
    throw error; // Let the caller handle the error
  }
}