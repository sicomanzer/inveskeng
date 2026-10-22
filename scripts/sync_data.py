import argparse
import json
import sys
import os
from datetime import datetime, timezone, timedelta
from curl_cffi import requests
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def fetch_market_stocks(country_slug: str, market_code: str, currency: str, curr_sym: str, out_filename: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching {market_code} from Investing.com ({country_slug})...")
    url = f"https://www.investing.com/equities/{country_slug}/most-undervalued" if country_slug != "us" else "https://www.investing.com/equities/most-undervalued"
    
    try:
        r = requests.get(url, impersonate="chrome124", timeout=20)
        if r.status_code != 200:
            print(f"Error fetching page ({market_code}): HTTP {r.status_code}")
            return None
    except Exception as e:
        print(f"Exception fetching page ({market_code}): {e}")
        return None

    soup = BeautifulSoup(r.text, 'html.parser')
    script = soup.find('script', id='__NEXT_DATA__')
    if not script:
        print(f"No __NEXT_DATA__ found for {market_code}")
        return None

    try:
        page_data = json.loads(script.string)
        undervalued = page_data['props']['pageProps']['state']['investingProRatingsStore']['assetsCollections']['undervalued']['_collection']
    except Exception as e:
        print(f"Failed to parse __NEXT_DATA__ for {market_code}: {e}")
        return None

    # Resolve real symbols and company names using pd-instruments
    pair_ids = [item['id'] for item in undervalued]
    query = "&".join(f"instrument_ids={pid}" for pid in pair_ids)
    pd_url = f"https://endpoints.investing.com/pd-instruments/v1/instruments?{query}&domain_id=1"
    
    try:
        r2 = requests.get(pd_url, impersonate="chrome124", timeout=15)
        instruments = {str(item['id']): item for item in r2.json()} if r2.status_code == 200 else {}
    except Exception as e:
        print(f"Exception resolving pd-instruments for {market_code}: {e}")
        instruments = {}

    table_tbody = soup.find('tbody')
    table_rows = table_tbody.find_all('tr') if table_tbody else []

    merged_stocks = []
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()

    for i, item in enumerate(undervalued):
        pid = str(item['id'])
        inst = instruments.get(pid, {})
        real_symbol = inst.get('symbol', item.get('symbol', f"ID-{pid}"))
        real_name = inst.get('long_name', item.get('name', real_symbol))
        real_short_name = inst.get('short_name', item.get('shortName', real_symbol))
        link = inst.get('link', item.get('url', '#'))
        if link.startswith('/'):
            link = f"https://www.investing.com{link}"

        # Get exact rendered values from the source website table cells
        rendered_row = [td.get_text(strip=True) for td in table_rows[i].find_all('td')] if i < len(table_rows) else []

        try:
            price_val = float(rendered_row[1]) if len(rendered_row) > 1 and rendered_row[1] else float(item.get('last') or 0.0)
        except:
            price_val = float(item.get('last') or 0.0)

        upside_str = rendered_row[2] if len(rendered_row) > 2 else f"+{item.get('fairValueUpside', 0):.2f}%"
        try:
            upside_val = float(upside_str.replace('+', '').replace('%', '').strip()) if upside_str else 0.0
        except:
            upside_val = float(item.get('fairValueUpside') or 0.0)

        try:
            fair_val = float(rendered_row[3]) if len(rendered_row) > 3 and rendered_row[3] else float(item.get('fairValue') or 0.0)
        except:
            fair_val = float(item.get('fairValue') or 0.0)

        health = rendered_row[4] if len(rendered_row) > 4 and rendered_row[4] else (item.get('financialHealth') or 'Good')
        cf_health = rendered_row[5] if len(rendered_row) > 5 and rendered_row[5] else (item.get('financialCashFlowHealth') or '-')
        growth_health = rendered_row[6] if len(rendered_row) > 6 and rendered_row[6] else (item.get('financialGrowthHealth') or '-')
        profit_health = rendered_row[7] if len(rendered_row) > 7 and rendered_row[7] else (item.get('financialProfitabilityHealth') or '-')
        analyst = rendered_row[8] if len(rendered_row) > 8 and rendered_row[8] else (item.get('analystRatings') or '-')

        pe_str = rendered_row[9] if len(rendered_row) > 9 else ''
        try:
            pe_val = float(pe_str) if pe_str else None
        except:
            pe_val = None

        ev_str = rendered_row[10] if len(rendered_row) > 10 else ''
        try:
            ev_val = float(ev_str) if ev_str else None
        except:
            ev_val = None

        mcap_fmt = rendered_row[11] if len(rendered_row) > 11 and rendered_row[11] else (f"{item.get('marketCap', 0)/1e9:.2f}B")

        eps_str = rendered_row[12] if len(rendered_row) > 12 else ''
        try:
            eps_val = float(eps_str) if eps_str else None
        except:
            eps_val = None

        stock_entry = {
            "id": pid,
            "symbol": real_symbol,
            "name": real_name,
            "shortName": real_short_name,
            "link": link,
            "price": price_val,
            "currency": currency,
            "currencySymbol": curr_sym,
            "fairValue": fair_val,
            "fairValueUpside": upside_val,
            "peRatio": pe_val,
            "evEbitda": ev_val,
            "marketCap": item.get('marketCap'),
            "marketCapFormatted": mcap_fmt,
            "epsGrowth5y": eps_val,
            "changeOneDayPercent": float(item.get('changeOneDayPercent') or 0.0),
            "financialHealth": health,
            "financialCashFlowHealth": cf_health,
            "financialGrowthHealth": growth_health,
            "financialProfitabilityHealth": profit_health,
            "analystRatings": analyst,
            "flagCode": "TH" if market_code == "SET" else "US",
            "flagName": "Thailand" if market_code == "SET" else "United States",
            "market": market_code,
            "lastUpdateTime": now_iso
        }
        merged_stocks.append(stock_entry)

    out_path = os.path.join(BASE_DIR, out_filename)
    with open(out_path, "w", encoding="utf-8") as out_f:
        json.dump(merged_stocks, out_f, indent=2, ensure_ascii=False)

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(merged_stocks)} exact stocks to {out_filename}")
    return len(merged_stocks)

def main():
    parser = argparse.ArgumentParser(description="Sync Investing.com Undervalued stocks with exact matching rows")
    parser.add_argument("--market", default="ALL", choices=["SET", "US", "ALL"], help="Market to sync")
    args = parser.parse_args()

    results = {}
    if args.market in ["SET", "ALL"]:
        count_set = fetch_market_stocks("thailand", "SET", "THB", "฿", "thailand_stocks_unmasked.json")
        results["SET"] = count_set

    if args.market in ["US", "ALL"]:
        count_us = fetch_market_stocks("us", "US", "USD", "$", "undervalued_stocks_unmasked.json")
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
