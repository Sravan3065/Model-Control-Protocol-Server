/**
 * Lightweight HTTP/WS API exposing the same MongoDB actions for non-MCP clients.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { getCollection } from './mongo.js';
import { logger } from './logger.js';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: (process.env.ALLOWED_ORIGINS || '*').split(',') }));
app.use(helmet());

function buildParams(req) {
  const { db = process.env.DEFAULT_DB, collection, uri } = req.query;
  return { db, collection, uri };
}

// CRUD endpoints
app.post('/insertOne', async (req, res) => {
  try {
    const p = { ...buildParams(req), document: req.body };
    const coll = await getCollection(p);
    const out = await coll.insertOne(p.document);
    res.json({ ok: true, insertedId: out.insertedId });
  } catch (err) {
    logger.error(err);
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/findOne', async (req, res) => {
  try {
    const p = { ...buildParams(req), query: req.body.query || {}, options: req.body.options };
    const coll = await getCollection(p);
    const doc = await coll.findOne(p.query, p.options);
    res.json({ ok: true, doc });
  } catch (err) {
    logger.error(err);
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/findMany', async (req, res) => {
  try {
    const p = { ...buildParams(req), query: req.body.query || {}, options: req.body.options };
    const coll = await getCollection(p);
    const docs = await coll.find(p.query, p.options || {}).toArray();
    res.json({ ok: true, docs });
  } catch (err) {
    logger.error(err);
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/updateOne', async (req, res) => {
  try {
    const p = { ...buildParams(req), filter: req.body.filter || {}, update: req.body.update, options: req.body.options };
    const coll = await getCollection(p);
    const out = await coll.updateOne(p.filter, p.update, p.options);
    res.json({ ok: true, result: out });
  } catch (err) {
    logger.error(err);
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/deleteOne', async (req, res) => {
  try {
    const p = { ...buildParams(req), filter: req.body.filter || {} };
    const coll = await getCollection(p);
    const out = await coll.deleteOne(p.filter);
    res.json({ ok: true, result: out });
  } catch (err) {
    logger.error(err);
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

app.post('/aggregate', async (req, res) => {
  try {
    const p = { ...buildParams(req), pipeline: req.body.pipeline || [], options: req.body.options };
    const coll = await getCollection(p);
    const docs = await coll.aggregate(p.pipeline, p.options || {}).toArray();
    res.json({ ok: true, docs });
  } catch (err) {
    logger.error(err);
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 8080);
const server = app.listen(port, () => logger.info({ port }, 'HTTP server listening'));

// Optional basic WebSocket that forwards JSON RPC-like requests
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const req = JSON.parse(String(msg));
      const { method, params = {} } = req;
      const coll = await getCollection(params);
      let result;
      switch (method) {
        case 'insertOne':
          result = await coll.insertOne(params.document);
          ws.send(JSON.stringify({ id: req.id, ok: true, result: { insertedId: result.insertedId } }));
          break;
        case 'findOne':
          result = await coll.findOne(params.query || {}, params.options);
          ws.send(JSON.stringify({ id: req.id, ok: true, result }));
          break;
        case 'findMany':
          result = await coll.find(params.query || {}, params.options || {}).toArray();
          ws.send(JSON.stringify({ id: req.id, ok: true, result }));
          break;
        case 'updateOne':
          result = await coll.updateOne(params.filter || {}, params.update, params.options);
          ws.send(JSON.stringify({ id: req.id, ok: true, result }));
          break;
        case 'deleteOne':
          result = await coll.deleteOne(params.filter || {});
          ws.send(JSON.stringify({ id: req.id, ok: true, result }));
          break;
        case 'aggregate':
          result = await coll.aggregate(params.pipeline || [], params.options || {}).toArray();
          ws.send(JSON.stringify({ id: req.id, ok: true, result }));
          break;
        default:
          ws.send(JSON.stringify({ id: req.id, ok: false, error: 'Unknown method' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ ok: false, error: String(err.message || err) }));
    }
  });
});
