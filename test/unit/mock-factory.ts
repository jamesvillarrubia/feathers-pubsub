import { vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { Application } from '@feathersjs/feathers';
import { Topic, Subscription, PubSub, GetTopicResponse, GetSubscriptionResponse } from '@google-cloud/pubsub';
import type { Config, QueueConfig } from '../../src/queue/queue.class';
import { mockConfig } from '../queue.fixtures';

export class MockFactory {
  static createMockSubscription(): Subscription {
    return {
      name: 'test-subscription',
      on: vi.fn(),
    } as unknown as Subscription;
  }

  static createMockTopic(name: string = 'default-topic'): Topic {
    const publishMessage = vi.fn().mockImplementation(({ data, attributes, ...options }) => {
      const messageId = attributes?.messageId || uuidv4();
      return Promise.resolve([messageId]);
    });

    return {
      name: `projects/test-project/topics/${name}`,
      createSubscription: vi.fn().mockResolvedValue([this.createMockSubscription()]),
      subscription: vi.fn().mockReturnValue(this.createMockSubscription()),
      publishMessage,
    } as unknown as Topic;
  }

  static createMockPubSub(topics: Topic[] = []): PubSub {
    return {
      getTopics: vi.fn().mockResolvedValue([topics]),
      getSubscriptions: vi.fn().mockResolvedValue([[]]),
      createTopic: vi.fn().mockResolvedValue([this.createMockTopic()]),
      topic: vi.fn().mockImplementation(name => this.createMockTopic(name)),
    } as unknown as PubSub;
  }

  static createMockApp(config: Config): Application {
    return {
      get: vi.fn().mockReturnValue(config),
      emit: vi.fn(),
      service: vi.fn().mockReturnValue({
        create: vi.fn().mockResolvedValue({ id: 'test-id' }),
      }),
    } as unknown as Application;
  }

  static createFailingMockTopic(error: Error): Topic {
    return {
      name: 'projects/test-project/topics/default-topic',
      createSubscription: vi.fn().mockResolvedValue([this.createMockSubscription()]),
      subscription: vi.fn().mockReturnValue(this.createMockSubscription()),
      publishMessage: vi.fn().mockRejectedValue(error),
    } as unknown as Topic;
  }

  static createFailingMockPubSub(error: Error): PubSub {
    return {
      topic: vi.fn().mockReturnValue(this.createFailingMockTopic(error)),
      createTopic: vi.fn().mockResolvedValue([this.createFailingMockTopic(error)]),
      getTopics: vi.fn().mockResolvedValue([[this.createFailingMockTopic(error)]]),
      getSubscriptions: vi.fn().mockResolvedValue([[this.createMockSubscription()]]),
    } as unknown as PubSub;
  }
}

export class MockPubSub extends PubSub {
  private topics: Map<string, Topic>;
  private subscriptions: Map<string, Subscription>;

  constructor() {
    super({ projectId: mockConfig.projectId });
    this.topics = new Map();
    this.subscriptions = new Map();
  }

  async createTopic(name: string): Promise<GetTopicResponse> {
    const topic = this.createMockTopic(name);
    this.topics.set(name, topic);
    return [topic, {}];
  }

  async createSubscription(
    topicName: string,
    subscriptionName: string,
    _message?: any
  ): Promise<GetSubscriptionResponse> {
    const subscription = this.createMockSubscription();
    this.subscriptions.set(subscriptionName, subscription);
    return [subscription, {}];
  }

  topic(name: string): Topic {
    return this.topics.get(name) || this.createMockTopic(name);
  }

  subscription(name: string): Subscription {
    return this.subscriptions.get(name) || this.createMockSubscription();
  }

  private createMockTopic(name: string = 'default-topic'): Topic {
    return {
      name: `projects/test-project/topics/${name}`,
      createSubscription: vi.fn().mockResolvedValue([MockFactory.createMockSubscription()]),
      subscription: vi.fn().mockReturnValue(MockFactory.createMockSubscription()),
      publishMessage: vi.fn().mockImplementation(({ data, attributes, ...options }) => {
        const messageId = attributes?.messageId || uuidv4();
        return Promise.resolve([messageId]);
      }),
    } as unknown as Topic;
  }

  private createMockSubscription(): Subscription {
    return {
      name: 'test-subscription',
      on: vi.fn(),
    } as unknown as Subscription;
  }
}

export const mockPubSub = {
  createTopic: async () => {
    return {
      get: async () => {
        return [{}];
      }
    };
  }
};
