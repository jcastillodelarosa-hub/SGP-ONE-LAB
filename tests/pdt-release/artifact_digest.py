"""Record the frontend files tested and submitted to Firebase Hosting."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
EXCLUDED = {'.git', '.github', '.agents', 'docs', 'supabase', 'tests',
            'node_modules', 'scripts', 'functions', 'dataconnect'}
EXCLUDED_FILES = {'firebase.json', '.firebaserc', 'package.json', 'package-lock.json',
                  'config.example.js', 'README.md'}


def digest(root=ROOT):
    files = []
    for path in root.rglob('*'):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(root)
        if any(part.startswith('.') or part in EXCLUDED for part in rel.parts[:-1]):
            continue
        if rel.name.startswith('.') or rel.name in EXCLUDED_FILES or rel.suffix in ('.md', '.sql'):
            continue
        files.append(rel)
    if not files or Path('index.html') not in files or Path('app.js') not in files:
        raise RuntimeError('FRONTEND_ARTIFACT_INCOMPLETE')
    state = hashlib.sha256()
    for rel in sorted(files):
        data = (root / rel).read_bytes()
        state.update(json.dumps([str(rel), len(data), hashlib.sha256(data).hexdigest()],
                                separators=(',', ':')).encode() + b'\n')
    return state.hexdigest()


if __name__ == '__main__':
    try:
        current = digest()
        if len(sys.argv) == 2:
            if current != sys.argv[1]:
                raise RuntimeError('FRONTEND_ARTIFACT_CHANGED_AFTER_TEST')
        elif len(sys.argv) == 1:
            print(current)
        else:
            raise RuntimeError('ARTIFACT_DIGEST_USAGE')
    except Exception:
        print('::error::FRONTEND_ARTIFACT_NOT_VERIFIED')
        sys.exit(1)
