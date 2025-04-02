/**
 * The QueueService provides a robust message queue implementation using Google Cloud Pub/Sub.
 * It handles message publishing, subscription management, and message processing.
 */

import { Id, NullableId, Params, ServiceMethods, Application } from '@feathersjs/feathers';
import { BadRequest, GeneralError, NotFound, MethodNotAllowed } from '@feathersjs/errors';
import { PubSub, Topic, Subscription, PublishOptions } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid';
import debug from 'debug';
import type { Queue, QueueConfig, QueueQuery } from './queue.schema';
import { PubSubErrorCode } from './queue.schema';
import { initializeQueue } from './initialize';

// Only enable debug logs in development mode
if (process.env.NODE_ENV === 'development') {
  debug.enable('queue:service');
}

const logQueueService = debug('queue:service');

export type { Queue, QueueConfig, QueueQuery };

// Define QueueData type for create operations
export type QueueData = {
  payload: {
    service: string;
    action: string;
    queueName?: string;
    data: any;
    id?: Id;
    params?: any;
    query?: any;
    method?: string;
    methodArgs?: any[];
  };
  metadata?: {
    messageId?: string;
    timestamp?: number;
    priority?: number;
    scheduledFor?: number;
    queueName?: string;
  };
};

// Define QueuePatch type for patch operations
export type QueuePatch = {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
    name?: string;
  };
  metadata?: {
    messageId?: string;
    timestamp?: number;
    priority?: number;
    scheduledFor?: number;
    queueName?: string;
  };
};

export interface QueueServiceOptions {
  app: Application;
  pubsub?: PubSub;
  configPath?: string;
}

export interface QueueParams extends Params<QueueQuery> {
  query?: QueueQuery & {
    queueName?: string;
  };
}

export interface Config {
  projectId: string;
  apiEndpoint: string;
  queues: Record<string, QueueConfig>;
}

export interface QueueConnection {
  topic: Topic;
  subscription: Subscription;
  deadLetterTopic: Topic | null;
  config: QueueConfig;
}

interface QueueError extends Error {
  code?: string;
  details?: any;
}

interface QueueServiceMethods extends ServiceMethods<any> {
  [key: string]: any; // Allow custom methods
}

/**
 * QueueService handles asynchronous message processing using Google Cloud Pub/Sub
 * It supports multiple queues, retries, dead letter queues, and message scheduling
 */
export class QueueService<ServiceParams extends QueueParams = QueueParams> {
  private pubsub: PubSub;
  private queueConnections: Map<string, QueueConnection> = new Map();
  private processingMessages: Set<string>;
  private app: Application;
  private configPath: string;
  private options: QueueServiceOptions;

  constructor(options: QueueServiceOptions) {
    this.processingMessages = new Set();
    this.options = options;
    this.app = options.app;
    this.configPath = options.configPath || 'pubsub';

    // Get configuration from the specified config path
    const config = this.app.get(this.configPath);
    if (!config || !config.projectId || !config.apiEndpoint) {
      throw new BadRequest(
        `PubSub configuration missing required fields in '${this.configPath}' config: projectId and apiEndpoint`
      );
    }

    // Parse the API endpoint to ensure IPv4
    const apiEndpoint = config.apiEndpoint.replace('localhost', '127.0.0.1');

    this.pubsub = new PubSub({
      projectId: config.projectId,
      apiEndpoint,
    });

    this.listenForMessages();
  }

  /**
   * Retrieves queue connection details
   * @throws {NotFound} If queue is not initialized
   */
  private getQueueConnection(queueName: string): {
    topic: Topic;
    deadLetterTopic: Topic | null;
    config: QueueConfig;
  } {
    const queueConfig = this.app.get(this.configPath)?.queues[queueName];
    if (!queueConfig) {
      logQueueService('Queue not found:', queueName);
      throw new NotFound(`Queue ${queueName} not initialized`);
    }

    const projectId = this.app.get(this.configPath)?.projectId;
    if (!projectId) {
      logQueueService('Project ID not found in configuration');
      throw new NotFound('Project ID is required in configuration');
    }

    // Construct full topic name
    const topicName = `projects/${projectId}/topics/${queueConfig.topic}`;
    const topic = this.pubsub.topic(topicName);
    if (!topic) {
      logQueueService('Topic not found for queue:', queueName);
      throw new NotFound(`Topic not found for queue "${queueName}"`);
    }

    let deadLetterTopic = null;
    if (queueConfig.deadLetter?.topic) {
      const deadLetterTopicName = `projects/${projectId}/topics/${queueConfig.deadLetter.topic}`;
      deadLetterTopic = this.pubsub.topic(deadLetterTopicName);
    }

    return { topic, deadLetterTopic, config: queueConfig };
  }

