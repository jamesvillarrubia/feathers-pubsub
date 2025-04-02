#!/bin/bash

# Wait for the emulator to be ready
sleep 5

# Set environment variables for the emulator
export PUBSUB_PROJECT_ID=test-project
export PUBSUB_EMULATOR_HOST=localhost:8085
export GOOGLE_CLOUD_PROJECT=test-project

# Create topics
gcloud beta emulator pubsub topics create delayed-tasks
gcloud beta emulator pubsub topics create notifications
gcloud beta emulator pubsub topics create notifications-dlq

# Create subscriptions
gcloud beta emulator pubsub subscriptions create delayed-tasks-sub --topic=delayed-tasks
gcloud beta emulator pubsub subscriptions create notifications-sub --topic=notifications --push-endpoint=http://localhost:3030/pubsub-handler
gcloud beta emulator pubsub subscriptions create notifications-dlq-sub --topic=notifications-dlq

echo "Pub/Sub topics and subscriptions created successfully" 