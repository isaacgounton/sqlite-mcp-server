# SQLite MCP Server

A Model Context Protocol (MCP) server that provides SQLite database operations through a standardized interface.

## Features

- In-memory SQLite database (configurable for file-based storage)
- SQL operations (SELECT, INSERT, UPDATE, DELETE)
- Table management (CREATE, LIST, DESCRIBE)
- Business insights memo tracking
- Docker support for easy deployment

## Development & Deployment

### Local Development
```bash
# Install dependencies and build
npm install
npm start
```

### Docker Deployment
```bash
# Build and run with Docker
docker build -t sqlite-mcp-server .
docker run -d --name sqlite-mcp sqlite-mcp-server
```

## Available Tools

1. `read_query`: Execute SELECT queries
2. `write_query`: Execute INSERT, UPDATE, or DELETE queries
3. `create_table`: Create new tables
4. `list_tables`: List all tables in the database
5. `describe_table`: View schema information for a table
6. `append_insight`: Add business insights to the memo

## Remote Server Connection

To connect using SSE in n8n:

1. Add an MCP Client node
2. Configure SSE connection:
   - SSE URL: `http://localhost:3001/sse`
   - Messages Post Endpoint: `http://localhost:3001/messages`
   - No additional headers required

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
