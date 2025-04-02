// // For more information about this file see https://dove.feathersjs.com/guides/cli/

/**********************************
 * Import the queue schema as service for your service
 */
import { queueSchema as pubsubSchema, queueQuerySchema as pubsubQuerySchema } from '../../../../dist/index.js';
/**********************************/





// Standard imports for feathers service
import { Type, getValidator, defaultDefinitions } from '@feathersjs/typebox';
import { resolveValidator, resolveResult } from '@feathersjs/schema';
// Define the schema for patch operations
export const pubsubPatchSchema = Type.Partial(pubsubSchema);

// Create validators
export const pubsubDataValidator = getValidator(pubsubSchema, defaultDefinitions);
export const pubsubQueryValidator = getValidator(pubsubQuerySchema, defaultDefinitions);
export const pubsubPatchValidator = getValidator(pubsubPatchSchema, defaultDefinitions);

// Create resolvers
export const pubsubDataResolver = resolveValidator(pubsubSchema);
export const pubsubQueryResolver = resolveValidator(pubsubQuerySchema);
export const pubsubPatchResolver = resolveValidator(pubsubPatchSchema);

// External resolver for handling external data
export const pubsubExternalResolver = resolveValidator(pubsubSchema);

// Result resolver for handling service results
export const pubsubResolver = resolveResult(pubsubSchema);
