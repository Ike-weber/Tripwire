import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { pathToFileURL } from "node:url"
import { keccak256, toHex } from "viem"

import {
  createMemoryStateStore,
  RiskOrchestrator,
  type ProcessingStatus,
  type ProposedTx,
  type RelayerSlot,
} from "./riskOrchestrator.js"

/**
 * Intake + status API for the risk orchestrator (issue #45: "expose
 * transaction status and verdict through an API for the dashboard" and
 * "a backend endpoint for proposed Safe transactions"). Read-only on
 * state plus a single intake endpoint:
 *
 *   POST /tx/propose        { to, value, data, txHash? } -> 202 { txHash, status, duplicate }
 *   GET  /tx                ?status=&limit= -> newest-first processing states
 *   GET  /tx/:txHash/status -> full processing state incl. canonical verdict
 *   GET  /health
 *
 * When the client omits txHash, a content hash over (to, value, data) is
 * derived so replays of the identical proposal dedupe naturally.
 */

/**
 * The dashboard is served from a different origin in dev (Vite on :5173,
 * this API on :3001), so without these the browser blocks every call from
 * the risk feed and the attack button.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", ...CORS_HEADERS })
  res.end(JSON.stringify(body, (_key, v: unknown) => (typeof v === "bigint" ? v.toString() : v)))
}

function deriveTxHash(to: string, value: string, data: string): string {
  return keccak256(toHex(`${to}|${value}|${data}`))
}

export function createOrchestratorHttpServer(orchestrator: RiskOrchestrator): Server {
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost")

      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS_HEADERS)
        res.end()
        return
      }

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true, pending: orchestrator.pendingCount })
        return
      }

      if (req.method === "POST" && url.pathname === "/tx/propose") {
        let body: unknown
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          sendJson(res, 400, { error: "invalid JSON body" })
          return
        }
        const parsed = body as Partial<ProposedTx> & { to?: string; value?: string | number }
        if (!parsed.to || parsed.value === undefined || !parsed.data) {
          sendJson(res, 400, { error: "to, value, and data are required" })
          return
        }
        const tx: ProposedTx = {
          txHash: parsed.txHash ?? deriveTxHash(parsed.to, String(parsed.value), parsed.data),
          to: parsed.to,
          value: BigInt(parsed.value),
          data: parsed.data,
        }
        const result = await orchestrator.propose(tx)
        sendJson(res, 202, result)
        return
      }

      if (req.method === "GET" && url.pathname === "/tx") {
        const status = url.searchParams.get("status") as ProcessingStatus | null
        const limit = Number(url.searchParams.get("limit"))
        sendJson(
          res,
          200,
          await orchestrator.list({
            status: status ?? undefined,
            limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
          }),
        )
        return
      }

      const statusMatch = /^\/tx\/(0x[a-fA-F0-9]+)\/status$/.exec(url.pathname)
      if (req.method === "GET" && statusMatch) {
        const state = await orchestrator.status(statusMatch[1])
        if (!state) {
          sendJson(res, 404, { error: "unknown transaction", txHash: statusMatch[1] })
          return
        }
        sendJson(res, 200, state)
        return
      }

      sendJson(res, 404, { error: "not found" })
    })().catch((err: unknown) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
    })
  })
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8")
      if (data.length > 1_000_000) reject(new Error("body too large"))
    })
    req.on("end", () => resolve(data))
    req.on("error", reject)
  })
}

// ---------------------------------------------------------------------------
// Entrypoint - `npm run orchestrator`
// ---------------------------------------------------------------------------

/**
 * Scoring runs and verdicts are served over HTTP, but nothing is written
 * on-chain: no RiskRegistry is deployed yet, and the relayer is the one
 * component holding a real key. Swap this for a `VerdictRelayer` backed by
 * `createRiskRegistryClient` once deployment lands (see CHECKLIST Phase 1).
 */
function createLoggingRelayer(): RelayerSlot {
  return {
    async submit(txHash, verdict) {
      console.log(`[relayer:dry-run] ${txHash} score=${verdict.score} label=${verdict.label}`)
    },
  }
}

function startFromEnv(): void {
  const port = Number(process.env.ORCHESTRATOR_PORT ?? 3001)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`ORCHESTRATOR_PORT must be a valid port number, got: ${process.env.ORCHESTRATOR_PORT}`)
    process.exit(1)
  }

  const orchestrator = RiskOrchestrator.create({
    relayer: createLoggingRelayer(),
    store: createMemoryStateStore(),
    onError: (err) => {
      console.error("[orchestrator]", err)
    },
  })

  const server = createOrchestratorHttpServer(orchestrator)

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Set ORCHESTRATOR_PORT to a free port.`)
      process.exit(1)
    }
    throw err
  })

  server.listen(port, () => {
    console.log(`Tripwire orchestrator listening on http://localhost:${port}`)
    console.log("  GET  /health")
    console.log("  GET  /tx?status=&limit=")
    console.log("  GET  /tx/:txHash/status")
    console.log("  POST /tx/propose   { to, value, data }")
    console.log("  relayer: dry-run (logs verdicts, writes nothing on-chain)")
  })

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0))
    })
  }
}

// Only start a server when this module is executed directly, so importing it
// from tests or from another entrypoint stays side-effect free. pathToFileURL
// handles Windows drive letters and separators, which a hand-built file:// URL
// does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startFromEnv()
}
