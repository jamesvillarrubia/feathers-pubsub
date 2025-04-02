import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import debug from 'debug';
import { QueueService } from '../../src/queue/queue.class';
import { MockFactory } from './mock-factory';
import { mockConfig, createTestMessage, createScheduledMessage } from '../queue.fixtures';
import type { Application } from '@feathersjs/feathers';
import type { PubSub } from '@google-cloud/pubsub';
import { BadRequest, GeneralError } from '@feathersjs/errors';
import type { QueueParams } from '../../src/queue/queue.class';
import { v4 as uuidv4 } from 'uuid';

const log = debug('queue:test');

// Enable debug logs for tests
debug.enable('queue:*');

describe('queue service unit tests', () => {
  let app: Application;
  let queueService: QueueService<QueueParams>;
  let mockPubSub: PubSub;
  let _publishedMessages: any[] = [];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock app and PubSub instances
    app = MockFactory.createMockApp(mockConfig);
    mockPubSub = MockFactory.createMockPubSub();

    // Create the queue service
    queueService = new QueueService({
      app,
      configPath: 'pubsub',
    });

    // Override the PubSub client
    (queueService as any).pubsub = mockPubSub;

    // Initialize the service
    await queueService.setup();

    // Set up queue connections
    const defaultTopic = MockFactory.createMockTopic('default-topic');
    const testTopic = MockFactory.createMockTopic('test-topic');

    (queueService as any).queueConnections = new Map([
      [
        'default',
        {
          topic: defaultTopic,
          subscription: MockFactory.createMockSubscription(),
          deadLetterTopic: null,
          config: mockConfig.queues.default,
        },
      ],
      [
        'test',
        {
          topic: testTopic,
          subscription: MockFactory.createMockSubscription(),
          deadLetterTopic: null,
          config: mockConfig.queues.test,
        },
      ],
    ]);
  });

  afterEach(async () => {
    log('Cleaning up test environment');
    vi.clearAllMocks();
    _publishedMessages = [];
    log('Test environment cleanup complete');
  });

  describe('configuration', () => {
    it('uses default pubsub path when no configPath provided', async () => {
      const service = new QueueService({ app });
      (service as any).pubsub = mockPubSub;
      await service.setup();

      expect(app.get).toHaveBeenCalledWith('pubsub');
    });

    it('uses custom config path when provided', async () => {
      const customPath = 'custom:pubsub';
      const service = new QueueService({ app, configPath: customPath });
      (service as any).pubsub = mockPubSub;
      await service.setup();

      expect(app.get).toHaveBeenCalledWith(customPath);
    });

    it('throws error when config is not found', async () => {
      const service = new QueueService({ app });
      (service as any).pubsub = mockPubSub;
      (app.get as any).mockReturnValue(undefined);

      await expect(async () => {
        await service.setup();
      }).rejects.toThrow(BadRequest);
    });

    it('throws error when required fields are missing', async () => {
      const invalidConfig = {
        apiEndpoint: mockConfig.apiEndpoint,
        queues: mockConfig.queues,
      };
      const service = new QueueService({ app });
      (service as any).pubsub = mockPubSub;
      (app.get as any).mockReturnValue(invalidConfig);

      await expect(async () => {
        await service.setup();
      }).rejects.toThrow(BadRequest);
    });

    it('throws error when no queues are configured', async () => {
      const invalidConfig = {
        apiEndpoint: mockConfig.apiEndpoint,
        projectId: mockConfig.projectId,
        queues: {},
      };
      const service = new QueueService({ app });
      (service as any).pubsub = mockPubSub;
      (app.get as any).mockReturnValue(invalidConfig);

      await expect(async () => {
        await service.setup();
      }).rejects.toThrow('Queue configuration is required. At least one queue must be configured.');
    });
  });

  describe('message creation', () => {
    it('creates a queue message with correct metadata', async () => {
      const messageData = createTestMessage({
        metadata: { 
          messageId: uuidv4(),
          timestamp: Date.now(),
          priority: 1,
          queueName: 'test'
        },
        payload: {
          service: 'test',
          action: 'create',
          queueName: 'test',
          data: { test: 'data' },
        },
      });

      const message = await queueService.create(messageData);

      expect(message.id).toBeDefined();
      expect(message.status).toBe('pending');
      expect(message.metadata.priority).toBe(1);
    });

    it('uses default queue when queueName is not specified', async () => {
      const messageData = createTestMessage({
        payload: {
          service: 'test',
          action: 'find',
          data: {},
        },
      });

      const message = await queueService.create(messageData);

      expect(message.id).toBeDefined();
      expect(message.status).toBe('pending');
      expect(message.metadata.queueName).toBe('default');
    });

    it('sets default priority when not specified', async () => {
      const messageData = createTestMessage({
        payload: {
          service: 'test',
          action: 'find',
          data: {},
        },
      });

      const message = await queueService.create(messageData);

      expect(message.metadata.priority).toBe(5);
    });

    it('uses Pub/Sub native scheduling for future messages', async () => {
      const mockTopic = MockFactory.createMockTopic();
      const service = new QueueService({ app, ...mockConfig });
      (service as any).pubsub = {
        topic: vi.fn().mockReturnValue(mockTopic)
      };

      const futureTime = new Date(Date.now() + 60000); // 1 minute in the future
      const message = createScheduledMessage(futureTime);
      await service.create(message);

      expect(mockTopic.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Buffer),
          attributes: expect.objectContaining({
            priority: '0',
            scheduledFor: String(futureTime.getTime()),
          }),
          scheduleTime: expect.any(Object),
        })
      );
    }, 10000);

    it('does not schedule messages for past times', async () => {
      const mockTopic = MockFactory.createMockTopic();
      const service = new QueueService({ app, ...mockConfig });
      (service as any).pubsub = {
        topic: vi.fn().mockReturnValue(mockTopic)
      };

      const pastTime = new Date(Date.now() - 60000); // 1 minute in the past
      const message = createScheduledMessage(pastTime);
      await service.create(message);

      expect(mockTopic.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Buffer),
          attributes: expect.objectContaining({
            priority: '0',
            scheduledFor: String(pastTime.getTime()),
          }),
        })
      );
      const publishArgs = (mockTopic.publishMessage as any).mock.calls[0][0];
      expect(publishArgs).not.toHaveProperty('scheduleTime');
    }, 10000);

    it('preserves existing metadata values', async () => {
      const existingMessageId = 'existing-id';
      const existingTimestamp = Date.now() - 1000;
      const messageData = createTestMessage({
        metadata: { 
          messageId: existingMessageId,
          timestamp: existingTimestamp,
          priority: 1,
          queueName: 'test'
        },
        payload: {
          service: 'test',
          action: 'create',
          queueName: 'test',
          data: { test: 'data' },
        },
      });

      const message = await queueService.create(messageData);

      expect(message.metadata.messageId).toBe(existingMessageId);
      expect(message.metadata.timestamp).toBe(existingTimestamp);
      expect(message.metadata.priority).toBe(1);
    });
  });

  describe('queue configuration', () => {
    it('initializes queue with correct configuration', async () => {
      const queueConnection = (queueService as any).queueConnections.get('test');

      expect(queueConnection.topic.name).toBe('projects/test-project/topics/test-topic');
      expect(queueConnection.subscription.name).toBe('test-subscription');
    });

    it('throws error for non-existent queue', async () => {
      const messageData = createTestMessage({
        payload: {
          service: 'test',
          action: 'test',
          data: 'test message',
          queueName: 'non-existent',
        },
      });

      await expect(async () => {
        await queueService.create(messageData);
      }).rejects.toThrow('Queue non-existent not initialized');
    });
  });

  describe('error handling', () => {
    it('handles failed message publishing', async () => {
      const messageData = createTestMessage();
      const mockError = new Error('Publish failed');

      // Create a new queue service with failing PubSub mock
      queueService = new QueueService({ app });
      queueService['pubsub'] = MockFactory.createFailingMockPubSub(mockError);
      await queueService.setup();

      try {
        await queueService.create(messageData);
        expect.fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(GeneralError);
        expect(error.code).toBe(500);
        expect(error.data.code).toBe('PUBLISH_FAILED');
        expect(error.data.cause).toBe(mockError);
      }
    });

    it('handles empty message data', async () => {
      const messageData = createTestMessage({
        payload: {
          service: 'test',
          action: 'test',
          data: {},
        },
      });

      const message = await queueService.create(messageData);
      expect(message).toBeDefined();
      expect(message.status).toBe('pending');
    });
  });
});
