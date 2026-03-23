import { RawOrder, SaleRecord, SalesChannel } from "@/lib/types";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const calcNetAmount = (raw: Pick<RawOrder, "total" | "discount" | "marketplaceFee" | "tax" | "iibb" | "otherCharges">): number => {
  return round2(raw.total - raw.discount - raw.marketplaceFee - raw.tax - raw.iibb - raw.otherCharges);
};

export const normalizeOrder = (source: SalesChannel, order: RawOrder): SaleRecord => {
  return {
    id: `${source}-${order.id}`,
    source,
    orderId: order.id,
    orderedAt: order.date,
    currency: order.currency,
    customerName: order.customerName,
    status: order.status,
    grossAmount: round2(order.total),
    discountAmount: round2(order.discount),
    shippingAmount: round2(order.shipping),
    marketplaceFeeAmount: round2(order.marketplaceFee),
    taxAmount: round2(order.tax),
    iibbAmount: round2(order.iibb),
    otherChargesAmount: round2(order.otherCharges),
    netAmount: calcNetAmount(order),
  };
};
