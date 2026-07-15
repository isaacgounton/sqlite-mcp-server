#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  validateTableName,
  validateReadQuery,
  validateWriteQuery,
  validateCreateTableQuery,
} from './validators.js';
import { bearerAuth } from './auth.js';

// --- Configuration ---
const args = process.argv.slice(2);
const dbPath = process.env.SQLITE_DB_PATH || args.find(a => !a.startsWith('--')) || ':memory:';
const transportMode = args.includes('--http') ? 'http' : 'stdio';
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';
const allowedHosts = (process.env.MCP_ALLOWED_HOSTS || `localhost:${port},127.0.0.1:${port}`)
  .split(',').map(h => h.trim()).filter(Boolean);
const authToken = process.env.MCP_AUTH_TOKEN;

// --- Shared database wrapper ---
class DatabaseWrapper {
  private db: SqlJsDatabase;
  private filePath: string | null;

  private constructor(db: SqlJsDatabase, filePath: string | null) {
    this.db = db;
    this.filePath = filePath;
    this.db.run('PRAGMA foreign_keys = ON');
  }

  static async create(path: string): Promise<DatabaseWrapper> {
    const SQL = await initSqlJs();
    let db: SqlJsDatabase;
    const filePath = path === ':memory:' ? null : path;

    if (filePath && existsSync(filePath)) {
      const buffer = readFileSync(filePath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    return new DatabaseWrapper(db, filePath);
  }

  all(sql: string): Record<string, unknown>[] {
    const stmt = this.db.prepare(sql);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, unknown>);
    }
    stmt.free();
    return rows;
  }

  run(sql: string): { changes: number } {
    this.db.run(sql);
    const changes = this.db.getRowsModified();
    this.persist();
    return { changes };
  }

  private persist(): void {
    if (this.filePath) {
      const data = this.db.export();
      writeFileSync(this.filePath, Buffer.from(data));
    }
  }

  close(): void {
    this.persist();
    this.db.close();
  }
}

// --- Shared insights store ---
const insights: string[] = [];

// --- Server factory ---
function createMcpServer(db: DatabaseWrapper): Server {
  const server = new Server(
    { name: 'sqlite-manager', version: '1.0.0' },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  server.onerror = (error) => console.error('[MCP Error]', error);

  // ── Resources ──
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: `sqlite://${dbPath}/schema`,
        name: 'Database Schema',
        description: 'Complete schema of all tables in the SQLite database',
        mimeType: 'application/json',
      },
      {
        uri: 'memo://insights',
        name: 'Business Insights Memo',
        description: 'Accumulated business insights from data analysis',
        mimeType: 'text/plain',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === `sqlite://${dbPath}/schema`) {
      const tables = db.all(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ) as { name: string; sql: string }[];
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(tables, null, 2),
        }],
      };
    }

    if (uri === 'memo://insights') {
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: insights.length > 0 ? insights.join('\n\n') : 'No insights yet.',
        }],
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
  });

  // ── Tools ──
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'read_query',
        description: 'Execute a read-only SQL query (SELECT, WITH/CTE, or EXPLAIN). Use this for fetching data.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'The SELECT SQL query to execute' },
          },
          required: ['query'],
        },
      },
      {
        name: 'write_query',
        description: 'Execute a data modification query (INSERT, UPDATE, DELETE, REPLACE). Returns affected row count.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'The SQL modification query to execute' },
          },
          required: ['query'],
        },
      },
      {
        name: 'create_table',
        description: 'Create a new table in the database with a full CREATE TABLE SQL statement.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'CREATE TABLE SQL statement' },
          },
          required: ['query'],
        },
      },
      {
        name: 'drop_table',
        description: 'Drop (delete) a table from the database. This action is irreversible.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            table_name: { type: 'string', description: 'Name of the table to drop' },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'list_tables',
        description: 'List all user-created tables in the database.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      },
      {
        name: 'describe_table',
        description: 'Get the schema of a table: columns, types, constraints, indexes, and foreign keys.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            table_name: { type: 'string', description: 'Name of the table to describe' },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'append_insight',
        description: 'Add a business insight to the insights memo resource. Useful for recording observations from analysis.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            insight: { type: 'string', description: 'The business insight to record' },
          },
          required: ['insight'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;

    switch (name) {
      case 'read_query': {
        const { query } = toolArgs as { query: string };
        validateReadQuery(query);
        const rows = db.all(query);
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      }

      case 'write_query': {
        const { query } = toolArgs as { query: string };
        validateWriteQuery(query);
        const result = db.run(query);
        return {
          content: [{ type: 'text', text: JSON.stringify({ affected_rows: result.changes }, null, 2) }],
        };
      }

      case 'create_table': {
        const { query } = toolArgs as { query: string };
        validateCreateTableQuery(query);
        db.run(query);
        return { content: [{ type: 'text', text: 'Table created successfully' }] };
      }

      case 'drop_table': {
        const { table_name } = toolArgs as { table_name: string };
        validateTableName(table_name);
        db.run(`DROP TABLE IF EXISTS "${table_name}"`);
        return { content: [{ type: 'text', text: `Table "${table_name}" dropped successfully` }] };
      }

      case 'list_tables': {
        const rows = db.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ) as { name: string }[];
        return {
          content: [{ type: 'text', text: JSON.stringify(rows.map(r => r.name), null, 2) }],
        };
      }

      case 'describe_table': {
        const { table_name } = toolArgs as { table_name: string };
        validateTableName(table_name);
        const columns = db.all(`PRAGMA table_info("${table_name}")`);
        const indexes = db.all(`PRAGMA index_list("${table_name}")`);
        const foreignKeys = db.all(`PRAGMA foreign_key_list("${table_name}")`);
        return {
          content: [{ type: 'text', text: JSON.stringify({ columns, indexes, foreign_keys: foreignKeys }, null, 2) }],
        };
      }

      case 'append_insight': {
        const { insight } = toolArgs as { insight: string };
        insights.push(insight);
        return { content: [{ type: 'text', text: `Insight added (total: ${insights.length})` }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  // ── Prompts ──
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: 'mcp-demo',
        description: 'A guided walkthrough that creates tables, inserts sample data, and runs queries for a given topic',
        arguments: [
          {
            name: 'topic',
            description: 'Business domain to create sample data for (e.g., "e-commerce", "inventory", "HR")',
            required: true,
          },
        ],
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== 'mcp-demo') {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${request.params.name}`);
    }
    const topic = request.params.arguments?.topic;
    if (!topic) {
      throw new McpError(ErrorCode.InvalidRequest, 'Missing required argument: topic');
    }

    return {
      description: `Demo template for ${topic}`,
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Topic: ${topic}`,
              '',
              'Using the SQLite MCP server, please:',
              '1. Create relevant database tables for this topic with appropriate schemas',
              '2. Insert realistic sample data (at least 10 rows per table)',
              '3. Run analytical queries to extract insights',
              '4. Use append_insight to record each finding',
              '5. Summarize the insights at the end',
            ].join('\n'),
          },
        },
      ],
    };
  });

  return server;
}

