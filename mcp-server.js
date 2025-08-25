/**
 * MCP Server exposing MongoDB CRUD and aggregation.
 * Transport: stdio by default (works with Claude Desktop and other MCP clients).
 */
import 'dotenv/config';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getCollection } from './mongo.js';
import { logger } from './logger.js';

const server = new McpServer({
  name: 'mongo-mcp',
  version: '1.0.0',
});

// Zod schemas for inputs
const baseParams = z.object({
  uri: z.string().optional().describe('MongoDB connection URI; falls back to env MONGODB_URI'),
  db: z.string().default(process.env.DEFAULT_DB || '').describe('Database name'),
  collection: z.string().describe('Collection name'),
});

const docSchema = z.record(z.any()).describe('Arbitrary document');
const querySchema = z.record(z.any()).default({}).describe('MongoDB filter / query object');
const optionsSchema = z.record(z.any()).optional().describe('Driver options (projection, upsert, sort, limit, etc.)');

// Tools

server.tool('insertOne', baseParams.extend({ document: docSchema }), async (params) => {
  const { db, collection, uri, document } = params;
  const coll = await getCollection({ db, collection, uri });
  const res = await coll.insertOne(document);
  return { content: [{ type: 'text', text: JSON.stringify({ insertedId: res.insertedId }, null, 2) }] };
});

server.tool('findOne', baseParams.extend({ query: querySchema, options: optionsSchema }), async (p) => {
  const coll = await getCollection(p);
  const doc = await coll.findOne(p.query || {}, p.options);
  return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
});

server.tool('findMany', baseParams.extend({ query: querySchema, options: optionsSchema }), async (p) => {
  const coll = await getCollection(p);
  // Support limit/sort via options, but guard defaults
  const cursor = coll.find(p.query || {}, p.options || {});
  const docs = await cursor.toArray();
  return { content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }] };
});

server.tool('updateOne', baseParams.extend({
  filter: querySchema.describe('Filter to match documents'),
  update: docSchema.describe('Update document (use $set / $push etc.)'),
  options: optionsSchema
}), async (p) => {
  const coll = await getCollection(p);
  const res = await coll.updateOne(p.filter, p.update, p.options);
  return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
});

server.tool('deleteOne', baseParams.extend({ filter: querySchema }), async (p) => {
  const coll = await getCollection(p);
  const res = await coll.deleteOne(p.filter);
  return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
});

server.tool('aggregate', baseParams.extend({ pipeline: z.array(z.record(z.any())).describe('MongoDB aggregation pipeline array'), options: optionsSchema }), async (p) => {
  const coll = await getCollection(p);
  const cursor = coll.aggregate(p.pipeline, p.options || {});
  const docs = await cursor.toArray();
  return { content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }] };
});

// Health/tooling
server.tool('ping', z.object({}), async () => ({
  content: [{ type: 'text', text: 'ok' }]
}));

// Start stdio transport
const transport = new StdioServerTransport();
transport.onclose = () => {
  logger.info('stdio transport closed');
  process.exit(0);
};

logger.info('Starting MCP server on stdio...');
await server.connect(transport);
