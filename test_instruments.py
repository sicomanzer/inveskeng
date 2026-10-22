from curl_cffi import requests
import json

with open('e:/gg/REA/next_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

pro_ratings = data['props']['pageProps']['state']['investingProRatingsStore']
undervalued = pro_ratings['assetsCollections']['undervalued']['_collection']

pair_ids = [int(item['id']) for item in undervalued]
query = "&".join(f"instrument_ids={pid}" for pid in pair_ids)
url = f"https://endpoints.investing.com/pd-instruments/v1/instruments?{query}&domain_id=1"

r = requests.get(url, impersonate="chrome124")
if r.status_code == 200:
    instruments_data = {str(item['id']): item for item in r.json()}
    
    merged_stocks = []
    print(f"{'#':<2} | {'Symbol':<6} | {'Price':<7} | {'Fair Value':<10} | {'Upside %':<8} | {'P/E':<6} | {'Health':<6} | {'Company Name'}")
    print("-" * 90)
    for i, stock in enumerate(undervalued):
        pid = str(stock['id'])
        inst = instruments_data.get(pid, {})
        
        real_symbol = inst.get('symbol', stock.get('symbol'))
        real_name = inst.get('long_name', stock.get('name'))
        real_short_name = inst.get('short_name', stock.get('shortName'))
        link = inst.get('link', stock.get('url'))
        
        merged_item = {
            "id": pid,
            "symbol": real_symbol,
            "name": real_name,
            "shortName": real_short_name,
            "link": f"https://www.investing.com{link}" if link.startswith('/') else link,
            "price": stock.get('last'),
            "fairValue": round(stock.get('fairValue', 0), 2) if stock.get('fairValue') else None,
            "fairValueUpside": round(stock.get('fairValueUpside', 0), 2) if stock.get('fairValueUpside') else None,
            "peRatio": round(stock.get('peRatio', 0), 2) if stock.get('peRatio') else None,
            "evEbitda": round(stock.get('evEbitda', 0), 2) if stock.get('evEbitda') else None,
            "marketCap": stock.get('marketCap'),
            "marketCapFormatted": f"${stock.get('marketCap', 0) / 1e9:.2f}B" if stock.get('marketCap') else "N/A",
            "epsGrowth5y": round(stock.get('epsGrowth5y', 0) * 100, 2) if stock.get('epsGrowth5y') is not None else None,
            "changeOneDayPercent": stock.get('changeOneDayPercent'),
            "financialHealth": stock.get('financialHealth'),
            "financialCashFlowHealth": stock.get('financialCashFlowHealth'),
            "financialGrowthHealth": stock.get('financialGrowthHealth'),
            "financialProfitabilityHealth": stock.get('financialProfitabilityHealth'),
            "analystRatings": stock.get('analystRatings'),
            "flagCode": stock.get('flagCode', 'US'),
            "flagName": stock.get('flagName', 'United States'),
            "lastUpdateTime": stock.get('lastUpdateTime')
        }
        merged_stocks.append(merged_item)
        print(f"{i+1:2d} | {real_symbol:<6} | {merged_item['price']:<7} | {merged_item['fairValue']:<10} | {str(merged_item['fairValueUpside']) + '%':<8} | {merged_item['peRatio']:<6} | {merged_item['financialHealth']:<6} | {real_name}")
    
    with open('e:/gg/REA/undervalued_stocks_unmasked.json', 'w', encoding='utf-8') as out_f:
        json.dump(merged_stocks, out_f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(merged_stocks)} unmasked stocks to e:/gg/REA/undervalued_stocks_unmasked.json")
else:
    print("Failed to fetch instruments:", r.status_code, r.text)
