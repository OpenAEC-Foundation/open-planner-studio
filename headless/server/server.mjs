#!/usr/bin/env node
// Headless HTTP-API van Open Planner Studio op `node:http`, boven het gebouwde pakket
// `@openaec/open-planner-core`. Contract: openapi.yaml; uitleg: docs/headless-api.md.
//
//   GET  /healthz                       zonder auth: status, versie en grenzen
//   POST /v1/schedule?output=summary    IFC-tekst in, JSON-samenvatting uit (standaard)
//   POST /v1/schedule?output=ifc        IFC-tekst in, herberekende IFC-tekst uit
//
// Configuratie alleen via omgevingsvariabelen (zie `loadConfig`). Zonder token start de server niet.
//
// Capaciteit (geen wachtrij): één berekening tegelijk, in een worker-thread met een harde deadline.
// Is die bezig, of lopen er al `maxUploads` uploads, dan krijgt een nieuw verzoek METEEN 503 `BUSY`,
// vóór de body gelezen wordt. Zo is het geheugen voor bodies begrensd op maxUploads × maxBodyBytes,
// en duurt een geaccepteerd verzoek hooguit uploadtijd + rekentijd (onder de ALB-idle-timeout).
//
// Logging: één JSON-regel per verzoek naar stdout. Nooit IFC-inhoud, querystring of token. De
// console-uitvoer van de worker (de rekenkern kan taak- of relatie-id's loggen) wordt weggegooid.
import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { VERSION as CORE_VERSION } from '@openaec/open-planner-core';

const MIB = 1024 * 1024;
/** Bovengrenzen: uploadtijd (30 s) + rekentijd (85 s) = 115 s, onder de idle-timeout van de ALB
 *  (120 s, deploy/aws/ecs-fargate.yaml). Een geaccepteerd verzoek krijgt dus altijd zelf antwoord. */
export const MAX_UPLOAD_MS = 30_000;
export const MAX_CALCULATION_MS = 85_000;

/** Lees de configuratie. Gooit bij een fout; de aanroeper stopt dan het proces. */
export function loadConfig(env = process.env) {
  const intVar = (name, fallback, min, max) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
    return n;
  };
  if (env.OPS_API_TOKEN && env.OPS_API_TOKEN_FILE) {
    throw new Error('Set OPS_API_TOKEN or OPS_API_TOKEN_FILE, not both');
  }
  let token = env.OPS_API_TOKEN ?? '';
  if (env.OPS_API_TOKEN_FILE) token = readFileSync(env.OPS_API_TOKEN_FILE, 'utf8');
  token = token.trim();
  if (!token) throw new Error('No API token configured: set OPS_API_TOKEN or OPS_API_TOKEN_FILE');
  if (token.length < 16) throw new Error('The API token must be at least 16 characters');
  if (Buffer.byteLength(token) > MAX_TOKEN_BYTES) throw new Error(`The API token must be at most ${MAX_TOKEN_BYTES} bytes`);
  return {
    token,
    host: env.HOST || '127.0.0.1',
    port: intVar('PORT', 8080, 0, 65535),
    maxBodyBytes: intVar('OPS_API_MAX_BODY_BYTES', 20 * MIB, 1024, 512 * MIB),
    timeoutMs: intVar('OPS_API_TIMEOUT_MS', 60_000, 1_000, MAX_CALCULATION_MS),
    maxUploads: intVar('OPS_API_MAX_UPLOADS', 2, 1, 16),
    uploadTimeoutMs: intVar('OPS_API_UPLOAD_TIMEOUT_MS', MAX_UPLOAD_MS, 1_000, MAX_UPLOAD_MS),
  };
}

