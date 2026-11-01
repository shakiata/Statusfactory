import { EndpointInfo, FRMConfig } from './types';
import {
  buildEndpointUrl,
  parseConfigEndpoint,
  type ConnectionEndpoint,
} from './connection/contract';
import {
  FrmRequestError,
  MAX_RESPONSE_BYTES,
  REQUEST_DEADLINE_MS,
  readBoundedBody,
  validateEndpointPayload,
  validatePayload,
} from './request-bounds';

const ENDPOINTS: EndpointInfo[] = [
  // Power
  { path: 'getPower', category: 'power', description: 'All power circuits with production, consumption, and battery stats', requiresGameThread: false },
  { path: 'getPowerUsage', category: 'power', description: 'Per-building power usage across the factory', requiresGameThread: false },
  { path: 'getCables', category: 'power', description: 'All power cables/wires', requiresGameThread: false },
  { path: 'getSwitches', category: 'power', description: 'All power switches and their states', requiresGameThread: false },

  // Generators
  { path: 'getGenerators', category: 'generators', description: 'All power generating buildings (all types)', requiresGameThread: false },
  { path: 'getBiomassGenerator', category: 'generators', description: 'Biomass Burners', requiresGameThread: false },
  { path: 'getCoalGenerator', category: 'generators', description: 'Coal Generators', requiresGameThread: false },
  { path: 'getFuelGenerator', category: 'generators', description: 'Fuel Generators', requiresGameThread: false },
  { path: 'getNuclearGenerator', category: 'generators', description: 'Nuclear Power Plants', requiresGameThread: false },
  { path: 'getGeothermalGenerator', category: 'generators', description: 'Geothermal Generators', requiresGameThread: false },

  // Factory Buildings
  { path: 'getFactory', category: 'factory', description: 'All factory buildings (all types)', requiresGameThread: false },
  { path: 'getAssembler', category: 'factory', description: 'Assemblers', requiresGameThread: false },
  { path: 'getBlender', category: 'factory', description: 'Blenders', requiresGameThread: false },
  { path: 'getConstructor', category: 'factory', description: 'Constructors', requiresGameThread: false },
  { path: 'getConverter', category: 'factory', description: 'Converters', requiresGameThread: false },
  { path: 'getEncoder', category: 'factory', description: 'Quantum Encoders', requiresGameThread: false },
  { path: 'getFoundry', category: 'factory', description: 'Foundries', requiresGameThread: false },
  { path: 'getManufacturer', category: 'factory', description: 'Manufacturers', requiresGameThread: false },
  { path: 'getPackager', category: 'factory', description: 'Packagers', requiresGameThread: false },
  { path: 'getParticle', category: 'factory', description: 'Particle Accelerators', requiresGameThread: false },
  { path: 'getRefinery', category: 'factory', description: 'Refineries', requiresGameThread: false },
  { path: 'getSmelter', category: 'factory', description: 'Smelters', requiresGameThread: false },

  // Resources
  { path: 'getExtractor', category: 'resources', description: 'Miners and Extractors', requiresGameThread: false },
  { path: 'getFrackingActivator', category: 'resources', description: 'Fracking Activators / Resource Well Pressurizers', requiresGameThread: false },
  { path: 'getDropPod', category: 'resources', description: 'Drop Pods on the map', requiresGameThread: true },
  { path: 'getPowerSlug', category: 'resources', description: 'Power Slugs on the map', requiresGameThread: true },
  { path: 'getTapes', category: 'resources', description: 'Cassette Tapes on the map', requiresGameThread: false },

  // Logistics
  { path: 'getPump', category: 'logistics', description: 'Pipeline Pumps and Valves', requiresGameThread: false },
  { path: 'getPipes', category: 'logistics', description: 'All pipelines', requiresGameThread: false },
  { path: 'getPipeJunctions', category: 'logistics', description: 'Pipeline junctions', requiresGameThread: false },
  { path: 'getHypertube', category: 'logistics', description: 'Hypertubes', requiresGameThread: false },
  { path: 'getHyperEntrance', category: 'logistics', description: 'Hypertube Entrances', requiresGameThread: false },
  { path: 'getHyperJunctions', category: 'logistics', description: 'Hypertube Junctions', requiresGameThread: false },

  // Vehicles
  { path: 'getVehicles', category: 'vehicles', description: 'All vehicles', requiresGameThread: true },
  { path: 'getExplorer', category: 'vehicles', description: 'Explorers', requiresGameThread: true },
  { path: 'getFactoryCart', category: 'vehicles', description: 'Factory Carts', requiresGameThread: true },
  { path: 'getDrone', category: 'vehicles', description: 'All Drones', requiresGameThread: true },

  // Transport Stations
  { path: 'getDroneStation', category: 'transport', description: 'Drone Ports', requiresGameThread: false },
  { path: 'getTrainStation', category: 'transport', description: 'Train Stations', requiresGameThread: false },
  { path: 'getTrains', category: 'transport', description: 'All trains with railcars, speed, and timetable', requiresGameThread: false },
  { path: 'getTruckStation', category: 'transport', description: 'Truck Stations', requiresGameThread: false },

  // Support Buildings
  { path: 'getHubTerminal', category: 'support', description: 'HUB Terminal', requiresGameThread: true },
  { path: 'getTradingPost', category: 'support', description: 'Trading Post / Central HUB', requiresGameThread: false },
  { path: 'getSpaceElevator', category: 'support', description: 'Space Elevator', requiresGameThread: false },
  { path: 'getResourceSinkBuilding', category: 'support', description: 'AWESOME Sinks', requiresGameThread: false },
  { path: 'getElevators', category: 'support', description: 'Elevators', requiresGameThread: false },
  { path: 'getPortal', category: 'support', description: 'Portals', requiresGameThread: false },
  { path: 'getRadarTower', category: 'support', description: 'Radar Towers', requiresGameThread: false },

  // Session
  { path: 'getPlayer', category: 'session', description: 'Player information and location', requiresGameThread: true },
  { path: 'getModList', category: 'session', description: 'Installed mods list', requiresGameThread: false },
  { path: 'getMapMarkers', category: 'session', description: 'Map markers and stamps', requiresGameThread: false },
  { path: 'getProdStats', category: 'session', description: 'Production Stats (per-item production/consumption rates)', requiresGameThread: false },
  { path: 'getExplorationSink', category: 'session', description: 'Exploration sink statistics', requiresGameThread: false },

  // Inventory
  { path: 'getWorldInv', category: 'inventory', description: 'Total aggregated inventory across all storage containers', requiresGameThread: false },
  { path: 'getStorageInv', category: 'inventory', description: 'Storage container inventories (per container)', requiresGameThread: false },
  { path: 'getCloudInv', category: 'inventory', description: 'Dimensional Depot (cloud) inventory', requiresGameThread: false },
  { path: 'getCrateInv', category: 'inventory', description: 'Crate inventories', requiresGameThread: true },

  // Research
  { path: 'getRecipes', category: 'research', description: 'All recipes', requiresGameThread: true },
  { path: 'getSchematics', category: 'research', description: 'All schematics/milestones', requiresGameThread: true },
  { path: 'getArtifacts', category: 'research', description: 'Artifacts (Mercer Spheres, Somersloops)', requiresGameThread: true },

  // Events & Creatures
  { path: 'getFallingGiftBundles', category: 'events', description: 'FICSMAS gift bundles', requiresGameThread: true },
  { path: 'getCreatures', category: 'creatures', description: 'Creatures on the map', requiresGameThread: false },
];

