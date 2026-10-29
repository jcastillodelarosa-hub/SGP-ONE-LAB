"""Focused read-only preflight diagnostics; no database or credentials."""
import os
import subprocess
import unittest
from unittest.mock import patch

import live_preflight


class PreflightDiagnostics(unittest.TestCase):
    def test_sql_remains_read_only_and_rolls_back(self):
        self.assertIn('BEGIN READ ONLY;', live_preflight.SQL)
        self.assertIn("current_setting('transaction_read_only')", live_preflight.SQL)
        self.assertTrue(live_preflight.SQL.rstrip().endswith('ROLLBACK;'))

    def test_failure_categories_never_echo_connection_details(self):
        examples = {
            'password authentication failed for user "postgres"': 'PDT_PREFLIGHT_AUTHENTICATION_FAILED',
            'connection refused at secret-host': 'PDT_PREFLIGHT_CONNECTION_FAILED',
            'permission denied for schema private': 'PDT_PREFLIGHT_PERMISSION_DENIED',
            'relation "private.fixture" does not exist': 'PDT_PREFLIGHT_OBJECT_MISSING',
            'syntax error at or near "secret"': 'PDT_PREFLIGHT_SQL_REJECTED',
            'PDT_PREFLIGHT_CUTOVER_ALREADY_INSTALLED': 'PDT_PREFLIGHT_CUTOVER_ALREADY_INSTALLED',
        }
        for stderr, expected in examples.items():
            with self.subTest(expected=expected):
                code = live_preflight.classify_failure(stderr + ' password=never-print', 1)
                self.assertEqual(code, expected)
                self.assertNotIn('never-print', code)
        self.assertEqual(live_preflight.classify_failure('unrecognized private details', 1),
                         'PDT_BASELINE_NOT_VERIFIED')

    def test_authenticated_psql_failure_is_reported_without_leaking_url(self):
        result = subprocess.CompletedProcess([], 2, '', 'password authentication failed; password=secret')
        with patch.dict(os.environ, {'DATABASE_URL': 'postgresql://user:secret@host/db'}):
            with patch.object(live_preflight.subprocess, 'run', return_value=result) as run:
                with self.assertRaisesRegex(RuntimeError, '^PDT_PREFLIGHT_AUTHENTICATION_FAILED$'):
                    live_preflight.main()
        args, kwargs = run.call_args
        self.assertTrue(any(value.startswith('PGOPTIONS=-c default_transaction_read_only=on')
                            for value in args[0]))
        self.assertTrue(kwargs['capture_output'])
        self.assertNotIn('secret', str(args[0]))

    def test_success_requires_both_read_only_and_baseline_markers(self):
        result = subprocess.CompletedProcess([], 0, 'PDT_BASELINE_READ_ONLY_PASS\n', '')
        with patch.dict(os.environ, {'DATABASE_URL': 'postgresql://user:secret@host/db'}):
            with patch.object(live_preflight.subprocess, 'run', return_value=result):
                with self.assertRaisesRegex(RuntimeError, '^PDT_BASELINE_NOT_VERIFIED$'):
                    live_preflight.main()


if __name__ == '__main__':
    unittest.main()
