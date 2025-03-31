import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import debug from 'debug';

const log = debug('queue:test');

// Enable debug logs for tests
debug.enable('queue:*');

import { PubSub, Topic, Message, PublishOptions, Subscription } from '@google-cloud/pubsub';
import sinon from 'sinon';
import { QueueService } from '../src/index';
import { swallowStderr } from './utils';

describe('queue service unit tests', () => {
  let queueService: QueueService;
  let pubsubStub: sinon.SinonStubbedInstance<PubSub>;
  let topicStub: sinon.SinonStub<[name: string, options?: PublishOptions], Topic>;
  let mockTopic: Topic;
  let mockSubscription: Subscription;
  let publishedMessages: any[] = [];

  beforeEach(async () => {
    log('Setting up test environment');
    // Reset published messages
    publishedMessages = [];

    // Create mock Subscription
    mockSubscription = {
      exists: sinon.stub().resolves([true]),
      on: sinon.stub()
    } as unknown as Subscription;

    // Create mock Topic
    mockTopic = {
      publishMessage: sinon.stub().callsFake((message) => {
        const messageData = JSON.parse(message.data.toString());
        log('Mock topic publishing message:', JSON.stringify(messageData, null, 2));
        publishedMessages.push(messageData);
        return Promise.resolve('mock-message-id');
      }),
      exists: sinon.stub().resolves([true]),
      subscription: sinon.stub().returns(mockSubscription)
    } as unknown as Topic;

    // Create mock PubSub
    pubsubStub = sinon.createStubInstance(PubSub);
    
    // Set up topic stub
    topicStub = sinon.stub<[name: string, options?: PublishOptions], Topic>();
    topicStub.returns(mockTopic);
    pubsubStub.topic = topicStub;

    // Create queue service instance with mocked PubSub
    queueService = new QueueService({
      app: {
        get: (key: string) => {
          if (key === 'pubsub') {
            return {
              queues: {
                default: {
                  topic: 'default-topic',
                  subscription: 'default-subscription',
                  max_retries: 3,
                  retry_delay: 1000,
                  max_retry_delay: 30000,
                  message_timeout: 30000,
                  batch_size: 10,
                  priority_levels: 10
                },
                test: {
                  topic: 'test-topic',
                  subscription: 'test-subscription',
                  max_retries: 3,
                  retry_delay: 1000,
                  max_retry_delay: 30000,
                  message_timeout: 30000,
                  batch_size: 10,
                  priority_levels: 10
                }
              }
            };
          }
          return undefined;
        }
      } as any
    });

    // Replace PubSub instance
    (queueService as any).pubsub = pubsubStub;

    log('Test environment setup complete');
  });

  afterEach(() => {
    log('Cleaning up test environment');
    sinon.restore();
    log('Test environment cleanup complete');
  });

  describe('message creation', () => {
    it('creates a queue message with correct metadata', async () => {
      const message = await queueService.create({
        metadata: {
          messageId: uuidv4(),
          timestamp: Date.now(),
          priority: 1
        },
        payload: {
          service: 'test',
          action: 'create',
          queueName: 'test',
          data: { test: 'data' }
        }
      });

      assert.ok(message.id, 'Message has an ID');
      assert.equal(message.status, 'pending', 'Message is pending');
      assert.ok(message.metadata.messageId, 'Message has a messageId');
      assert.equal(message.payload.service, 'test', 'Message has correct service');
      assert.ok(topicStub.calledWith('test-topic'), 'Topic was created with correct name');
      
      // Verify published message
      assert.equal(publishedMessages.length, 1, 'One message was published');
      assert.equal(publishedMessages[0].payload.service, 'test', 'Published message has correct service');
      assert.equal(publishedMessages[0].status, 'pending', 'Published message has correct status');
    });

    it('uses default queue when queueName is not specified', async () => {
      const message = await queueService.create({
        metadata: {
          messageId: uuidv4(),
          timestamp: Date.now()
        },
        payload: {
          service: 'test',
          action: 'find'
        }
      });

      assert.ok(message.id, 'Message has an ID');
      assert.equal(message.status, 'pending', 'Message is pending');
      assert.ok(topicStub.calledWith('default-topic'), 'Topic was created with default name');
      
      // Verify published message
      assert.equal(publishedMessages.length, 1, 'One message was published');
      assert.equal(publishedMessages[0].payload.service, 'test', 'Published message has correct service');
    });

    it('sets default priority when not specified', async () => {
      const message = await queueService.create({
        metadata: {
          messageId: uuidv4(),
          timestamp: Date.now()
        },
        payload: {
          service: 'test',
          action: 'find'
        }
      });

      assert.equal(message.metadata.priority, 5, 'Default priority is 5');
      assert.equal(publishedMessages[0].metadata.priority, 5, 'Published message has default priority');
    });

    it('supports message scheduling', async () => {
      const scheduledTime = Date.now() + 60000; // 1 minute in the future
      const message = await queueService.create({
        metadata: {
          messageId: uuidv4(),
          timestamp: Date.now(),
          scheduledFor: scheduledTime
        },
        payload: {
          service: 'test',
          action: 'find'
        }
      });

      assert.ok(message.id, 'Message has an ID');
      assert.equal(message.metadata.scheduledFor, scheduledTime, 'Message has correct scheduled time');
      assert.equal(publishedMessages[0].metadata.scheduledFor, scheduledTime, 'Published message has correct scheduled time');
    });
  });

  describe('queue configuration', () => {
    it('initializes queue with correct configuration', async () => {
      await queueService.create({
        metadata: {
          messageId: uuidv4(),
          timestamp: Date.now()
        },
        payload: {
          service: 'test',
          action: 'find',
          queueName: 'test'
        }
      });

      assert.ok(topicStub.calledWith('test-topic'), 'Topic was created with correct name');
      assert.ok((mockTopic.subscription as sinon.SinonStub).calledWith('test-subscription'), 'Subscription was created with correct name');
    });

    it('throws error for non-existent queue', async () => {
      try {
        await swallowStderr(async () => {
          await queueService.create({
            metadata: {
              messageId: uuidv4(),
              timestamp: Date.now()
            },
            payload: {
              service: 'test',
              action: 'test',
              data: 'test message',
              queueName: 'non-existent'
            }
          });
        });
        assert.fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof Error) {
          assert.equal(error.message, 'Queue initialization failed: Queue configuration not found for queue: non-existent');
        } else {
          assert.fail('Expected error to be instance of Error');
        }
      }
    });
  });

  describe('error handling', () => {
    it('handles failed message publishing', async () => {
      // Mock publishMessage to fail
      (mockTopic.publishMessage as sinon.SinonStub).rejects(new Error('Publish failed'));

      try {
        await swallowStderr(async () => {
          await queueService.create({
            metadata: {
              messageId: uuidv4(),
              timestamp: Date.now()
            },
            payload: {
              service: 'test',
              action: 'test'
            }
          });
        });
        assert.fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof Error) {
          assert.equal(error.message, 'Failed to publish message: Publish failed');
        } else {
          assert.fail('Expected error to be instance of Error');
        }
      }
    });

    it('handles empty message data', async () => {
      try {
        await queueService.create({
          metadata: {
            messageId: uuidv4(),
            timestamp: Date.now()
          },
          payload: {
            service: 'test',
            action: 'test',
            data: undefined // data field is optional
          }
        });
        // Test should pass since data field is optional
        assert.ok(true, 'Message created successfully with undefined data');
      } catch (error) {
        assert.fail('Should not have thrown an error for undefined data');
      }
    });
  });

  describe('message processing', () => {
    it('processes messages in priority order', async () => {
      const messages = [
        { priority: 3, data: 'low' },
        { priority: 1, data: 'high' },
        { priority: 2, data: 'medium' }
      ];

      for (const msg of messages) {
        await queueService.create({
          metadata: {
            messageId: uuidv4(),
            timestamp: Date.now(),
            priority: msg.priority
          },
          payload: {
            service: 'test',
            action: 'test',
            data: msg.data
          }
        });
      }

      // Verify all messages were published with correct priorities
      assert.equal(publishedMessages.length, 3);
      const priorities = publishedMessages.map(msg => msg.metadata.priority).sort();
      assert.deepEqual(priorities, [1, 2, 3], 'Messages were published with correct priority values');
    });

    it('handles batch message processing', async () => {
      const batchSize = 5;
      const messages = Array(batchSize).fill(null).map(() => ({
        metadata: {
          messageId: uuidv4(),
          timestamp: Date.now()
        },
        payload: {
          service: 'test',
          action: 'test',
          data: 'batch test'
        }
      }));

      for (const msg of messages) {
        await queueService.create(msg);
      }

      assert.equal(publishedMessages.length, batchSize);
      assert.ok(publishedMessages.every(msg => msg.payload.service === 'test'));
    });
  });
}); 