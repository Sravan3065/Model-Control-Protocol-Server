# MCP MongoDB Server (CRUD + Aggregations)

A minimal **Model Context Protocol (MCP)** server that exposes MongoDB **CRUD** and **Aggregation** as MCP tools, with an optional lightweight **HTTP** and **WebSocket** wrapper for external clients.

## Features

- ✅ Dynamic inputs: `uri`, `db`, `collection`, `query`, `document`, `filter`, `update`, `options`
- ✅ CRUD: `insertOne`, `findOne`, `findMany`, `updateOne`, `deleteOne`
- ✅ Aggregation: `aggregate(pipeline)`
- ✅ Error handling + structured logging (pino)
- ✅ HTTP API + WS wrapper (optional)
- ✅ Clean, modular code (no framework lock-in)

## Quickstart

### 1) Requirements
- Node.js 20+
- MongoDB (local or Atlas)
- An MCP client (e.g., Claude Desktop) **for MCP mode**

### 2) Install
```bash
cp .env.example .env
# edit .env to set MONGODB_URI and DEFAULT_DB if desired
npm i
```

### 3A) Run as an MCP Server (stdio transport)
```bash
npm run dev:mcp
```
- The server exposes tools:
  - `insertOne`
  - `findOne`
  - `findMany`
  - `updateOne`
  - `deleteOne`
  - `aggregate`
  - `ping`

#### Configure in Claude Desktop (example)
Add to your `claude_desktop_config.json`:
```jsonc
{
  "mcpServers": {
    "mongo-mcp": {
      "command": "node",
      "args": ["src/mcp-server.js"],
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017",
        "DEFAULT_DB": "test"
      }
    }
  }
}
```

Then start a new chat and run tools like:
```json
{
  "tool": "insertOne",
  "args": {
    "db": "test",
    "collection": "users",
    "document": { "name": "Ada", "role": "admin" }
  }
}
```

### 3B) Run as HTTP/WS API (optional)
```bash
npm run dev:http
# Defaults to PORT=8080
```
**HTTP examples:**

- Insert:
```bash
curl -X POST "http://localhost:8080/insertOne?db=test&collection=users"   -H "Content-Type: application/json"   -d '{"name":"Ada","role":"admin"}'
```

- Find many:
```bash
curl -X POST "http://localhost:8080/findMany?db=test&collection=users"   -H "Content-Type: application/json"   -d '{"query": {"role": "admin"}, "options": {"limit": 10}}'
```

- Aggregate:
```bash
curl -X POST "http://localhost:8080/aggregate?db=test&collection=users"   -H "Content-Type: application/json"   -d '{"pipeline": [{"$match": {"role":"admin"}}, {"$group":{"_id":"$role","count":{"$sum":1}}}]}'
```

**WS example payloads** (path `/ws`):
```json
{ "id": 1, "method": "findMany", "params": {
  "db": "test", "collection": "users", "query": { "role": "admin" } } }
```

## Design Notes

- Uses `@modelcontextprotocol/sdk` stdio transport for MCP mode.
- Mongo connection is lazy, shared, and supports overriding `uri` per request.
- All inputs are **JSON** and validated with zod in MCP mode.
- Logging via `pino` (+ pretty in dev). No secrets are logged.

## Error Handling

- Missing required params produce `400` in HTTP and an error in MCP tool output.
- Mongo driver errors are returned with messages; stack traces remain server-side.

## Project Structure

```
src/
  http-server.js     # lightweight HTTP + WS API
  logger.js          # pino logger
  mcp-server.js      # MCP tools (stdio transport)
  mongo.js           # Mongo helpers (client + getCollection)
.env.example
package.json
README.md
```

## Testing Tips

1) Start MongoDB (e.g., `mongod`).
2) Run `npm run dev:http` and test the endpoints with curl or Postman.
3) For MCP, add to your client's config and run tools from the UI.

## License

MIT