// ── Logging ────────────────────────────────────────────────────────────────────────────────────
function log(level, msg, fields = {}) {
  try {
    process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields })}\n`);
  } catch {
    // Loggen mag het proces nooit stoppen.
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────────────────────────
/** Tokens zijn hooguit zo lang; beide kanten worden tot precies deze lengte aangevuld. */
export const MAX_TOKEN_BYTES = 512;
const padded = (value) => {
  const buf = Buffer.alloc(MAX_TOKEN_BYTES);
  buf.write(value, 'utf8');
  return buf;
};
/** Vergelijk in constante tijd: beide kanten aangevuld tot MAX_TOKEN_BYTES, dan `timingSafeEqual`.
 *  De duur hangt dus niet af van de inhoud of de lengte van het token. (Geen hash: dan meldt CodeQL
 *  een te zwakke wachtwoordhash, terwijl hier niets wordt opgeslagen.) */
function tokenMatches(header, expected) {
  if (typeof header !== 'string') return false;
  const m = /^Bearer ([^\s]+)$/.exec(header);
  if (!m || Buffer.byteLength(m[1]) > MAX_TOKEN_BYTES) return false;
  const same = timingSafeEqual(padded(m[1]), expected.padded);
  return same && Buffer.byteLength(m[1]) === expected.length;
}

// ── Rekenen: één worker, één berekening tegelijk, geen wachtrij ────────────────────────────────
class Calculator {
  constructor(timeoutMs) {
    this.timeoutMs = timeoutMs;
    this.busy = false;
    this.worker = null;
  }

  #spawn() {
    // stdout/stderr van de worker NIET naar het proces doorgeven: de kern logt soms id's uit het
    // bestand (bijv. een relatie-id). Lezen en weggooien, anders loopt de buffer vol.
    const w = new Worker(fileURLToPath(new URL('./worker.mjs', import.meta.url)), { stdout: true, stderr: true });
    w.stdout.resume();
    w.stderr.resume();
    w.unref();
    return w;
  }

  /** Alleen aanroepen als `busy` false is. */
  run(job) {
    this.busy = true;
    if (!this.worker) this.worker = this.#spawn();
    const worker = this.worker;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.off('message', onMessage);
        worker.off('error', onError);
        worker.off('exit', onExit);
        this.busy = false;
        resolve(result);
      };
      const onMessage = (msg) => finish(msg);
      const onError = () => {
        this.worker = null;
        finish({ ok: false, code: 'INTERNAL', message: 'The calculation worker failed' });
      };
      const onExit = () => {
        this.worker = null;
        finish({ ok: false, code: 'INTERNAL', message: 'The calculation worker stopped unexpectedly' });
      };
      const timer = setTimeout(() => {
        this.worker = null;
        worker.terminate().catch(() => {});
        finish({ ok: false, code: 'TIMEOUT', message: `The calculation took longer than ${this.timeoutMs} ms` });
      }, this.timeoutMs);
      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.on('exit', onExit);
      worker.postMessage(job);
    });
  }

  async stop() {
    const w = this.worker;
    this.worker = null;
    await w?.terminate();
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────────────────────
const STATUS_OF = {
  INVALID_INPUT: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  UPLOAD_TIMEOUT: 408,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  IFC_READ_FAILED: 422,
  NO_TASKS: 422,
  SCHEDULE_FAILED: 422,
  IFC_WRITE_FAILED: 500,
  INTERNAL: 500,
  BUSY: 503,
  TIMEOUT: 503,
};
const ACCEPTED_TYPES = new Set(['application/x-step', 'application/ifc', 'model/ifc', 'text/plain', 'application/octet-stream']);
const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function createApiServer(config) {
  const tokenDigest = { padded: padded(config.token), length: Buffer.byteLength(config.token) };
  const calculator = new Calculator(config.timeoutMs);
  let uploads = 0;

  async function handle(req, res, ctx) {
    const sendJson = (status, body, headers = {}) => {
      const text = JSON.stringify(body);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), ...headers });
      res.end(text);
    };
    const fail = (code, message, extra = {}, headers = {}) => {
      ctx.errorCode = code;
      sendJson(STATUS_OF[code] ?? 500, { error: { code, message, ...extra } }, headers);
    };
    // Antwoord vóór de body gelezen is: de rest weggooien (niet bewaren), zodat de client het
    // antwoord kan lezen. Na 4× de body-grens of de uploadtijd verbreekt de server de verbinding.
    // Bewust GEEN `Connection: close`: dan sluit Node de socket direct na het antwoord terwijl de
    // client nog uploadt, en de TCP-reset kan het antwoord wegvagen (gezien in de containerjob: 413
    // kwam als "fetch failed" aan).
    const failEarly = (code, message, headers = {}) => {
      fail(code, message, {}, headers);
      let discarded = 0;
      const cutoff = setTimeout(() => req.destroy(), config.uploadTimeoutMs);
      cutoff.unref();
      req.on('data', (chunk) => {
        discarded += chunk.length;
        if (discarded > 4 * config.maxBodyBytes) req.destroy();
      });
      req.once('close', () => clearTimeout(cutoff));
      req.resume();
    };

    let url;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      return failEarly('BAD_REQUEST', 'The request target is not a valid URL');
    }
    ctx.path = url.pathname;

    if (url.pathname === '/healthz') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return failEarly('METHOD_NOT_ALLOWED', 'Use GET', { Allow: 'GET, HEAD' });
      return sendJson(200, {
        status: 'ok',
        version: CORE_VERSION,
        limits: {
          maxBodyBytes: config.maxBodyBytes,
          timeoutMs: config.timeoutMs,
          uploadTimeoutMs: config.uploadTimeoutMs,
          maxUploads: config.maxUploads,
        },
        busy: calculator.busy,
        uploads,
      });
    }
    if (url.pathname !== '/v1/schedule') return failEarly('NOT_FOUND', `No route for ${url.pathname}`);
    if (req.method !== 'POST') return failEarly('METHOD_NOT_ALLOWED', 'Use POST', { Allow: 'POST' });
    if (!tokenMatches(req.headers.authorization, tokenDigest)) {
      return failEarly('UNAUTHORIZED', 'Missing or invalid bearer token', { 'WWW-Authenticate': 'Bearer' });
    }
    const output = url.searchParams.get('output') ?? 'summary';
    if (output !== 'summary' && output !== 'ifc') {
      return failEarly('BAD_REQUEST', 'Query parameter "output" must be "summary" or "ifc"');
    }
    const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!ACCEPTED_TYPES.has(type)) {
      return failEarly('UNSUPPORTED_MEDIA_TYPE', `Send the IFC file as one of: ${[...ACCEPTED_TYPES].join(', ')}`);
    }
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > config.maxBodyBytes) {
      return failEarly('PAYLOAD_TOO_LARGE', `The body is larger than ${config.maxBodyBytes} bytes`);
    }
    // Capaciteit VÓÓR de body: een lopende berekening of te veel uploads ⇒ meteen 503.
    if (calculator.busy || uploads >= config.maxUploads) {
      return failEarly('BUSY', 'The server is busy; try again later', { 'Retry-After': '5' });
    }

    uploads++;
    let body;
    try {
      body = await new Promise((resolve) => {
        const parts = [];
        let size = 0;
        const done = (value) => {
          clearTimeout(timer);
          req.off('data', onData);
          req.off('end', onEnd);
          req.off('close', onClose);
          resolve(value);
        };
        const onData = (chunk) => {
          size += chunk.length;
          ctx.bytesIn = size;
          if (size > config.maxBodyBytes) return done({ error: 'PAYLOAD_TOO_LARGE' });
          parts.push(chunk);
        };
        const onEnd = () => done({ text: Buffer.concat(parts).toString('utf8') });
        const onClose = () => done({ error: 'ABORTED' });
        const timer = setTimeout(() => done({ error: 'UPLOAD_TIMEOUT' }), config.uploadTimeoutMs);
        req.on('data', onData);
        req.once('end', onEnd);
        req.once('close', onClose);
      });
    } finally {
      uploads--;
    }
    if (body.error === 'ABORTED') { ctx.errorCode = 'ABORTED'; return res.destroy(); }
    if (body.error === 'PAYLOAD_TOO_LARGE') return failEarly('PAYLOAD_TOO_LARGE', `The body is larger than ${config.maxBodyBytes} bytes`);
    if (body.error === 'UPLOAD_TIMEOUT') {
      fail('UPLOAD_TIMEOUT', `The body did not arrive within ${config.uploadTimeoutMs} ms`, {}, { Connection: 'close' });
      return res.once('finish', () => req.destroy());
    }
    // Intussen kan een andere upload de berekening hebben gekregen.
    if (calculator.busy) return fail('BUSY', 'The server is busy; try again later', {}, { 'Retry-After': '5' });

    const result = await calculator.run({ text: body.text, output });
    if (res.destroyed) return;
    if (!result.ok) {
      return fail(result.code in STATUS_OF ? result.code : 'INTERNAL', result.message,
        result.details && Object.keys(result.details).length ? { details: result.details } : {},
        result.code === 'TIMEOUT' ? { 'Retry-After': '30' } : {});
    }
    if (output === 'ifc') {
      res.writeHead(200, {
        'Content-Type': 'application/x-step; charset=utf-8',
        'Content-Length': Buffer.byteLength(result.ifc),
        'Content-Disposition': 'attachment; filename="schedule.ifc"',
      });
      return res.end(result.ifc);
    }
    return sendJson(200, result.summary);
  }

  const server = createServer({
    // Node controleert requestTimeout/headersTimeout standaard maar elke 30 s; dan zou een trage
    // upload tot een minuut te lang open kunnen blijven.
    connectionsCheckingInterval: 1_000,
  }, (req, res) => {
    const started = process.hrtime.bigint();
    const incoming = req.headers['x-request-id'];
    const ctx = {
      requestId: typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID(),
      path: null,
      bytesIn: 0,
      errorCode: undefined,
    };
    // Een stream-fout zonder listener zou het proces stoppen.
    req.on('error', () => {});
    res.on('error', () => {});
    res.on('close', () => {
      log(res.statusCode >= 500 ? 'error' : 'info', 'request', {
        requestId: ctx.requestId,
        method: req.method,
        path: ctx.path,
        status: res.writableFinished ? res.statusCode : null,
        durationMs: Number((process.hrtime.bigint() - started) / 1000n) / 1000,
        bytesIn: ctx.bytesIn,
        ...(ctx.errorCode ? { errorCode: ctx.errorCode } : {}),
        ...(res.writableFinished ? {} : { aborted: true }),
      });
    });
    try {
      res.setHeader('X-Request-Id', ctx.requestId);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    } catch { /* headers al verstuurd: niets te doen */ }
    handle(req, res, ctx).catch((err) => {
      log('error', 'unhandled', { requestId: ctx.requestId, error: err instanceof Error ? err.name : 'error' });
      try {
        if (!res.headersSent) {
          ctx.errorCode = 'INTERNAL';
          const text = JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal server error' } });
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), Connection: 'close' });
          res.end(text);
        } else {
          res.destroy();
        }
      } catch {
        res.destroy();
      }
    });
  });

  // headersTimeout ≤ requestTimeout (anders draait Node 22 ze om). requestTimeout is een vangnet
  // boven de eigen uploaddeadline. keepAliveTimeout ligt boven de ALB-idle-timeout (120 s), anders
  // sluit Node een verbinding die de ALB nog hergebruikt (502).
  server.requestTimeout = config.uploadTimeoutMs + 5_000;
  server.headersTimeout = Math.min(10_000, server.requestTimeout);
  server.keepAliveTimeout = 125_000;
  server.on('clientError', (_err, socket) => {
    // Onleesbaar HTTP: kort 400 en sluiten. Nooit gooien.
    try {
      if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      else socket.destroy();
    } catch { socket.destroy(); }
  });
  return { server, calculator };
}

// ── Start als los proces ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    log('error', 'config', { error: err.message });
    process.exit(78); // EX_CONFIG
  }
  const { server, calculator } = createApiServer(config);
  server.listen(config.port, config.host, () => {
    const addr = server.address();
    log('info', 'listening', {
      host: addr.address, port: addr.port, version: CORE_VERSION,
      maxBodyBytes: config.maxBodyBytes, timeoutMs: config.timeoutMs, uploadTimeoutMs: config.uploadTimeoutMs, maxUploads: config.maxUploads,
    });
  });
  // Laatste vangnet: een fout buiten de verzoekafhandeling wordt gelogd (zonder inhoud), het proces
  // blijft draaien. Een fout in de afhandeling zelf vangt `handle(...).catch` al.
  process.on('uncaughtException', (err) => log('error', 'uncaught', { error: err?.name ?? 'error' }));
  process.on('unhandledRejection', (err) => log('error', 'unhandled-rejection', { error: err?.name ?? 'error' }));

  const SHUTDOWN_MS = 25_000;
  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    log('info', 'shutdown', { signal });
    // Geen nieuwe verbindingen; lopende verzoeken (upload + berekening) mogen afmaken.
    const closed = new Promise((resolve) => server.close(() => resolve(true)));
    // Een keep-alive-verbinding wordt pas na haar laatste antwoord idle: blijf die sluiten.
    const idle = setInterval(() => server.closeIdleConnections(), 100);
    idle.unref();
    server.closeIdleConnections();
    const deadline = new Promise((resolve) => setTimeout(() => resolve(false), SHUTDOWN_MS).unref());
    Promise.race([closed, deadline])
      .then(async (clean) => {
        if (!clean) server.closeAllConnections();
        await calculator.stop();
        log('info', 'stopped', { clean });
        process.exit(0);
      })
      .catch(() => process.exit(1));
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}
