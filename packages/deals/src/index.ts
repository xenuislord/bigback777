import { base, canonical } from "../../grocery/src/index.ts";
import type { Offer, GroceryItem, Settings } from "../../shared/src/index.ts";
export function quote(
  item: Pick<GroceryItem, "name" | "quantity" | "unit">,
  o: Offer,
  memberships: string[],
  date = new Date().toISOString().slice(0, 10),
) {
  if (
    o.expires < date ||
    canonical(item.name) !== canonical(o.ingredient) ||
    o.quality !== "standard" ||
    (o.loyalty && !memberships.includes(o.store)) ||
    (o.membership && !memberships.includes(o.membership))
  )
    return null;
  const need = base(item.quantity, item.unit),
    pack = base(o.quantity, o.unit);
  if (need.unit !== pack.unit) return null;
  const packages = Math.max(
    o.minPackages,
    Math.ceil((need.quantity - 1e-8) / pack.quantity),
  );
  return {
    offer: o,
    packages,
    costCents: packages * (o.priceCents - o.couponCents),
    regularCents: o.regularCents === null ? null : packages * o.regularCents,
    unitPriceCents: (o.priceCents - o.couponCents) / pack.quantity,
    baseUnit: pack.unit,
  };
}
export function compareBasket(
  items: GroceryItem[],
  offers: Offer[],
  settings: Settings,
) {
  const rows = items
    .filter((i) => !i.purchased)
    .map((item) => ({
      item,
      quotes: offers
        .map((o) => quote(item, o, settings.memberships))
        .filter((q): q is NonNullable<typeof q> => !!q)
        .sort((a, b) => a.costCents - b.costCents),
    }));
  const stores = [...new Set(offers.map((o) => o.store))].sort();
  const combinations: string[][] = [];
  function pick(start: number, chosen: string[]) {
    if (chosen.length) combinations.push(chosen);
    if (chosen.length === settings.maxStores) return;
    for (let i = start; i < stores.length; i++)
      pick(i + 1, [...chosen, stores[i]]);
  }
  if (stores.length <= 20) pick(0, []);
  const baskets = combinations
    .map((stores) => {
      const choices = rows.map((row) => ({
        item: row.item,
        choice: row.quotes.find((q) => stores.includes(q.offer.store)) || null,
      }));
      const missing = choices.filter((c) => !c.choice).length;
      const basketCents = choices.reduce(
        (s, c) => s + (c.choice?.costCents || 0),
        0,
      );
      const travelCents = Math.round(
        settings.extraMiles *
          settings.costPerMileCents *
          Math.max(0, stores.length - 1),
      );
      return {
        stores,
        choices,
        missing,
        basketCents,
        travelCents,
        totalCents: basketCents + travelCents,
      };
    })
    .sort((a, b) => a.missing - b.missing || a.totalCents - b.totalCents);
  return {
    rows,
    baskets: baskets.slice(0, 10),
    unpriced: rows.filter((r) => !r.quotes.length).map((r) => r.item.name),
    assumptions:
      "Exact ingredient + compatible units + standard quality only. Packages rounded up. User-entered prices are not retailer-verified. Travel uses your extra-mile assumption; no route optimization is claimed.",
  };
}
export const retailerLinks = [
  {
    name: "Ralphs / Kroger",
    url: "https://www.ralphs.com/weeklyad",
    status:
      "Official product adapter requires approved Kroger credentials and a location ID.",
  },
  {
    name: "Vons",
    url: "https://www.vons.com/weeklyad",
    status: "Retailer link and manual observations; no live feed configured.",
  },
  {
    name: "Sprouts",
    url: "https://www.sprouts.com/weekly-ad/",
    status: "Retailer link and manual observations.",
  },
  {
    name: "Trader Joe’s",
    url: "https://www.traderjoes.com/",
    status: "No authorized price feed configured.",
  },
  {
    name: "Whole Foods",
    url: "https://www.wholefoodsmarket.com/sales-flyer",
    status: "Retailer link; membership eligibility must be checked.",
  },
  {
    name: "Costco",
    url: "https://www.costco.com/",
    status: "Manual warehouse prices; membership required where applicable.",
  },
  {
    name: "Flipp",
    url: "https://corp.flipp.com/",
    status: "No assumed public API. A licensed partnership is required.",
  },
  {
    name: "Farmers markets",
    url: "https://www.glendaleca.gov/",
    status:
      "Consult official schedules; enter observed vendor prices manually.",
  },
];
