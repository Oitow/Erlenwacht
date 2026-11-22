import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { attachRooms } from './rooms.js';

const ROOT = new URL('../', import.meta.url);
const SOURCE_PATH = /^\/src\/(?:[\w-]+\/)*[\w-]+\.(js|css)$/;
const MIME = { js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };

function respond(request, response, status, type, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-cache',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

async function serve(request, response) {
  const plain = 'text/plain; charset=utf-8';
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    respond(request, response, 405, plain, 'Method not allowed\n');
    return;
  }

  const path = request.url?.split('?', 1)[0];
  if (path === '/healthz') {
    respond(request, response, 200, 'application/json; charset=utf-8', '{"status":"ok"}');
    return;
  }
  const isIndex = path === '/' || path === '/index.html';
  const match = SOURCE_PATH.exec(path);
  if (!isIndex && !match) {
    respond(request, response, 404, plain, 'Not found\n');
    return;
  }

  let body;
  try {
    body = await readFile(new URL(isIndex ? 'index.html' : path.slice(1), ROOT));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      respond(request, response, 404, plain, 'Not found\n');
    } else {
      respond(request, response, 500, plain, 'Unable to read file\n');
    }
    return;
  }
  respond(request, response, 200, isIndex ? 'text/html; charset=utf-8' : MIME[match[1]], body);
}

function normalizeOrigins(origins) {
  return new Set(origins.map(value => {
    const origin = new URL(value);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/'
        || origin.username || origin.password || origin.search || origin.hash) {
      throw new Error('ERLENWACHT_ORIGINS needs HTTP(S) origins without paths.');
    }
    return origin.origin;
  }));
}

export function createGameServer({
  allowedOrigins = (process.env.ERLENWACHT_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
} = {}) {
  const server = createServer({ headersTimeout: 8_000, requestTimeout: 10_000 }, serve);
  attachRooms(server, normalizeOrigins(allowedOrigins));
  return server;
}

export function startServer({ host = process.env.HOST ?? '127.0.0.1', port = Number(process.env.PORT ?? 8080), allowedOrigins } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  return createGameServer({ allowedOrigins }).listen(port, host);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = startServer();
  server.on('listening', () => {
    const { address, port } = server.address();
    const host = address.includes(':') ? '[' + address + ']' : address;
    console.log('Erlenwacht listening on http://' + host + ':' + port);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
