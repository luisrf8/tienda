import { SaleRecord, SalesTotals } from "@/lib/types";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const calculateTotals = (items: SaleRecord[]): SalesTotals => {
  return items.reduce<SalesTotals>(
    (acc, item) => {
      acc.totalOrders += 1;
      acc.gross = round2(acc.gross + item.grossAmount);
      acc.discounts = round2(acc.discounts + item.discountAmount);
      acc.shipping = round2(acc.shipping + item.shippingAmount);
      acc.marketplaceFees = round2(acc.marketplaceFees + item.marketplaceFeeAmount);
      acc.taxes = round2(acc.taxes + item.taxAmount);
      acc.iibb = round2(acc.iibb + item.iibbAmount);
      acc.otherCharges = round2(acc.otherCharges + item.otherChargesAmount);
      acc.net = round2(acc.net + item.netAmount);
      return acc;
    },
    {
      totalOrders: 0,
      gross: 0,
      discounts: 0,
      shipping: 0,
      marketplaceFees: 0,
      taxes: 0,
      iibb: 0,
      otherCharges: 0,
      net: 0,
    },
  );
};
