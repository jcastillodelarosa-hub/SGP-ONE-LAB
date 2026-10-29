"""Small, isolated checks of release gates. No production or GCS connection."""
import datetime
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from verify_recovery import BUCKET, PREFIX, checked_record
from compare_live_catalog import catalog_snapshot, compare, SECTIONS
from prepare_cutover import render
from artifact_digest import digest
from validate_connection import valid
from gcs_storage import PrivateStorage, SafeFailure, boundary


class Storage:
    def __init__(self):
        self.archive = b'isolated archive fixture'
        self.base = PREFIX + '20261029T120000Z-fixture/'
        self.objects = {
            name: {'name': self.base + filename, 'generation': '7',
                   'bytes': len(self.archive), 'sha256': hashlib.sha256(self.archive).hexdigest()}
            for name, filename in (('database', 'database.dump'), ('globals', 'globals.sql'),
                                   ('catalog_and_counts', 'catalog-and-counts.json'))
        }
        self.manifest = {'project_ref': 'ocvxbwzqxbrfndkvjmfx', 'bucket': BUCKET,
                         'prefix': self.base, 'objects': self.objects,
                         'created_utc': '2026-10-29T12:00:00Z'}
        self.verified = {**self.manifest, 'status': 'POSTGRES_BACKUP_RESTORED_VERIFIED',
                         'production_writes': False, 'source_consistent_snapshot': True,
                         'verification': {key: True for key in
                                          ('table_counts_equal', 'catalog_sections_equal',
                                           'archive_sha256_checked_on_download', 'postgres_scope_only')}}
        self.verified['verification'].update(restore_network='none', source_writes=False)

    def latest_backup_manifest(self):
        return self.manifest

    def get(self, item):
        if item['name'].endswith('/recovery-verified.json'):
            if (item['name'] != self.base + 'recovery-verified.json'
                    or item['generation'] != '8' or item['sha256'] != 'a' * 64
                    or item['bytes'] != 100):
                raise SafeFailure('PIN_MISMATCH')
            return json.dumps(self.verified).encode()
        if item['name'].endswith('/catalog-and-counts.json'):
            if item != self.verified['objects']['catalog_and_counts']:
                raise SafeFailure('CATALOG_REDIRECTED')
            return json.dumps({'catalog': {'funciones': [{'firma': 'from-verified-backup'}]}}).encode()
        return self.archive

    def environment(self):
        return {'BACKUP_OBJECT': 'gs://' + BUCKET + '/' + self.objects['database']['name'],
                'BACKUP_SHA256': self.objects['database']['sha256'],
                'RECOVERY_GENERATION': '8', 'RECOVERY_BYTES': '100',
                'RECOVERY_SHA256': 'a' * 64,
                'BACKUP_RUN_START': '2026-10-29T11:55:00Z',
                'BACKUP_RUN_END': '2026-10-29T12:20:00Z'}


