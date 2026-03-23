import { promises as fs } from "node:fs";
import path from "node:path";
import { SaleRecord, SalesChannel } from "@/lib/types";

const FILE_PATH = path.join(process.cwd(), "data", "sales.json");

const parseSafe = (content: string): SaleRecord[] => {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as SaleRecord[]) : [];
  } catch {
    return [];
  }
};

export const readSales = async (): Promise<SaleRecord[]> => {
  try {
    const content = await fs.readFile(FILE_PATH, "utf-8");
    return parseSafe(content);
  } catch {
    return [];
  }
};

export const upsertSales = async (newSales: SaleRecord[]): Promise<{ inserted: number; skipped: number }> => {
  const current = await readSales();
  const existingIds = new Set(current.map((item) => item.id));

  let inserted = 0;
  const merged = [...current];

  for (const sale of newSales) {
    if (existingIds.has(sale.id)) {
      continue;
    }

    merged.push(sale);
    existingIds.add(sale.id);
    inserted += 1;
  }

  await fs.writeFile(FILE_PATH, JSON.stringify(merged, null, 2), "utf-8");

  return {
    inserted,
    skipped: newSales.length - inserted,
  };
};

export const filterSales = (
  sales: SaleRecord[],
  filters: { from?: string; to?: string; channels?: SalesChannel[] },
): SaleRecord[] => {
  const fromTs = filters.from ? new Date(filters.from).getTime() : Number.NEGATIVE_INFINITY;
  const toTs = filters.to ? new Date(filters.to).getTime() : Number.POSITIVE_INFINITY;

  return sales
    .filter((sale) => {
      const saleTs = new Date(sale.orderedAt).getTime();
      const channelAllowed =
        !filters.channels || filters.channels.length === 0 || filters.channels.includes(sale.source);
      return channelAllowed && saleTs >= fromTs && saleTs <= toTs;
    })
    .sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : -1));
};
