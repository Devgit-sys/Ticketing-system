(function () {
  'use strict';

  function safeJsonParse(value) {
    try { return JSON.parse(value || '{}'); } catch (e) { return {}; }
  }

  function getRuntimeConfig() {
    const direct = safeJsonParse(window.IEPM_RUNTIME_CONFIG || '{}');
    return {
      supabaseUrl: direct.supabaseUrl || window.IEPM_SUPABASE_URL || '',
      supabaseAnonKey: direct.supabaseAnonKey || window.IEPM_SUPABASE_ANON_KEY || '',
      googleClientId: direct.googleClientId || window.IEPM_GOOGLE_CLIENT_ID || '',
    };
  }

  async function loadServerConfig() {
    if (window.location.protocol === 'file:') return;

    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.supabaseUrl) {
        window.IEPM_SUPABASE_URL = String(data.supabaseUrl).trim();
      }
      if (data && data.supabaseAnonKey) {
        window.IEPM_SUPABASE_ANON_KEY = String(data.supabaseAnonKey).trim();
      }
      if (data && data.googleClientId) {
        window.IEPM_GOOGLE_CLIENT_ID = String(data.googleClientId).trim();
      }
    } catch (e) {
      // ignore offline or missing server configuration
    }
  }

  async function readAppState(tableName, key) {
    const state = window.IEPM_SUPABASE || {};
    if (!state.ready || !state.client || !tableName || !key) return null;

    try {
      const { data, error } = await state.client.from(tableName).select('data').eq('id', key).maybeSingle();
      if (error) {
        console.warn('Supabase read failed:', error.message || error);
        return null;
      }
      return data && data.data ? data.data : null;
    } catch (error) {
      console.warn('Supabase read exception:', error && error.message ? error.message : error);
      return null;
    }
  }

  async function writeAppState(tableName, key, data) {
    const state = window.IEPM_SUPABASE || {};
    if (!state.ready || !state.client || !tableName || !key) return false;

    try {
      const payload = { id: key, data: data, updated_at: new Date().toISOString() };
      const { error } = await state.client.from(tableName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase write failed:', error.message || error);
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Supabase write exception:', error && error.message ? error.message : error);
      return false;
    }
  }

  function initSupabase() {
    const config = getRuntimeConfig();
    const hasUrl = Boolean(config.supabaseUrl && config.supabaseUrl.indexOf('https://') === 0);
    const hasAnon = Boolean(config.supabaseAnonKey && config.supabaseAnonKey.length > 20);

    if (!hasUrl || !hasAnon || !window.supabase || !window.supabase.createClient) {
      window.IEPM_SUPABASE = {
        ready: false,
        url: config.supabaseUrl || '',
        anonKey: config.supabaseAnonKey || '',
        client: null,
        loaded: true,
        isConfigured: false,
        readAppState,
        writeAppState,
      };
      return;
    }

    const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    window.IEPM_SUPABASE = {
      ready: true,
      url: config.supabaseUrl,
      anonKey: config.supabaseAnonKey,
      client: client,
      loaded: true,
      isConfigured: true,
      readAppState,
      writeAppState,
    };
  }

  window.IEPM_SUPABASE = window.IEPM_SUPABASE || {
    ready: false,
    url: '',
    anonKey: '',
    client: null,
    loaded: false,
    isConfigured: false,
    readAppState,
    writeAppState,
  };

  window.IEPM_SUPABASE.refresh = loadServerConfig;
  window.IEPM_SUPABASE.init = initSupabase;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      loadServerConfig().finally(initSupabase);
    });
  } else {
    loadServerConfig().finally(initSupabase);
  }
})();
