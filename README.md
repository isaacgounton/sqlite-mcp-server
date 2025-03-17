# SQLite MCP Server

A Model Context Protocol (MCP) server that provides SQLite database operations through a standardized interface.

## Features

- In-memory SQLite database (configurable for file-based storage)
- SQL operations (SELECT, INSERT, UPDATE, DELETE)
- Table management (CREATE, LIST, DESCRIBE)
- Business insights memo tracking
- Docker support for easy deployment

## Installation

```bash
npm install
npm run build
```

## Development

```bash
# Build TypeScript
npm run build

# Start the server
npm start
```

## Docker Deployment

Build the image:
```bash
docker build -t sqlite-mcp-server .
```

Run the container:
```bash
docker run -d --name sqlite-mcp sqlite-mcp-server
```

## Docker Compose with n8n

Create a `docker-compose.yml`:

```yaml
version: '3'
services:
  sqlite-mcp:
    image: sqlite-mcp-server
    stdin_open: true
    tty: true
    volumes:
      - sqlite_data:/data  # Optional: For persistent storage

  n8n:
    image: n8n/n8n
    depends_on:
      - sqlite-mcp
    environment:
      - N8N_EDITOR_BASE_URL=http://localhost:5678
    ports:
      - "5678:5678"

volumes:
  sqlite_data:
```

Run with:
```bash
docker-compose up -d
```

## Available Tools

1. `read_query`: Execute SELECT queries
2. `write_query`: Execute INSERT, UPDATE, or DELETE queries
3. `create_table`: Create new tables
4. `list_tables`: List all tables in the database
5. `describe_table`: View schema information for a table
6. `append_insight`: Add business insights to the memo

## Example Usage

```typescript
// Create a table
await callTool('create_table', {
  query: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'
});

// Insert data
await callTool('write_query', {
  query: 'INSERT INTO users (name) VALUES ("John Doe")'
});

// Query data
const result = await callTool('read_query', {
  query: 'SELECT * FROM users'
});
```

## Environment Variables

None required by default. If using file-based storage, modify the database path in `src/index.ts`.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC
