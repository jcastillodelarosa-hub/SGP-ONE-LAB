#!/usr/bin/env python3
"""Mock-only lifecycle checks. Never launches Docker or connects to a database."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('incorporation_harness', Path(__file__).with_name('postgres17.py'))
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.failure = None
        self.cleanup_failure = False
        self.version = '170011'
        self.runner = patch.object(harness.subprocess, 'run', side_effect=self.fake_run)
        self.runner.start()
        self.addCleanup(self.runner.stop)
        self.db = patch.object(harness.Database, 'sql', side_effect=self.fake_sql)
        self.db.start()
        self.addCleanup(self.db.stop)

    def fake_run(self, argv, **kwargs):
        self.calls.append(argv)
        action = argv[2]
        if action == 'rm' and self.cleanup_failure:
            raise subprocess.TimeoutExpired(argv, 15)
        if action == self.failure:
            raise subprocess.CalledProcessError(1, argv)
        output = ''
        if action == 'logs':
            output = 'PostgreSQL init process complete'
        if action == 'exec' and 'psql' in argv:
            output = self.version + '\n'
        return subprocess.CompletedProcess(argv, 0, stdout=output, stderr='')

    def fake_sql(self, sql):
        if sql == 'SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id':
            return 'f'
        if sql == 'SELECT version()':
            return 'Mock PostgreSQL17; not a database execution'
        return ''

    def assert_cleanup(self, container):
        removals = [call for call in self.calls if call[2] == 'rm']
        self.assertEqual(removals, [container.docker + ['rm', '-f', container.container]])
        self.assertFalse(container.started)

    def test_readiness_timeout_cleans_without_context_exit(self):
        container = harness.Container()
        with patch.object(harness.time, 'monotonic', side_effect=[0, 100]):
            with self.assertRaisesRegex(RuntimeError, 'did not start'):
                container.__enter__()
        self.assert_cleanup(container)

    def test_version_assertion_cleans_without_context_exit(self):
        self.version = '180006'
        container = harness.Container()
        with self.assertRaises(AssertionError):
            container.__enter__()
        self.assert_cleanup(container)

    def test_fixture_sql_failure_cleans_without_context_exit(self):
        container = harness.Container()
        with patch.object(harness.Database, 'sql', side_effect=AssertionError('synthetic SQL failure')):
            with self.assertRaisesRegex(AssertionError, 'synthetic SQL failure'):
                container.__enter__()
        self.assert_cleanup(container)

    def test_run_failure_attempts_cleanup_in_case_creation_occurred(self):
        self.failure = 'run'
        container = harness.Container()
        with self.assertRaises(subprocess.CalledProcessError):
            container.__enter__()
        self.assert_cleanup(container)

    def test_cleanup_failure_preserves_setup_error_and_records_it(self):
        self.version = '180006'
        self.cleanup_failure = True
        container = harness.Container()
        with self.assertRaises(AssertionError) as caught:
            container.__enter__()
        self.assertTrue(container.started)
        self.assertIn('Container cleanup failed', caught.exception.__notes__[0])
        self.assertEqual(len([call for call in self.calls if call[2] == 'rm']), 1)

    def test_success_exit_is_idempotent(self):
        container = harness.Container()
        with container:
            self.assertTrue(container.started)
        container.close()
        self.assert_cleanup(container)

    def test_body_error_is_preserved_if_cleanup_also_fails(self):
        self.cleanup_failure = True
        container = harness.Container()
        with self.assertRaisesRegex(RuntimeError, 'body failed') as caught:
            with container:
                raise RuntimeError('body failed')
        self.assertIn('Container cleanup failed', caught.exception.__notes__[0])


if __name__ == '__main__':
    unittest.main(verbosity=2)
