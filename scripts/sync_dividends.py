#!/usr/bin/env python3
"""Sync the "หุ้นปันผล" (dividend) screener.

แหล่งรายชื่อ: Investing.com Stock Screener (saved screen ของผู้ใช้)
    div_yield > 5%  AND  div_yield_avg_5y > 5%  (ตลาดไทย, primary only)
    เรียงตาม market cap มาก->น้อย, เอา 30 ตัวแรก

ตัวเลขปันผล (DPS รายปี / yield ปัจจุบัน / เฉลี่ย 5 ปี) คำนวณจาก yfinance
เพราะ Investing.com ไม่ส่งค่า metric ของแถวออกมาให้ guest (คอลัมน์ Pro)

ไฟล์ผลลัพธ์: dividend_stocks.json
"""

import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

from bs4 import BeautifulSoup
from curl_cffi import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = "dividend_stocks.json"
DPS_CACHE_FILE = "dividend_dps_cache.json"

TH_TZ = timezone(timedelta(hours=7))

# โครงสร้าง ssid ของ screener (v2$ + base64 ของ {keys, values})
SSID_KEYS = [
    "connective",
    "limit",
    "prefilters.market",
    "prefilters.primaryOnly",
    "sort.direction",
    "sort.metric",
    "filters.0.gt.inclusive",
    "filters.0.gt.scale",
    "filters.0.gt.value",
    "filters.0.metric",
    "filters.1.gt.inclusive",
    "filters.1.gt.scale",
    "filters.1.gt.value",
    "filters.1.metric",
]
SSID_VALUES = [
    "ALL",
    30,
    "TH",
    True,
    "DESC",
    "marketcap_adj_latest",
    True,
    1,
    0.05,
    "div_yield",
    True,
    1,
    0.05,
    "div_yield_avg_5y",
]

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
}


def now_iso():
    return datetime.now(TH_TZ).isoformat()


def build_screener_url(limit=30):
    payload = {"keys": SSID_KEYS, "values": list(SSID_VALUES)}
    payload["values"][1] = limit
    ssid = "v2$" + base64.b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()
    return "https://th.investing.com/stock-screener?ssid=" + quote(ssid, safe="")


def fetch_screener_html(limit=30):
    """ดึงหน้า screener: direct (retry) -> relay r.jina.ai (X-Timeout ให้ผ่าน Cloudflare)"""
    url = build_screener_url(limit)
    candidates = [url, url.replace("th.investing.com", "www.investing.com")]
    last_err = None

    for attempt in range(4):
        for cand in candidates:
            try:
                res = requests.get(
                    cand + "&_t=%d" % int(time.time() * 1000),
                    impersonate="chrome124",
                    headers=BROWSER_HEADERS,
                    timeout=30,
                )
                if res.status_code == 200 and "__NEXT_DATA__" in res.text:
                    return res.text, f"direct({cand.split('/')[2]})"
                last_err = f"HTTP {res.status_code} len={len(res.text)}"
            except Exception as e:  # noqa: BLE001
                last_err = f"{type(e).__name__}: {str(e)[:80]}"
        if attempt < 3:
            time.sleep(0.8 + attempt * 0.8)

    print(f"[screener] direct failed ({last_err}) — trying relay")
    relay_headers = {**BROWSER_HEADERS, "X-Return-Format": "html", "X-Timeout": "40"}
    for attempt in range(3):
        try:
            res = requests.get(
                "https://r.jina.ai/" + url,
                impersonate="chrome124",
                headers=relay_headers,
                timeout=120,
            )
            if res.status_code == 200 and "__NEXT_DATA__" in res.text:
                return res.text, "jina-relay"
            last_err = f"relay HTTP {res.status_code} len={len(res.text)}"
        except Exception as e:  # noqa: BLE001
            last_err = f"relay {type(e).__name__}: {str(e)[:80]}"
        time.sleep(2 + attempt * 4)

    print(f"[screener] relay failed ({last_err})")
    return None, last_err


def parse_screener(html):
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        raise ValueError("no __NEXT_DATA__")
    data = json.loads(script.string)
    store = data["props"]["pageProps"]["state"]["stockScreenerStore"]
    columns = [c["metric"] for c in store["results"]["columns"]]
    items = []
    for row in store["results"]["rows"]:
        asset = row.get("asset") or {}
        cells = {}
        for metric, cell in zip(columns, row.get("data") or []):
            if isinstance(cell, dict) and not cell.get("hidden"):
                cells[metric] = cell.get("raw", cell.get("value"))
        items.append(
            {
                "symbol": asset.get("ticker"),
                "name": asset.get("name"),
                "pairId": asset.get("pairID"),
                "path": asset.get("path"),
                "sector": asset.get("sector"),
                "industry": cells.get("investing_industry"),
                "sourcePrice": cells.get("asset_price_latest"),
                "sourceChangePercent": (
                    round(float(cells["asset_price_latest_change_pct"]) * 100, 2)
                    if isinstance(cells.get("asset_price_latest_change_pct"), (int, float))
                    else None
                ),
                "marketCap": cells.get("marketcap_adj_latest"),
                "peRatio": (round(float(cells["pe_ltm_latest"]), 2)
                            if isinstance(cells.get("pe_ltm_latest"), (int, float)) else None),
                "pegRatio": (round(float(cells["peg_ltm"]), 2)
                             if isinstance(cells.get("peg_ltm"), (int, float)) else None),
                "currency": "THB",
            }
        )
    return {
        "items": items,
        "totalMatches": store.get("paginationTotal"),
        "market": store.get("market"),
    }


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return default


