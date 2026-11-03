import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from controller import Controller, TOP_FILES, freeze


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'workspace'
        self.source.mkdir()
        for name in TOP_FILES:
            (self.source / name).write_text('{}')
        (self.source / 'test').mkdir()
        (self.source / 'test' / 'example.test.mjs').write_text('test')
        self.config = self.root / 'config'
        self.config.mkdir()
        self.data = self.root / 'data'
        self.data.mkdir()

    def tearDown(self):
        for directory, dirs, files in os.walk(self.root):
            os.chmod(directory, 0o700)
            for name in files:
                if not (Path(directory) / name).is_symlink():
                    os.chmod(Path(directory) / name, 0o600)
        self.temp.cleanup()

    def controller(self, runner=None):
        return Controller(self.source, self.root / 'state', self.config, self.data, runner)

    def test_snapshot_excludes_credentials_and_does_not_follow_links(self):
        (self.source / '.env').write_text('private')
        manifest = freeze(self.source, self.root / 'snapshot')
        self.assertNotIn('.env', manifest)
        self.assertEqual((self.root / 'snapshot' / 'server.mjs').stat().st_mode & 0o777, 0o444)
        (self.source / 'server.mjs').unlink()
        (self.source / 'server.mjs').symlink_to(self.source / '.env')
        with self.assertRaises(ValueError):
            freeze(self.source, self.root / 'snapshot2')

    def test_snapshot_is_independent_of_later_edits(self):
        freeze(self.source, self.root / 'snapshot')
        (self.source / 'server.mjs').write_text('later change')
        self.assertEqual((self.root / 'snapshot' / 'server.mjs').read_text(), '{}')

    def test_prepare_tests_have_no_network_secrets_or_project_dockerfile(self):
        calls = []
        c = self.controller(lambda args, timeout: calls.append(args) or '')
        c.current = {'id': 'a' * 32, 'phase': 'preparing'}
        c.prepare_work('a' * 32)
        self.assertEqual(c.status()['phase'], 'ready')
        run, build = calls
        self.assertIn('none', run)
        self.assertIn('1000:1000', run)
        self.assertFalse(any('config:' in a or 'data:' in a or 'docker.sock' in a for a in run))
        self.assertIn(str(self.config / 'Deployment.Dockerfile'), build)
        self.assertNotIn('npm', run)

    def test_failed_tests_never_replace_application(self):
        def failing(args, timeout):
            raise RuntimeError('tests fail')
        c = self.controller(failing)
        c.current = {'id': 'b' * 32, 'phase': 'preparing'}
        c.prepare_work('b' * 32)
        self.assertEqual(c.status()['phase'], 'failed')
        self.assertFalse((self.config / 'deployment-override.json').exists())

    def test_deploy_requires_ready_version_and_matching_id(self):
        c = self.controller()
        for phase, identifier in [('idle', 'a' * 32), ('ready', 'b' * 32), ('ready', '../../bad')]:
            c.current = {'phase': phase, 'id': 'a' * 32}
            with self.assertRaises(ValueError):
                c.deploy(identifier)

    def test_interrupted_deployment_does_not_retry_automatically(self):
        c = self.controller()
        c.update(phase='deploying')
        restarted = self.controller()
        self.assertEqual(restarted.status()['phase'], 'interrupted')
        with self.assertRaises(ValueError):
            restarted.prepare()

    def test_health_failure_restores_image_and_database(self):
        dbpath = self.data / 'sygnal.sqlite'
        with sqlite3.connect(dbpath) as db:
            db.execute('CREATE TABLE example(value)')
            db.execute('INSERT INTO example VALUES(7)')
        calls = []
        def run(args, timeout):
            calls.append(args)
            if 'compose' in args:
                self.assertTrue((self.config / 'deployment-override.json').exists())
            return 'sha256:' + '1' * 64 if args[1] == 'inspect' else ''
        c = self.controller(run)
        identifier = 'c' * 32
        (c.root / identifier).mkdir()
        c.current = {'phase': 'deploying', 'id': identifier}
        checks = [False, True]
        def health():
            if not checks.pop(0):
                with sqlite3.connect(dbpath) as db:
                    db.execute('UPDATE example SET value=99')
                raise RuntimeError('failed startup')
        with patch.object(c, 'wait_healthy', health):
            c.deploy_work(identifier)
        self.assertEqual(c.status()['phase'], 'rolled_back')
        with sqlite3.connect(dbpath) as db:
            self.assertEqual(db.execute('SELECT value FROM example').fetchone()[0], 7)
        override = json.loads((self.config / 'deployment-override.json').read_text())
        self.assertEqual(override['services']['app']['image'], 'zorza-rollback:' + identifier)

    def test_database_restore_replaces_link_without_writing_its_target(self):
        c = self.controller()
        outside = self.root / 'outside.txt'
        outside.write_text('unchanged')
        (self.data / 'sygnal.sqlite').symlink_to(outside)
        backup = self.root / 'backup.sqlite'
        backup.write_bytes(b'safe database contents')
        c.restore_database(backup)
        self.assertEqual(outside.read_text(), 'unchanged')
        self.assertFalse((self.data / 'sygnal.sqlite').is_symlink())
        self.assertEqual((self.data / 'sygnal.sqlite').read_bytes(), backup.read_bytes())


if __name__ == '__main__':
    unittest.main()
