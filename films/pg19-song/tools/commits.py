"""Extract the REL_19_BETA1..REL_19_BETA4 commit list for the commit wall + reverts for the bridge.
usage: python3 tools/commits.py <postgres-repo>  -> assets/commits.json"""
import json, subprocess, sys, re
R = sys.argv[1]
g = lambda *a: subprocess.run(['git', '-C', R, *a], capture_output=True, text=True, check=True).stdout
raw = g('log', '--format=%h%x1f%cs%x1f%cn%x1f%s%x1f%B%x1e', '--abbrev=10', 'REL_19_BETA1..REL_19_BETA4')
C = []
for rec in raw.split('\x1e'):
    if not rec.strip(): continue
    h, d, cn, s, b = rec.strip('\n').split('\x1f')
    C.append({'h': h, 'd': d, 'c': cn, 's': s, 'fix_msg': 'fix' in b.lower(), 'fix_subj': 'fix' in s.lower()})
REV = {'Property graphs': '2b9e1aff4d3', 'Online checksums': 'c05d5ce1236', 'For portion of': 'a9d2f728240', 'Merge and split partitions': '3e8bcc8644f'}
rev = {k: dict(zip(['h', 'd', 'c', 's'], g('log', '-1', '--abbrev=10', '--format=%h%x1f%cs%x1f%cn%x1f%s', v).strip().split('\x1f'))) for k, v in REV.items()}
tags = {t: g('log', '-1', '--format=%cs', t).strip() for t in ['REL_19_BETA1', 'REL_19_BETA2', 'REL_19_BETA3', 'REL_19_BETA4']}
first = dict(zip(['H', 'ad', 'an', 's'], g('log', '-1', '--date=iso-strict', '--format=%H%x1f%ad%x1f%an%x1f%s', 'd31084e').strip().split('\x1f')))
out = {'range': 'REL_19_BETA1..REL_19_BETA4', 'n': len(C), 'fix_msg': sum(c['fix_msg'] for c in C), 'fix_subj': sum(c['fix_subj'] for c in C),
       'committers': len({c['c'] for c in C}), 'commits': C, 'reverts': rev, 'tags': tags, 'first': first}
json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else 'assets/commits.json', 'w'))
print(out['n'], out['fix_msg'], out['fix_subj'], out['committers'], tags); print(json.dumps(rev, indent=0)); print(first)
