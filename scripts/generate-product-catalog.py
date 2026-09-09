#!/usr/bin/env python3
"""Regenerate lib/product-classification.ts from Finance's product catalog.

Finance's source of truth is cashflow-qbo/data/product_classification_v2.csv. The dashboard
keeps a generated copy so its ARR matches Finance's. Run this whenever Finance adds or
reclassifies a product (the daily sync logs and Slack-notifies unmatched line items):

    python3 scripts/generate-product-catalog.py [path/to/product_classification_v2.csv]
"""
import csv, json, sys, datetime, pathlib

default_csv = pathlib.Path.home() / 'overgrad' / 'cashflow-qbo' / 'data' / 'product_classification_v2.csv'
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else default_csv
out = pathlib.Path(__file__).resolve().parent.parent / 'lib' / 'product-classification.ts'

rows = list(csv.DictReader(open(src)))
entries = [{
    'productId': r['product_id'].strip(),
    'sku': r['sku'].strip(),
    'itemName': r['item_name'].strip(),
    'countsTowardArr': r['counts_toward_arr'].strip().lower() == 'true',
    'revenueType': r['revenue_type'].strip(),
} for r in rows]

body = ',\n'.join(
    '  { productId: %s, sku: %s, itemName: %s, countsTowardArr: %s, revenueType: %s }' % (
        json.dumps(e['productId']), json.dumps(e['sku']), json.dumps(e['itemName']),
        'true' if e['countsTowardArr'] else 'false', json.dumps(e['revenueType']))
    for e in entries)

out.write_text(f"""// Product catalog used to classify HubSpot line items as ARR vs non-ARR.
//
// SOURCE OF TRUTH: cashflow-qbo/data/product_classification_v2.csv (Finance).
// Generated {datetime.date.today()} by scripts/generate-product-catalog.py — rerun it when
// Finance updates the catalog so the dashboard's ARR keeps matching Finance's numbers.
// Do not hand-edit.

export interface ProductClassification {{
  productId: string
  sku: string
  itemName: string
  countsTowardArr: boolean
  revenueType: string
}}

export const PRODUCT_CLASSIFICATION: ProductClassification[] = [
{body},
]
""")
arr = sum(e['countsTowardArr'] for e in entries)
print(f'wrote {out.name}: {len(entries)} products ({arr} ARR, {len(entries) - arr} non-ARR) from {src}')
