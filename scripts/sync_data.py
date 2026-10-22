import argparse
import json
import sys
import os
from datetime import datetime, timezone, timedelta
from curl_cffi import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def fetch_market_stocks(country_id: int, market_code: str, currency: str, curr_sym: str, out_filename: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching {market_code} (Country ID: {country_id})...")
    finbox_url = f"https://endpoints.investing.com/finbox/v2/fair-value/top/undervalued?country_id={country_id}&limit=30"
    
    try:
        r = requests.get(finbox_url, headers={"domain-id": "1"}, impersonate="chrome124", timeout=15)
        if r.status_code != 200:
            print(f"Error fetching Finbox ({market_code}): HTTP {r.status_code} - {r.text[:200]}")
            return None
        items = r.json().get("items", [])
    except Exception as e:
        print(f"Exception fetching Finbox ({market_code}): {e}")
        return None

    if not items:
        print(f"No items returned for {market_code}")
        return None

    # Resolve instrument IDs
    pair_ids = [item["instrument_id"] for item in items if "instrument_id" in item]
    query = "&".join(f"instrument_ids={pid}" for pid in pair_ids)
    pd_url = f"https://endpoints.investing.com/pd-instruments/v1/instruments?{query}&domain_id=1"

    try:
        r2 = requests.get(pd_url, impersonate="chrome124", timeout=15)
        if r2.status_code != 200:
            print(f"Error fetching pd-instruments ({market_code}): HTTP {r2.status_code}")
            instruments_data = {}
        else:
            instruments_data = {str(item["id"]): item for item in r2.json()}
    except Exception as e:
        print(f"Exception fetching pd-instruments ({market_code}): {e}")
        instruments_data = {}

    merged_stocks = []
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()

    for stock in items:
        pid = str(stock.get("instrument_id"))
        inst = instruments_data.get(pid, {})
        metrics = stock.get("metrics", {})
        health = metrics.get("financial_health", {})
        price_info = stock.get("price", {})

        real_symbol = inst.get("symbol", stock.get("symbol", f"ID-{pid}"))
        real_name = inst.get("long_name", stock.get("long_name", real_symbol))
        real_short_name = inst.get("short_name", stock.get("short_name", real_symbol))
        link = inst.get("link", stock.get("link", "#"))

        last_price = price_info.get("last", inst.get("price", {}).get("last", 0))
        fair_value = metrics.get("fair_value")
        fair_value_upside = metrics.get("fair_value_upside")

        if fair_value_upside is not None:
            upside_pct = round(fair_value_upside * 100, 2)
        elif fair_value and last_price and last_price > 0:
            upside_pct = round(((fair_value - last_price) / last_price) * 100, 2)
        else:
            upside_pct = 0.0

        mcap = metrics.get("market_cap")
        if mcap:
            if mcap >= 1e12:
                mcap_fmt = f"{curr_sym}{mcap / 1e12:.2f}T"
            elif mcap >= 1e9:
                mcap_fmt = f"{curr_sym}{mcap / 1e9:.2f}B"
            elif mcap >= 1e6:
                mcap_fmt = f"{curr_sym}{mcap / 1e6:.2f}M"
            else:
                mcap_fmt = f"{curr_sym}{mcap:,.0f}"
        else:
            mcap_fmt = "N/A"

        change_pct = inst.get("price", {}).get("change_percent", 0.0)

        merged_item = {
            "id": pid,
            "symbol": real_symbol,
            "name": real_name,
            "shortName": real_short_name,
            "link": f"https://www.investing.com{link}" if link.startswith('/') else link,
            "price": float(last_price) if last_price else 0.0,
            "currency": currency,
            "currencySymbol": curr_sym,
            "fairValue": round(float(fair_value), 2) if fair_value is not None else None,
            "fairValueUpside": float(upside_pct),
            "peRatio": round(float(metrics.get("pe_ratio", 0)), 2) if metrics.get("pe_ratio") is not None else None,
            "evEbitda": round(float(metrics.get("ev_to_ebitda", 0)), 2) if metrics.get("ev_to_ebitda") is not None else None,
            "marketCap": mcap,
            "marketCapFormatted": mcap_fmt,
            "epsGrowth5y": round(float(metrics.get("eps_growth_5y", 0)) * 100, 2) if metrics.get("eps_growth_5y") is not None else None,
            "changeOneDayPercent": round(float(change_pct), 2) if change_pct is not None else 0.0,
            "financialHealth": health.get("overall", "GOOD"),
            "financialCashFlowHealth": health.get("cash_flow"),
            "financialGrowthHealth": health.get("growth"),
            "financialProfitabilityHealth": health.get("profitability"),
            "analystRatings": metrics.get("consensus_recommendation", "NEUTRAL"),
            "flagCode": "TH" if market_code == "SET" else "US",
            "flagName": "Thailand" if market_code == "SET" else "United States",
            "market": market_code,
            "lastUpdateTime": now_iso
        }
        merged_stocks.append(merged_item)

    out_path = os.path.join(BASE_DIR, out_filename)
    with open(out_path, "w", encoding="utf-8") as out_f:
        json.dump(merged_stocks, out_f, indent=2, ensure_ascii=False)

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(merged_stocks)} stocks to {out_filename}")
    return len(merged_stocks)

def main():
    parser = argparse.ArgumentParser(description="Sync Investing.com Undervalued stocks")
    parser.add_argument("--market", default="ALL", choices=["SET", "US", "ALL"], help="Market to sync")
    args = parser.parse_args()

    results = {}
    if args.market in ["SET", "ALL"]:
        count_set = fetch_market_stocks(41, "SET", "THB", "฿", "thailand_stocks_unmasked.json")
        results["SET"] = count_set

    if args.market in ["US", "ALL"]:
        count_us = fetch_market_stocks(14, "US", "USD", "$", "undervalued_stocks_unmasked.json")
        results["US"] = count_us

    # Update metadata
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()
    status_data = {
        "lastSync": now_iso,
        "results": results,
        "status": "success"
    }
    status_path = os.path.join(BASE_DIR, "sync_status.json")
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2)

    print(f"Sync complete at {now_iso}: {results}")

if __name__ == "__main__":
    main()
