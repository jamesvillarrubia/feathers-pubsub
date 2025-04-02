import { pubsub } from './pubsub/pubsub.js';
import { pushHandler } from './push-handler/push-handler.js';


export const services = app => {
  app.configure(pubsub);
  app.configure(pushHandler);
};
