import { v4 as uuidv4 } from 'uuid';
import type { Config } from '../src/queue/queue.class';
import type { Queue } from '../src/queue/queue.schema';

export const mockConfig: Config = {
  projectId: 'test-project',
  apiEndpoint: 'localhost:8085',
  queues: {
    default: {
      name: 'default',
      topic: 'default-topic',
      subscription: 'default-subscription',
      maxDeliveryAttempts: 3,
      ackDeadlineSeconds: 30,
      messageRetentionDuration: '7d',
      pushEndpoint: 'http://localhost:3000/queue/push',
    },
    test: {
      name: 'test',
      topic: 'test-topic',
      subscription: 'test-subscription',
      maxDeliveryAttempts: 3,
      ackDeadlineSeconds: 30,
      messageRetentionDuration: '7d',
      pushEndpoint: 'http://localhost:3000/queue/push',
    },
  },
};

export function createTestMessage(overrides: Partial<Queue> = {}): Queue {
  const messageId = uuidv4();
  const timestamp = Date.now();
  
  return {
    id: uuidv4(),
    status: 'pending',
    metadata: {
      messageId,
      timestamp,
      priority: 5,
      queueName: 'default',
      ...overrides.metadata,
    },
    payload: {
      service: 'test',
      action: 'test',
      data: {},
      ...overrides.payload,
    },
    processingHistory: [],
    ...overrides,
  };
}

export function createTestMessageWithPriority(priority: number): Queue {
  return createTestMessage({
    metadata: {
      messageId: uuidv4(),
      timestamp: Date.now(),
      priority,
      queueName: 'default',
    },
  });
}

export function createPriorityTestMessages(): Queue[] {
  return [
    createTestMessage({
      metadata: { 
        messageId: uuidv4(),
        timestamp: Date.now(),
        priority: 3,
        queueName: 'default',
      },
      payload: { service: 'test', action: 'test', data: 'low' },
    }),
    createTestMessage({
      metadata: { 
        messageId: uuidv4(),
        timestamp: Date.now(),
        priority: 1,
        queueName: 'default',
      },
      payload: { service: 'test', action: 'test', data: 'high' },
    }),
    createTestMessage({
      metadata: { 
        messageId: uuidv4(),
        timestamp: Date.now(),
        priority: 2,
        queueName: 'default',
      },
      payload: { service: 'test', action: 'test', data: 'medium' },
    }),
  ];
}

export function createScheduledMessage(scheduledFor: Date | number = Date.now() + 60000): Queue {
  const timestamp = typeof scheduledFor === 'number' ? scheduledFor : scheduledFor.getTime();
  return createTestMessage({
    metadata: {
      messageId: uuidv4(),
      timestamp: Date.now(),
      priority: 0,
      queueName: 'default',
      scheduledFor: timestamp,
    },
    payload: {
      service: 'test',
      action: 'test',
      data: { scheduled: true },
    },
  });
}

export function createBatchTestMessages(count: number = 5): Queue[] {
  return Array(count)
    .fill(null)
    .map(() =>
      createTestMessage({
        payload: {
          service: 'test',
          action: 'test',
          data: 'batch test',
        },
      })
    );
}
