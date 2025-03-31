# @sera/feathers-pubsub

A FeathersJS service for Google Cloud Pub/Sub integration. Provides a queue service that handles asynchronous message processing with support for message priorities, scheduling, and error handling.

## Features

- Asynchronous message processing using Google Cloud Pub/Sub
- Support for multiple queues with different configurations
- Message prioritization
- Message scheduling
- Error handling and retries
- Batch message processing
- Queue statistics tracking

## Installation

```bash
pnpm add @sera/feathers-pubsub
```

## Configuration

Configure the service in your FeathersJS app:

```typescript
import { QueueService } from '@sera/feathers-pubsub';

// Configure the service
app.configure(QueueService, {
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
    high_priority: {
      topic: 'high-priority-topic',
      subscription: 'high-priority-subscription',
      max_retries: 5,
      retry_delay: 500,
      max_retry_delay: 15000,
      message_timeout: 15000,
      batch_size: 5,
      priority_levels: 5
    }
  }
});
```

## Usage

### Creating Messages

```typescript
// Create a message in the default queue
const message = await app.service('queue').create({
  metadata: {
    messageId: uuidv4(),
    timestamp: Date.now(),
    priority: 1
  },
  payload: {
    service: 'users',
    action: 'create',
    data: { name: 'John Doe' }
  }
});

// Create a message in a specific queue
const highPriorityMessage = await app.service('queue').create({
  metadata: {
    messageId: uuidv4(),
    timestamp: Date.now(),
    priority: 1,
    scheduledFor: Date.now() + 60000 // Schedule for 1 minute in the future
  },
  payload: {
    service: 'orders',
    action: 'process',
    queueName: 'high_priority',
    data: { orderId: '123' }
  }
});
```

### Processing Messages

The service automatically handles message processing through Google Cloud Pub/Sub subscriptions. Messages are processed in priority order and respect the configured retry and timeout settings.

### Error Handling

The service includes built-in error handling with configurable retries:

```typescript
// Error handling example
try {
  await app.service('queue').create({
    metadata: {
      messageId: uuidv4(),
      timestamp: Date.now()
    },
    payload: {
      service: 'test',
      action: 'test'
    }
  });
} catch (error) {
  console.error('Failed to create message:', error);
}
```

## API Reference

### QueueService

#### Methods

- `create(data: QueueData): Promise<Queue>`
  - Creates a new message in the queue
  - Returns the created message

- `get(id: Id): Promise<Queue>`
  - Retrieves a message by ID

- `find(params?: Params): Promise<Queue[]>`
  - Retrieves messages based on query parameters

- `patch(id: Id, data: QueuePatch): Promise<Queue>`
  - Updates a message

- `remove(id: Id): Promise<Queue>`
  - Removes a message

### Types

```typescript
interface QueueConfig {
  topic: string;
  subscription: string;
  max_retries: number;
  retry_delay: number;
  max_retry_delay: number;
  message_timeout: number;
  batch_size: number;
  priority_levels: number;
}

interface QueueMetadata {
  messageId: string;
  timestamp: number;
  priority?: number;
  scheduledFor?: number;
}

interface QueuePayload {
  service: string;
  action: string;
  queueName?: string;
  data?: any;
}

interface Queue {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: QueueMetadata;
  payload: QueuePayload;
  error?: string;
  retryCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

### Testing

Run tests:
```bash
pnpm test
```

Run tests with coverage:
```bash
pnpm test:coverage
```

### Building

Build the library:
```bash
pnpm build
```

## License

MIT 