import { Type } from '@feathersjs/typebox';

// Pub/Sub specific error codes
export enum PubSubErrorCode {
  // Pub/Sub API Errors
  TOPIC_NOT_FOUND = 'TOPIC_NOT_FOUND',
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  INTERNAL = 'INTERNAL',
  UNAVAILABLE = 'UNAVAILABLE',

  // Queue Processing Errors
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  INVALID_ACTION = 'INVALID_ACTION',
  METHOD_NOT_FOUND = 'METHOD_NOT_FOUND',
  INVALID_METHOD_ARGS = 'INVALID_METHOD_ARGS',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  DEAD_LETTER = 'DEAD_LETTER',
  PUBLISH_FAILED = 'PUBLISH_FAILED',
}

export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export const QueueSchema = Type.Object({
  id: Type.String(),
  status: Type.Union([
    Type.Literal('pending'),
    Type.Literal('processing'),
    Type.Literal('completed'),
    Type.Literal('failed'),
  ]),
  payload: Type.Object({
    service: Type.String(),
    action: Type.String(),
    queueName: Type.Optional(Type.String()),
    data: Type.Any(),
    id: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    params: Type.Optional(Type.Any()),
    query: Type.Optional(Type.Any()),
    method: Type.Optional(Type.String()),
    methodArgs: Type.Optional(Type.Array(Type.Any())),
  }),
  metadata: Type.Object({
    messageId: Type.String(),
    timestamp: Type.Number(),
    priority: Type.Number(),
    queueName: Type.String(),
    scheduledFor: Type.Optional(Type.Number()),
  }),
  processingHistory: Type.Array(
    Type.Object({
      timestamp: Type.Number(),
      status: Type.String(),
      error: Type.Optional(Type.String()),
    })
  ),
});

export const QueueConfigSchema = Type.Object({
  name: Type.String(),
  topic: Type.String(),
  subscription: Type.String(),
  deadLetterTopic: Type.Optional(Type.String()),
  deadLetterSubscription: Type.Optional(Type.String()),
  maxRetries: Type.Optional(Type.Number()),
  retryDelay: Type.Optional(Type.Number()),
  maxRetryDelay: Type.Optional(Type.Number()),
  minRetryDelay: Type.Optional(Type.Number()),
  maxDeliveryAttempts: Type.Optional(Type.Number()),
  ackDeadlineSeconds: Type.Optional(Type.Number()),
  messageRetentionDuration: Type.Optional(Type.String()),
  pushEndpoint: Type.Optional(Type.String()),
  pushAuth: Type.Optional(Type.Object({
    type: Type.String(),
    credentials: Type.Any(),
  })),
});

export type Queue = {
  id: string;
  status: QueueStatus;
  payload: {
    service: string;
    action: string;
    queueName?: string;
    data: any;
    id?: string | number;
    params?: any;
    query?: any;
    method?: string;
    methodArgs?: any[];
  };
  metadata: {
    messageId: string;
    timestamp: number;
    priority: number;
    queueName: string;
    scheduledFor?: number;
  };
  processingHistory: Array<{
    timestamp: number;
    status: string;
    error?: string;
  }>;
};

export type QueueConfig = {
  name: string;
  topic: string;
  subscription: string;
  deadLetterTopic?: string;
  deadLetterSubscription?: string;
  maxRetries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  minRetryDelay?: number;
  maxDeliveryAttempts?: number;
  ackDeadlineSeconds?: number;
  messageRetentionDuration?: string;
  pushEndpoint?: string;
  pushAuth?: {
    type: string;
    credentials: any;
  };
};

export type QueueQuery = {
  status?: QueueStatus;
  service?: string;
  action?: string;
  queueName?: string;
  priority?: number;
  scheduledFor?: number;
};
