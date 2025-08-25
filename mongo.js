import { MongoClient } from 'mongodb';
import { logger } from './logger.js';

let client;

/**
 * Get a MongoClient (lazy-init, singleton)
 */
export async function getClient(uri) {
  if (client && client.topology?.isConnected()) {
    return client;
  }
  const mongoUri = uri || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not provided (env or param)');
  }
  client = new MongoClient(mongoUri, { monitorCommands: false });
  await client.connect();
  logger.info({ mongoUri: mongoUri.replace(/:.+@/, ':****@') }, 'Connected to MongoDB');
  return client;
}

/**
 * Resolve a collection from flexible inputs.
 * @param {object} p
 * @param {string} p.db - database name
 * @param {string} p.collection - collection name
 * @param {string} [p.uri] - optional override MongoDB URI
 */
export async function getCollection({ db, collection, uri }) {
  if (!db) throw new Error('Missing db');
  if (!collection) throw new Error('Missing collection');
  const c = (await getClient(uri)).db(db).collection(collection);
  return c;
}
