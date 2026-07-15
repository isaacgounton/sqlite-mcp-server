# SQLite MCP Server

[![CI](https://github.com/isaacgounton/sqlite-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/isaacgounton/sqlite-mcp-server/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![smithery badge](https://smithery.ai/badge/@isaacgounton/sqlite-mcp-server)](https://smithery.ai/server/@isaacgounton/sqlite-mcp-server)

A Model Context Protocol (MCP) server that provides SQLite database operations. Supports both **stdio** (for Claude Desktop, Cursor, etc.) and **Streamable HTTP** (for remote clients) transports.

## Features

- In-memory or file-based SQLite database
- Dual transport: stdio and Streamable HTTP
- SQL operations with input validation and injection protection
- Table management (CREATE, DROP, LIST, DESCRIBE)
- Database schema exposed as an MCP resource
- Business insights memo tracking
- Docker support

## Quick Start

### Stdio (Claude Desktop, Cursor, etc.)

```bash
npm install && npm run build
node build/index.js
```

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "node",
      "args": ["/path/to/sqlite-mcp-server/build/index.js"]
    }
  }
}
```

With a file-based database:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "node",
      "args": ["/path/to/sqlite-mcp-server/build/index.js", "/path/to/database.db"]
    }
  }
}
```

### Streamable HTTP (remote clients)

```bash
node build/index.js --http
```

The server exposes a single endpoint at `http://localhost:3000/mcp` following the MCP Streamable HTTP specification. By default it binds to `127.0.0.1`. To reach it from another host or a container, set `HOST=0.0.0.0` — but read the [Security](#security) section first: the HTTP transport has no authentication.

### Docker

```bash
docker build -t sqlite-mcp-server .
docker run -d -p 3000:3000 -e HOST=0.0.0.0 --name sqlite-mcp sqlite-mcp-server
```

`HOST=0.0.0.0` is required so the server is reachable through the published port. Connecting from the host via `localhost:3000` works out of the box; to reach it under any other hostname, add that host to `MCP_ALLOWED_HOSTS`.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `--http` | Use Streamable HTTP transport instead of stdio | stdio |
| First non-flag argument | Path to SQLite database file | `:memory:` |
| `SQLITE_DB_PATH` | Database path (env var alternative) | `:memory:` |
| `PORT` | HTTP server port (HTTP mode only) | `3000` |
| `HOST` | Interface to bind in HTTP mode. Use `0.0.0.0` to expose beyond localhost | `127.0.0.1` |
| `MCP_ALLOWED_HOSTS` | Comma-separated `Host` header allow-list for DNS-rebinding protection | `localhost:$PORT,127.0.0.1:$PORT` |
| `MCP_AUTH_TOKEN` | Bearer token required on all `/mcp` requests (HTTP mode). Unset = auth disabled | _(none)_ |

Examples:

```bash
# In-memory database on stdio
node build/index.js

# File-based database on stdio
node build/index.js ./data.db

# HTTP mode with custom port
PORT=8080 node build/index.js --http ./data.db

# Using environment variable
SQLITE_DB_PATH=./data.db node build/index.js --http
```

## Available Tools

| Tool | Description |
|------|-------------|
| `read_query` | Execute SELECT, WITH (CTE), or EXPLAIN queries |
| `write_query` | Execute INSERT, UPDATE, DELETE, or REPLACE queries |
| `create_table` | Create a new table with a CREATE TABLE statement |
| `drop_table` | Drop a table (irreversible) |
| `list_tables` | List all user-created tables |
| `describe_table` | Get table schema: columns, indexes, and foreign keys |
| `append_insight` | Add a business insight to the memo resource |

## Resources

| URI | Description |
|-----|-------------|
| `sqlite://{db}/schema` | Full schema (CREATE statements) for all tables |
| `memo://insights` | Accumulated business insights from analysis |

## Prompts

| Name | Description |
|------|-------------|
| `mcp-demo` | Guided walkthrough: creates tables, inserts sample data, runs queries for a given topic |

## Remote Connection

### Streamable HTTP

Connect any MCP-compatible client to `http://your-host:3000/mcp`. The server supports:

- `POST /mcp` — send MCP messages (session created on initialize)
- `GET /mcp` — SSE stream for session resumability
- `DELETE /mcp` — terminate a session
- `GET /health` — health check endpoint

Sessions are managed via the `Mcp-Session-Id` header.

### Authentication

Set `MCP_AUTH_TOKEN` to require a bearer token on every `/mcp` request (`/health` stays open):

```bash
MCP_AUTH_TOKEN=$(openssl rand -hex 32) HOST=0.0.0.0 node build/index.js --http
```

Clients then send `Authorization: Bearer <token>`. When `MCP_AUTH_TOKEN` is unset, authentication is disabled — fine for a localhost-only bind, but do not expose the server publicly without it.

## Security

- Query validation: each tool only accepts its intended SQL statement type
- Multi-statement injection blocked: stacked statements are rejected, with string literals and comments stripped before the check
- Table names validated against `^[a-zA-Z_][a-zA-Z0-9_]*$`
- Foreign keys enabled by default
- HTTP transport binds to `127.0.0.1` by default, with DNS-rebinding protection (`MCP_ALLOWED_HOSTS`)
- Optional bearer-token auth on the HTTP transport via `MCP_AUTH_TOKEN` (timing-safe check)

**Set `MCP_AUTH_TOKEN` before exposing the HTTP transport beyond localhost.** For production, also front it with a reverse proxy that terminates TLS. See [SECURITY.md](SECURITY.md) for the full model and how to report a vulnerability.

## Development

```bash
npm install
npm run build
npm test           # build + run the validator test suite
npm start          # stdio mode
npm run start:http # HTTP mode
```

## License

[ISC](LICENSE)
