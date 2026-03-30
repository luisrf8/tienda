"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppSettings,
  AutomationJob,
  ChannelConnection,
  SaleRecord,
  SalesChannel,
  SalesResponse,
  SyncRun,
} from "@/lib/types";

type ApiState = {
  loading: boolean;
  message: string;
  error: string;
};

type ConnectionTestState = ApiState & {
  details?: string;
};

type TiendanubeProductRow = {
  id: string;
  name: string;
  published: boolean;
  freeShipping: boolean;
  permalink: string;
  createdAt: string;
  updatedAt: string;
  variants: number;
  stock: number;
  price: number | null;
  promotionalPrice: number | null;
  sku: string;
};

type TiendanubeSaleRow = {
  id: string;
  date: string;
  status: "paid" | "pending" | "cancelled";
  customerName?: string;
  currency: string;
  total: number;
  discount: number;
  shipping: number;
  marketplaceFee: number;
  tax: number;
  iibb: number;
  otherCharges: number;
};

const CHANNELS: SalesChannel[] = ["tiendanube", "shopify", "mercadolibre"];

const defaultSettings: AppSettings = {
  connections: CHANNELS.map((channel) => ({
    channel,
    enabled: true,
    mode: "demo",
    storeName: `Demo ${channel}`,
    credentials: {},
  })),
  exportSettings: {
    enabled: true,
    spreadsheetId: "",
    sheetTab: "Ventas",
  },
  automations: [
    {
      id: "daily-close",
      name: "Cierre diario",
      channels: CHANNELS,
      fromDaysBack: 1,
      schedule: "daily",
      enabled: true,
      exportToSheets: true,
    },
  ],
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const initialDateRange = () => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
};

const metricList = [
  { label: "Ventas Brutas", key: "gross" },
  { label: "Descuentos", key: "discounts" },
  { label: "IIBB", key: "iibb" },
  { label: "Impuestos", key: "taxes" },
  { label: "Comisiones", key: "marketplaceFees" },
  { label: "Neto", key: "net" },
] as const;

const createManualJob = (): AutomationJob => ({
  id: `job-${Date.now()}`,
  name: "Nueva automatizacion",
  channels: ["tiendanube"],
  fromDaysBack: 1,
  schedule: "daily",
  enabled: true,
  exportToSheets: true,
});

