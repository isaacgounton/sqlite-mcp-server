# SQLite MCP Server

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

The server exposes a single endpoint at `http://localhost:3000/mcp` following the MCP Streamable HTTP specification.

### Docker

```bash
docker build -t sqlite-mcp-server .
docker run -d -p 3000:3000 --name sqlite-mcp sqlite-mcp-server
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `--http` | Use Streamable HTTP transport instead of stdio | stdio |
| First non-flag argument | Path to SQLite database file | `:memory:` |
| `SQLITE_DB_PATH` | Database path (env var alternative) | `:memory:` |
| `PORT` | HTTP server port (HTTP mode only) | `3000` |

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

## Security

- Query validation: each tool only accepts its intended SQL statement type
- Multi-statement injection blocked (semicolons within queries are rejected)
- Table names validated against `^[a-zA-Z_][a-zA-Z0-9_]*$`
- WAL mode and foreign keys enabled by default
- DNS rebinding protection on HTTP transport

## Development

```bash
npm install
npm run build
npm start          # stdio mode
npm run start:http # HTTP mode
```

## License

[ISC](LICENSE)