def save_json(path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1, ensure_ascii=False)


def yf_symbol(symbol):
    return f"{symbol}.BK"


def refresh_dps_cache(symbols, cache, max_age_days=7):
    """รายการปันผลที่จ่ายจริง (วัน ex-date + จำนวน) — cache 7 วัน"""
    import yfinance as yf

    now = datetime.now(timezone.utc)
    updated = 0
    for sym in symbols:
        entry = cache.get(sym) or {}
        fetched = entry.get("fetchedAt")
        if fetched:
            try:
                age = (now - datetime.fromisoformat(fetched)).days
                if age < max_age_days and entry.get("payments"):
                    continue
            except Exception:  # noqa: BLE001
                pass
        try:
            divs = yf.Ticker(yf_symbol(sym)).dividends
            payments = [
                [ts.strftime("%Y-%m-%d"), round(float(amount), 6)]
                for ts, amount in divs.items()
                if float(amount) > 0
            ]
            cache[sym] = {"payments": payments, "fetchedAt": now.isoformat()}
            updated += 1
        except Exception as e:  # noqa: BLE001
            print(f"[dividends] {sym}: {type(e).__name__}: {str(e)[:70]}")
    if updated:
        print(f"[dividends] refreshed DPS for {updated} symbols")
    return cache


def fetch_price_history(symbols):
    """คืน {symbol: {"price": float, "prevClose": float, "yearEndClose": {year: close}}}"""
    import pandas as pd
    import yfinance as yf

    tickers = [yf_symbol(s) for s in symbols]
    out = {}

    daily = yf.download(tickers, period="7d", interval="1d", progress=False,
                        auto_adjust=False, threads=True, group_by="ticker")
    monthly = yf.download(tickers, period="8y", interval="1mo", progress=False,
                          auto_adjust=False, threads=True, group_by="ticker")

    def series_for(df, ticker):
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            if ticker not in df.columns.get_level_values(0):
                return None
            sub = df[ticker]
        else:
            sub = df
        return sub["Close"].dropna() if "Close" in sub else None

    for sym in symbols:
        ticker = yf_symbol(sym)
        d = series_for(daily, ticker)
        m = series_for(monthly, ticker)
        price = float(d.iloc[-1]) if d is not None and len(d) else None
        prev = float(d.iloc[-2]) if d is not None and len(d) > 1 else None
        year_end = {}
        if m is not None and len(m):
            for ts, close in m.items():
                year_end[str(ts.year)] = float(close)
        if price:
            out[sym] = {"price": round(price, 2), "prevClose": prev, "yearEndClose": year_end}
    return out


def compute_metrics(symbol, price_info, dps_entry):
    """divYield = ปันผลรวม 12 เดือนย้อนหลัง (ตามวัน ex-date) / ราคา
    avg5y = เฉลี่ย yield ของ 5 ปีปฏิทินล่าสุด (DPS ปีนั้น / ราคาปิดสิ้นปี)"""
    payments = [[d, float(a)] for d, a in ((dps_entry or {}).get("payments") or [])]
    price = price_info.get("price")
    year_end = price_info.get("yearEndClose") or {}

    by_year = {}
    for date_str, amount in payments:
        by_year[date_str[:4]] = round(by_year.get(date_str[:4], 0.0) + amount, 6)

    today = datetime.now(TH_TZ).date()
    cutoff = today.replace(year=today.year - 1)
    ttm = round(sum(a for d, a in payments if datetime.strptime(d, "%Y-%m-%d").date() > cutoff), 4)

    current_year = today.year
    last5 = [str(y) for y in range(current_year - 5, current_year)]
    available = [y for y in last5 if y in year_end and by_year.get(y)]
    yields = []
    for y in available:
        close = year_end[y]
        if close:
            yields.append(by_year[y] / close * 100)
    avg5y = round(sum(yields) / len(yields), 2) if yields else None

    div_yield = round(ttm / price * 100, 2) if (ttm and price) else None

    # D0 = ปันผลทั้งปีของ "ปีชำระ" ที่ปิดแล้ว (1 ก.ค. ปีก่อน – 30 มิ.ย. ปีนี้)
    # ใช้ค่าเดียวกับป้าย D0 ใน popup (lib/stock-detail.ts)
    fy_start = f"{current_year - 1}-07-01"
    fy_end = f"{current_year}-06-30"
    prev_fy = round(sum(a for d, a in payments if fy_start <= d <= fy_end), 4)
    recent_payments = [
        {"date": d, "amount": round(a, 4)}
        for d, a in sorted(payments)
        if d >= f"{current_year - 6}-01-01"
    ]

    return {
        "divYield": div_yield,
        "avgYield5y": avg5y,
        "dpsLastYear": ttm or None,
        "dpsPrevFY": prev_fy or None,
        "divPayments": recent_payments,
        "dpsByYear": {y: by_year[y] for y in sorted(by_year, reverse=True)[:6]},
        "yieldYearsUsed": available,
    }


