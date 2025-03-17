#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const PROMPT_TEMPLATE = `
Oh, Hey there! I see you've chosen the topic {topic}. Let's get started! 🚀

I'll help you create a comprehensive business scenario using our SQLite database. We'll:
1. Set up relevant database tables
2. Populate them with sample data
3. Run some insightful queries
4. Generate business insights
5. Create a dashboard
`;

class SQLiteServer {
  private server: Server;
  private db: sqlite3.Database;
  private insights: string[] = [];

  constructor() {
    this.server = new Server(
      {
        name: 'sqlite-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: { listChanged: false },
          tools: { listChanged: false },
          prompts: { listChanged: false }
        },
      }
    );

    // Initialize SQLite database
    this.db = new sqlite3.Database(':memory:');
    this.setupResourceHandlers();
    this.setupToolHandlers();
    this.setupPromptHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      this.db.close();
      process.exit(0);
    });
  }

  private setupPromptHandlers() {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'mcp-demo',
          description: 'A prompt to demonstrate SQLite MCP Server capabilities',
          arguments: [
            {
              name: 'topic',
              description: 'Topic to seed the database with initial data',
              required: true
            }
          ]
        }
      ]
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (request.params.name !== 'mcp-demo') {
        throw new McpError(ErrorCode.InvalidRequest, 'Unknown prompt');
      }

      if (!request.params.arguments?.topic) {
        throw new McpError(ErrorCode.InvalidRequest, 'Missing required argument: topic');
      }

      const prompt = PROMPT_TEMPLATE.replace('{topic}', request.params.arguments.topic);

      return {
        description: `Demo template for ${request.params.arguments.topic}`,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt.trim() }]
          }
        ]
      };
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'memo://insights',
          name: 'Business Insights Memo',
          description: 'Continuously updated business insights memo',
          mimeType: 'text/plain',
        },
      ],
    }));

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (request.params.uri !== 'memo://insights') {
          throw new McpError(ErrorCode.InvalidRequest, 'Resource not found');
      }

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: this.insights.join('\n\n'),
          },
        ],
      };
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'read_query',
          description: 'Execute a SELECT query',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The SELECT SQL query to execute',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'write_query',
          description: 'Execute an INSERT, UPDATE, or DELETE query',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The SQL modification query',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_table',
          description: 'Create a new table',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'CREATE TABLE SQL statement',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'list_tables',
          description: 'List all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'describe_table',
          description: 'View schema information for a table',
          inputSchema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: 'Name of table to describe',
              },
            },
            required: ['table_name'],
          },
        },
        {
          name: 'append_insight',
          description: 'Add a new business insight to the memo',
          inputSchema: {
            type: 'object',
            properties: {
              insight: {
                type: 'string',
                description: 'Business insight discovered from data analysis',
              },
            },
            required: ['insight'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'read_query': {
          const { query } = request.params.arguments as { query: string };
          if (!query.toLowerCase().trim().startsWith('select')) {
            throw new McpError(ErrorCode.InvalidParams, 'Only SELECT queries are allowed');
          }
          const result = await promisify(this.db.all.bind(this.db))(query);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'write_query': {
          const { query } = request.params.arguments as { query: string };
          const result = await promisify(this.db.run.bind(this.db))(query) as { changes?: number };
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ affected_rows: result.changes }, null, 2),
              },
            ],
          };
        }

        case 'create_table': {
          const { query } = request.params.arguments as { query: string };
          if (!query.toLowerCase().trim().startsWith('create table')) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Query must be a CREATE TABLE statement'
            );
          }
          await promisify(this.db.run.bind(this.db))(query);
          return {
            content: [{ type: 'text', text: 'Table created successfully' }],
          };
        }

        case 'list_tables': {
          const result = await promisify(this.db.all.bind(this.db))(
            "SELECT name FROM sqlite_master WHERE type='table'"
          ) as { name: string }[];
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.map((r: { name: string }) => r.name), null, 2),
              },
            ],
          };
        }

        case 'describe_table': {
          const { table_name } = request.params.arguments as { table_name: string };
          const result = await promisify(this.db.all.bind(this.db))(
            `PRAGMA table_info(${table_name})`
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        case 'append_insight': {
          const { insight } = request.params.arguments as { insight: string };
          this.insights.push(insight);
          return {
            content: [{ type: 'text', text: 'Insight added successfully' }],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('SQLite MCP server running on stdio');
  }
}

const server = new SQLiteServer();
server.run().catch(console.error);
