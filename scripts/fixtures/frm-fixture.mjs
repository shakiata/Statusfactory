/**
 * Local synthetic FRM server for simulation and integration tests.
 *
 * - Loopback only by default.
 * - Requires a dummy token on every data endpoint.
 * - Returns small representative arrays/objects; it never contacts a game.
 * - No production credentials, public tunnel or telemetry.
 *
 * Usage: node scripts/fixtures/frm-fixture.mjs [port]
 */

import { createServer } from 'node:http';

/** Dummy token used by the fixture; safe to print. */
export const FIXTURE_TOKEN = 'sim-token-not-a-secret';

const PAYLOADS = {
  getPower: [{ CircuitGroupID: 1, CircuitID: 1, PowerProduction: 100, PowerConsumed: 80, MaxPowerConsumed: 120 }],
  getFactory: [{ ID: '1', Name: 'Assembler', ClassName: 'Build_AssemblerMk1_C', location: { x: 0, y: 0, z: 0 }, Recipe: 'Iron Plate' }],
  getWorldInv: [{ Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', Amount: 100, MaxAmount: 0 }],
  getPlayer: [{ ID: '1', Name: 'Pioneer', location: { x: 0, y: 0, z: 0 } }],
  getProdStats: [{ Name: 'Iron Plate', ClassName: 'Desc_IronPlate_C', CurrentProd: 10, MaxProd: 20, CurrentConsumed: 5, MaxConsumed: 10 }],
  getModList: [{ Name: 'FicsitRemoteMonitoring', Version: 'simulated' }],
};

/** Builds a JSON response with permissive local CORS. */
function json(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-FRM-Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

/**
 * Creates the fixture server.
 * @param {object} [options]
 * @param {string} [options.token]
 */
export function createFrmFixture({ token = FIXTURE_TOKEN } = {}) {
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'X-FRM-Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      response.end();
      return;
    }
    if (url.pathname === '/health') {
      json(response, 200, { ok: true });
      return;
    }
    const endpoint = url.pathname.replace(/^\//, '');
    if (request.headers['x-frm-authorization'] !== token) {
      json(response, 401, { error: 'unauthorized' });
      return;
    }
    if (request.method === 'POST' && endpoint === 'sendChatMessage') {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => json(response, 200, { ok: true, received: body.length }));
      return;
    }
    if (endpoint in PAYLOADS) {
      json(response, 200, PAYLOADS[endpoint]);
      return;
    }
    json(response, 404, { error: 'unknown endpoint' });
  });
}

/** Starts the fixture on a loopback port; resolves `{server, port, token}`. */
export async function startFrmFixture({ port = 0, token = FIXTURE_TOKEN } = {}) {
  const server = createFrmFixture({ token });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, port: server.address().port, token };
}

// Direct execution: print connection details and stay up.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8099);
  const { server, token } = await startFrmFixture({ port });
  console.log(`Synthetic FRM server: http://127.0.0.1:${port}`);
  console.log(`Token: ${token}`);
  console.log('All data endpoints require the token; /health is unauthenticated.');
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