  /**
   * Sets up the queue service by initializing all configured queues
   * This is called by FeathersJS during service initialization
   */
  async setup() {
    try {
      const config = this.app.get(this.configPath);
      if (!config) {
        throw new BadRequest(`Configuration not found at path: ${this.configPath}`);
      }

      if (!config.projectId || !config.apiEndpoint) {
        throw new BadRequest('PubSub configuration missing required fields');
      }

      const queueConnections = await initializeQueue(this.pubsub, config);

      // Add the connections to our map
      Object.entries(queueConnections).forEach(([name, connection]) => {
        this.queueConnections.set(name, connection);
      });

      // Set up message listeners for all queues
      this.listenForMessages();

      logQueueService('Queue service setup completed successfully');
    } catch (error) {
      const err = error as Error;
      logQueueService('Failed to setup queue service:', err);
      throw err;
    }
  }

  async find(_params?: ServiceParams): Promise<Queue[]> {
    return [];
  }

  async get(_id: Id, _params?: ServiceParams): Promise<Queue> {
    throw new MethodNotAllowed(
      'Message status tracking is not supported. Use GCP Console or API to check message status.'
    );
  }

  /**
   * Creates a new queue message and publishes it to the specified queue
   * @param data - Queue message data
   * @param params - Service parameters
   * @returns Created queue message
   */
  async create(data: QueueData, _params?: ServiceParams): Promise<Queue> {
    logQueueService('Creating queue message with data:', JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.payload || !data.payload.service || !data.payload.action) {
      throw new BadRequest('Invalid queue message data. Service and action are required.');
    }

    const queueName = data.payload.queueName || 'default';
    const { topic, config } = this.getQueueConnection(queueName);

    // Create base message without metadata to avoid overwriting
    const baseMessage = {
      id: uuidv4(),
      status: 'pending' as const,
      processingHistory: [],
      payload: data.payload,
    };

    // Create metadata separately to avoid property conflicts
    const metadata = {
      messageId: uuidv4(),
      timestamp: Date.now(),
      priority: data.metadata?.priority || 5,
      queueName,
      // Preserve existing metadata values
      ...(data.metadata || {}),
    };

    // Convert metadata values to strings for Pub/Sub attributes
    const attributes = Object.entries(metadata).reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>);

    // Prepare publish options
    const publishOptions: any = {
      attributes,
    };
    
    // Add ordering key based on priority
    if (metadata.priority) {
      publishOptions.orderingKey = metadata.priority.toString();
    }

    // Add scheduling if specified and in the future
    if (metadata.scheduledFor && metadata.scheduledFor > Date.now()) {
      publishOptions.scheduleTime = {
        seconds: Math.floor(metadata.scheduledFor / 1000),
        nanos: (metadata.scheduledFor % 1000) * 1000000,
      };
    }

