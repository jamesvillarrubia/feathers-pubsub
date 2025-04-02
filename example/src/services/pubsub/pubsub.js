// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { pubsubPath, pubsubMethods } from './pubsub.shared.js';
import { PubsubService, getOptions } from './pubsub.class.js';


export const pubsub = app => {
  // Register our service on the Feathers application
  app.use(pubsubPath, new PubsubService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: pubsubMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  });
  // Initialize hooks
  app.service(pubsubPath).hooks({
    around: {
      all: []
    },
    before: {
      all: [],
      find: [],
      get: [],
      create: [],
      patch: [],
      remove: []
    },
    after: {
      all: []
    },
    error: {
      all: []
    }
  });
};
