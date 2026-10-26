# -*- coding: utf-8 -*-
"""
Fetch REAL financial data for every stock in the screener:

- SET (Thai) : thaifin (Finnomena/SET public data)  -> 10+ fiscal years
- US         : yfinance (Yahoo Finance)             -> ~5 fiscal years

Merges everything into stock_details_SET.json / stock_details_US.json keyed by
ticker, which the web app then reads through /api/stock-details.

Usage:
    python scripts/fetch_financials.py --market=ALL
    python scripts/fetch_financials.py --market=SET --symbols=BBIK,TOA
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def enable_finnomena_relay():
    """Make `thaifin` work from datacenter IPs (GitHub Actions runners).

    finnomena.com 403-blocks datacenter IPs, so we monkeypatch httpx.Client.get:
    try the direct request first; if it fails or the host is finnomena (403),
    retry through the r.jina.ai HTML relay and unwrap the JSON payload that
    jina embeds inside an HTML <pre> block.
    """
    import httpx

    orig_get = httpx.Client.get

    def _is_finnomena(url) -> bool:
        return "finnomena.com" in str(url)

    def patched_get(self, url, **kw):
        # 1) direct first (works from residential IPs / local machines)
        try:
            resp = orig_get(self, url, **kw)
            if resp.status_code == 200 or not _is_finnomena(url):
                return resp
        except Exception:
            pass  # fall through to relay

        # 2) jina relay (free tier is per-IP rate limited -> space the calls)
        time.sleep(3.0)
        relay_url = f"https://r.jina.ai/{url}"
        if kw.get("params"):
            q = "&".join(f"{_k}={_v}" for _k, _v in kw["params"].items())
            relay_url = f"{relay_url}?{q}"
        relayed = orig_get(
            self, relay_url,
            headers={"User-Agent": "Mozilla/5.0", "X-Return-Format": "html"},
            timeout=90,
        )
        text = relayed.text or ""

        import re as _re
        m = _re.search(r"<pre[^>]*>([\s\S]*?)</pre>", text)
        payload = m.group(1).strip() if m else text.strip()
        if not (payload.startswith("{") or payload.startswith("[")):
            m = _re.search(r"\{[\s\S]*\}", text) or _re.search(r"\[[\s\S]*\]", text)
            payload = m.group(0).strip() if m else ""

        if not payload:
            raise ValueError(f"jina relay: no JSON payload for {url}")

        class _SyntheticResponse:  # subset of httpx.Response used by thaifin
            status_code = 200

            def __init__(self, raw: str):
                self.text = raw

            def raise_for_status(self):
                pass

            def json(self):
                return json.loads(self.text)

        return _SyntheticResponse(payload)

    httpx.Client.get = patched_get


def _fnum(v):
    """float(v) unless nan/None/str-garbage."""
    try:
        f = float(v)
        return f if f == f and abs(f) != float("inf") else None
    except (TypeError, ValueError):
        return None


def _weekly_price_history(ticker: str):
    """Weekly close history (date, close), longest window Yahoo exposes (~max)"""
    try:
        import pandas as pd
        import yfinance as _yf
        hist = _yf.Ticker(ticker).history(period="max", interval="1wk")
        if hist is None or hist.empty:
            return []
        closes = hist["Close"].dropna()
        rows = []
        for dt, c in closes.items():
            try:
                d = pd.Timestamp(dt).tz_localize(None).to_pydatetime()
            except Exception:
                continue
            v = _fnum(c)
            if v is not None and v > 0:
                rows.append((d, v))
        # Match the reference popup window: ~4.5 years of weekly points
        rows.sort(key=lambda r: r[0])
        keep = int(52 * 4.5) + 1
        if len(rows) > keep:
            rows = rows[-keep:]
        return rows
    except Exception as e:
        print(f"   -> weekly price history unavailable ({str(e)[:60]})")
        return []


def _weekly_band_series(price_rows, quarter_points):
    """Dense band series like the reference popup: weekly close / latest-known
    TTM eps & book value per share. quarter_points = [(quarter_end, ttm_eps, bvps)]"""
    eps_q = sorted([(d, e) for (d, e, _b) in quarter_points if e])
    bvps_q = sorted([(d, b) for (d, _e, b) in quarter_points if b and b > 0])
    pe_w, pbv_w = [], []
    for dt, close in sorted(price_rows):
        eps_ok = [e for (d, e) in eps_q if d <= dt and e > 0]
        if eps_ok:
            ttm = eps_ok[-1]
            if ttm > 0:
                pe_w.append(round(close / ttm, 2))
        bv_ok = [b for (d, b) in bvps_q if d <= dt]
        if bv_ok and bv_ok[-1] > 0:
            pbv_w.append(round(close / bv_ok[-1], 2))
    return {"pe": pe_w, "pbv": pbv_w}


def _set_quarter_points(qdf):
    """[(quarter_end, trailing-4Q eps, bvps)] ascending, from thaifin quarter frame"""
    import pandas as pd
    pts, eps_seen = [], []
    for i in range(len(qdf.index)):
        eps = _fnum(qdf["earning_per_share"].iloc[i])
        if eps is not None:
            eps_seen.append(eps)
        ttm = round(sum(eps_seen[-4:]), 4) if len(eps_seen) >= 4 else None
        bv = _fnum(qdf["book_value_per_share"].iloc[i])
        try:
            end = qdf.index[i].end_time.to_pydatetime().replace(tzinfo=None)
        except Exception:
            end = None
        if end is not None:
            pts.append((end, ttm, bv))
    return pts


def _us_quarter_points(t, info):
    """[(quarter_end, trailing-4Q eps, bvps)] ascending, from yfinance.
    Yahoo caps quarterly statements at ~5 quarters, so older history uses the
    annual statements as the best-known trailing eps/bv level (steps at FY end)
    and the most recent quarters override with true rolling TTM."""
    import pandas as pd
    pts = []
    rows = []  # (date, eps_or_None, kind)
    bv_by_date = {}
    shares = num(info.get("sharesOutstanding"))

    # 1) annual statements (~4y): fiscal-year-end dates carry the full-year dtoq
    ainc = abs_ = None
    try:
        ainc = t.get_income_stmt(pretty=False, freq="yearly")
        abs_ = t.get_balance_sheet(pretty=False, freq="yearly")
    except Exception:
        pass

    def date_of(col):
        try:
            return pd.Timestamp(col).tz_localize(None).to_pydatetime()
        except Exception:
            try:
                return pd.Timestamp(col).to_pydatetime()
            except Exception:
                return None

    if ainc is not None and len(ainc.columns):
        eps_row = get_row(ainc, "DilutedEPS", "BasicEPS")
        eq_row = get_row(abs_, "StockholdersEquity", "CommonStockEquity") if abs_ is not None else None
        for col in ainc.columns:
            d = date_of(col)
            if d is None:
                continue
            eps_v = num(cell(eps_row, col)) if eps_row is not None else None
            rows.append((d, eps_v))
        if eq_row is not None and shares:
            for col in abs_.columns:
                d = date_of(col)
                equity = num(cell(eq_row, col))
                if d is not None and equity and equity > 0:
                    bv_by_date[d] = round(equity / shares, 4)

    # 2) quarterly statements (~5-6 recent quarters): refine with real TTM
    qinc = qbs = None
    try:
        qinc = t.get_income_stmt(pretty=False, freq="quarterly")
        qbs = t.get_balance_sheet(pretty=False, freq="quarterly")
    except Exception:
        pass
    q_rows = []
    if qinc is not None and len(qinc.columns):
        qeps_row = get_row(qinc, "BasicEPS", "DilutedEPS")
        for col in qinc.columns:
            d = date_of(col)
            eps_v = num(cell(qeps_row, col)) if qeps_row is not None else None
            if d is not None:
                q_rows.append((d, eps_v))
    if qbs is not None and len(qbs.columns) and shares:
        qeq_row = get_row(qbs, "StockholdersEquity", "CommonStockEquity")
        if qeq_row is not None:
            for col in qbs.columns:
                d = date_of(col)
                equity = num(cell(qeq_row, col))
                if d is not None and equity and equity > 0:
                    bv_by_date[d] = round(equity / shares, 4)

    # merge: annual rows + quarterly rows, dedup by date (quarterly wins)
    annual_eps_by_date = {d: e for d, e in rows}
    by_date = dict(annual_eps_by_date)
    for d, e in q_rows:
        by_date[d] = e
    rows = sorted(by_date.items())

    # quarterly TTM where 4 consecutive quarter readings exist
    q_dates = sorted(d for d, _e in q_rows)
    q_eps_by_date = dict(q_rows)
    ttm_by_date = {}
    for i, d in enumerate(q_dates):
        window = [q_eps_by_date.get(q_d) for q_d in q_dates[max(0, i - 3):i + 1]]
        if len(window) == 4 and all(v is not None for v in window):
            ttm_by_date[d] = round(sum(window), 4)

    eps_seen = []
    for d, _eps in rows:
        eps_level = ttm_by_date.get(d)
        if eps_level is None:
            # fall back: latest annual eps reported at or before this date
            prior = sorted((dd, e) for dd, e in annual_eps_by_date.items() if dd <= d and e is not None)
            eps_level = prior[-1][1] if prior else None
        bv = bv_by_date.get(d)
        pts.append((d, eps_level, bv))
    return pts


enable_finnomena_relay()

SET_SOURCES = [
    "thailand_stocks_unmasked.json",
    "thailand_stocks_overvalued.json",
]
US_SOURCES = [
    "undervalued_stocks_unmasked.json",
    "us_stocks_overvalued.json",
]

OUT_SET = "stock_details_SET.json"
OUT_US = "stock_details_US.json"


def collect_symbols(files):
    syms = []
    for fname in files:
        path = os.path.join(BASE_DIR, fname)
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for row in data:
                symbol = row.get("symbol")
                if not symbol:
                    continue
                # investing.com instrument suffixes (MAGUROm, TACCm, CPNREITu, ...) -> plain SET tickers
                if symbol in ("UNIX", "GST"):
                    continue  # not present in thaifin (delisted)
                stripped = symbol[:-1] if symbol[-1:].islower() else symbol
                if stripped and stripped not in syms:
                    syms.append(stripped)
        except Exception as e:
            print(f"[Warn] Cannot read {fname}: {e}")
    return syms


def num(v):
    """Coerce anything into float or None."""
    if v is None:
        return None
    try:
        import math
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def cell(row, col):
    """Safe Series lookup: returns row[col] or None if the index lacks col."""
    if row is None or col is None:
        return None
    try:
        if col in row.index:
            return row[col]
        return None
    except Exception:
        return None


def get_row(df, *candidates, default=None):
    """Return first matching row series from a pandas DataFrame index."""
    if df is None:
        return default
    for key in candidates:
        if key in df.index:
            return df.loc[key]
    return default


# ------------------------------------------------------------------ #
# SET - thaifin                                                      #
# ------------------------------------------------------------------ #

def fetch_thaifin(symbol: str):
    from thaifin import Stock

    stock = Stock(symbol)
    df = stock.yearly_dataframe
    if df is None or len(df.index) == 0:
        return None

    # thaifin dataframe index = fiscal years (Period or int) -> normalize
    def fy_of(idx):
        s = str(idx)
        try:
            return int(s[:4])
        except ValueError:
            return None

    years = [fy_of(y) for y in df.index if fy_of(y) is not None]
    ok_idx = [y for y in df.index if fy_of(y) is not None]
    rows = dict(zip(years, [df.loc[i] for i in ok_idx]))
    years = sorted(years)
    series = {k: [] for k in
              ("netProfit", "revenue", "eps", "gm", "npm", "roe", "dps", "dve", "bvps", "roa",
               "peSeries", "pbvSeries", "opCashflow", "liabDe")}
    shares_series = {}

    for y in years:
        row = rows[y]
        eps = num(row.get("earning_per_share"))
        np_ = num(row.get("net_profit"))
        rev = num(row.get("revenue"))
        gm = num(row.get("gpm"))
        npm = num(row.get("npm"))
        roe = num(row.get("roe"))
        roa = num(row.get("roa"))
        dve = num(row.get("debt_to_equity"))
        bvps = num(row.get("book_value_per_share"))
        close = num(row.get("close"))
        dy = num(row.get("dividend_yield"))
        paid_up = num(row.get("paid_up_capital"))
        pe = num(row.get("price_earning_ratio"))
        pbv = num(row.get("price_book_value"))
        opcf = num(row.get("operating_activities"))
        asset = num(row.get("asset"))
        eqy = num(row.get("equity"))

        shares = None
        if eps and eps > 0 and np_ and np_ > 0:
            shares = np_ / eps
        if not shares and paid_up and close and close > 0:
            shares = paid_up / close
        shares_series[y] = shares

        dps_val = None
        if dy is not None and close is not None and dy > 0:
            dps_val = dy * close / 100.0

        rowmap = {
            "netProfit": np_, "revenue": rev, "eps": eps, "gm": gm,
            "npm": npm, "roe": roe, "dps": dps_val, "dve": dve,
            "bvps": bvps, "roa": roa, "peSeries": pe, "pbvSeries": pbv,
            "opCashflow": opcf,
            # total liabilities / equity (D/E the way the reference site reports it)
            "liabDe": (asset - eqy) / eqy if asset is not None and eqy and eqy > 0 else None,
        }
        for k, val in rowmap.items():
            series[k].append(round(val, 6) if val is not None else None)

    last_idx = ok_idx[-1]
    last = fy_of(last_idx)
    lastrow = df.loc[last_idx]
    close_last = num(lastrow.get("close"))

    # --- quarterly frame: TTM earnings, latest-quarter balance sheet, latest DPS ---
    ttm_eps = ttm_np = cash_q = debt_q = equity_q = asset_q = bvps_q = None
    liab_de_q = net_debt_q = dps_ttm = None
    try:
        qdf = stock.quarter_dataframe
    except Exception:
        qdf = None
    if qdf is not None and len(qdf.index):
        def qnum(col, at):
            try:
                return num(qdf[col].iloc[at])
            except Exception:
                return None
        n = len(qdf.index)
        # TTM: latest 4 quarters that contain earnings data
        earn_rows = [i for i in range(n)
                     if qnum("earning_per_share", i) is not None
                     and qnum("net_profit", i) is not None]
        if earn_rows:
            take = earn_rows[-4:] if len(earn_rows) >= 4 else earn_rows
            ttm_eps = round(sum(qnum("earning_per_share", i) for i in take), 4)
            ttm_np = round(sum(qnum("net_profit", i) for i in take), 2)
        # latest quarter holding a balance sheet
        bal_rows = [i for i in range(n) if qnum("equity", i) is not None]
        if bal_rows:
            b = bal_rows[-1]
            cash_q, debt_q = qnum("cash", b), qnum("total_debt", b)
            equity_q, asset_q = qnum("equity", b), qnum("asset", b)
            bvps_q = qnum("book_value_per_share", b)
            if asset_q is not None and equity_q and equity_q > 0:
                liab_de_q = round((asset_q - equity_q) / equity_q, 6)
            if debt_q is not None and cash_q is not None:
                net_debt_q = round(debt_q - cash_q, 0)
        # D0 = latest dividend yield x latest market close (most recent quarter row)
        dy_rows = [i for i in range(n)
                   if (qnum("dividend_yield", i) or 0) > 0 and qnum("close", i) is not None]
        if dy_rows:
            d = dy_rows[-1]
            dyv, cl = qnum("dividend_yield", d), qnum("close", d)
            if dyv and cl:
                dps_ttm = round(dyv * cl / 100.0, 4)

    metrics = {
        "roe": num(lastrow.get("roe")),
        "roa": num(lastrow.get("roa")),
        "npm": num(lastrow.get("npm")),
        "gpm": num(lastrow.get("gpm")),
        "de": num(lastrow.get("debt_to_equity")),
        "peRatio": num(lastrow.get("price_earning_ratio")),
        "pbv": num(lastrow.get("price_book_value")),
        "evEbitda": num(lastrow.get("ev_per_ebit_da")),
        "eps": num(lastrow.get("earning_per_share")),
        "bvps": num(lastrow.get("book_value_per_share")),
        "dividendYield": num(lastrow.get("dividend_yield")),
        "mktCap": num(lastrow.get("mkt_cap")),
        "netProfit": num(lastrow.get("net_profit")),
        "revenue": num(lastrow.get("revenue")),
        "opCashflow": num(lastrow.get("operating_activities")),
        "totalDebt": num(lastrow.get("total_debt")),
        "equity": num(lastrow.get("equity")),
        "cash": num(lastrow.get("cash")),
        "close": close_last,
        "shares": shares_series.get(last),
        "ttmEps": ttm_eps,
        "ttmNetProfit": ttm_np,
        "cashQ": cash_q, "debtQ": debt_q, "equityQ": equity_q, "assetQ": asset_q,
        "bvpsQ": bvps_q, "liabDeQ": liab_de_q, "netDebtQ": net_debt_q,
    }

    # DPS: use latest dividend yield * close; payout from DPS / EPS
    dy_last = num(lastrow.get("dividend_yield"))
    dps = metrics["dps"] = (
        dy_last * close_last / 100.0 if dy_last and close_last else
        [d for d in reversed(series["dps"]) if d is not None][-1] if series["dps"] else None
    )
    payout = metrics["payout"] = (
        (dps / metrics["eps"] * 100.0) if dps and metrics["eps"] and metrics["eps"] > 0 else None
    )

    # FCFE approximation from real operating cash flow ( thaifin doesn't expose capex split )
    netdebt = None
    if metrics["totalDebt"] is not None and metrics["cash"] is not None:
        netdebt = metrics["totalDebt"] - metrics["cash"]

    band_weekly = None
    if qdf is not None and len(qdf.index) >= 8:
        try:
            price_rows = _weekly_price_history(f"{symbol}.BK")
            if price_rows:
                band_weekly = _weekly_band_series(price_rows, _set_quarter_points(qdf))
        except Exception as be:
            print(f"   -> bandWeekly skipped ({str(be)[:60]})")

    return {
        "source": "thaifin",
        "currency": "THB",
        "fiscalYears": years,
        "latestFY": int(last),
        "metrics": metrics,
        "netDebt": round(netdebt, 0) if netdebt is not None else None,
        "netDebtQ": net_debt_q,
        "fcfe": metrics["opCashflow"],
        "dpsTTM": dps_ttm,
        "series": series,
        "sharesSeries": {str(y): shares for y, shares in shares_series.items()},
        "bandWeekly": band_weekly,
    }


# ------------------------------------------------------------------ #
# US - yfinance                                                      #
# ------------------------------------------------------------------ #

def fetch_yfinance(symbol: str):
    import yfinance as yf

    t = yf.Ticker(symbol)
    info = t.info or {}
    inc = t.get_income_stmt(pretty=False, freq="yearly")
    bs = t.get_balance_sheet(pretty=False, freq="yearly")
    cf = t.get_cashflow(pretty=False, freq="yearly")

    if inc is None or len(inc.columns) == 0:
        return None

    years = [int(c.year) for c in inc.columns]
    shares_series = {}

    series = {k: [] for k in
              ("netProfit", "revenue", "eps", "gm", "npm", "roe", "dps", "dve", "bvps", "roa",
               "opCashflow", "coverage", "liabDe")}

    for col, y in zip(inc.columns, years):
        row_rev = get_row(inc, "TotalRevenue", "OperatingRevenue")
        rev = num(cell(row_rev, col))
        netinc_row = get_row(inc, "NetIncome", "NetIncomeCommonStockholders", "DilutedNIAvailtoComStockholders")
        np_ = num(cell(netinc_row, col))
        gp_row = get_row(inc, "GrossProfit")
        gp = num(cell(gp_row, col))
        eps_row = get_row(inc, "DilutedEPS", "BasicEPS")
        eps = num(cell(eps_row, col))
        shares_row = get_row(inc, "DilutedAverageShares", "BasicAverageShares")
        shares = num(cell(shares_row, col))

        eq_row = get_row(bs, "StockholdersEquity", "CommonStockEquity", "TotalEquityGrossMinorityInterest") if bs is not None and bs is not False else None
        equity = num(cell(eq_row, col))
        asset_row = None
        if bs is not None and not isinstance(bs, bool):
            for k in bs.index:
                if "TotalAssets" in str(k):
                    asset_row = bs.loc[k]
                    break
        assets = num(cell(asset_row, col))
        debt_row = get_row(bs, "TotalDebt", "LongTermDebtAndCapitalLeaseObligation") if bs is not None else None
        debt = num(cell(debt_row, col))

        ocf_row = get_row(cf, "OperatingCashFlow", "CashFlowFromContinuingOperatingActivities") if cf is not None else None
        ocf = num(cell(ocf_row, col))

        # interest coverage = EBIT / interest expense (reference CROSS-CHECKS style)
        ebit = num(cell(get_row(inc, "OperatingIncome", "EBIT"), col))
        interest = num(cell(get_row(inc, "InterestExpense", "InterestExpenseNonOperating", "Interest Payment On Debt"), col))
        coverage = ebit / abs(interest) if ebit is not None and interest else None
        div_pct_row = None
        if cf is not None:
            for k in ("CashDividendsPaid", "CommonStockDividendPaid", "PaymentOfDividends", "CashDividendsPaidCommonStock"):
                row = get_row(cf, k)
                if row is not None:
                    div_pct_row = row
                    break
        dividends_paid = num(cell(div_pct_row, col))

        if not shares and info.get("sharesOutstanding"):
            shares = num(info.get("sharesOutstanding"))
        shares_series[y] = shares

        npm = np_ / rev * 100 if np_ is not None and rev else None
        gm = gp / rev * 100 if gp is not None and rev else None
        roe = np_ / equity * 100 if np_ is not None and equity else None
        roa = np_ / assets * 100 if np_ is not None and assets else None
        dve = debt / equity if debt is not None and equity else None
        bvps = equity / shares if equity is not None and shares else None
        dps = abs(dividends_paid) / shares if dividends_paid is not None and shares else None

        rowmap = {
            "netProfit": np_, "revenue": rev, "eps": eps, "gm": gm, "npm": npm,
            "roe": roe, "dps": dps, "dve": dve, "bvps": bvps, "roa": roa,
            "opCashflow": ocf, "coverage": coverage,
            # total liabilities / equity from the balance sheet (reference D/E)
            "liabDe": (assets - equity) / equity if assets is not None and equity and equity > 0 else None,
        }
        for k, val in rowmap.items():
            series[k].append(round(val, 6) if val is not None else None)

    # yfinance returns newest-first columns -> normalize to chronological ascending
    series = {k: (v[::-1] if isinstance(v, list) else v) for k, v in series.items()}
    fiscal_years_asc = years[::-1]

    # actual dividend payments (per payment date) - for the DPS "by payment" chart
    div_payments = []
    try:
        dhist = t.dividends
        if dhist is not None and len(dhist):
            for dt, amt in list(dhist.items()):
                div_payments.append({"date": str(dt)[:10], "amount": round(float(amt), 6)})
    except Exception:
        div_payments = []

    # latest-period coverage (yfinance columns are newest-first)
    coverage_latest = series["coverage"][-1] if series["coverage"] else None

    current_price = num(info.get("currentPrice")) or num(info.get("regularMarketPrice"))
    fcf = num(info.get("freeCashflow"))
    ocf = num(info.get("operatingCashflow"))
    total_debt = num(info.get("totalDebt"))
    total_cash = num(info.get("totalCash"))
    ebitda = num(info.get("ebitda"))

    dy = num(info.get("dividendYield"))
    payout = num(info.get("payoutRatio"))
    payout_pct = payout * 100.0 if payout is not None else None

    # fallback DPS from dividend yield * price
    dps_latest = None
    dps_list = [d for d in reversed(series["dps"]) if d is not None]
    if dps_list:
        dps_latest = dps_list[0]
    elif dy is not None and current_price is not None:
        dps_latest = dy * current_price / 100.0

    ev_ebitda = None
    if ebitda and ebitda > 0 and info.get("marketCap"):
        ev = num(info.get("marketCap")) + (total_debt or 0) - (total_cash or 0)
        ev_ebitda = ev / ebitda

    metrics = {
        "roe": (num(info.get("returnOnEquity")) or 0) * 100 or None,
        "roa": (num(info.get("returnOnAssets")) or 0) * 100 or None,
        "npm": (num(info.get("profitMargins")) or 0) * 100 or None,
        "gpm": (num(info.get("grossMargins")) or 0) * 100 or None,
        "de": (num(info.get("debtToEquity")) or 0) / 100 or None,
        "peRatio": num(info.get("trailingPE")),
        "pbv": num(info.get("priceToBook")),
        "evEbitda": ev_ebitda,
        "eps": num(info.get("trailingEps")) or num(info.get("epsTrailingTwelveMonths")),
        "bvps": num(info.get("bookValue")),
        "dividendYield": dy,
        "payout": payout_pct,
        "dps": dps_latest,
        "mktCap": num(info.get("marketCap")),
        "netProfit": num(info.get("netIncomeToCommon")),
        "revenue": num(info.get("totalRevenue")),
        "opCashflow": ocf,
        "totalDebt": total_debt,
        "equity": None,
        "cash": total_cash,
        "close": current_price,
        "shares": num(info.get("sharesOutstanding")),
        "revenueGrowth": (num(info.get("revenueGrowth")) or 0) * 100 or None,
        "earningsGrowth": (num(info.get("earningsGrowth")) or 0) * 100 or None,
        "coverage": coverage_latest,
        "sharesQ": num(info.get("sharesOutstanding")),
    }

    netdebt = None
    bs_netdebt = get_row(bs, "NetDebt") if bs is not None else None
    if bs_netdebt is not None and len(bs_netdebt):
        netdebt = num(bs_netdebt.iloc[0])
    if netdebt is None and total_debt is not None:
        netdebt = total_debt - (total_cash or 0)

    band_weekly = None
    try:
        price_rows = _weekly_price_history(symbol)
        qp = _us_quarter_points(t, info)
        if price_rows and qp:
            band_weekly = _weekly_band_series(price_rows, qp)
    except Exception as be:
        print(f"   -> bandWeekly skipped ({str(be)[:60]})")

    return {
        "source": "yfinance",
        "currency": "USD",
        "fiscalYears": years[::-1],
        "latestFY": max(years) if years else None,
        "metrics": metrics,
        "netDebt": round(netdebt, 0) if netdebt is not None else None,
        "fcfe": fcf,
        "divPayments": div_payments,
        "series": series,
        "sharesSeries": {str(y): s for y, s in shares_series.items()},
        "bandWeekly": band_weekly,
    }


# ------------------------------------------------------------------ #

def run(market: str, only_symbols=None):
    if market == "SET":
        symbols = collect_symbols(SET_SOURCES)
        out_file = OUT_SET
        fetcher = fetch_thaifin
    elif market == "US":
        symbols = collect_symbols(US_SOURCES)
        out_file = OUT_US
        fetcher = fetch_yfinance
    else:
        raise ValueError(f"Unknown market {market}")

    if only_symbols:
        symbols = [s for s in symbols if s in only_symbols]

    out_path = os.path.join(BASE_DIR, out_file)

    existing = {}
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    results = {}
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()
    ok, fail = 0, 0

    for i, symbol in enumerate(symbols, 1):
        print(f"[{i}/{len(symbols)}] fetching {market}: {symbol}")
        try:
            data = fetcher(symbol)
            has_any = data and (
                data.get("metrics", {}).get("roe") is not None
                or any(v is not None for v in (data.get("series") or {}).get("roe", []))
                or data.get("metrics", {}).get("peRatio") is not None
                or data.get("metrics", {}).get("eps") is not None
            )
            if data and has_any:
                data["fetchedAt"] = now_iso
                results[symbol] = data
                ok += 1
            else:
                print(f"   -> skipped (no data)")
                fail += 1
        except Exception as e:
            print(f"   -> ERROR: {e}")
            fail += 1
        # be gentle with Yahoo
        time.sleep(0.4 if market == "US" else 0.15)

    # merge with existing (keep older data for symbols not fetched this run, unless --clean)
    merged = {**existing}
    if only_symbols:
        for k, v in results.items():
            merged[k] = v
    else:
        merged = results

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=1, ensure_ascii=False)

    print(f"\n[Done] {market}: ok={ok}, failed/skipped={fail}, total written={len(merged)} -> {out_file}")
    return ok


def update_sync_status(results):
    status_path = os.path.join(BASE_DIR, "sync_status.json")
    now_iso = datetime.now(timezone(timedelta(hours=7))).isoformat()
    try:
        with open(status_path, "r", encoding="utf-8") as f:
            status = json.load(f)
    except Exception:
        status = {}
    status["financialDetails"] = {
        "lastSync": now_iso,
        "results": results,
    }
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Fetch REAL financial details via thaifin/yfinance")
    parser.add_argument("--market", default="ALL", choices=["SET", "US", "ALL"])
    parser.add_argument("--symbols", default="", help="comma-separated symbol filter")
    args = parser.parse_args()

    only = set(s.strip().upper() for s in args.symbols.split(",") if s.strip())

    results = {}
    if args.market in ("SET", "ALL"):
        results["SET"] = run("SET", only)
    if args.market in ("US", "ALL"):
        results["US"] = run("US", only)

    if not only:
        update_sync_status(results)


if __name__ == "__main__":
    main()
