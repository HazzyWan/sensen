import pandas as pd, numpy as np, json, re

U = '/root/.claude/uploads/5ea56d1e-28a0-5673-8b6a-b6f79c7f1395/'
p = pd.read_csv('/mnt/user-data/uploads/pricecatcher_2026-09.csv')
it = pd.read_csv(U + '446dae50-lookup_item.csv')
pr = pd.read_csv(U + '4e417b6c-lookup_premise.csv')
pr['premise_type'] = pr.premise_type.fillna('').str.strip()
for c in ['premise', 'address', 'district']:
    pr[c] = pr[c].fillna('').str.strip()
pr['premise'] = pr.premise.str.replace(r'\s+', ' ', regex=True)

STATE = 'Selangor'
GROCERY_TYPES = ['Hypermarket', 'Pasar Raya / Supermarket', 'Pasar Mini', 'Pasar Basah', 'Kedai Runcit', 'Borong']
sel = pr[(pr.state == STATE) & pr.premise_type.isin(GROCERY_TYPES)].copy()

CHAINS = [
    (r'AEON', "AEON BiG"),
    (r'LOTUSS|TESCO', "Lotus's"),
    (r'GIANT', 'Giant'),
    (r'MYDIN', 'Mydin'),
    (r'ECONSAVE', 'Econsave'),
    (r'99 SPEED', '99 Speedmart'),
    (r'SEGI', 'Segi Fresh'),
    (r'HERO', 'Hero'),
    (r'JAYA GROCER', 'Jaya Grocer'),
    (r'^TF ', 'TF Value-Mart'),
    (r'NSK', 'NSK'),
    (r'ROSYAM', 'ST Rosyam Mart'),
]
TYPE_FALLBACK = {
    'Hypermarket': 'Other hypermarkets',
    'Pasar Raya / Supermarket': 'Independent supermarkets',
    'Pasar Mini': 'Independent mini markets',
    'Pasar Basah': 'Wet markets (pasar)',
    'Kedai Runcit': 'Kedai runcit',
    'Borong': 'Wholesale',
}
def chain_of(row):
    for pat, name in CHAINS:
        if re.search(pat, row.premise):
            return name
    return TYPE_FALLBACK[row.premise_type]
sel['chain'] = sel.apply(chain_of, axis=1)

it = it[it.item_code > 0]
it = it[it.item_group != 'MAKANAN SIAP MASAK']  # cooked food, not groceries

d = p.merge(sel, on='premise_code').merge(it, on='item_code')
print('rows', len(d), 'premises', d.premise_code.nunique(), 'items', d.item_code.nunique())

# One price per item per outlet: median of the month's observations
op = (d.groupby(['item_code', 'premise_code'])
        .agg(price=('price', 'median'), obs=('price', 'size'), last=('date', 'max'))
        .reset_index())

# Items must be sold in >= 3 outlets to be comparable
cnt = op.groupby('item_code').premise_code.nunique()
keep = cnt[cnt >= 3].index
op = op[op.item_code.isin(keep)]

op = op.merge(sel[['premise_code', 'premise', 'premise_type', 'district', 'chain']], on='premise_code')

item_med = op.groupby('item_code').price.median().rename('item_median')
op = op.merge(item_med, on='item_code')
op['ratio'] = op.price / op.item_median
bad = (op.ratio > 3) | (op.ratio < 1/3)
print('dropped likely data-entry errors:', int(bad.sum()))
op[bad].to_csv('dropped_outliers.csv', index=False)
N_DROPPED = int(bad.sum())
op = op[~bad]

# Chain price index: median of (outlet price / item median) across all items the chain sells
op['ratio_c'] = op.ratio.clip(0.5, 2.0)  # limit effect of mis-keyed prices
ci = (op.groupby('chain')
        .agg(index=('ratio_c', 'mean'), items=('item_code', 'nunique'), outlets=('premise_code', 'nunique'))
        .reset_index())
# Head-to-head win rate: share of items where chain's median price is the lowest among chains
cm = op.groupby(['item_code', 'chain']).price.median().reset_index()
cm['rank'] = cm.groupby('item_code').price.rank(method='min')
wins = cm[cm['rank'] == 1].groupby('chain').size()
ci['cheapest_count'] = ci.chain.map(wins).fillna(0).astype(int)
ci = ci.sort_values('index')
print(ci.to_string())

items_out = []
for code, g in op.groupby('item_code'):
    row = it[it.item_code == code].iloc[0]
    g = g.sort_values('price')
    ch = (g.groupby('chain').agg(med=('price', 'median'), mn=('price', 'min'), n=('premise_code', 'nunique'))
            .reset_index().sort_values('med'))
    items_out.append({
        'c': int(code),
        'n': row['item'].strip(),
        'u': str(row['unit']).strip(),
        'g': row['item_group'].strip(),
        'k': row['item_category'].strip(),
        'min': round(g.price.min(), 2),
        'med': round(g.price.median(), 2),
        'max': round(g.price.max(), 2),
        'chains': [[r.chain, round(r.med, 2), round(r.mn, 2), int(r.n)] for r in ch.itertuples()],
        'outlets': [[r.premise, r.chain, r.district, round(r.price, 2)] for r in g.itertuples()],
    })

out = {
    'state': STATE,
    'month': 'September 2026',
    'rows': int(len(d)),
    'n_outlets': int(op.premise_code.nunique()),
    'n_items': len(items_out),
    'dropped': N_DROPPED,
    'index': [[r.chain, round(r.index, 3), int(r.items), int(r.outlets), int(r.cheapest_count)] for r in ci.itertuples()],
    'items': items_out,
}
json.dump(out, open('data.json', 'w'), separators=(',', ':'), ensure_ascii=False)
op.to_csv('outlet_prices.csv', index=False)
import os
print('json KB', os.path.getsize('data.json') // 1024, 'items', len(items_out))
