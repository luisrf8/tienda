import { ChannelConnection, RawOrder, SalesChannel } from "@/lib/types";
import { fetchShopifyOrders, testShopifyConnection } from "@/lib/shopify";

const randomBetween = (min: number, max: number): number => {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
};

const buildMockOrders = (channel: SalesChannel, from: string, to: string): RawOrder[] => {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const rangeMs = Math.max(toDate.getTime() - fromDate.getTime(), 1);
  const size = Math.floor(Math.random() * 8) + 5;

  return Array.from({ length: size }).map((_, idx) => {
    const date = new Date(fromDate.getTime() + Math.random() * rangeMs);
    const total = randomBetween(9000, 140000);
    const discount = randomBetween(0, total * 0.2);
    const marketplaceFee = randomBetween(total * 0.04, total * 0.12);
    const tax = randomBetween(total * 0.05, total * 0.21);
    const iibb = randomBetween(total * 0.008, total * 0.03);
    const otherCharges = randomBetween(0, total * 0.02);

    return {
      id: `${channel.toUpperCase()}-${Date.now()}-${idx + 1}`,
      date: date.toISOString(),
      status: "paid",
      customerName: `Cliente ${idx + 1}`,
      currency: "ARS",
      total,
      discount,
      shipping: randomBetween(0, 6500),
      marketplaceFee,
      tax,
      iibb,
      otherCharges,
    };
  });
};

export const fetchOrdersFromChannel = async (
  channel: SalesChannel,
  connection: ChannelConnection,
  from: string,
  to: string,
): Promise<RawOrder[]> => {
  if (connection.mode === "demo") {
    return buildMockOrders(channel, from, to);
  }

  if (!connection.credentials.accessToken) {
    throw new Error(`El canal ${channel} esta en modo API pero no tiene accessToken configurado.`);
  }

  if (channel === "shopify") {
    return fetchShopifyOrders(connection, from, to);
  }

  throw new Error(`La integracion API real para ${channel} todavia no esta implementada.`);
};

export const testChannelConnection = async (connection: ChannelConnection) => {
  if (connection.mode === "demo") {
    return {
      ok: true,
      message: `El canal ${connection.channel} esta en modo demo.`,
      details: null,
    };
  }

  if (connection.channel === "shopify") {
    const details = await testShopifyConnection(connection);
    return {
      ok: true,
      message: "Conexion Shopify valida.",
      details,
    };
  }

  throw new Error(`El test API real para ${connection.channel} todavia no esta implementado.`);
};
