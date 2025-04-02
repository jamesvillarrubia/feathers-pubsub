/**
 * @sera/feathers-pubsub
 *
 * A FeathersJS service for Google Cloud Pub/Sub integration that provides a robust
 * queue service for handling asynchronous message processing. This module enables
 * seamless integration between FeathersJS applications and Google Cloud Pub/Sub,
 * supporting both PULL and PUSH subscription modes.
 *
 * Key features include:
 * - Configurable message processing with retries and dead letter queues
 * - Support for message priorities and scheduling
 * - Comprehensive error handling and monitoring
 * - Flexible configuration through FeathersJS app settings
 * - Support for both PULL and PUSH subscription modes
 * - Message batching and processing optimization
 *
 * The service can be configured through the FeathersJS app settings, allowing
 * consumers to define their own configuration structure and Pub/Sub settings.
 */

export * from './queue/queue.class';
export * from './queue/queue.schema';
