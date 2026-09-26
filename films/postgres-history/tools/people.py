# Rebuild assets/people.json: everyone named as git author or in Author/Co-authored-by/Reviewed-by/
# Reported-by/Tested-by/Suggested-by/... trailers of the Postgres repo, deduplicated, ranked by credits.
# usage: python3 tools/people.py ~/github/postgres upstream/master
import re, subprocess, sys, unicodedata, json, collections
repo, ref = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else 'HEAD')
raw = subprocess.run(['git', '-C', repo, 'log', ref, '--format=%an%x00%B%x01'], capture_output=True, text=True).stdout
def fold(s): return ''.join(ch for ch in unicodedata.normalize('NFKD', s) if not unicodedata.combining(ch))
def norm(n): return re.sub(r'\(.*?\)|<.*?>', '', n).strip().strip('.').strip()
cnt = collections.Counter(); disp = {}
bad = re.compile(r'\b(and|with|me|by|based|help|patch|others|from|of|et al|several|various|team|anonymous|bot|user)\b|@|http|[0-9]', re.I)
for rec in raw.split('\x01'):
    if '\x00' not in rec: continue
    an, body = rec.split('\x00', 1); names = {norm(an)}
    for line in body.splitlines():
        m = re.match(r'^\s*(Author|Co-authored-by|Reviewed-by|Reported-by|Tested-by|Suggested-by|Diagnosed-by|Backpatch-by|Discussion-by):\s*(.+)$', line)
        if m:
            for part in re.split(r',|;', m.group(2)): names.add(norm(part))
    for n in names:
        if not n or bad.search(n) or len(n.split()) < 2 or len(n) > 32 or not re.match(r"^[\w .'\-]+$", n): continue
        k = fold(n).lower().replace('.', ''); k = re.sub(r'\b\w\b', '', k); k = ' '.join(k.split())
        cnt[k] += 1
        if k not in disp or n != fold(n): disp[k] = n
out = [[disp[k], c] for k, c in cnt.most_common()]
json.dump(out, open('assets/people.json', 'w'), ensure_ascii=False); print(len(out), 'people')
