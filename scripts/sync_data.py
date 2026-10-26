import argparse
import json
import sys
import os
import subprocess
import time
from datetime import datetime, timezone, timedelta
from curl_cffi import requests
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.google.com/",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
}

def clean_float(val, fallback=None):
    if val is None:
        return fallback
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').replace('+', '').replace('%', '').strip()
    if not s or s == '-' or s == 'N/A' or s == 'null':
        return fallback
    try:
        return float(s)
    except:
        return fallback

def _try_download_page(candidate_urls: list, market_code: str, tab_slug: str):
    """One download round-trip: try every candidate URL, return (html, chosen_url) or (None, last_err).

    Strategy:
      1. Direct requests (works from residential IPs / local machines).
      2. Jina Reader HTML relay — investing.com blocks datacenter IPs (GitHub
         Actions runners get instant connection resets), but r.jina.ai returns
         the full original HTML (incl. __NEXT_DATA__ and the rendered table).
    """
    last_err = None
    for url in candidate_urls:
        try:
            cache_bust = ("&" if "?" in url else "?") + f"_t={int(time.time() * 1000)}"
            res = requests.get(
                url + cache_bust, impersonate="chrome124",
                headers=BROWSER_HEADERS, timeout=25
            )
            if res.status_code == 200 and len(res.text) > 100000:
                return res.text, url
            last_err = f"HTTP {res.status_code} len={len(res.text)} ({url})"
        except Exception as e:
            last_err = f"{e} ({url})"

    # Proxied fallback (datacenter IPs e.g. GitHub Actions)
    for url in candidate_urls:
        try:
            cache_bust = ("&" if "?" in url else "?") + f"_t={int(time.time() * 1000)}"
            res = requests.get(
                f"https://r.jina.ai/{url}{cache_bust}",
                impersonate="chrome124",
                headers={**BROWSER_HEADERS, "X-Return-Format": "html"},
                timeout=90,
            )
            if res.status_code == 200 and "__NEXT_DATA__" in res.text and "fairValueUpside" in res.text:
                return res.text, f"jina-relay({url})"
            last_err = f"relay HTTP {res.status_code} len={len(res.text)} ({url})"
        except Exception as e:
            last_err = f"relay {str(e)[:80]} ({url})"

    print(f"Error fetching page ({market_code} {tab_slug}): {last_err}")
    return None, last_err