/** Returns the full list of FRM API endpoints with metadata. */
export function getEndpoints(): EndpointInfo[] {
  return ENDPOINTS;
}

/** Returns endpoints grouped by category as a Map. */
export function getEndpointsByCategory(): Map<string, EndpointInfo[]> {
  const map = new Map<string, EndpointInfo[]>();
  for (const ep of ENDPOINTS) {
    const existing = map.get(ep.category) || [];
    existing.push(ep);
    map.set(ep.category, existing);
  }
  return map;
}

/* ─── Bounded request coordination ─────────────────────────────── */

/** Maximum concurrent data requests per connection (contract: four). */
const MAX_CONCURRENT_PER_ORIGIN = 4;
/** Backoff schedule after failures; capped at 30 s (contract section 4). */
const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

type Slot = { active: number; waiters: Array<() => void> };
const originSlots = new Map<string, Slot>();
const inflight = new Map<string, Promise<unknown>>();
const failures = new Map<string, { count: number; nextAt: number }>();
const activeControllers = new Set<AbortController>();
let chatInFlight: string | null = null;

/** Resolves after `ms`, rejecting early when the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new FrmRequestError('aborted', 'The request was cancelled.'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new FrmRequestError('aborted', 'The request was cancelled.'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Acquires one of the per-origin request slots, waiting for a free slot. */
async function acquireSlot(origin: string, signal: AbortSignal): Promise<() => void> {
  const slot = originSlots.get(origin) ?? { active: 0, waiters: [] };
  originSlots.set(origin, slot);
  if (slot.active < MAX_CONCURRENT_PER_ORIGIN) {
    slot.active += 1;
  } else {
    await new Promise<void>((resolve, reject) => {
      const waiter = () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
      const onAbort = () => {
        slot.waiters = slot.waiters.filter((w) => w !== waiter);
        reject(new FrmRequestError('aborted', 'The request was cancelled.'));
      };
      slot.waiters.push(waiter);
      signal.addEventListener('abort', onAbort, { once: true });
    });
    slot.active += 1;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    slot.active = Math.max(0, slot.active - 1);
    const next = slot.waiters.shift();
    if (next) next();
  };
}