export function AdminDashboard() {
  const [selectedChannels, setSelectedChannels] = useState<SalesChannel[]>(CHANNELS);
  const [dateRange, setDateRange] = useState(initialDateRange());
  const [response, setResponse] = useState<SalesResponse | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [syncState, setSyncState] = useState<ApiState>({ loading: false, message: "", error: "" });
  const [exportState, setExportState] = useState<ApiState>({ loading: false, message: "", error: "" });
  const [settingsState, setSettingsState] = useState<ApiState>({ loading: false, message: "", error: "" });
  const [automationState, setAutomationState] = useState<ApiState>({ loading: false, message: "", error: "" });
  const [connectionTests, setConnectionTests] = useState<Record<string, ConnectionTestState>>({});
  const [productsState, setProductsState] = useState<ApiState>({ loading: false, message: "", error: "" });
  const [tiendanubeProducts, setTiendanubeProducts] = useState<TiendanubeProductRow[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productLimit, setProductLimit] = useState(300);
  const [salesState, setSalesState] = useState<ApiState>({ loading: false, message: "", error: "" });
  const [tiendanubeSales, setTiendanubeSales] = useState<TiendanubeSaleRow[]>([]);
  const [salesLimit, setSalesLimit] = useState(200);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", `${dateRange.from}T00:00:00.000Z`);
    params.set("to", `${dateRange.to}T23:59:59.999Z`);
    params.set("channels", selectedChannels.join(","));
    return params.toString();
  }, [dateRange.from, dateRange.to, selectedChannels]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) {
      return tiendanubeProducts;
    }

    return tiendanubeProducts.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q),
    );
  }, [productSearch, tiendanubeProducts]);

  const activeConnectionsCount = useMemo(
    () => settings.connections.filter((connection) => connection.enabled).length,
    [settings.connections],
  );

  const apiConnectionsCount = useMemo(
    () => settings.connections.filter((connection) => connection.enabled && connection.mode === "api").length,
    [settings.connections],
  );

  const loadSales = useCallback(async () => {
    const res = await fetch(`/api/sales?${queryString}`);
    const json = (await res.json()) as SalesResponse;
    setResponse(json);
  }, [queryString]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const json = (await res.json()) as AppSettings;
    setSettings(json);
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/runs");
    const json = (await res.json()) as { items: SyncRun[] };
    setRuns(json.items);
  }, []);

  useEffect(() => {
    Promise.all([loadSales(), loadSettings(), loadRuns()]).catch(() => {
      setResponse(null);
    });
  }, [loadRuns, loadSales, loadSettings]);

  const toggleChannel = (channel: SalesChannel) => {
    setSelectedChannels((prev) => {
      if (prev.includes(channel)) {
        return prev.filter((item) => item !== channel);
      }
      return [...prev, channel];
    });
  };

  const updateConnection = (channel: SalesChannel, updater: (current: ChannelConnection) => ChannelConnection) => {
    setSettings((prev) => ({
      ...prev,
      connections: prev.connections.map((connection) =>
        connection.channel === channel ? updater(connection) : connection,
      ),
    }));
  };

  const updateAutomation = (jobId: string, updater: (current: AutomationJob) => AutomationJob) => {
    setSettings((prev) => ({
      ...prev,
      automations: prev.automations.map((job) => (job.id === jobId ? updater(job) : job)),
    }));
  };

  const saveSettings = async () => {
    setSettingsState({ loading: true, message: "", error: "" });
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "No se pudo guardar la configuracion");
      }

      setSettingsState({ loading: false, message: "Configuracion guardada.", error: "" });
      await loadSettings();
    } catch (error) {
      setSettingsState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  };

  const runConnectionTest = async (connection: ChannelConnection) => {
    setConnectionTests((prev) => ({
      ...prev,
      [connection.channel]: { loading: true, message: "", error: "", details: "" },
    }));

    try {
      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connection),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        details?: { storeName?: string; domain?: string; currency?: string } | null;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "No se pudo validar la conexion");
      }

      const details = json.details
        ? `${json.details.storeName ?? "Tienda"} | ${json.details.domain ?? ""} | ${json.details.currency ?? ""}`
        : "";

      setConnectionTests((prev) => ({
        ...prev,
        [connection.channel]: {
          loading: false,
          message: json.message ?? "Conexion valida.",
          error: "",
          details,
        },
      }));
    } catch (error) {
      setConnectionTests((prev) => ({
        ...prev,
        [connection.channel]: {
          loading: false,
          message: "",
          error: error instanceof Error ? error.message : "Error inesperado",
          details: "",
        },
      }));
    }
  };

  const runSync = async () => {
    setSyncState({ loading: true, message: "", error: "" });
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${dateRange.from}T00:00:00.000Z`,
          to: `${dateRange.to}T23:59:59.999Z`,
          channels: selectedChannels,
        }),
      });

      const json = (await res.json()) as { inserted?: number; skipped?: number; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "No se pudo sincronizar");
      }

      setSyncState({
        loading: false,
        message: `Sincronizacion OK. Nuevas: ${json.inserted ?? 0} / Omitidas: ${json.skipped ?? 0}`,
        error: "",
      });
      await Promise.all([loadSales(), loadRuns(), loadSettings()]);
    } catch (error) {
      setSyncState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  };

  const runExport = async () => {
    setExportState({ loading: true, message: "", error: "" });
    try {
      const res = await fetch("/api/export/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${dateRange.from}T00:00:00.000Z`,
          to: `${dateRange.to}T23:59:59.999Z`,
          channels: selectedChannels,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; exportedRows?: number; reason?: string };
      if (!res.ok || !json.ok) {
        const reason = json.reason ?? "No se pudo exportar";

        // If Google Sheets is not configured, fallback to local XLS export.
        if (reason.includes("GOOGLE_SERVICE_ACCOUNT_JSON") || reason.includes("GOOGLE_SHEETS_SPREADSHEET_ID")) {
          window.location.href = "/api/export/xls?all=1";
          setExportState({
            loading: false,
            message: "Google Sheets no esta configurado. Se descargo XLS con toda la tienda.",
            error: "",
          });
          return;
        }

        throw new Error(reason);
      }

      setExportState({
        loading: false,
        message: `Exportacion OK. Filas enviadas: ${json.exportedRows ?? 0}`,
        error: "",
      });
      await loadRuns();
    } catch (error) {
      setExportState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  };

  const downloadXls = (includeAll: boolean) => {
    if (includeAll) {
      window.location.href = "/api/export/xls?all=1";
      return;
    }

    const params = new URLSearchParams();
    params.set("from", `${dateRange.from}T00:00:00.000Z`);
    params.set("to", `${dateRange.to}T23:59:59.999Z`);
    params.set("channels", selectedChannels.join(","));
    window.location.href = `/api/export/xls?${params.toString()}`;
  };

  const downloadProductsXls = () => {
    const params = new URLSearchParams();
    params.set("limit", String(productLimit));

    const q = productSearch.trim();
    if (q) {
      params.set("q", q);
    }

    window.location.href = `/api/export/xls/products?${params.toString()}`;
  };

  const runAutomations = async () => {
    setAutomationState({ loading: true, message: "", error: "" });
    try {
      const res = await fetch("/api/automation/run-due", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; executed?: number; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "No se pudieron ejecutar automatizaciones");
      }

      setAutomationState({
        loading: false,
        message: `Automatizaciones ejecutadas: ${json.executed ?? 0}`,
        error: "",
      });
      await Promise.all([loadSales(), loadRuns(), loadSettings()]);
    } catch (error) {
      setAutomationState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  };

  const loadTiendanubeProducts = async () => {
    setProductsState({ loading: true, message: "", error: "" });
    try {
      const res = await fetch(`/api/tiendanube/products?limit=${productLimit}`);
      const json = (await res.json()) as {
        ok?: boolean;
        total?: number;
        items?: TiendanubeProductRow[];
        error?: string;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "No se pudieron cargar productos.");
      }

      setTiendanubeProducts(json.items ?? []);
      setProductsState({
        loading: false,
        message: `Productos cargados: ${json.total ?? 0}`,
        error: "",
      });
    } catch (error) {
      setProductsState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  };

  const loadTiendanubeSales = async () => {
    setSalesState({ loading: true, message: "", error: "" });
    try {
      const params = new URLSearchParams();
      params.set("from", `${dateRange.from}T00:00:00.000Z`);
      params.set("to", `${dateRange.to}T23:59:59.999Z`);
      params.set("limit", String(salesLimit));

      const res = await fetch(`/api/tiendanube/sales?${params.toString()}`);
      const json = (await res.json()) as {
        ok?: boolean;
        total?: number;
        items?: TiendanubeSaleRow[];
        error?: string;
      };

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "No se pudieron cargar ventas de Tiendanube.");
      }

      setTiendanubeSales(json.items ?? []);
      setSalesState({
        loading: false,
        message: `Ventas cargadas: ${json.total ?? 0}`,
        error: "",
      });
    } catch (error) {
      setSalesState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  };

  return (
    <main className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="brand-block">
          <p className="brand-kicker">Backoffice</p>
          <h2>Administrador Comercial</h2>
          <p>Consolidacion operativa y monitoreo de canales en tiempo real.</p>
        </div>

        <nav className="sidebar-nav" aria-label="Panel administrativo">
          <a href="#" className="nav-item active">
            Resumen Ejecutivo
          </a>
          <a href="#" className="nav-item">
            Operaciones
          </a>
          <a href="#" className="nav-item">
            Conexiones
          </a>
          <a href="#" className="nav-item">
            Exportaciones
          </a>
          <a href="#" className="nav-item">
            Automatizaciones
          </a>
        </nav>

        <div className="sidebar-foot">
          <span>Canales activos</span>
          <strong>{activeConnectionsCount}/3</strong>
          <small>Integraciones API habilitadas: {apiConnectionsCount}</small>
        </div>
      </aside>

      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="topbar-kicker">Panel de control</p>
            <h1>Dashboard Administrativo</h1>
          </div>
          <div className="topbar-stats">
            <div>
              <span>Periodo</span>
              <strong>
                {dateRange.from} a {dateRange.to}
              </strong>
            </div>
            <div>
              <span>Canales seleccionados</span>
              <strong>{selectedChannels.length}</strong>
            </div>
          </div>
        </header>

        <div className="dashboard-shell">
          <section className="hero-card">
        <p className="kicker">Sistema Administrativo</p>
        <h1>Ventas unificadas con desglose fiscal</h1>
        <p>
          Consolida Tiendanube, Shopify y MercadoLibre, configura conexiones por canal, automatiza cierres y
          exporta a Google Sheets desde una sola pantalla.
        </p>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>Operacion manual</h2>
          <div className="field-grid">
            <label>
              <span>Desde</span>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              />
            </label>
          </div>

          <div className="channel-list">
            {CHANNELS.map((channel) => (
              <label key={channel} className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
                <span>{channel}</span>
              </label>
            ))}
          </div>

          <div className="button-row">
            <button type="button" onClick={runSync} disabled={syncState.loading || selectedChannels.length === 0}>
              {syncState.loading ? "Sincronizando..." : "Sincronizar ventas"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={runExport}
              disabled={exportState.loading || selectedChannels.length === 0}
            >
              {exportState.loading ? "Exportando..." : "Exportar a Sheets"}
            </button>
            <button type="button" className="ghost" onClick={runAutomations} disabled={automationState.loading}>
              {automationState.loading ? "Corriendo jobs..." : "Ejecutar jobs vencidos"}
            </button>
            <button type="button" className="ghost" onClick={() => downloadXls(true)}>
              Descargar XLS (toda la tienda)
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => downloadXls(false)}
              disabled={selectedChannels.length === 0}
            >
              Descargar XLS (filtro actual)
            </button>
          </div>

          {syncState.message ? <p className="msg ok">{syncState.message}</p> : null}
          {syncState.error ? <p className="msg error">{syncState.error}</p> : null}
          {exportState.message ? <p className="msg ok">{exportState.message}</p> : null}
          {exportState.error ? <p className="msg error">{exportState.error}</p> : null}
          {automationState.message ? <p className="msg ok">{automationState.message}</p> : null}
          {automationState.error ? <p className="msg error">{automationState.error}</p> : null}
        </article>

        <article className="panel metrics-panel">
          <h2>Resumen</h2>
          <p className="metric-caption">Pedidos: {response?.totals.totalOrders ?? 0}</p>
          <div className="metric-grid">
            {metricList.map((metric) => {
              const value = response?.totals[metric.key] ?? 0;
              return (
                <div className="metric" key={metric.key}>
                  <span>{metric.label}</span>
                  <strong>{ARS.format(value)}</strong>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="section-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Conexiones</h2>
            <button type="button" onClick={saveSettings} disabled={settingsState.loading}>
              {settingsState.loading ? "Guardando..." : "Guardar configuracion"}
            </button>
          </div>
          <div className="connection-grid">
            {settings.connections.map((connection) => (
              <div key={connection.channel} className="connection-card">
                <div className="panel-head compact">
                  <h3>{connection.channel}</h3>
                  <div className="panel-actions">
                    {connection.channel === "tiendanube" ? (
                      <button
                        type="button"
                        className="secondary small-button"
                        onClick={() => {
                          window.location.href = "/api/oauth/tiendanube/start";
                        }}
                      >
                        Conectar OAuth
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost small-button"
                      onClick={() => runConnectionTest(connection)}
                      disabled={connectionTests[connection.channel]?.loading}
                    >
                      {connectionTests[connection.channel]?.loading ? "Probando..." : "Test conexion"}
                    </button>
                    <label className="checkbox small">
                      <input
                        type="checkbox"
                        checked={connection.enabled}
                        onChange={(e) =>
                          updateConnection(connection.channel, (current) => ({
                            ...current,
                            enabled: e.target.checked,
                          }))
                        }
                      />
                      <span>Activo</span>
                    </label>
                  </div>
                </div>
                <div className="mini-grid">
                  <label>
                    <span>Nombre tienda</span>
                    <input
                      type="text"
                      value={connection.storeName}
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          storeName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Modo</span>
                    <select
                      value={connection.mode}
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          mode: e.target.value as ChannelConnection["mode"],
                        }))
                      }
                    >
                      <option value="demo">Demo</option>
                      <option value="api">API real</option>
                    </select>
                  </label>
                  <label>
                    <span>Store URL</span>
                    <input
                      type="text"
                      value={connection.credentials.storeUrl ?? ""}
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          credentials: { ...current.credentials, storeUrl: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Access Token</span>
                    <input
                      type="password"
                      value={connection.credentials.accessToken ?? ""}
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          credentials: { ...current.credentials, accessToken: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Client ID</span>
                    <input
                      type="text"
                      value={connection.credentials.clientId ?? ""}
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          credentials: { ...current.credentials, clientId: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Client Secret</span>
                    <input
                      type="password"
                      value={connection.credentials.clientSecret ?? ""}
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          credentials: { ...current.credentials, clientSecret: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>
                      {connection.channel === "tiendanube"
                        ? "User ID / Store ID"
                        : connection.channel === "mercadolibre"
                          ? "Seller ID"
                          : "Refresh Token"}
                    </span>
                    <input
                      type="text"
                      value={
                        connection.channel === "tiendanube" || connection.channel === "mercadolibre"
                          ? connection.credentials.sellerId ?? ""
                          : connection.credentials.refreshToken ?? ""
                      }
                      onChange={(e) =>
                        updateConnection(connection.channel, (current) => ({
                          ...current,
                          credentials:
                            current.channel === "tiendanube" || current.channel === "mercadolibre"
                              ? { ...current.credentials, sellerId: e.target.value }
                              : { ...current.credentials, refreshToken: e.target.value },
                        }))
                      }
                    />
                  </label>
                </div>
                <p className="subtle">
                  En modo demo el sistema genera ventas simuladas. En modo API exige token cargado y queda listo
                  para conectar el fetch real del canal.
                </p>
                {connection.channel === "shopify" ? (
                  <p className="subtle">Para Shopify usa el dominio `mitienda.myshopify.com` y el Admin API access token.</p>
                ) : null}
                {connection.channel === "tiendanube" ? (
                  <p className="subtle">
                    En Partners, cambia la URL de redireccion despues de instalacion a
                    <strong> /api/oauth/tiendanube/callback</strong> de este sistema y luego usa <strong>Conectar OAuth</strong>.
                  </p>
                ) : null}
                {connectionTests[connection.channel]?.message ? (
                  <p className="msg ok">{connectionTests[connection.channel]?.message}</p>
                ) : null}
                {connectionTests[connection.channel]?.details ? (
                  <p className="subtle">{connectionTests[connection.channel]?.details}</p>
                ) : null}
                {connectionTests[connection.channel]?.error ? (
                  <p className="msg error">{connectionTests[connection.channel]?.error}</p>
                ) : null}
              </div>
            ))}
          </div>
          {settingsState.message ? <p className="msg ok">{settingsState.message}</p> : null}
          {settingsState.error ? <p className="msg error">{settingsState.error}</p> : null}
        </article>

        <article className="panel">
          <h2>Exportacion</h2>
          <div className="mini-grid">
            <label>
              <span>Spreadsheet ID</span>
              <input
                type="text"
                value={settings.exportSettings.spreadsheetId ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    exportSettings: { ...prev.exportSettings, spreadsheetId: e.target.value },
                  }))
                }
              />
            </label>
            <label>
              <span>Hoja</span>
              <input
                type="text"
                value={settings.exportSettings.sheetTab}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    exportSettings: { ...prev.exportSettings, sheetTab: e.target.value },
                  }))
                }
              />
            </label>
            <label className="checkbox inline-row">
              <input
                type="checkbox"
                checked={settings.exportSettings.enabled}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    exportSettings: { ...prev.exportSettings, enabled: e.target.checked },
                  }))
                }
              />
              <span>Exportacion habilitada</span>
            </label>
          </div>
          <p className="subtle">
            El service account de Google sigue leyendose desde variables de entorno. Desde el admin podes cambiar
            el spreadsheet y la pestaña destino.
          </p>
        </article>
      </section>

      <section className="section-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Automatizaciones</h2>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  automations: [...prev.automations, createManualJob()],
                }))
              }
            >
              Agregar job
            </button>
          </div>
          <div className="stack-list">
            {settings.automations.map((job) => (
              <div key={job.id} className="connection-card">
                <div className="mini-grid wide">
                  <label>
                    <span>Nombre</span>
                    <input
                      type="text"
                      value={job.name}
                      onChange={(e) => updateAutomation(job.id, (current) => ({ ...current, name: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Frecuencia</span>
                    <select
                      value={job.schedule}
                      onChange={(e) =>
                        updateAutomation(job.id, (current) => ({
                          ...current,
                          schedule: e.target.value as AutomationJob["schedule"],
                        }))
                      }
                    >
                      <option value="manual">Manual</option>
                      <option value="daily">Diaria</option>
                      <option value="hourly">Cada hora</option>
                    </select>
                  </label>
                  <label>
                    <span>Dias hacia atras</span>
                    <input
                      type="number"
                      min="1"
                      value={job.fromDaysBack}
                      onChange={(e) =>
                        updateAutomation(job.id, (current) => ({
                          ...current,
                          fromDaysBack: Number(e.target.value) || 1,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="channel-list compact-list">
                  {CHANNELS.map((channel) => (
                    <label key={`${job.id}-${channel}`} className="checkbox small">
                      <input
                        type="checkbox"
                        checked={job.channels.includes(channel)}
                        onChange={() =>
                          updateAutomation(job.id, (current) => ({
                            ...current,
                            channels: current.channels.includes(channel)
                              ? current.channels.filter((item) => item !== channel)
                              : [...current.channels, channel],
                          }))
                        }
                      />
                      <span>{channel}</span>
                    </label>
                  ))}
                </div>
                <div className="button-row compact-row">
                  <label className="checkbox small">
                    <input
                      type="checkbox"
                      checked={job.enabled}
                      onChange={(e) => updateAutomation(job.id, (current) => ({ ...current, enabled: e.target.checked }))}
                    />
                    <span>Activo</span>
                  </label>
                  <label className="checkbox small">
                    <input
                      type="checkbox"
                      checked={job.exportToSheets}
                      onChange={(e) =>
                        updateAutomation(job.id, (current) => ({ ...current, exportToSheets: e.target.checked }))
                      }
                    />
                    <span>Exporta a Sheets</span>
                  </label>
                  <span className="subtle">
                    Ultima corrida: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString("es-AR") : "Nunca"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel table-panel">
          <h2>Ultimas corridas</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Canales</th>
                  <th>Estado</th>
                  <th>Nuevas</th>
                  <th>Exportadas</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.createdAt).toLocaleString("es-AR")}</td>
                    <td>{run.triggeredBy}</td>
                    <td>{run.channels.join(", ")}</td>
                    <td>
                      <span className={`run-tag ${run.status === "success" ? "run-success" : "run-failed"}`}>
                        {run.status}
                      </span>
                    </td>
                    <td>{run.inserted}</td>
                    <td>{run.exportedRows}</td>
                    <td>{run.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Productos Tiendanube</h2>
          <div className="products-toolbar">
            <label>
              <span>Limite</span>
              <input
                type="number"
                min="50"
                max="5000"
                step="50"
                value={productLimit}
                onChange={(e) => setProductLimit(Math.max(50, Math.min(5000, Number(e.target.value) || 300)))}
              />
            </label>
            <button type="button" className="secondary" onClick={loadTiendanubeProducts} disabled={productsState.loading}>
              {productsState.loading ? "Cargando..." : "Ver productos"}
            </button>
            <label>
              <span>Limite ventas</span>
              <input
                type="number"
                min="1"
                max="2000"
                step="50"
                value={salesLimit}
                onChange={(e) => setSalesLimit(Math.max(1, Math.min(2000, Number(e.target.value) || 200)))}
              />
            </label>
            <button type="button" className="secondary" onClick={loadTiendanubeSales} disabled={salesState.loading}>
              {salesState.loading ? "Cargando ventas..." : "Ver ventas Tiendanube"}
            </button>
            <button type="button" className="ghost" onClick={downloadProductsXls}>
              Exportar productos XLS
            </button>
          </div>
        </div>

        <div className="products-toolbar">
          <label>
            <span>Buscar (nombre, ID o SKU)</span>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Ej: Remera, 12345, SKU-001"
            />
          </label>
        </div>

        {productsState.message ? <p className="msg ok">{productsState.message}</p> : null}
        {productsState.error ? <p className="msg error">{productsState.error}</p> : null}
        {salesState.message ? <p className="msg ok">{salesState.message}</p> : null}
        {salesState.error ? <p className="msg error">{salesState.error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>SKU</th>
                <th>Precio</th>
                <th>Promo</th>
                <th>Stock</th>
                <th>Variantes</th>
                <th>Publicado</th>
                <th>Envio gratis</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.sku || "-"}</td>
                  <td>{item.price !== null ? ARS.format(item.price) : "-"}</td>
                  <td>{item.promotionalPrice !== null ? ARS.format(item.promotionalPrice) : "-"}</td>
                  <td>{item.stock}</td>
                  <td>{item.variants}</td>
                  <td>{item.published ? "Si" : "No"}</td>
                  <td>{item.freeShipping ? "Si" : "No"}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString("es-AR") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <h2>Ventas Tiendanube (API real)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Order ID</th>
                <th>Estado</th>
                <th>Cliente</th>
                <th>Moneda</th>
                <th>Total</th>
                <th>Descuento</th>
                <th>Envio</th>
                <th>Impuestos</th>
              </tr>
            </thead>
            <tbody>
              {tiendanubeSales.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.date).toLocaleString("es-AR")}</td>
                  <td>{item.id}</td>
                  <td>{item.status}</td>
                  <td>{item.customerName ?? "-"}</td>
                  <td>{item.currency}</td>
                  <td>{ARS.format(item.total)}</td>
                  <td>{ARS.format(item.discount)}</td>
                  <td>{ARS.format(item.shipping)}</td>
                  <td>{ARS.format(item.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <h2>Detalle de ventas</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Canal</th>
                <th>Order ID</th>
                <th>Bruta</th>
                <th>Desc.</th>
                <th>IIBB</th>
                <th>Imp.</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              {(response?.items ?? []).map((item: SaleRecord) => (
                <tr key={item.id}>
                  <td>{new Date(item.orderedAt).toLocaleString("es-AR")}</td>
                  <td>{item.source}</td>
                  <td>{item.orderId}</td>
                  <td>{ARS.format(item.grossAmount)}</td>
                  <td>{ARS.format(item.discountAmount)}</td>
                  <td>{ARS.format(item.iibbAmount)}</td>
                  <td>{ARS.format(item.taxAmount)}</td>
                  <td>{ARS.format(item.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

        </div>
      </div>
    </main>
  );
}