def _page_freshness(html: str, tab_slug: str):
    """Parse __NEXT_DATA__ and return (collection, max_lastUpdateTime_str) or (None, None)."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return None, None
        page_data = json.loads(script.string)
        collection = page_data["props"]["pageProps"]["state"]["investingProRatingsStore"]["assetsCollections"][tab_slug]["_collection"]
        timestamps = [item.get("lastUpdateTime") or "" for item in collection]
        max_ts = max(timestamps) if timestamps else ""
        return collection, max_ts
    except Exception:
        return None, None


def fetch_market_stocks(country_slug: str, market_code: str, tab_slug: str, currency: str, curr_sym: str, out_filename: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching {market_code} ({tab_slug}) from Investing.com...")

    candidate_urls = []
    if country_slug == "thailand":
        candidate_urls = [
            f"https://th.investing.com/equities/thailand/most-{tab_slug}",
            f"https://www.investing.com/equities/thailand/most-{tab_slug}",
        ]
    elif country_slug in ["us", "united-states"]:
        candidate_urls = [
            f"https://th.investing.com/equities/united-states/most-{tab_slug}",
            f"https://www.investing.com/equities/united-states/most-{tab_slug}",
            f"https://www.investing.com/equities/most-{tab_slug}",
        ]
    else:
        candidate_urls = [
            f"https://th.investing.com/equities/{country_slug}/most-{tab_slug}",
            f"https://www.investing.com/equities/{country_slug}/most-{tab_slug}",
        ]

    # Investing.com's CDN randomly serves a STALE cached copy of this page
    # (~seconds to minutes old). Download several rounds and keep the copy with
    # the newest lastUpdateTime from __NEXT_DATA__ — a deterministic freshness
    # check instead of trusting a single request that may hit an old edge cache.
    max_attempts = 3
    best_html = best_collection = None
    best_ts = ""
    for attempt in range(max_attempts):
        html, err = _try_download_page(candidate_urls, market_code, tab_slug)
        if not html:
            continue
        collection, max_ts = _page_freshness(html, tab_slug)
        if collection is None:
            continue
        print(f"[{datetime.now().strftime('%H:%M:%S')}]   attempt {attempt + 1}/{max_attempts}: lastUpdateTime={max_ts}")
        if best_html is None or max_ts >= best_ts:
            best_html, best_collection, best_ts = html, collection, max_ts
        # Stop early once two rounds agree on the same newest timestamp.
        if best_ts and max_ts == best_ts and attempt >= 1:
            break
        if attempt < max_attempts - 1:
            time.sleep(0.8)

    if not best_html:
        print(f"No usable page for {market_code} {tab_slug}")
        return None

    html = best_html
    collection = best_collection
    chosen_url = f"(best freshness lastUpdateTime={best_ts})"

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Successfully downloaded {market_code} from {chosen_url}")

    soup = BeautifulSoup(html, "html.parser")

    # Resolve real symbols and company names using pd-instruments
    pair_ids = [item['id'] for item in collection]
    query = "&".join(f"instrument_ids={pid}" for pid in pair_ids)
    pd_url = f"https://endpoints.investing.com/pd-instruments/v1/instruments?{query}&domain_id=1"

    instruments = {}
    try:
        r2 = requests.get(
            pd_url,
            impersonate="chrome124",
            headers={
                "User-Agent": BROWSER_HEADERS["User-Agent"],
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://www.investing.com/",
            },
            timeout=15
        )
        if r2.status_code == 200:
            instruments = {str(item['id']): item for item in r2.json()}
    except Exception as e:
        print(f"Exception resolving pd-instruments for {market_code}: {e}")

    table_tbody = soup.find('tbody')
    table_rows = table_tbody.find_all('tr') if table_tbody else []

    merged_stocks = []
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()

    for i, item in enumerate(collection):
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

        rendered_price = clean_float(rendered_row[1]) if len(rendered_row) > 1 else None
        price_val = rendered_price if rendered_price is not None else clean_float(item.get('last'), 0.0)

        rendered_upside = clean_float(rendered_row[2]) if len(rendered_row) > 2 else None
        upside_val = rendered_upside if rendered_upside is not None else clean_float(item.get('fairValueUpside'), 0.0)

        rendered_fv = clean_float(rendered_row[3]) if len(rendered_row) > 3 else None
        fair_val = rendered_fv if rendered_fv is not None else clean_float(item.get('fairValue'), 0.0)

        health = rendered_row[4] if len(rendered_row) > 4 and rendered_row[4] else (item.get('financialHealth') or 'Good')
        cf_health = rendered_row[5] if len(rendered_row) > 5 and rendered_row[5] else (item.get('financialCashFlowHealth') or '-')
        growth_health = rendered_row[6] if len(rendered_row) > 6 and rendered_row[6] else (item.get('financialGrowthHealth') or '-')
        profit_health = rendered_row[7] if len(rendered_row) > 7 and rendered_row[7] else (item.get('financialProfitabilityHealth') or '-')
        analyst = rendered_row[8] if len(rendered_row) > 8 and rendered_row[8] else (item.get('analystRatings') or '-')

        pe_val = clean_float(rendered_row[9]) if len(rendered_row) > 9 else clean_float(item.get('peRatio'))
        ev_val = clean_float(rendered_row[10]) if len(rendered_row) > 10 else clean_float(item.get('evEbitda'))

        mcap_fmt = rendered_row[11] if len(rendered_row) > 11 and rendered_row[11] else (f"{float(item.get('marketCap') or 0)/1e9:.2f}B")
        eps_val = clean_float(rendered_row[12]) if len(rendered_row) > 12 else clean_float(item.get('epsGrowth5y'))

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
            "valuationType": tab_slug,
            "lastUpdateTime": now_iso
        }
        merged_stocks.append(stock_entry)

    out_path = os.path.join(BASE_DIR, out_filename)
    with open(out_path, "w", encoding="utf-8") as out_f:
        json.dump(merged_stocks, out_f, indent=2, ensure_ascii=False)

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Successfully saved {len(merged_stocks)} {tab_slug} stocks to {out_filename}")
    return len(merged_stocks)

def git_commit_and_push():
    print("[Git] Staging live stock data and pushing to origin main...")
    try:
        subprocess.run(["git", "add", "thailand_stocks_unmasked.json", "thailand_stocks_overvalued.json", "undervalued_stocks_unmasked.json", "us_stocks_overvalued.json", "sync_status.json"], cwd=BASE_DIR, check=True)
        # Check if there are changes to commit
        diff = subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=BASE_DIR)
        if diff.returncode != 0:
            commit_msg = f"chore(sync): automated live stock data update {datetime.now(timezone(timedelta(hours=7))).strftime('%Y-%m-%d %H:%M')}"
            subprocess.run(["git", "commit", "-m", commit_msg], cwd=BASE_DIR, check=True)
            subprocess.run(["git", "push", "origin", "main"], cwd=BASE_DIR, check=True)
            print("[Git] Successfully pushed updated data to GitHub origin main.")
        else:
            print("[Git] No file changes to commit.")
    except Exception as e:
        print(f"[Git Error] Failed to push to GitHub: {e}")

def main():
    parser = argparse.ArgumentParser(description="Sync Investing.com Undervalued & Overvalued stocks")
    parser.add_argument("--market", default="ALL", choices=["SET", "US", "ALL"], help="Market to sync")
    parser.add_argument("--type", default="ALL", choices=["undervalued", "overvalued", "ALL"], help="Valuation type")
    parser.add_argument("--push", action="store_true", help="Auto commit and push updated JSON to GitHub")
    args = parser.parse_args()

    results = {}
    
    # 1. SET Undervalued
    if args.market in ["SET", "ALL"] and args.type in ["undervalued", "ALL"]:
        count_set_uv = fetch_market_stocks("thailand", "SET", "undervalued", "THB", "฿", "thailand_stocks_unmasked.json")
        results["SET_undervalued"] = count_set_uv

    # 2. SET Overvalued
    if args.market in ["SET", "ALL"] and args.type in ["overvalued", "ALL"]:
        count_set_ov = fetch_market_stocks("thailand", "SET", "overvalued", "THB", "฿", "thailand_stocks_overvalued.json")
        results["SET_overvalued"] = count_set_ov

    # 3. US Undervalued
    if args.market in ["US", "ALL"] and args.type in ["undervalued", "ALL"]:
        count_us_uv = fetch_market_stocks("united-states", "US", "undervalued", "USD", "$", "undervalued_stocks_unmasked.json")
        results["US_undervalued"] = count_us_uv

    # 4. US Overvalued
    if args.market in ["US", "ALL"] and args.type in ["overvalued", "ALL"]:
        count_us_ov = fetch_market_stocks("united-states", "US", "overvalued", "USD", "$", "us_stocks_overvalued.json")
        results["US_overvalued"] = count_us_ov

    valid_counts = [v for v in results.values() if v is not None and v > 0]
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()

    if not valid_counts:
        print(f"[Sync Failed] No stock data could be scraped from Investing.com at {now_iso}.")
        # Do not overwrite sync_status.json with success when 0 stocks were scraped
        sys.exit(1)

    # Update metadata
    status_data = {
        "lastSync": now_iso,
        "results": results,
        "status": "success" if len(valid_counts) == len(results) else "partial"
    }
    status_path = os.path.join(BASE_DIR, "sync_status.json")
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2)

    print(f"Sync complete at {now_iso}: {results}")

    if args.push:
        git_commit_and_push()

if __name__ == "__main__":
    main()