// --- Transport: Streamable HTTP ---
async function startHttpTransport(db: DatabaseWrapper) {
  const app = createMcpExpressApp();

  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Health check (unauthenticated, for load balancers)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', db: dbPath, sessions: transports.size });
  });

  // Bearer-token auth on all /mcp routes (no-op when MCP_AUTH_TOKEN is unset)
  app.use('/mcp', bearerAuth(authToken));

  // Streamable HTTP endpoint - handles POST (messages) and GET (SSE stream)
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Existing session — route to its transport
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — only allow initialize requests
    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableDnsRebindingProtection: true,
        allowedHosts,
        onsessioninitialized: (id) => {
          transports.set(id, transport);
          console.error(`Session initialized: ${id}`);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
          console.error(`Session closed: ${transport.sessionId}`);
        }
      };

      const server = createMcpServer(db);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid request: bad session ID or not an initialize request' },
      id: null,
    });
  });

  // GET for SSE stream (session resumability)
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const transport = transports.get(sessionId);
    if (transport) {
      await transport.handleRequest(req, res);
    } else {
      res.status(400).json({ error: 'Invalid or missing session ID' });
    }
  });

  // DELETE for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    const transport = transports.get(sessionId);
    if (transport) {
      await transport.close();
      transports.delete(sessionId);
      res.status(200).json({ message: 'Session terminated' });
    } else {
      res.status(400).json({ error: 'Invalid or missing session ID' });
    }
  });

  app.listen(port, host, () => {
    console.error(`SQLite MCP server (Streamable HTTP) listening on ${host}:${port}`);
    console.error(`  Database: ${dbPath}`);
    console.error(`  Endpoint: http://${host}:${port}/mcp`);
    console.error(`  Health:   http://${host}:${port}/health`);
    console.error(`  Auth:     ${authToken ? 'bearer token required' : 'DISABLED (set MCP_AUTH_TOKEN)'}`);
    if (!authToken && host !== '127.0.0.1' && host !== 'localhost') {
      console.error(`  WARNING: bound to ${host} with NO auth — set MCP_AUTH_TOKEN and/or front it with an authenticating proxy. See SECURITY.md`);
    }
  });
}

// --- Transport: Stdio ---
async function startStdioTransport(db: DatabaseWrapper) {
  const server = createMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`SQLite MCP server running on stdio (db: ${dbPath})`);
}

// --- Main ---
async function main() {
  const db = await DatabaseWrapper.create(dbPath);

  process.on('SIGINT', () => {
    db.close();
    process.exit(0);
  });

  if (transportMode === 'http') {
    await startHttpTransport(db);
  } else {
    await startStdioTransport(db);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
