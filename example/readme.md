# Feathers PubSub Example

This is an example application demonstrating how to use the `feathers-pubsub` package with both pull-based and push-based message processing.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Google Cloud project:
   - Update `config/default.json` with your Google Cloud project ID
   - Create the necessary topics and subscriptions in Google Cloud Pub/Sub
   - For push subscriptions, configure the push endpoint URL

3. Build the application:
```bash
npm run build
```

## Running the Application

The example application consists of two parts:

1. Main Application (HTTP API):
```bash
npm run dev
```
This starts the main application that exposes the HTTP API for creating queue messages.

2. Queue Listener (Pull-based processing):
```bash
npm run dev:listener
```
This starts the listener process that handles pull-based message processing.

## Example Usage

### 1. Creating a Delayed Task (Pull-based)

```bash
curl -X POST http://localhost:3030/queue \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "delayed-tasks",
    "data": {
      "service": "users",
      "action": "sendWelcomeEmail",
      "data": {
        "userId": "123"
      }
    },
    "metadata": {
      "priority": "high",
      "scheduledTime": "2024-02-20T10:00:00Z"
    }
  }'
```

### 2. Creating a Push Notification

```bash
curl -X POST http://localhost:3030/queue \
  -H "Content-Type: application/json" \
  -d '{
    "queue": "notifications",
    "data": {
      "service": "notifications",
      "action": "sendPushNotification",
      "data": {
        "userId": "123",
        "message": "Welcome to our platform!"
      }
    }
  }'
```

## Configuration

The application is configured through `config/default.json`. Key configuration options:

- `projectId`: Your Google Cloud project ID
- `queues`: Configuration for different queues
  - `delayed-tasks`: Pull-based queue for delayed processing
  - `notifications`: Push-based queue for notifications

Each queue configuration includes:
- `topic`: Pub/Sub topic name
- `subscription`: Pub/Sub subscription name
- `maxRetries`: Maximum number of retry attempts
- `retryDelay`: Delay between retries (in seconds)
- `messageTimeout`: Message processing timeout
- `batchSize`: Number of messages to process in a batch
- `priorityLevels`: Available priority levels (for pull-based queues)
- `pushEndpoint`: Push endpoint URL (for push-based queues)
- `deadLetter`: Dead letter queue configuration (optional)

## Error Handling

The application includes error handling for:
- Invalid message formats
- Queue configuration errors
- Processing failures
- Retry logic for failed messages
- Dead letter queue for messages that exceed retry limits

## Development

- `npm run dev`: Start the main application in development mode
- `npm run dev:listener`: Start the queue listener in development mode
- `npm run build`: Build the application
- `npm start`: Start the main application in production mode
- `npm run start:listener`: Start the queue listener in production mode
