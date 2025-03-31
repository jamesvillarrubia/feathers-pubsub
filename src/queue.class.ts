import type { Id, NullableId, Params, ServiceInterface, ServiceMethods } from '@feathersjs/feathers';
import type { Application } from '@feathersjs/feathers';
import { PubSub, Topic, Subscription } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid';
import debug from 'debug';

// Only enable debug logs in development mode
if (process.env.NODE_ENV === 'development') {
  debug.enable('queue:service');
}

const log = debug('queue:service');

import { Queue, QueueData, QueuePatch, QueueQuery, QueueConfig, QueueStats, QueueErrorCode } from './queue.schema';

export type { Queue, QueueData, QueuePatch, QueueQuery, QueueConfig, QueueStats };

export interface QueueServiceOptions {
  app: Application;
}

export interface QueueParams extends Params<QueueQuery> {
  query?: QueueQuery & {
    queueName?: string;
  };
}

interface QueueConnection {
  topic: Topic;
  subscription: Subscription;
  deadLetterTopic: Topic | null;
  config: QueueConfig;
}

interface QueueError extends Error {
  code?: string;
  details?: any;
}

interface QueueConfigYAML {
  topic: string;
  subscription: string;
  max_retries: number;
  retry_delay: number;
  max_retry_delay: number;
  dead_letter?: {
    topic: string;
    threshold: number;
  };
  message_timeout: number;
  batch_size: number;
  priority_levels: number;
}

interface QueueServiceMethods extends ServiceMethods<any> {
  [key: string]: any; // Allow custom methods
}

/**
 * QueueService handles asynchronous message processing using Google Cloud Pub/Sub
 * It supports multiple queues, retries, dead letter queues, and message scheduling
 */