/**
 * Cancels every outstanding FRM request.
 *
 * Called when the origin/token changes, on Forget and on disconnect so a late
 * response cannot populate the next connection.
 */
export function abortAllRequests(): void {
  for (const controller of activeControllers) controller.abort();
  activeControllers.clear();
  inflight.clear();
  originSlots.clear();
  failures.clear();
  chatInFlight = null;
}

/** Returns true when the parsed hostname is an ngrok-managed boundary. */
function isNgrokHost(hostname: string): boolean {
  return (
    hostname === 'ngrok.io' ||
    hostname.endsWith('.ngrok.io') ||
    hostname === 'ngrok.app' ||
    hostname.endsWith('.ngrok.app') ||
    hostname === 'ngrok-free.app' ||
    hostname.endsWith('.ngrok-free.app')
  );
}

/** Builds the header set. The token is attached only for the selected origin. */
function buildHeaders(
  endpoint: ConnectionEndpoint,
  config: FRMConfig,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extra };
  if (config.password) headers['X-FRM-Authorization'] = config.password;
  if (isNgrokHost(endpoint.hostname)) headers['ngrok-skip-browser-warning'] = '1';
  return headers;
}

/**
 * Executes one bounded FRM request.
 *
 * Inputs: a validated config, fixed endpoint name and optional method/body.
 * Side effects: one fetch, cancellation timer and per-origin slot.
 * Errors: typed `FrmRequestError`; the token never appears in a message.
 */
