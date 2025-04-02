import { QueueService } from '../../../../dist/index.js';
import { initializePubSub } from './init-pubsub.js';

// This is the PubsubService class that extends the QueueService class
export class PubsubService extends QueueService {

}

export const getOptions = app => {
  return {
    app
  };
};
