import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('PubSub Service', () => {
  it('should handle queue creation', async () => {
    const response = await request(app)
      .post('/pubsub')
      .send({
        payload: {
          service: 'test-service',
          action: 'test-action',
          queueName: 'test-queue',
          data: { test: 'data' }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
  });

  it('should handle delayed tasks', async () => {
    const scheduledTime = new Date(Date.now() + 1000 * 60 * 5); // 5 minutes from now
    const response = await request(app)
      .post('/pubsub')
      .send({
        payload: {
          service: 'users',
          action: 'sendWelcomeEmail',
          queueName: 'delayed-tasks',
          data: { userId: '123' }
        },
        metadata: {
          priority: 1,
          scheduledFor: scheduledTime.getTime()
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
    expect(response.body.metadata.scheduledFor).toBeDefined();
  });

  it('should handle push notifications', async () => {
    const response = await request(app)
      .post('/pubsub')
      .send({
        payload: {
          service: 'notifications',
          action: 'sendPushNotification',
          queueName: 'notifications',
          data: {
            userId: '123',
            message: 'Test notification'
          }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
  });

  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/pubsub')
      .send({
        // Missing required fields
        payload: {
          data: { test: 'data' }
        }
      });

    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.name).toBe('BadRequest');
  });
}); 