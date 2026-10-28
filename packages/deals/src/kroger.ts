import { randomUUID } from "node:crypto";
import { fetchJSON, type Vault } from "../../ai/src/providers.ts";
import { type HearthDB, AppError } from "../../database/src/index.ts";
import { OfferInput } from "../../shared/src/index.ts";
// Opt-in official API adapter. Requires a Kroger developer application with
// product.compact scope and store-location access. Never scrape retailer pages.
export async function scanKroger(db: HearthDB, vault: Vault, week: string) {
  const settings = db.settings();
  if (
    !vault.has("krogerClientId") ||
    !vault.has("krogerSecret") ||
    !settings.krogerLocationId
  )
    throw new AppError(
      400,
      "Kroger is not configured. Add approved developer credentials and a store location ID, or enter observed prices manually.",
    );
  const auth = await fetchJSON(
    "https://api.kroger.com/v1/connect/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            vault.get("krogerClientId") + ":" + vault.get("krogerSecret"),
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=product.compact",
    },
  );
  if (typeof auth.access_token !== "string")
    throw new AppError(502, "Kroger did not issue an access token.");
  const groceries = db
    .groceries(week)
    .filter((i) => !i.purchased)
    .slice(0, 30);
  let matched = 0;
  const unmatched: string[] = [];
  for (const item of groceries) {
    const params = new URLSearchParams({
      "filter.term": item.name,
      "filter.locationId": settings.krogerLocationId,
      "filter.limit": "5",
    });
    const result = await fetchJSON(
      "https://api.kroger.com/v1/products?" + params,
      { headers: { Authorization: "Bearer " + auth.access_token } },
    );
    // Product search is not a canonical ingredient match. Candidates are returned
    // for explicit human review before they enter price comparisons.
    const candidates = (result.data || []).flatMap((p: any) =>
      (p.items || [])
        .filter((i: any) => i.price)
        .map((i: any) => ({
          ingredient: item.name,
          product: p.description,
          productId: p.productId,
          size: i.size,
          regular: i.price.regular,
          promo: i.price.promo,
          locationId: settings.krogerLocationId,
          sourceUrl: "https://www.kroger.com/p/" + p.productId,
          retrievedAt: new Date().toISOString(),
        })),
    );
    if (candidates.length) {
      matched += candidates.length;
      db.notify(
        "Kroger candidates need review",
        JSON.stringify({ ingredient: item.name, candidates }).slice(0, 10000),
      );
    } else unmatched.push(item.name);
  }
  return {
    matched,
    unmatched,
    message:
      "Candidates are saved to notifications for review. Package size, quality, loyalty eligibility and expiry must be confirmed before manually adding an observation. Product search results are not automatically treated as compatible offers.",
  };
}
