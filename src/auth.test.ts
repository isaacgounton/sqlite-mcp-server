import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokensMatch } from './auth.js';

test('tokensMatch accepts identical tokens', () => {
  assert.equal(tokensMatch('s3cret-token', 's3cret-token'), true);
});

test('tokensMatch rejects different tokens', () => {
  assert.equal(tokensMatch('wrong', 's3cret-token'), false);
  assert.equal(tokensMatch('', 's3cret-token'), false);
  assert.equal(tokensMatch('s3cret-token', 's3cret-token-extra'), false);
});
