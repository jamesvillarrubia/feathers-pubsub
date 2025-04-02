import { describe, it, expect, beforeEach } from 'vitest';
import { QueueService } from '../../src/queue/queue.class';
import { PubSub } from '@google-cloud/pubsub';
import { createTestApp, createFailingTestApp } from './integration-utils';
import { createTestMessage, createTestMessageWithPriority } from '../queue.fixtures';
import { MethodNotAllowed, GeneralError } from '@feathersjs/errors';
import { vi } from 'vitest';
import { mockConfig } from '../queue.fixtures';
import { initializeQueue } from '../../src/queue/initialize';
import {
  Application as FeathersApplication,
  HookContext as FeathersHookContext,
} from '@feathersjs/feathers';

export interface ServiceTypes {
  queue: QueueService;
}

export interface Application extends FeathersApplication<ServiceTypes> {}

describe('Queue Integration Tests', () => {
  let queueService: QueueService;
  let pubsub: PubSub;
  let app: Application;

  beforeEach(async () => {
    // Create PubSub client for emulator
    pubsub = new PubSub({
      apiEndpoint: 'localhost:8085',
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'test-project',
    });

    // Create test app with mock configuration
    app = await createTestApp('pubsub') as unknown as Application;
    
    // Initialize the queues first
    await initializeQueue(pubsub, mockConfig);
    
    // Create the queue service with initialized queues
    queueService = new QueueService({
      app,
      pubsub,
      ...mockConfig
    });
    
    // Setup the service
    await queueService.setup();
  });

  describe('Message Creation', () => {
    it('should create a queue message', async () => {
      const messageData = createTestMessage();
      const result = await queueService.create(messageData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.metadata.messageId).toBeDefined();
      expect(result.payload).toEqual(messageData.payload);
      expect(result.status).toBe('pending');
    }, 10000);

    it('should create a message with priority', async () => {
      const messageData = createTestMessageWithPriority(5);
      const result = await queueService.create(messageData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.metadata.messageId).toBeDefined();
      expect(result.metadata.priority).toBe(5);
      expect(result.payload).toEqual(messageData.payload);
      expect(result.status).toBe('pending');
    }, 10000);

    it('should use default queue when no queueName specified', async () => {
      const messageData = createTestMessage();
      const result = await queueService.create(messageData);

      expect(result).toBeDefined();
      expect(result.metadata.queueName).toBe('default');
    }, 10000);
  });

  describe('Message Management', () => {
    it('should reject find operation', async () => {
      await expect(queueService.find()).resolves.toEqual([]);
    });

    it('should reject get operation', async () => {
      await expect(queueService.get('123')).rejects.toThrow(MethodNotAllowed);
    });

    it('should reject patch operation', async () => {
      await expect(queueService.patch('123', {})).rejects.toThrow(MethodNotAllowed);
    });

    it('should reject remove operation', async () => {
      await expect(queueService.remove('123')).rejects.toThrow(MethodNotAllowed);
    });
  });
});