export class QueueService<ServiceParams extends QueueParams = QueueParams>
  implements ServiceInterface<Queue, QueueData, ServiceParams, QueuePatch>
{
  private pubsub: PubSub;
  private projectId: string;
  private queueConnections: Map<string, QueueConnection> = new Map();
  private stats: QueueStats;
  private processingMessages: Set<string>;
  private isListening: boolean = false;

  constructor(public options: QueueServiceOptions) {
    this.pubsub = new PubSub();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'test-project';
    this.processingMessages = new Set();
    this.stats = this.initializeStats();
  }

  /**
   * Retrieves queue configuration from application settings
   * @throws {Error} If queue configuration is not found
   */
  private getQueueConfig(queueName: string): QueueConfigYAML {
    const pubsubConfig = this.options.app.get('pubsub');
    if (!pubsubConfig?.queues?.[queueName]) {
      throw new Error(`Queue configuration not found for queue: ${queueName}`);
    }
    return pubsubConfig.queues[queueName];
  }

  /**
   * Initializes a queue connection if it doesn't exist
   * Sets up topic, subscription, and dead letter queue if configured
   */
  private async initializeQueue(queueName: string): Promise<void> {
    if (this.queueConnections.has(queueName)) {
      return;
    }

    try {
      const queueConfig = this.getQueueConfig(queueName);
      const config = this.convertYAMLConfig(queueConfig);
      
      const topic = this.pubsub.topic(queueConfig.topic);
      const subscription = topic.subscription(queueConfig.subscription);
      const deadLetterTopic = config.deadLetterTopic ? this.pubsub.topic(config.deadLetterTopic) : null;

      // Verify topic and subscription exist
      await Promise.all([
        topic.exists(),
        subscription.exists()
      ]);

      this.queueConnections.set(queueName, {
        topic,
        subscription,
        deadLetterTopic,
        config
      });

      if (!this.isListening) {
        this.listenForMessages();
        this.isListening = true;
      }
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to initialize queue ${queueName}:`, err);
      throw new Error(`Queue initialization failed: ${err.message}`);
    }
  }

  /**
   * Retrieves queue connection details
   * @throws {Error} If queue is not initialized
   */
  private getQueueConnection(queueName: string): QueueConnection {
    const connection = this.queueConnections.get(queueName);
    if (!connection) {
      throw new Error(`Queue ${queueName} not initialized`);
    }
    return connection;
  }

  /**
   * Converts YAML configuration to internal QueueConfig format
   */
  private convertYAMLConfig(yamlConfig: QueueConfigYAML): QueueConfig {
    return {
      maxRetries: yamlConfig.max_retries,
      retryDelay: yamlConfig.retry_delay,
      maxRetryDelay: yamlConfig.max_retry_delay,
      deadLetterTopic: yamlConfig.dead_letter?.topic,
      deadLetterThreshold: yamlConfig.dead_letter?.threshold,
      messageTimeout: yamlConfig.message_timeout,
      batchSize: yamlConfig.batch_size,
      priorityLevels: yamlConfig.priority_levels
    };
  }

  private initializeStats(): QueueStats {
    return {
      totalMessages: 0,
      processedMessages: 0,
      failedMessages: 0,
      deadLetterMessages: 0,
      averageProcessingTime: 0,
      messagesByStatus: {},
      messagesByService: {},
      messagesByAction: {}
    };
  }

  private updateStats(message: Queue, processingTime: number): void {
    this.stats.totalMessages++;
    this.stats.messagesByStatus[message.status] = (this.stats.messagesByStatus[message.status] || 0) + 1;
    this.stats.messagesByService[message.payload.service] = (this.stats.messagesByService[message.payload.service] || 0) + 1;
    this.stats.messagesByAction[message.payload.action] = (this.stats.messagesByAction[message.payload.action] || 0) + 1;

    if (message.status === 'completed') {
      this.stats.processedMessages++;
    } else if (message.status === 'failed') {
      this.stats.failedMessages++;
    } else if (message.status === 'dead-letter') {
      this.stats.deadLetterMessages++;
    }

    // Update average processing time
    const currentTotal = this.stats.averageProcessingTime * (this.stats.processedMessages - 1);
    this.stats.averageProcessingTime = (currentTotal + processingTime) / this.stats.processedMessages;
  }

  async find(params?: ServiceParams): Promise<Queue[]> {
    // In a real implementation, this would query the database for queue messages
    return [];
  }

  async get(id: Id, params?: ServiceParams): Promise<Queue> {
    throw new Error('Method not implemented.');
  }

  /**
   * Creates a new queue message and publishes it to the specified queue
   * @param data - Queue message data
   * @param params - Service parameters
   * @returns Created queue message
   */
  async create(data: QueueData, params?: ServiceParams): Promise<Queue> {
    log('Creating queue message with data:', JSON.stringify(data, null, 2));

    // Validate message data
    if (!data || !data.payload || !data.payload.service || !data.payload.action) {
      log('Invalid message data - missing required fields:', { data });
      throw new Error('Invalid message data: payload must contain service and action');
    }

    const queueName = data.payload.queueName || 'default';
    log('Using queue:', queueName);
    
    await this.initializeQueue(queueName);
    log('Queue initialized successfully');

    const queueMessage: Queue = {
      id: Date.now(),
      metadata: {
        ...data.metadata,
        messageId: uuidv4(),
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: this.getQueueConnection(queueName).config.maxRetries,
        priority: data.metadata?.priority || 5
      },
      payload: data.payload,
      status: 'pending',
      processingHistory: []
    };

    log('Created queue message:', JSON.stringify(queueMessage, null, 2));

    try {
      const { topic } = this.getQueueConnection(queueName);
      log('Publishing message to topic:', topic.name);
      
      const messageBuffer = Buffer.from(JSON.stringify(queueMessage));
      const messageId = await topic.publishMessage({ data: messageBuffer });
      log('Message published successfully:', {
        messageId,
        queueName,
        priority: queueMessage.metadata.priority
      });

      if (data.metadata?.scheduledFor && data.metadata.scheduledFor > Date.now()) {
        log('Message scheduled for future processing:', {
          messageId: queueMessage.metadata.messageId,
          scheduledFor: new Date(data.metadata.scheduledFor)
        });
      }

      return queueMessage;
    } catch (error) {
      const err = error as Error;
      log('Failed to publish message:', {
        error: err.message,
        queueName,
        messageId: queueMessage.metadata.messageId
      });
      throw new Error(`Failed to publish message: ${err.message}`);
    }
  }

  async patch(id: NullableId, data: QueuePatch, params?: ServiceParams): Promise<Queue> {
    throw new Error('Method not implemented.');
  }

  async remove(id: NullableId, params?: ServiceParams): Promise<Queue> {
    throw new Error('Method not implemented.');
  }

  /**
   * Processes a queue message by executing the specified service action
   * Handles retries, dead letter queues, and error reporting
   */
  private async processMessage(message: Queue): Promise<void> {
    if (this.processingMessages.has(message.metadata.messageId)) {
      log('Message %s is already being processed', message.metadata.messageId);
      return;
    }

    this.processingMessages.add(message.metadata.messageId);
    const startTime = Date.now();
    const queueName = message.payload.queueName || 'default';
    const { config, deadLetterTopic } = this.getQueueConnection(queueName);

    try {
      const result = await this.executeServiceAction(message);
      const processingTime = Date.now() - startTime;
      
      this.updateStats(message, processingTime);
      await this.patch(message.id, { status: 'completed', result });
      this.options.app.emit('queue:completed', { message, result, processingTime });
    } catch (error) {
      const err = error as Error;
      await this.handleProcessingError(message, err, startTime, config, deadLetterTopic);
    } finally {
      this.processingMessages.delete(message.metadata.messageId);
    }
  }

  /**
   * Executes the service action specified in the message
   */
  private async executeServiceAction(message: Queue): Promise<any> {
    const { service, action, id, data, params, query, method, methodArgs } = message.payload;
    const feathersService = this.options.app.service(service) as QueueServiceMethods;

    if (!feathersService) {
      throw new Error(`Service ${service} not found`);
    }

    await this.patch(message.id, { status: 'processing' });

    if (method) {
      if (typeof feathersService[method] !== 'function') {
        throw new Error(`Method ${method} not found on service ${service}`);
      }
      return await (feathersService[method] as Function)(...methodArgs || []);
    }

    switch (action) {
      case 'create':
        return await feathersService.create(data, params);
      case 'get':
        if (!id) throw new Error('ID is required for get operation');
        return await feathersService.get(id, params);
      case 'find':
        return await feathersService.find({ ...params, query });
      case 'patch':
        if (!id) throw new Error('ID is required for patch operation');
        return await feathersService.patch(id, data, params);
      case 'remove':
        if (!id) throw new Error('ID is required for remove operation');
        return await feathersService.remove(id, params);
      case 'update':
        if (!id) throw new Error('ID is required for update operation');
        return await feathersService.update(id, data, params);
      default:
        throw new Error(`Invalid action: ${action}`);
    }
  }

  /**
   * Handles processing errors, including retries and dead letter queue
   */
  private async handleProcessingError(
    message: Queue,
    error: Error,
    startTime: number,
    config: QueueConfig,
    deadLetterTopic: Topic | null
  ): Promise<void> {
    const queueError = error as QueueError;
    const processingTime = Date.now() - startTime;
    
    const retryCount = message.metadata.retryCount || 0;
    if (retryCount < config.maxRetries) {
      await this.handleRetry(message, queueError, config);
    } else {
      await this.handleMaxRetriesExceeded(message, queueError, processingTime, deadLetterTopic);
    }
  }

  /**
   * Handles message retry logic
   */
  private async handleRetry(message: Queue, error: QueueError, config: QueueConfig): Promise<void> {
    const retryCount = message.metadata.retryCount || 0;
    const delay = Math.min(
      config.retryDelay * Math.pow(2, retryCount),
      config.maxRetryDelay
    );
    
    message.metadata.retryCount = retryCount + 1;
    message.processingHistory?.push({
      timestamp: Date.now(),
      status: 'retry',
      error: error.message,
      retryCount: message.metadata.retryCount
    });

    await this.rescheduleMessage(message, delay);
  }

  /**
   * Handles when max retries are exceeded
   */
  private async handleMaxRetriesExceeded(
    message: Queue,
    error: QueueError,
    processingTime: number,
    deadLetterTopic: Topic | null
  ): Promise<void> {
    if (deadLetterTopic) {
      message.status = 'dead-letter';
      message.metadata.deadLetterReason = 'Max retries exceeded';
      await deadLetterTopic.publishMessage({
        data: Buffer.from(JSON.stringify(message))
      });
    }

    await this.patch(message.id, {
      status: 'failed',
      error: {
        code: error.code || QueueErrorCode.PROCESSING_ERROR,
        message: error.message,
        details: error.details,
        stack: error.stack
      }
    });

    this.updateStats(message, processingTime);
    this.options.app.emit('queue:error', { message, error, processingTime });
  }

  private async rescheduleMessage(message: Queue, delay: number): Promise<void> {
    const queueName = message.payload.queueName || 'default';
    const { topic } = this.getQueueConnection(queueName);
    
    const rescheduledMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        scheduledFor: Date.now() + delay
      }
    };

    await topic.publishMessage({
      data: Buffer.from(JSON.stringify(rescheduledMessage))
    });
  }

  private listenForMessages(): void {
    // Set up message listeners for all queues
    for (const [queueName, connection] of this.queueConnections) {
      connection.subscription.on('message', async (message: any) => {
        try {
          const queueMessage: Queue = JSON.parse(message.data.toString());
          
          if (queueMessage.metadata.scheduledFor && queueMessage.metadata.scheduledFor > Date.now()) {
            await this.rescheduleMessage(queueMessage, queueMessage.metadata.scheduledFor - Date.now());
            message.ack();
            return;
          }

          await this.processMessage(queueMessage);
          message.ack();
        } catch (error) {
          console.error(`Error processing message in queue ${queueName}:`, error);
          message.nack();
        }
      });

      connection.subscription.on('error', (error: Error) => {
        console.error(`Error in subscription for queue ${queueName}:`, error);
      });
    }
  }

  // Custom method to get queue statistics
  async getStats(): Promise<QueueStats> {
    return this.stats;
  }
}

export const getOptions = (app: Application) => {
  return { app };
}; 