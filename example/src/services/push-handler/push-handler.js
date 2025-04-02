const pushHandlerPath = '/push-handler';
const pushHandlerMethods = ['create'];  


export class PushHandlerService {
  constructor(options) {
    this.app = options.app;
    this.events = ['created'];
  }

  async find() {
    return [];
  }

  async get() {
    return null;
  }

  async create(data) {
    try {
      // Decode the base64 message data
      const message = JSON.parse(Buffer.from(data.message.data, 'base64').toString());
      
      // Process the message using the pubsub service
      const pubsubService = this.app.service('pubsub');
      await pubsubService.processMessage(message);
      
      return { success: true };
    } catch (error) {
      console.error('Error processing push message:', error);
      throw error;
    }
  }

  async patch() {
    return null;
  }

  async remove() {
    return null;
  }
} 

const getOptions = app => {
  return {
    app
  };
};

export const pushHandler = app => {
  // Register our service on the Feathers application
  app.use(pushHandlerPath, new PushHandlerService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: pushHandlerMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  });
  // Initialize hooks
  app.service(pushHandlerPath).hooks({
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
