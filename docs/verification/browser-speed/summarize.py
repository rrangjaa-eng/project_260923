"""저장된 브라우저 표본만 집계한다. 브라우저/제품을 실행하거나 수정하지 않는다."""
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
raw = json.loads((ROOT / 'raw-results.json').read_text())

def stats(values):
    if not values:
        return None
    return dict(n=len(values), median=round(statistics.median(values), 3),
                minimum=round(min(values), 3), maximum=round(max(values), 3))

rows = []
keys = sorted({(s['phase'], s['loaded'], s['workload']) for s in raw['samples']})
for phase, loaded, workload in keys:
    samples = [s for s in raw['samples'] if (s['phase'], s['loaded'], s['workload']) == (phase, loaded, workload)]
    duration = 'pinReuseMs' if workload == 'pin' else 'totalMs'
    ui = [k['ui'] - k['up'] for s in samples for k in s.get('keys', [])
          if 'ui' in k and 'up' in k and k['ui'] >= k['up']]
    rows.append(dict(phase=phase, loaded=loaded, workload=workload,
                     total_ms=stats([s[duration] for s in samples]),
                     spaces=sorted({s['spaces'] for s in samples if 'spaces' in s}),
                     release_to_action_ms=stats([s['lastKeyToActionMs'] for s in samples if s.get('lastKeyToActionMs') is not None]),
                     release_to_ui_dom_ms=stats(ui),
                     stop_down_to_ui_ms=stats([s['keys'][-1]['ui']-s['keys'][-1]['down'] for s in samples]) if workload == 'stop' else None,
                     pin_setup_ms=stats([s['pinSetupMs'] for s in samples]) if workload == 'pin' else None,
                     pin_setup_spaces=sorted({s['pinSetupSpaces'] for s in samples}) if workload == 'pin' else None,
                     page_ready_ms=stats([s['readyMs'] for s in samples if 'readyMs' in s])))
summary = dict(product_commit=raw['product_commit'], valid_samples=len(raw['samples']),
               excluded_samples=len(raw['excluded_samples']), rows=rows)
(ROOT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
