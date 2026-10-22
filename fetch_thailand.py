from curl_cffi import requests
import json

# 1. Fetch Thailand Undervalued stocks from Finbox API (country_id = 41)
finbox_url = "https://endpoints.investing.com/finbox/v2/fair-value/top/undervalued?country_id=41&limit=30"
r = requests.get(finbox_url, headers={"domain-id": "1"}, impersonate="chrome124")

if r.status_code != 200:
    print(f"Error fetching finbox: {r.status_code} {r.text}")
    exit(1)

items = r.json().get("items", [])
print(f"Fetched {len(items)} Thailand stocks from Finbox API")

# 2. Extract instrument_ids and query pd-instruments API
pair_ids = [item["instrument_id"] for item in items]
query = "&".join(f"instrument_ids={pid}" for pid in pair_ids)
pd_url = f"https://endpoints.investing.com/pd-instruments/v1/instruments?{query}&domain_id=1"

r2 = requests.get(pd_url, impersonate="chrome124")
if r2.status_code != 200:
    print(f"Error fetching pd-instruments: {r2.status_code} {r2.text}")
    exit(1)

instruments_data = {str(item["id"]): item for item in r2.json()}
print(f"Resolved {len(instruments_data)} instrument profiles from pd-instruments")

# 3. Merge data
merged_stocks = []
print(f"{'#':<2} | {'Symbol':<8} | {'Price (THB)':<11} | {'Fair Value':<10} | {'Upside %':<9} | {'Health':<6} | {'Company Name'}")
print("-" * 90)

for i, stock in enumerate(items):
    pid = str(stock["instrument_id"])
    inst = instruments_data.get(pid, {})
    metrics = stock.get("metrics", {})
    health = metrics.get("financial_health", {})
    price_info = stock.get("price", {})
    
    real_symbol = inst.get("symbol", stock.get("symbol"))
    real_name = inst.get("long_name", stock.get("long_name"))
    real_short_name = inst.get("short_name", stock.get("short_name"))
    link = inst.get("link", stock.get("link", "#"))
    
    last_price = price_info.get("last", inst.get("price", {}).get("last", 0))
    fair_value = metrics.get("fair_value")
    fair_value_upside = metrics.get("fair_value_upside")
    if fair_value_upside is not None:
        upside_pct = round(fair_value_upside * 100, 2)
    elif fair_value and last_price:
        upside_pct = round(((fair_value - last_price) / last_price) * 100, 2)
    else:
        upside_pct = 0.0

    mcap = metrics.get("market_cap")
    if mcap:
        if mcap >= 1e12:
            mcap_fmt = f"฿{mcap / 1e12:.2f}T"
        elif mcap >= 1e9:
            mcap_fmt = f"฿{mcap / 1e9:.2f}B"
        elif mcap >= 1e6:
            mcap_fmt = f"฿{mcap / 1e6:.2f}M"
        else:
            mcap_fmt = f"฿{mcap}"
    else:
        mcap_fmt = "N/A"

    change_pct = inst.get("price", {}).get("change_percent", 0.0)

    merged_item = {
        "id": pid,
        "symbol": real_symbol,
        "name": real_name,
        "shortName": real_short_name,
        "link": f"https://www.investing.com{link}" if link.startswith('/') else link,
        "price": last_price,
        "currency": "THB",
        "currencySymbol": "฿",
        "fairValue": round(fair_value, 2) if fair_value else None,
        "fairValueUpside": upside_pct,
        "peRatio": round(metrics.get("pe_ratio", 0), 2) if metrics.get("pe_ratio") else None,
        "evEbitda": round(metrics.get("ev_to_ebitda", 0), 2) if metrics.get("ev_to_ebitda") else None,
        "marketCap": mcap,
        "marketCapFormatted": mcap_fmt,
        "epsGrowth5y": round(metrics.get("eps_growth_5y", 0) * 100, 2) if metrics.get("eps_growth_5y") is not None else None,
        "changeOneDayPercent": round(change_pct, 2) if change_pct is not None else 0.0,
        "financialHealth": health.get("overall", "GOOD"),
        "financialCashFlowHealth": health.get("cash_flow"),
        "financialGrowthHealth": health.get("growth"),
        "financialProfitabilityHealth": health.get("profitability"),
        "analystRatings": metrics.get("consensus_recommendation", "NEUTRAL"),
        "flagCode": "TH",
        "flagName": "Thailand",
        "market": "SET"
    }
    merged_stocks.append(merged_item)
    print(f"{i+1:2d} | {real_symbol:<8} | ฿{last_price:<10} | ฿{str(merged_item['fairValue']):<9} | +{upside_pct}% | {merged_item['financialHealth']:<6} | {real_name}")

with open("e:/gg/REA/thailand_stocks_unmasked.json", "w", encoding="utf-8") as out_f:
    json.dump(merged_stocks, out_f, indent=2, ensure_ascii=False)

print(f"\nSaved {len(merged_stocks)} Thailand unmasked stocks to e:/gg/REA/thailand_stocks_unmasked.json")
