# Reorder planner

I run TinyFab 3D in Canberra. Filament comes by sea from China, about a month and a half. If I order when a colour is already low, it sits out of stock for weeks while the boat is still out.

This is the list for the next order. It reads the Shopify shop, or a sample file if I have not put a token in. It does not place the order.

## What it does

For each colour it works out how fast it has been selling, how many days of stock are left, when it is likely to hit zero, and how many spools to put on the boat. The default lead time is 45 days. The order is meant to last that, plus the time until I order again (also 45 days unless I change it). Quantities round up to a full box. I can cap the spend. Colours that run out sooner go on the list first.

The sample uses the real colours, SKUs and shelf prices from [tinyfab3d.com.au](https://tinyfab3d.com.au): TinyFab PLA Basic 1.75mm 1kg at $16.49 (14 colours), TinyFab PLA Matte 1.75mm 1kg at $17.99 (7), TinyFab PETG Basic 1.75mm 1kg at $15.99 (12), and the Essential Starter Pack at $39.90. Stock levels and every order in that file are made up. They are not my sales. The live starter pack variants have no SKU, so the sample uses one line, `TF-PACK-ESSENTIAL`.

## Run it

Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no token it uses the sample. To read the live shop, copy `.env.example` to `.env` and set `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_TOKEN`. The token only needs `read_products`, `read_inventory` and `read_orders`.

`npm test` runs the checks.

Box size for a live colour goes in `data/sku-policies.json` (there is an example next to it). Colours with no entry use the minimum and box size on the form, which start at 1. In the sample, spools round up to boxes of 10. That is my ordering habit, not a number from the supplier's site.

## Limits

- The sample has shelf prices and no factory cost, so the order has no dollar total. A spend limit does nothing until costs are filled in. On the live shop, cost only comes through if the token is allowed to see it.
- Stock already on the water has a quantity and no date, so I assume it lands with the lead time.
- A variant with no SKU is skipped.
- If the shop has more pages than this build will read, it stops and says so. It does not quietly drop colours or orders.
- The sales guess is a recent average, a weekday pattern and a straight trend. It is for planning, not a promise of what will sell.

## TODO

- Put real factory costs on the variants so the order has a dollar total.
- Arrival dates for stock already on a boat.
- Carton size as a metafield, instead of `data/sku-policies.json`.
- Send the list back to Shopify as a draft purchase order, once I trust the quantities.