def main():
    parser = argparse.ArgumentParser(description="Sync dividend screener (หุ้นปันผล)")
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--offline", action="store_true", help="ไม่อัปเดตรายชื่อจาก Investing.com")
    parser.add_argument("--push", action="store_true", help="commit + push ไฟล์ข้อมูลขึ้น GitHub")
    args = parser.parse_args()

    out_path = os.path.join(BASE_DIR, OUT_FILE)
    cache_path = os.path.join(BASE_DIR, DPS_CACHE_FILE)
    previous = load_json(out_path, {})
    prev_items = previous.get("items") or []
    cache = load_json(cache_path, {})

    screener = None
    if not args.offline:
        html, how = fetch_screener_html(args.limit)
        if html:
            try:
                screener = parse_screener(html)
                print(f"[screener] {len(screener['items'])} rows via {how} "
                      f"(matches={screener['totalMatches']})")
            except Exception as e:  # noqa: BLE001
                print(f"[screener] parse failed: {e}")
                screener = None
        else:
            print(f"[screener] fetch failed: {how}")

    if screener and screener["items"]:
        base_items = screener["items"]
        source_as_of = now_iso()
        partial = False
    else:
        # ใช้รายชื่อเดิม (ถ้ามี) แล้วอัปเดตราคา/ผลตอบแทนจาก yfinance อย่างเดียว
        base_items = [
            {k: v for k, v in it.items() if k not in ("divYield", "avgYield5y", "price", "changePercent")}
            for it in prev_items
        ]
        source_as_of = previous.get("sourceAsOf") or now_iso()
        partial = True

    if not base_items:
        print("[dividends] no items (screener failed and no previous data)")
        sys.exit(1)

    symbols = [it["symbol"] for it in base_items if it.get("symbol")]
    cache = refresh_dps_cache(symbols, cache)
    save_json(cache_path, cache)

    prices = fetch_price_history(symbols)

    items = []
    for it in base_items:
        sym = it.get("symbol")
        pinfo = prices.get(sym) or {}
        metrics = compute_metrics(sym, pinfo, cache.get(sym))
        price = pinfo.get("price") or it.get("sourcePrice")
        change = None
        if pinfo.get("price") and pinfo.get("prevClose"):
            change = round((pinfo["price"] / pinfo["prevClose"] - 1) * 100, 2)
        if change is None:
            change = it.get("sourceChangePercent")
        items.append(
            {
                **it,
                "price": round(float(price), 2) if isinstance(price, (int, float)) else price,
                "changePercent": change,
                "divYield": metrics["divYield"],
                "avgYield5y": metrics["avgYield5y"],
                "dpsLastYear": metrics["dpsLastYear"],
                "dpsPrevFY": metrics["dpsPrevFY"],
                "divPayments": metrics["divPayments"],
                "dpsByYear": metrics["dpsByYear"],
                "yieldYearsUsed": metrics["yieldYearsUsed"],
                "dividendsAsOf": (cache.get(sym) or {}).get("fetchedAt"),
            }
        )

    # ถ้าไม่มีข้อมูลปันผลเลย ให้คงค่าเดิมไว้ (กันกราฟ/ตารางว่าง)
    if not any(i.get("divYield") for i in items):
        old = {i["symbol"]: i for i in prev_items}
        for i in items:
            oldi = old.get(i["symbol"])
            if oldi:
                i["divYield"] = oldi.get("divYield")
                i["avgYield5y"] = oldi.get("avgYield5y")
                i["dpsByYear"] = oldi.get("dpsByYear", {})

    payload = {
        "asOf": now_iso(),
        "sourceAsOf": source_as_of,
        "partial": partial,
        "criteria": {
            "market": "TH",
            "divYieldMin": 5,
            "avgYield5yMin": 5,
            "limit": args.limit,
            "sort": "marketcap_adj_latest desc",
            "primaryOnly": True,
        },
        "totalMatches": (screener or {}).get("totalMatches") or previous.get("totalMatches"),
        "sourceUrl": build_screener_url(args.limit),
        "items": items,
    }
    save_json(out_path, payload)
    print(f"[dividends] wrote {len(items)} items -> {OUT_FILE} (partial={partial})")

    if args.push:
        import subprocess

        subprocess.run(["git", "add", OUT_FILE, DPS_CACHE_FILE], cwd=BASE_DIR, check=False)
        subprocess.run(
            ["git", "commit", "-m", "chore(dividends): refresh dividend screener data"],
            cwd=BASE_DIR,
            check=False,
        )
        subprocess.run(["git", "push", "origin", "main"], cwd=BASE_DIR, check=False)


if __name__ == "__main__":
    main()
