import { promises as fs } from "node:fs";
import path from "node:path";
import { AppSettings, ChannelConnection, SyncRun } from "@/lib/types";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");
const RUNS_PATH = path.join(process.cwd(), "data", "runs.json");

const defaultSettings: AppSettings = {
  connections: [
    { channel: "tiendanube", enabled: true, mode: "demo", storeName: "Demo Tiendanube", credentials: {} },
    { channel: "shopify", enabled: true, mode: "demo", storeName: "Demo Shopify", credentials: {} },
    { channel: "mercadolibre", enabled: true, mode: "demo", storeName: "Demo MercadoLibre", credentials: {} },
  ],
  exportSettings: {
    enabled: true,
    sheetTab: "Ventas",
  },
  automations: [
    {
      id: "daily-close",
      name: "Cierre diario",
      channels: ["tiendanube", "shopify", "mercadolibre"],
      fromDaysBack: 1,
      schedule: "daily",
      enabled: true,
      exportToSheets: true,
    },
  ],
};

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const readSettings = async (): Promise<AppSettings> => {
  return readJson(SETTINGS_PATH, defaultSettings);
};

export const writeSettings = async (settings: AppSettings): Promise<void> => {
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
};

export const readRuns = async (): Promise<SyncRun[]> => {
  return readJson(RUNS_PATH, [] as SyncRun[]);
};

export const appendRun = async (run: SyncRun): Promise<void> => {
  const runs = await readRuns();
  const next = [run, ...runs].slice(0, 50);
  await fs.writeFile(RUNS_PATH, JSON.stringify(next, null, 2), "utf-8");
};

export const getConnection = (
  connections: ChannelConnection[],
  channel: ChannelConnection["channel"],
): ChannelConnection | undefined => {
  return connections.find((item) => item.channel === channel);
};
