import { fetchOrdersFromChannel } from "@/lib/connectors";
import { exportSalesToSheets } from "@/lib/sheets";
import { calculateTotals } from "@/lib/metrics";
import { normalizeOrder } from "@/lib/normalizer";
import { appendRun, getConnection, readSettings, writeSettings } from "@/lib/settings";
import { filterSales, readSales, upsertSales } from "@/lib/storage";
import { AppSettings, AutomationJob, SalesChannel, SyncRun } from "@/lib/types";

const nowIso = () => new Date().toISOString();

const buildRun = (partial: Omit<SyncRun, "id" | "createdAt">): SyncRun => ({
  id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: nowIso(),
  ...partial,
});

const markAutomationRun = async (settings: AppSettings, jobId: string): Promise<void> => {
  const updated: AppSettings = {
    ...settings,
    automations: settings.automations.map((job) =>
      job.id === jobId ? { ...job, lastRunAt: nowIso() } : job,
    ),
  };
  await writeSettings(updated);
};

export const runSalesSync = async (input: {
  from: string;
  to: string;
  channels: SalesChannel[];
  triggeredBy: "manual" | "automation";
  jobId?: string;
  exportToSheets?: boolean;
}) => {
  const settings = await readSettings();

  try {
    const allNormalized = [];

    for (const channel of input.channels) {
      const connection = getConnection(settings.connections, channel);
      if (!connection || !connection.enabled) {
        continue;
      }

      const orders = await fetchOrdersFromChannel(channel, connection, input.from, input.to);
      allNormalized.push(...orders.map((order) => normalizeOrder(channel, order)));
    }

    const writeResult = await upsertSales(allNormalized);
    const allSales = await readSales();
    const filtered = filterSales(allSales, {
      from: input.from,
      to: input.to,
      channels: input.channels,
    });

    let exportedRows = 0;
    if (input.exportToSheets && settings.exportSettings.enabled) {
      const exportResult = await exportSalesToSheets(filtered, settings.exportSettings);
      if (!exportResult.ok) {
        throw new Error(exportResult.reason);
      }
      exportedRows = filtered.length;
    }

    const totals = calculateTotals(filtered);

    await appendRun(
      buildRun({
        triggeredBy: input.triggeredBy,
        jobId: input.jobId,
        from: input.from,
        to: input.to,
        channels: input.channels,
        status: "success",
        fetched: allNormalized.length,
        inserted: writeResult.inserted,
        skipped: writeResult.skipped,
        exportedRows,
        message: "Sincronizacion completada",
      }),
    );

    if (input.jobId) {
      await markAutomationRun(settings, input.jobId);
    }

    return {
      fetched: allNormalized.length,
      inserted: writeResult.inserted,
      skipped: writeResult.skipped,
      exportedRows,
      totals,
    };
  } catch (error) {
    await appendRun(
      buildRun({
        triggeredBy: input.triggeredBy,
        jobId: input.jobId,
        from: input.from,
        to: input.to,
        channels: input.channels,
        status: "failed",
        fetched: 0,
        inserted: 0,
        skipped: 0,
        exportedRows: 0,
        message: error instanceof Error ? error.message : "Error inesperado",
      }),
    );

    throw error;
  }
};

const isJobDue = (job: AutomationJob): boolean => {
  if (!job.enabled) {
    return false;
  }

  if (!job.lastRunAt) {
    return true;
  }

  const lastRun = new Date(job.lastRunAt).getTime();
  const hoursAgo = (Date.now() - lastRun) / (1000 * 60 * 60);

  if (job.schedule === "hourly") {
    return hoursAgo >= 1;
  }

  if (job.schedule === "daily") {
    return hoursAgo >= 24;
  }

  return false;
};

export const runDueAutomations = async () => {
  const settings = await readSettings();
  const dueJobs = settings.automations.filter(isJobDue);

  const results = [];
  for (const job of dueJobs) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - job.fromDaysBack);

    const result = await runSalesSync({
      from: from.toISOString(),
      to: to.toISOString(),
      channels: job.channels,
      triggeredBy: "automation",
      jobId: job.id,
      exportToSheets: job.exportToSheets,
    });

    results.push({
      jobId: job.id,
      ...result,
    });
  }

  return {
    executed: results.length,
    jobs: results,
  };
};
