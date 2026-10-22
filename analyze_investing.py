import json

with open('e:/gg/REA/next_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

pro_ratings = data['props']['pageProps']['state']['investingProRatingsStore']
undervalued = pro_ratings['assetsCollections']['undervalued']['_collection']

print(f"Total undervalued items: {len(undervalued)}")
print("-" * 100)
for i, item in enumerate(undervalued):
    iid = item.get('id')
    sym = item.get('symbol')
    name = item.get('name')
    locked = item.get('locked')
    fv = item.get('fairValue')
    upside = item.get('fairValueUpside')
    last = item.get('last')
    pe = item.get('peRatio')
    health = item.get('financialHealth')
    mcap = item.get('marketCap')
    print(f"{i+1:2d}. ID: {iid:<7} | Symbol: {sym:<6} | Name: {name:<25} | Last: {str(last):<7} | FV: {str(fv):<7} | Upside: {str(upside):<8} | PE: {str(pe):<6} | Health: {str(health):<4} | Locked: {locked}")

print("\n--- Detailed Schema of an Unlocked Item ---")
unlocked_items = [x for x in undervalued if not x.get('locked')]
if unlocked_items:
    print(json.dumps(unlocked_items[0], indent=2, ensure_ascii=False))
else:
    print("All items marked locked in this view, showing first item:")
    print(json.dumps(undervalued[0], indent=2, ensure_ascii=False))