async function request<T>(
  config: FRMConfig,
  endpointName: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const parsed = parseConfigEndpoint(config);
  if (!parsed.ok) {
    throw new FrmRequestError('invalid-endpoint', parsed.error.message);
  }
  const endpoint = parsed.endpoint;
  const key = `${endpoint.origin}/${endpointName}`;
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const controller = new AbortController();
  activeControllers.add(controller);
  const external = init.signal;
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_DEADLINE_MS);

  let release: (() => void) | null = null;
  const run = (async () => {
    const prior = failures.get(key);
    if (prior && prior.nextAt > Date.now()) {
      await sleep(Math.min(prior.nextAt - Date.now(), BACKOFF_MS[BACKOFF_MS.length - 1]), controller.signal);
    }
    release = await acquireSlot(endpoint.origin, controller.signal);
    const url = buildEndpointUrl(endpoint, endpointName);
    let response: Response;
    try {
      response = await fetch(url, {
        method: init.method ?? 'GET',
        headers: buildHeaders(endpoint, config, init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new FrmRequestError('timeout', 'The server did not respond within 15 seconds.');
      if (controller.signal.aborted) throw new FrmRequestError('aborted', 'The request was cancelled.');
      const message = error instanceof Error ? error.message : '';
      if (/redirect/i.test(message)) {
        throw new FrmRequestError('redirect', 'The server redirected the request; configure the canonical endpoint instead.');
      }
      throw new FrmRequestError('transport', 'Could not reach the FRM server. Check the address and network.');
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      throw new FrmRequestError('redirect', 'The server redirected the request; configure the canonical endpoint instead.', response.status);
    }
    if (response.status === 401 || response.status === 403) {
      throw new FrmRequestError('auth', 'The FRM server rejected the session token.', response.status);
    }
    if (response.status === 429) {
      throw new FrmRequestError('rate-limit', 'The FRM server is rate limiting requests. Retry shortly.', 429);
    }
    if (!response.ok) {
      throw new FrmRequestError('transport', `FRM API error: ${response.status} ${response.statusText}`, response.status);
    }

    const text = await readBoundedBody(response, MAX_RESPONSE_BYTES);
    if (text.length === 0) {
      // Chat writes legitimately return an empty body; reads must not.
      if ((init.method ?? 'GET') === 'POST') return undefined as T;
      throw new FrmRequestError('malformed', 'The server returned an empty response.');
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new FrmRequestError('malformed', 'The server returned malformed JSON.');
    }
    validatePayload(data);
    if ((init.method ?? 'GET') === 'GET') validateEndpointPayload(endpointName, data);
    return data as T;
  })();

  const tracked = run.then(
    (value) => {
      failures.delete(key);
      return value;
    },
    (error) => {
      if (error instanceof FrmRequestError && error.code !== 'aborted' && error.code !== 'invalid-endpoint') {
        const count = (failures.get(key)?.count ?? 0) + 1;
        failures.set(key, { count, nextAt: Date.now() + BACKOFF_MS[Math.min(count - 1, BACKOFF_MS.length - 1)] });
      }
      throw error;
    },
  ).finally(() => {
    clearTimeout(timer);
    if (external) external.removeEventListener('abort', onExternalAbort);
    activeControllers.delete(controller);
    inflight.delete(key);
    release?.();
  });

  inflight.set(key, tracked);
  return tracked;
}

/** Backwards-compatible URL builder used by tests and diagnostics. */
export function buildUrl(config: FRMConfig, endpoint: string): string {
  const parsed = parseConfigEndpoint(config);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return buildEndpointUrl(parsed.endpoint, endpoint);
}

/**
 * Fetches one FRM endpoint through the shared bounded request path.
 * Throws `FrmRequestError` or a cancellation error.
 */
export async function fetchEndpoint<T = unknown>(
  config: FRMConfig,
  endpoint: string,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  return request<T>(config, endpoint, { signal: options.signal });
}

/**
 * Tests connectivity by reading `getPower`.
 * Returns a typed result instead of throwing so the connection UI can show a
 * category without leaking the token.
 */
export async function testConnection(
  config: FRMConfig,
): Promise<{ ok: boolean; error?: string; code?: string }> {
  try {
    await fetchEndpoint(config, 'getPower');
    return { ok: true };
  } catch (error) {
    if (error instanceof FrmRequestError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return { ok: false, error: 'Connection failed.' };
  }
}

/**
 * Sends one chat message. Chat is a write: one in-flight send per connection,
 * no automatic retry, and a 2,000-code-point draft limit.
 */
export async function sendChatMessage(config: FRMConfig, message: string): Promise<void> {
  const codePoints = Array.from(message).length;
  if (codePoints === 0) throw new FrmRequestError('schema', 'Enter a message before sending.');
  if (codePoints > 2_000) {
    throw new FrmRequestError('schema', 'Chat messages are limited to 2,000 characters.');
  }
  const parsed = parseConfigEndpoint(config);
  if (!parsed.ok) throw new FrmRequestError('invalid-endpoint', parsed.error.message);
  if (chatInFlight === parsed.endpoint.origin) {
    throw new FrmRequestError('chat-in-flight', 'A chat message is already being sent.');
  }
  chatInFlight = parsed.endpoint.origin;
  try {
    await request<void>(config, 'sendChatMessage', { method: 'POST', body: { message } });
  } finally {
    chatInFlight = null;
  }
}
