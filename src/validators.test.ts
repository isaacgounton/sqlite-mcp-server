import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  validateTableName,
  validateReadQuery,
  validateWriteQuery,
  validateCreateTableQuery,
  queryHasMultipleStatements,
} from './validators.js';

const throws = (fn: () => void) => assert.throws(fn, McpError);
const ok = (fn: () => void) => assert.doesNotThrow(fn);

test('validateTableName accepts valid identifiers', () => {
  ok(() => validateTableName('users'));
  ok(() => validateTableName('_tmp1'));
  ok(() => validateTableName('Order_Items'));
});

test('validateTableName rejects injection attempts', () => {
  throws(() => validateTableName('users; DROP TABLE x'));
  throws(() => validateTableName('users"'));
  throws(() => validateTableName('1users'));
  throws(() => validateTableName(''));
});

test('validateReadQuery allows SELECT / WITH / EXPLAIN', () => {
  ok(() => validateReadQuery('SELECT * FROM users'));
  ok(() => validateReadQuery('  with cte as (select 1) select * from cte'));
  ok(() => validateReadQuery('EXPLAIN QUERY PLAN SELECT 1'));
});

test('validateReadQuery rejects writes and other verbs', () => {
  throws(() => validateReadQuery('DELETE FROM users'));
  throws(() => validateReadQuery('DROP TABLE users'));
});

test('validateWriteQuery allows INSERT/UPDATE/DELETE/REPLACE only', () => {
  ok(() => validateWriteQuery('INSERT INTO t VALUES (1)'));
  ok(() => validateWriteQuery('update t set a = 1'));
  throws(() => validateWriteQuery('SELECT * FROM t'));
  throws(() => validateWriteQuery('DROP TABLE t'));
});

test('validateCreateTableQuery requires CREATE TABLE', () => {
  ok(() => validateCreateTableQuery('CREATE TABLE t (id INTEGER PRIMARY KEY)'));
  throws(() => validateCreateTableQuery('DROP TABLE t'));
});

// --- Regression: issue #3 — SQL injection via stacked statements ---
test('issue #3: create_table cannot smuggle a second statement', () => {
  throws(() => validateCreateTableQuery('CREATE TABLE t (id INTEGER); DROP TABLE users;'));
  throws(() => validateCreateTableQuery('CREATE TABLE t (id INTEGER); DELETE FROM secrets'));
});

test('stacked statements are rejected across all validators', () => {
  throws(() => validateReadQuery('SELECT 1; DROP TABLE users'));
  throws(() => validateWriteQuery('INSERT INTO t VALUES (1); DELETE FROM t'));
});

test('comment-based statement splitting is caught', () => {
  throws(() => validateCreateTableQuery('CREATE TABLE t (id INTEGER) -- x\n; DROP TABLE users'));
  throws(() => validateWriteQuery('INSERT INTO t VALUES (1) /* c */; DELETE FROM t'));
});

test('queryHasMultipleStatements ignores semicolons inside strings', () => {
  assert.equal(queryHasMultipleStatements("INSERT INTO t VALUES ('a; b')"), false);
  assert.equal(queryHasMultipleStatements(`INSERT INTO t VALUES ('it''s; ok')`), false);
  assert.equal(queryHasMultipleStatements('SELECT * FROM t;'), false); // trailing semicolon
  assert.equal(queryHasMultipleStatements('SELECT 1; SELECT 2'), true);
});
