import { Id } from '@feathersjs/feathers';

export interface QueueConfig {
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  deadLetterTopic?: string;
  deadLetterThreshold?: number;
  messageTimeout: number;
  batchSize: number;
  priorityLevels: number;
}

export interface QueueStats {
  totalMessages: number;
  processedMessages: number;
  failedMessages: number;
  deadLetterMessages: number;
  averageProcessingTime: number;
  messagesByStatus: Record<string, number>;
  messagesByService: Record<string, number>;
  messagesByAction: Record<string, number>;
}

export interface QueueMetadata {
  messageId: string;
  timestamp: number;
  priority?: number;
  retryCount?: number;
  maxRetries?: number;
  scheduledFor?: number;
  deadLetterReason?: string;
}

export interface QueuePayload {
  service: string;
  action: string;
  queueName?: string;
  data?: any;
  id?: Id;
  params?: any;
  query?: any;
  method?: string;
  methodArgs?: any[];
}

export interface Queue {
  id: Id;
  metadata: QueueMetadata;
  payload: QueuePayload;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead-letter';
  result?: any;
  error?: {
    code?: string;
    message: string;
    details?: any;
    stack?: string;
  };
  processingHistory?: Array<{
    timestamp: number;
    status: string;
    error?: string;
    retryCount?: number;
  }>;
}

export interface QueueData {
  metadata?: Partial<QueueMetadata>;
  payload: QueuePayload;
}

export interface QueuePatch {
  status?: Queue['status'];
  result?: any;
  error?: Queue['error'];
}

export interface QueueQuery {
  status?: Queue['status'];
  service?: string;
  action?: string;
  queueName?: string;
}

export enum QueueErrorCode {
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  METHOD_NOT_FOUND = 'METHOD_NOT_FOUND',
  INVALID_ACTION = 'INVALID_ACTION',
  MISSING_ID = 'MISSING_ID'
} 