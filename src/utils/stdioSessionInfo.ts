/**
 * Singleton that stores information captured from the stdio MCP handshake.
 *
 * Written by:
 *  - index.ts createDiagnosticStdin() — parses the raw `initialize` JSON-RPC
 *    request (first message on stdin) and stores clientInfo + capabilities.
 *  - mcpServer.ts applyRootsToConfig() — stores last roots/list result.
 *  - mcpServer.ts RootsListChangedNotificationSchema handler — increments
 *    rootsListChangedCount each time VS 2022 reports a workspace change.
 *
 * Read by get_workspace_info so devs can verify what VS 2022 is sending
 * without having to grep log files.
 */

export interface StdioSessionInfo {
  /** e.g. "Microsoft Visual Studio" */
  clientName:    string | null;
  /** e.g. "17.12.35527.113" */
  clientVersion: string | null;
  /** e.g. "2025-06-18" */
  protocolVersion: string | null;
  /** true when client declared roots.listChanged capability */
  supportsRootsListChanged: boolean;
  /** ISO timestamp of the initialize message */
  initializedAt: string | null;
  /** URIs from the most recent roots/list response */
  lastRoots: string[];
  /** ISO timestamp of the most recent roots/list fetch */
  rootsLastAt: string | null;
  /** How many times roots/list_changed notification arrived (0 = never) */
  rootsListChangedCount: number;
  /** ISO timestamp of the most recent roots/list_changed notification */
  rootsListChangedLastAt: string | null;
}

const _info: StdioSessionInfo = {
  clientName:    null,
  clientVersion: null,
  protocolVersion: null,
  supportsRootsListChanged: false,
  initializedAt: null,
  lastRoots: [],
  rootsLastAt: null,
  rootsListChangedCount: 0,
  rootsListChangedLastAt: null,
};

/** Returns a live reference — callers should treat it as read-only. */
export function getStdioSessionInfo(): Readonly<StdioSessionInfo> {
  return _info;
}

/** Called once when the raw `initialize` request is parsed from stdin. */
export function setInitializeParams(params: {
  protocolVersion?: string;
  clientInfo?: { name?: string; version?: string };
  capabilities?: { roots?: { listChanged?: boolean } };
}): void {
  _info.protocolVersion          = params.protocolVersion ?? null;
  _info.clientName               = params.clientInfo?.name    ?? null;
  _info.clientVersion            = params.clientInfo?.version ?? null;
  _info.supportsRootsListChanged = params.capabilities?.roots?.listChanged === true;
  _info.initializedAt            = new Date().toISOString();
}

/** Called by applyRootsToConfig after each roots/list fetch. */
export function setLastRoots(uris: string[]): void {
  _info.lastRoots    = uris;
  _info.rootsLastAt  = new Date().toISOString();
}

/** Called by the RootsListChangedNotificationSchema handler. */
export function recordRootsListChanged(): void {
  _info.rootsListChangedCount++;
  _info.rootsListChangedLastAt = new Date().toISOString();
}
