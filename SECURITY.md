# Security Policy

## Reporting a Vulnerability

Please report security issues privately using **GitHub Security Advisories**:

1. Go to the [Security tab](https://github.com/isaacgounton/sqlite-mcp-server/security/advisories) of this repository.
2. Click **Report a vulnerability**.

This creates a private channel to share reproduction steps before any public disclosure. Please include a proof of concept and the affected version/commit. Expect an initial response within a few days.

## Security Model

This server exposes a SQLite database to an MCP client. Its defenses:

- **Per-tool statement allow-listing.** Each tool accepts only its intended verb — `read_query` allows `SELECT`/`WITH`/`EXPLAIN`, `write_query` allows `INSERT`/`UPDATE`/`DELETE`/`REPLACE`, `create_table` allows `CREATE TABLE`.
- **Stacked-statement rejection.** All query validators reject multiple statements, so a payload cannot smuggle a second statement past the verb check (comments and string literals are stripped before the check). See [`src/validators.ts`](src/validators.ts).
- **Identifier validation.** Table names must match `^[a-zA-Z_][a-zA-Z0-9_]*$`.

These are validated by the test suite (`npm test`).

### HTTP transport

The Streamable HTTP transport (`--http`) has **no authentication**. Anyone who can reach the endpoint can run every tool against the database. Mitigations in place and expected:

- The server binds to `127.0.0.1` by default. Set `HOST=0.0.0.0` only when you intend to expose it.
- DNS-rebinding protection is on; requests are checked against `MCP_ALLOWED_HOSTS` (defaults to localhost).
- **If you expose it beyond localhost, put it behind a reverse proxy that terminates TLS and enforces authentication.** Do not expose the raw port to an untrusted network.

## Scope

The threat model assumes the MCP *client* is trusted and the database may hold sensitive data. Arbitrary SQL that bypasses the per-tool verb restrictions, or any way to reach the database over HTTP without the documented mitigations, is in scope.
