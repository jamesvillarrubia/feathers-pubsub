import { app } from '../src/app.js';
import { logger } from '../src/logger.js';
import { beforeAll, afterAll } from 'vitest';

let server;

beforeAll(async () => {
  // Start the server
  const port = app.get('port');
  const host = app.get('host');
  server = await app.listen(port);
  logger.info(`Test server listening on http://${host}:${port}`);
});

afterAll(async () => {
  // Clean up and close the server
  if (server) {
    await server.close();
    logger.info('Test server closed');
  }
}); 