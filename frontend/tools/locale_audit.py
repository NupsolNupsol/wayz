"""Compares the English and Arabic books key by key, and names anything still in English."""
import io, json, glob, re, os

def walk(node, path=()):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from walk(v, path + (k,))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, path + (str(i),))
    else:
        yield path, node

# Words that are the same in both languages are not a translation failure.
SHARED = re.compile(
    r'^(?:[\W\d]+|EN|AR|SAR|VAT|QR|ETL|TPE|MADA|VISA|MC|SPAN|ID|OK|CSV|PDF|SMTP|'
    r'WhatsApp|Apple Pay|Mastercard|Visa|Mada|GCC|ZATCA|COTE|WAYZ|manager@…|'
    r'\{\{[a-zA-Z]+\}\}.*|[\w.]+@[\w.]+)$'
)

problems = 0
for path in sorted(glob.glob('src/i18n/locales/en/*.json')):
    ns = os.path.basename(path)
    ar_path = os.path.join('src', 'i18n', 'locales', 'ar', ns)
    if not os.path.exists(ar_path):
        print('MISSING NAMESPACE:', ns)
        problems += 1
        continue

    en = dict(walk(json.load(io.open(path, encoding='utf-8'))))
    ar = dict(walk(json.load(io.open(ar_path, encoding='utf-8'))))

    missing = sorted('.'.join(p) for p in en if p not in ar)
    # Arabic needs plural forms English has no word for; those are expected, not extra.
    PLURALS = ('_zero', '_two', '_few', '_many')
    extra = sorted('.'.join(p) for p in ar if p not in en and not p[-1].endswith(PLURALS))
    english = sorted(
        '.'.join(p) for p, v in en.items()
        if isinstance(v, str) and ar.get(p) == v and not SHARED.match(v.strip())
    )

    if missing or extra or english:
        problems += 1
        print('\n### %s  (en %d / ar %d)' % (ns, len(en), len(ar)))
        if missing:
            print('  missing in ar (%d):' % len(missing), ', '.join(missing[:12]))
        if extra:
            print('  only in ar (%d):' % len(extra), ', '.join(extra[:12]))
        if english:
            print('  identical to english (%d):' % len(english))
            for k in english[:20]:
                print('     ', k, '=', json.dumps(en[tuple(k.split('.'))], ensure_ascii=False)[:90])

print('\n== %s ==' % ('every namespace is fully translated' if not problems else '%d namespace(s) need work' % problems))
