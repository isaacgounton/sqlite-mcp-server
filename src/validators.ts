import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// --- Validation helpers ---
export const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function validateTableName(name: string): void {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid table name: "${name}". Use only letters, numbers, and underscores.`);
  }
}

export function validateReadQuery(query: string): void {
  const normalized = query.trim().toLowerCase();
  if (!normalized.startsWith('select') && !normalized.startsWith('with') && !normalized.startsWith('explain')) {
    throw new McpError(ErrorCode.InvalidParams, 'Only SELECT, WITH (CTE), and EXPLAIN queries are allowed for read_query');
  }
  if (queryHasMultipleStatements(query)) {
    throw new McpError(ErrorCode.InvalidParams, 'Multiple statements are not allowed');
  }
}

export function validateWriteQuery(query: string): void {
  const normalized = query.trim().toLowerCase();
  const allowed = ['insert', 'update', 'delete', 'replace'];
  if (!allowed.some(prefix => normalized.startsWith(prefix))) {
    throw new McpError(ErrorCode.InvalidParams, 'Only INSERT, UPDATE, DELETE, and REPLACE queries are allowed for write_query');
  }
  if (queryHasMultipleStatements(query)) {
    throw new McpError(ErrorCode.InvalidParams, 'Multiple statements are not allowed');
  }
}

export function validateCreateTableQuery(query: string): void {
  const normalized = query.trim().toLowerCase();
  if (!normalized.startsWith('create table')) {
    throw new McpError(ErrorCode.InvalidParams, 'Query must be a CREATE TABLE statement');
  }
  if (queryHasMultipleStatements(query)) {
    throw new McpError(ErrorCode.InvalidParams, 'Multiple statements are not allowed');
  }
}

export function queryHasMultipleStatements(query: string): boolean {
  const stripped = query
    .replace(/'(?:[^']|'')*'/g, '')    // remove single-quoted strings (handles '' escapes)
    .replace(/"(?:[^"]|"")*"/g, '')    // remove double-quoted identifiers (handles "" escapes)
    .replace(/--[^\n]*/g, '')          // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')  // remove block comments
    .trim()
    .replace(/;$/, '');                // remove trailing semicolon
  return stripped.includes(';');
}
