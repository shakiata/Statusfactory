'use client';

import { useCallback, useEffect, useState } from 'react';
import { FRMConfig } from './types';
import {
  DEFAULT_PROFILE,
  loadProfile,
  writeProfile,
  type ConnectionProfile,
} from './connection/profile';

/** Default connection config used by tests and the Settings reset action. */
export const defaultConfig: FRMConfig = {
  host: DEFAULT_PROFILE.host,
  port: DEFAULT_PROFILE.port,
  password: '',
  refreshRate: DEFAULT_PROFILE.refreshRate,
};

/**
 * Persists the nonsecret connection profile and performs the one-time legacy
 * token migration on mount.
 *
 * The returned `config` never contains a token; the session token is owned by
 * `page.tsx` and composed into the runtime config passed to panels.
 */
export function useConfig() {
  const [config, setConfig] = useState<FRMConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoaded(true);
      return;
    }
    const loadedProfile = loadProfile(window.localStorage);
    setConfig({
      host: loadedProfile.profile.host,
      port: loadedProfile.profile.port,
      refreshRate: loadedProfile.profile.refreshRate,
    });
    if (loadedProfile.notice) setNotice(loadedProfile.notice);
    setLoaded(true);
  }, []);

  /** Saves only nonsecret fields; a token in the argument is ignored. */
  const saveConfig = useCallback((newConfig: FRMConfig) => {
    const profile: ConnectionProfile = {
      schemaVersion: 2,
      host: newConfig.host,
      port: newConfig.port,
      refreshRate: newConfig.refreshRate,
    };
    setConfig(profile);
    if (typeof window !== 'undefined') {
      writeProfile(window.localStorage, profile, () => {
        setNotice('The connection profile could not be saved.');
      });
    }
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { config, saveConfig, loaded, notice, dismissNotice };
}
