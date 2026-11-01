/**
 * Nonsecret connection-profile persistence and one-time legacy migration.
 *
 * Contract: docs/security/02_DOMAIN_AND_PRODUCT_CONTRACTS.md sections 5 and 8
 * (REQ-017). Only schema-validated nonsecret fields are persisted; a legacy
 * `password` field is deleted and never restored.
 */

/** Nonsecret, persisted connection preference. */
export interface ConnectionProfile {
  schemaVersion: 2;
  host: string;
  port: string;
  refreshRate: number;
}

/** Storage key retained across the migration so the legacy record is removed. */
export const PROFILE_STORAGE_KEY = 'frm-config';

/** Refresh intervals offered by the existing UI (milliseconds). */
export const ALLOWED_REFRESH_RATES = [1_000, 2_000, 3_000, 5_000, 10_000, 15_000, 30_000, 60_000] as const;

export const DEFAULT_PROFILE: ConnectionProfile = {
  schemaVersion: 2,
  host: 'localhost',
  port: '8080',
  refreshRate: 5_000,
};

export interface LoadedProfile {
  profile: ConnectionProfile;
  /** True when a legacy token-bearing record was found and removed. */
  migrated: boolean;
  /** True when stored data was malformed and defaults were applied. */
  recovered: boolean;
  /** User-facing, secret-free notice; null when nothing needs attention. */
  notice: string | null;
}

/** Returns a valid refresh rate or the documented default. */
function validRefreshRate(value: unknown): number {
  return typeof value === 'number' && (ALLOWED_REFRESH_RATES as readonly number[]).includes(value)
    ? value
    : DEFAULT_PROFILE.refreshRate;
}

/** Returns a trimmed nonempty host string or the default. */
function validHost(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 255
    ? value.trim()
    : DEFAULT_PROFILE.host;
}

/** Returns a plausible port string or the default; full parsing happens later. */
function validPort(value: unknown): string {
  return typeof value === 'string' && /^\d{1,5}$/.test(value.trim())
    ? value.trim()
    : DEFAULT_PROFILE.port;
}

/**
 * Loads the persisted profile, removes any legacy token and writes the
 * sanitized record back.
 *
 * Inputs: a Storage-like object (localStorage in the app).
 * Side effects: one read and one write to storage; a write failure is reported
 * through `notice` but never throws.
 * Invariants: the returned profile never contains a token; a malformed record
 * falls back to safe defaults.
 */
export function loadProfile(storage: Pick<Storage, 'getItem' | 'setItem'>): LoadedProfile {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return {
      profile: { ...DEFAULT_PROFILE },
      migrated: false,
      recovered: true,
      notice: 'Saved settings could not be read; using defaults.',
    };
  }

  if (!raw) {
    return { profile: { ...DEFAULT_PROFILE }, migrated: false, recovered: false, notice: null };
  }

  let parsed: unknown;
  const recoveryNotice = (reason: string): string => {
    let writeFailed = false;
    writeProfile(storage, DEFAULT_PROFILE, () => {
      writeFailed = true;
    });
    return writeFailed
      ? `Saved settings were ${reason} and could not be reset. Clear this site’s stored data manually; it may still contain an old token.`
      : `Saved settings were ${reason} and have been reset.`;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      profile: { ...DEFAULT_PROFILE },
      migrated: false,
      recovered: true,
      notice: recoveryNotice('malformed'),
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      profile: { ...DEFAULT_PROFILE },
      migrated: false,
      recovered: true,
      notice: recoveryNotice('invalid'),
    };
  }

  const record = parsed as Record<string, unknown>;
  const hadLegacySecret = Object.prototype.hasOwnProperty.call(record, 'password');
  const profile: ConnectionProfile = {
    schemaVersion: 2,
    host: validHost(record.host),
    port: validPort(record.port),
    refreshRate: validRefreshRate(record.refreshRate),
  };

  let writeFailed = false;
  writeProfile(storage, profile, () => {
    writeFailed = true;
  });

  const notices: string[] = [];
  if (hadLegacySecret && writeFailed) {
    // Never claim removal when the sanitized write failed: the legacy token is
    // still at rest and the user must clear site data manually.
    notices.push('The saved FRM token could not be removed from browser storage. Clear this site’s data and re-enter the token.');
  } else if (hadLegacySecret) {
    notices.push('The saved FRM token was removed. Re-enter it for this session.');
  }
  if (writeFailed) notices.push('The cleaned profile could not be saved.');

  return {
    profile,
    migrated: hadLegacySecret,
    recovered: false,
    notice: notices.length > 0 ? notices.join(' ') : null,
  };
}

/** Writes only the nonsecret fields; reports failure through the callback. */
export function writeProfile(
  storage: Pick<Storage, 'setItem'>,
  profile: ConnectionProfile,
  onError: (error: unknown) => void,
): void {
  const safe: ConnectionProfile = {
    schemaVersion: 2,
    host: profile.host,
    port: profile.port,
    refreshRate: validRefreshRate(profile.refreshRate),
  };
  try {
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(safe));
  } catch (error) {
    onError(error);
  }
}

/** Removes the stored profile (Forget/disconnect keeps nonsecret fields, so
 * this is only used by explicit "reset settings"). */
export function clearProfile(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Storage is unavailable; in-memory state still resets.
  }
}
