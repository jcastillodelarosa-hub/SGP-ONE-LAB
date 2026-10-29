"""Compare the live read-only PDT catalog with the verified backup snapshot."""
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pdt-backup'))
from gcs_storage import PrivateStorage
from verify_recovery import pinned_record

ROOT = Path(__file__).resolve().parents[2]
SECTIONS = ('funciones', 'relaciones', 'triggers', 'politicas', 'roles',
            'membresias', 'secuencias', 'grants_por_defecto', 'extensiones', 'existencia')


def compare(source, live):
    """Return safe section names only; no catalog definitions escape."""
    def normalized(value):
        if isinstance(value, dict):
            return {key: normalized(item) for key, item in value.items()}
        if isinstance(value, list):
            items = [normalized(item) for item in value]
            return sorted(items, key=lambda item: json.dumps(item, sort_keys=True, ensure_ascii=False))
        return value
    return [section for section in SECTIONS
            if normalized(source.get(section)) != normalized(live.get(section))]


def main():
    storage = PrivateStorage(read_only=True)
    storage.verify_boundary()
    snapshot = catalog_snapshot(storage, os.environ)
    sql = (ROOT / 'PDT_PREFLIGHT_SUPABASE.sql').read_text()
    command = ['docker', 'run', '--rm', '-i', '-e', 'DATABASE_URL',
               '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=3000',
               'postgres:17', 'sh', '-c',
               'psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1']
    result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=90)
    if result.returncode:
        raise RuntimeError('LIVE_CATALOG_QUERY_FAILED')
    live = json.loads(result.stdout.strip())
    if live.get('captura', {}).get('transaccion_solo_lectura') != 'on':
        raise RuntimeError('LIVE_CATALOG_NOT_READ_ONLY')
    changed = compare(snapshot, live)
    if changed:
        raise RuntimeError('LIVE_CATALOG_DRIFT_' + ','.join(changed))
    print('LIVE_FUNCTION_RLS_PERMISSION_DEPENDENCY_CATALOG_VERIFIED')


def catalog_snapshot(storage, environment, now=None):
    # The same immutable recovery generation supplies the catalog identity.
    # A newly created backup-record cannot redirect this comparison.
    record = pinned_record(storage, environment, now)
    return json.loads(storage.get(record['objects']['catalog_and_counts']))['catalog']


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('::error::LIVE_CATALOG_NOT_VERIFIED')
        sys.exit(1)