class ReleaseControls(unittest.TestCase):
    def test_newer_backup_between_steps_cannot_redirect_catalog(self):
        storage = Storage()
        env = storage.environment()
        now = datetime.datetime(2026, 10, 29, 12, 30, tzinfo=datetime.timezone.utc)
        checked_record(storage, env, now)
        original = storage.verified['objects']['catalog_and_counts'].copy()
        storage.manifest = {'prefix': PREFIX + '20261029T121000Z-newer/',
                            'objects': {'catalog_and_counts': {'name': 'newer-secret-catalog'}}}
        self.assertEqual(catalog_snapshot(storage, env, now),
                         {'funciones': [{'firma': 'from-verified-backup'}]})
        self.assertEqual(storage.verified['objects']['catalog_and_counts'], original)
        env['BACKUP_SHA256'] = 'b' * 64
        with self.assertRaises(SafeFailure):
            catalog_snapshot(storage, env, now)
        env = storage.environment()
        env['RECOVERY_GENERATION'] = '9'
        with self.assertRaises(SafeFailure):
            catalog_snapshot(storage, env, now)

    def test_release_storage_downscope_is_read_only(self):
        permissions = boundary(True)['accessBoundary']['accessBoundaryRules'][0]['availablePermissions']
        self.assertEqual(permissions, ['inRole:roles/storage.objectViewer'])
        storage = object.__new__(PrivateStorage)
        storage.read_only = True
        with self.assertRaises(SafeFailure):
            storage.put(PREFIX + 'fixture', b'private')

    def test_restore_proof_links_exact_archive_and_snapshot(self):
        storage = Storage()
        now = datetime.datetime(2026, 10, 29, 12, 30, tzinfo=datetime.timezone.utc)
        self.assertEqual(checked_record(storage, storage.environment(), now), storage.verified)
        for change in ('object', 'hash', 'catalog', 'network', 'age', 'run'):
            with self.subTest(change=change):
                storage = Storage()
                env = storage.environment()
                clock = now
                if change == 'object': env['BACKUP_OBJECT'] += '-other'
                if change == 'hash': env['BACKUP_SHA256'] = 'b' * 64
                if change == 'catalog': storage.verified['verification']['catalog_sections_equal'] = False
                if change == 'network': storage.verified['verification']['restore_network'] = 'bridge'
                if change == 'age': clock += datetime.timedelta(hours=7)
                if change == 'run': env['BACKUP_RUN_END'] = '2026-10-29T11:59:00Z'
                with self.assertRaises(Exception):
                    checked_record(storage, env, clock)

    def test_recovery_job_may_verify_earlier_backup_but_not_future_backup(self):
        storage = Storage()
        env = storage.environment()
        env['BACKUP_RUN_START'] = '2026-10-29T12:10:00Z'
        now = datetime.datetime(2026, 10, 29, 12, 30, tzinfo=datetime.timezone.utc)
        self.assertEqual(checked_record(storage, env, now), storage.verified)
        env['BACKUP_RUN_END'] = '2026-10-29T11:59:00Z'
        with self.assertRaises(SafeFailure):
            checked_record(storage, env, now)
        env['BACKUP_RUN_END'] = '2026-10-29T12:31:00Z'
        with self.assertRaises(SafeFailure):
            checked_record(storage, env, now)

    def test_catalog_diff_includes_permissions_and_rls(self):
        baseline = {section: [] for section in SECTIONS}
        self.assertEqual(compare(baseline, dict(baseline)), [])
        changed = dict(baseline)
        changed['funciones'] = [{'firma': 'safe-signature', 'execute_efectivo': {'anon': True}}]
        changed['relaciones'] = [{'nombre': 'public.fixture', 'rls': False}]
        self.assertEqual(compare(baseline, changed), ['funciones', 'relaciones'])
        a = dict(baseline, roles=[{'rolname': 'anon'}, {'rolname': 'authenticated'}])
        b = dict(baseline, roles=list(reversed(a['roles'])))
        self.assertEqual(compare(a, b), [])

    def test_cutover_uses_database_clock_and_rejects_template_drift(self):
        template = ("DO $$ BEGIN IF position('REPLACE_' IN 'REPLACE_WITH_PUBLICATION_UTC')>0 "
                    "OR position('REPLACE_' IN 'REPLACE_WITH_ADMIN_USER')>0 THEN RAISE EXCEPTION 'guard'; END IF; END $$;\n"
                    "INSERT INTO sgp_pdt_manual.corte_operativo(id,desde,activado_por) "
                    "VALUES(1,'REPLACE_WITH_PUBLICATION_UTC'::timestamptz,'REPLACE_WITH_ADMIN_USER');")
        rendered = render(template)
        self.assertIn('clock_timestamp()', rendered)
        self.assertIn('RETURNING to_char(desde AT TIME ZONE', rendered)
        self.assertNotIn('REPLACE_WITH_', rendered)
        with self.assertRaises(ValueError):
            render(template.replace('VALUES(1,', 'VALUES(2,'))

    def test_frontend_digest_changes_with_artifact_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text('<h1>PDT</h1>')
            (root / 'app.js').write_text('const x=1')
            first = digest(root)
            (root / 'app.js').write_text('const x=2')
            self.assertNotEqual(first, digest(root))
            (root / 'tests').mkdir()
            (root / 'tests' / 'ignored.js').write_text('fixture')
            self.assertEqual(digest(root), digest(root))

    def test_production_url_is_scoped_to_project_pooler_and_tls(self):
        url = ('postgresql://postgres.ocvxbwzqxbrfndkvjmfx:encoded%40password@'
               'aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require')
        self.assertTrue(valid(url))
        for bad in (url.replace('ocvxbwzqxbrfndkvjmfx', 'other-project'),
                    url.replace('sslmode=require', 'sslmode=disable'),
                    url.replace('aws-0-us-east-2.pooler.supabase.com', 'localhost'),
                    url + '\nDATABASE_URL=other', ''):
            self.assertFalse(valid(bad))

    def test_workflow_orders_guards_before_first_write_and_never_restores_automatically(self):
        workflow = (Path(__file__).resolve().parents[2] /
                    '.github/workflows/pdt-unified-production-release.yml').read_text()
        order = ('Build and test before any production writes',
                 'Verify isolated restoration evidence and freshness',
                 'Compare live RPC, RLS, grants and dependencies with verified snapshot',
                 'Production release interlock — protected approval required',
                 'Install pinned SQL phases',
                 'Activate cutover at actual execution instant',
                 'Deploy Firebase Hosting',
                 'Verify backend after deployment without writes')
        positions = [workflow.index('- name: ' + label) for label in order]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("if: github.ref == 'refs/heads/main'", workflow)
        self.assertIn('cancel-in-progress: false', workflow)
        self.assertIn("PUBLISH_ENABLED: ${{ vars.PDT_PUBLISH_ENABLED }}", workflow)
        self.assertIn("'feat/pdt-multifabricacion-avances-nc': ('Supabase - private PostgreSQL backup and isolated recovery',)", workflow)
        self.assertIn("j['name'] in allowed_proof_jobs[data['head_branch']]", workflow)
        self.assertNotIn('pg_restore --clean', workflow)
        self.assertNotIn('06_ROLLBACK_REVIEW.sql\n          docker', workflow)


    def test_publish_keeps_pinned_evidence_and_validated_connection(self):
        workflow = (Path(__file__).resolve().parents[2] /
                    '.github/workflows/pdt-unified-production-release.yml').read_text()
        verify = workflow.split('- name: Verify isolated restoration evidence and freshness', 1)[1].split('- name: Compare live RPC', 1)[0]
        compare = workflow.split('- name: Compare live RPC', 1)[1].split('- name: Production release interlock', 1)[0]
        for key in ('BACKUP_OBJECT', 'BACKUP_SHA256', 'RECOVERY_GENERATION',
                    'RECOVERY_BYTES', 'RECOVERY_SHA256'):
            line = key + ': ' + '
    unittest.main()
 + '{{ inputs.' + key.lower() + ' }}'
            self.assertIn(line, verify)
            self.assertIn(line, compare)
        self.assertIn('run: python3 tests/pdt-release/verify_recovery.py', verify)
        self.assertIn('run: python3 tests/pdt-release/compare_live_catalog.py', compare)
        self.assertIn('out.write("DATABASE_URL=" + url +', (Path(__file__).resolve().parent /
                      'validate_connection.py').read_text())
        self.assertIn('docker run --rm -e DATABASE_URL', workflow)
        self.assertIn('run: python3 tests/pdt-release/post_release.py', workflow)


if __name__ == '__main__':
    unittest.main()
