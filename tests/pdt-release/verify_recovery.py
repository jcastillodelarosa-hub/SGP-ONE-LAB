"""Verify the exact private backup and restored record before a release.

Only fixed error codes leave this process. Backup bytes and catalog stay in memory.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pdt-backup'))
from gcs_storage import BUCKET, PREFIX, PrivateStorage, SafeFailure

PROJECT = 'ocvxbwzqxbrfndkvjmfx'
MAX_AGE = datetime.timedelta(hours=6)


def pinned_record(storage, environment, now=None):
    """Read the exact recovery generation and archive identity from dispatch inputs."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    requested = environment.get('BACKUP_OBJECT', '')
    bucket_url = 'gs://' + BUCKET + '/'
    if not requested.startswith(bucket_url) or not requested.endswith('/database.dump'):
        raise SafeFailure('BACKUP_OBJECT_IDENTITY_MISMATCH')
    base = requested.removeprefix(bucket_url).removesuffix('database.dump')
    if not base.startswith(PREFIX) or not base.endswith('/'):
        raise SafeFailure('BACKUP_SOURCE_MISMATCH')
    generation = environment.get('RECOVERY_GENERATION', '')
    size = environment.get('RECOVERY_BYTES', '')
    digest = environment.get('RECOVERY_SHA256', '').lower()
    if (not re.fullmatch(r'[1-9][0-9]*', generation)
            or not re.fullmatch(r'[1-9][0-9]*', size)
            or not re.fullmatch(r'[0-9a-f]{64}', digest)):
        raise SafeFailure('RECOVERY_OBJECT_IDENTITY_INVALID')
    recovery = storage.get({'name': base + 'recovery-verified.json',
                            'generation': generation, 'bytes': int(size), 'sha256': digest})
    verified = json.loads(recovery)
    objects = verified.get('objects', {})
    required = {'database': 'database.dump', 'globals': 'globals.sql',
                'catalog_and_counts': 'catalog-and-counts.json'}
    for key, filename in required.items():
        item = objects.get(key, {})
        if item.get('name') != base + filename or not re.fullmatch(r'[1-9][0-9]*', str(item.get('generation', ''))):
            raise SafeFailure('BACKUP_OBJECT_IDENTITY_MISMATCH')
    archive = objects['database']
    if requested != 'gs://' + BUCKET + '/' + archive['name']:
        raise SafeFailure('BACKUP_OBJECT_IDENTITY_MISMATCH')
    expected = environment.get('BACKUP_SHA256', '').lower()
    if not re.fullmatch('[0-9a-f]{64}', expected) or archive.get('sha256') != expected:
        raise SafeFailure('BACKUP_HASH_MISMATCH')
    checks = verified.get('verification', {})
    if (verified.get('status') != 'POSTGRES_BACKUP_RESTORED_VERIFIED'
            or verified.get('project_ref') != PROJECT or verified.get('bucket') != BUCKET
            or verified.get('prefix') != base
            or verified.get('production_writes') is not False
            or verified.get('source_consistent_snapshot') is not True
            or any(checks.get(k) is not True for k in
                   ('table_counts_equal', 'catalog_sections_equal',
                    'archive_sha256_checked_on_download', 'postgres_scope_only'))
            or checks.get('restore_network') != 'none'
            or checks.get('source_writes') is not False):
        raise SafeFailure('RESTORE_PROOF_INCOMPLETE')
    age = now - datetime.datetime.fromisoformat(verified['created_utc'].replace('Z', '+00:00'))
    if not datetime.timedelta(0) <= age <= MAX_AGE:
        raise SafeFailure('BACKUP_NOT_FRESH')
    started = environment.get('BACKUP_RUN_START')
    finished = environment.get('BACKUP_RUN_END')
    if not started or not finished:
        raise SafeFailure('BACKUP_RUN_NOT_LINKED')
    created = datetime.datetime.fromisoformat(verified['created_utc'].replace('Z', '+00:00'))
    run_started = datetime.datetime.fromisoformat(started.replace('Z', '+00:00'))
    run_finished = datetime.datetime.fromisoformat(finished.replace('Z', '+00:00'))
    # A recovery job may verify a backup created before that job started.
    # The pinned proof and archive identities are checked independently.
    if not (run_started <= run_finished and created <= run_finished <= now):
        raise SafeFailure('BACKUP_RUN_NOT_LINKED')
    return verified


def checked_record(storage, environment, now=None):
    """Verify pinned proof against its backup record and archive bytes."""
    verified = pinned_record(storage, environment, now)
    manifest = storage.latest_backup_manifest()
    if (manifest.get('project_ref') != PROJECT or manifest.get('bucket') != BUCKET
            or manifest.get('prefix') != verified['prefix']
            or manifest.get('objects') != verified['objects']
            or manifest.get('created_utc') != verified['created_utc']):
        raise SafeFailure('BACKUP_RECORD_RECOVERY_MISMATCH')
    archive = verified['objects']['database']
    expected = environment['BACKUP_SHA256'].lower()
    # The archive was hashed in the isolated restore and is read again from
    # the pinned immutable generation. Do not print its bytes or catalog.
    if hashlib.sha256(storage.get(archive)).hexdigest() != expected:
        raise SafeFailure('BACKUP_HASH_MISMATCH')
    return verified


def main():
    storage = PrivateStorage(read_only=True)
    storage.verify_boundary()
    checked_record(storage, os.environ)
    print('PRIVATE_RESTORE_HASH_COUNTS_CATALOG_VERIFIED')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('::error::RESTORE_EVIDENCE_NOT_VERIFIED')
        sys.exit(1)