    try {
      // Publish the message
      const [messageId] = await topic.publishMessage({
        data: Buffer.from(JSON.stringify(baseMessage)),
        ...publishOptions,
      });

      // Return the complete message
      return {
        ...baseMessage,
        metadata: {
          ...metadata,
          messageId,
        },
      };
    } catch (error) {
      const err = error as QueueError;
      logQueueService('Failed to publish message:', err);
      throw new GeneralError('Failed to publish message', {
        code: 'PUBLISH_FAILED',
        cause: err,
      });
    }
  }

  async patch(_id: NullableId, _data: QueuePatch, _params?: ServiceParams): Promise<Queue> {
    throw new MethodNotAllowed(
      'Message status updates are not supported. Use GCP Console or API to manage messages.'
    );
  }

  async remove(_id: NullableId, _params?: ServiceParams): Promise<Queue> {
    throw new MethodNotAllowed(
      'Message deletion is not supported. Use GCP Console or API to manage messages.'
    );
  }

  /**
   * Processes a queue message by executing the specified service action
   * Handles error reporting
   */
  private async processMessage(message: Queue): Promise<void> {
    if (this.processingMessages.has(message.metadata.messageId)) {
      logQueueService('Message %s is already being processed', message.metadata.messageId);
      return;
    }

    this.processingMessages.add(message.metadata.messageId);
    const startTime = Date.now();
    const queueName = message.payload.queueName || 'default';
    const { config } = this.getQueueConnection(queueName);

    try {
      const result = await this.executeServiceAction(message);
      const processingTime = Date.now() - startTime;

      this.options.app.emit('queue:completed', { message, result, processingTime });
    } catch (error) {
      const err = error as Error;
      const processingTime = Date.now() - startTime;
      
      // Log the error and emit an event
      logQueueService('Error processing message:', {
        messageId: message.metadata.messageId,
        error: err.message,
        processingTime,
      });
      
      this.options.app.emit('queue:error', {
        message,
        error: new GeneralError('Message processing failed', {
          cause: err,
          code: PubSubErrorCode.SERVICE_NOT_FOUND,
        }),
        processingTime,
      });
      
      // Re-throw the error to let GCP Pub/Sub handle the retry
      throw err;
    } finally {
      this.processingMessages.delete(message.metadata.messageId);
    }
  }

  /**
   * Executes the service action specified in the message
   */
  private async executeServiceAction(message: Queue): Promise<any> {
    const { service, action, data, method, methodArgs, params, query, id } = message.payload;
    const feathersService = this.options.app.service(service as any) as QueueServiceMethods;

    if (!feathersService) {
      throw new NotFound(`Service ${service} not found`, {
        code: PubSubErrorCode.SERVICE_NOT_FOUND,
      });
    }

    // Handle custom method calls if specified
    if (method) {
      if (typeof feathersService[method] !== 'function') {
        throw new BadRequest(`Method ${method} not found on service ${service}`, {
          code: PubSubErrorCode.METHOD_NOT_FOUND,
        });
      }
      return await (feathersService[method] as Function)(...(methodArgs || []));
    }

    // Handle standard CRUD operations
    switch (action) {
      case 'create':
        return await feathersService.create(data, params);
      case 'get':
        if (!id) throw new BadRequest('ID is required for get operation');
        return await feathersService.get(id, params);
      case 'find':
        return await feathersService.find({ ...params, query });
      case 'patch':
        if (!id) throw new BadRequest('ID is required for patch operation');
        return await feathersService.patch(id, data, params);
      case 'remove':
        if (!id) throw new BadRequest('ID is required for remove operation');
        return await feathersService.remove(id, params);
      case 'update':
        if (!id) throw new BadRequest('ID is required for update operation');
        return await feathersService.update(id, data, params);
      default:
        throw new BadRequest(`Invalid action: ${action}`, {
          code: PubSubErrorCode.INVALID_ACTION,
        });
    }
  }

  private listenForMessages(): void {
    // Set up message listeners for all queues
    for (const [queueName, _connection] of this.queueConnections) {
      // For push subscriptions, we don't need to set up message listeners
      // The messages will be pushed to our configured endpoint
      logQueueService(`Queue ${queueName} configured for push-based subscription`);
    }
  }

  /**
   * Handle pushed messages from Pub/Sub
   * This endpoint receives messages pushed by Pub/Sub
   */
  async handlePushedMessage(data: any, _params: Params): Promise<void> {
    try {
      const message = data.message;
      const queueName = message.attributes?.queueName;

      if (!queueName) {
        throw new BadRequest('Queue name is required in message attributes');
      }

      const queueMessage: Queue = JSON.parse(Buffer.from(message.data, 'base64').toString());
      await this.processMessage(queueMessage);
    } catch (error) {
      logQueueService('Error processing pushed message:', error);
      throw error;
    }
  }
}

export const getOptions = (app: Application) => {
  return { app };
};
