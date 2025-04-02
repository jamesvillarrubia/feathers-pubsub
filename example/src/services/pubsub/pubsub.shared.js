export const pubsubPath = 'pubsub';

export const pubsubMethods = ['find', 'get', 'create', 'patch', 'remove'];

export const pubsubClient = client => {
  const connection = client.get('connection');

  client.use(pubsubPath, connection.service(pubsubPath), {
    methods: pubsubMethods
  });
};
