#!/usr/bin/env python3
"""Host-only controller. Install outside the agent workspace, owned by root.

Only fixed Zorza operations are accepted. Never execute a submitted command,
Dockerfile, Compose definition, package lifecycle script or host-side test.
"""
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import shutil
import socketserver
import sqlite3
import stat
import subprocess
import threading
import time
import uuid

SOURCE = Path('/opt/zorza/source')
STATE = Path('/opt/zorza/deploy-state')
CONFIG = Path('/opt/zorza/config')
SOCKET = Path('/opt/zorza/deploy-run/control.sock')
DATA = Path('/opt/zorza/data')
TOP_FILES = {'package.json', 'server.mjs', 'catalog.json', 'sources.json', 'quote-sources.json'}
TOP_DIRS = {'lib', 'scripts', 'public', 'test'}
BUSY = {'preparing', 'testing', 'deploying'}
MAX_FILE = 24 * 1024 * 1024
MAX_TOTAL = 160 * 1024 * 1024


class CommandFailed(RuntimeError):
    def __init__(self, output):
        super().__init__('Polecenie serwera nie powiodło się')
        self.output = output[-6000:]


def atomic_json(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    temp.chmod(0o600)
    temp.replace(path)


def freeze(source, destination):
    """Copy through directory descriptors: no symlink traversal, even during edits."""
    manifest = {}
    total = 0
    count = 0
    destination.mkdir(mode=0o700)

    def visit(fd, relative=''):
        nonlocal total, count
        for name in sorted(os.listdir(fd)):
            if not relative and name not in TOP_FILES | TOP_DIRS:
                continue
            if name in {'.git', 'node_modules', '__pycache__'}:
                continue
            info = os.stat(name, dir_fd=fd, follow_symlinks=False)
            rel = f'{relative}/{name}' if relative else name
            if stat.S_ISDIR(info.st_mode):
                if not relative and name not in TOP_DIRS:
                    raise ValueError('Nieprawidłowy katalog źródłowy')
                child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                try:
                    (destination / rel).mkdir(mode=0o700)
                    visit(child, rel)
                finally:
                    os.close(child)
            elif stat.S_ISREG(info.st_mode):
                count += 1
                if count > 6000 or info.st_size > MAX_FILE:
                    raise ValueError('Przekroczony limit plików wersji')
                child = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
                try:
                    with os.fdopen(child, 'rb') as src:
                        if not stat.S_ISREG(os.fstat(src.fileno()).st_mode):
                            raise ValueError('Zmienił się typ pliku źródłowego')
                        data = src.read(MAX_FILE + 1)
                    total += len(data)
                    if len(data) > MAX_FILE or total > MAX_TOTAL:
                        raise ValueError('Przekroczony rozmiar wersji')
                    (destination / rel).write_bytes(data)
                    (destination / rel).chmod(0o444)
                    manifest[rel] = hashlib.sha256(data).hexdigest()
                except BaseException:
                    raise
            else:
                raise ValueError('Wersja zawiera dowiązanie lub plik specjalny')

    root = os.open(source, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        visit(root)
    finally:
        os.close(root)
    if not TOP_FILES.issubset(manifest) or not any(p.startswith('test/') and p.endswith('.test.mjs') for p in manifest):
        raise ValueError('Niekompletna wersja aplikacji')
    for directory, _, _ in os.walk(destination, topdown=False):
        Path(directory).chmod(0o555)
    return manifest


class Controller:
    def __init__(self, source=SOURCE, state=STATE, config=CONFIG, data=DATA, runner=None):
        self.source, self.root, self.config, self.data = map(Path, (source, state, config, data))
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.guard = threading.Lock()
        self.runner = runner or self.command
        self.status_file = self.root / 'status.json'
        self.current = json.loads(self.status_file.read_text()) if self.status_file.exists() else {'phase': 'idle'}
        if self.current.get('phase') in BUSY:
            # No automatic retry after a restart: an administrator must inspect it.
            self.current.update(phase='interrupted', message='Przerwano proces. Wymagana kontrola administratorki.')
            atomic_json(self.status_file, self.current)

    @staticmethod
    def command(args, timeout=300):
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, cwd='/')
        if result.returncode:
            # Full output stays in the root-only journal; never expose runtime env.
            print('Zorza deploy command failed:', args[0:3], result.stdout[-4000:], result.stderr[-4000:], flush=True)
            raise CommandFailed(result.stdout + '\n' + result.stderr)
        return result.stdout.strip()

    def update(self, **values):
        with self.guard:
            self.current.update(values, updated_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
            atomic_json(self.status_file, self.current)

    def status(self):
        with self.guard:
            return dict(self.current, enabled=True)

    def compose(self, *args):
        return self.runner(['docker', 'compose', '-p', 'zorza', '-f', str(self.config / 'compose.yml'),
                            '-f', str(self.config / 'deployment-access.json'),
                            '-f', str(self.config / 'deployment-override.json'), *args], timeout=180)

    def set_image(self, image):
        atomic_json(self.config / 'deployment-override.json', {'services': {'app': {'image': image}}})

    def prepare(self):
        with self.guard:
            if self.current.get('phase') in BUSY or self.current.get('phase') == 'interrupted':
                raise ValueError('Trwa wdrożenie lub wymagana jest kontrola serwera')
            identifier = uuid.uuid4().hex
            self.current = {'id': identifier, 'phase': 'preparing', 'message': 'Zapisywanie wersji…', 'files': []}
            atomic_json(self.status_file, self.current)
        threading.Thread(target=self.prepare_work, args=(identifier,), daemon=True).start()
        return self.status()

    def prepare_work(self, identifier):
        directory = self.root / identifier
        try:
            if shutil.disk_usage(self.root).free < 2 * 1024 ** 3:
                raise ValueError('Za mało miejsca na bezpieczne przygotowanie wersji')
            self.prune(identifier)
            directory.mkdir(mode=0o700)
            manifest = freeze(self.source, directory / 'source')
            baseline_path = self.root / 'baseline.json'
            baseline = json.loads(baseline_path.read_text()) if baseline_path.exists() else {}
            changes = [{'path': p, 'change': 'dodano' if p not in baseline else 'usunięto' if p not in manifest else 'zmieniono'}
                       for p in sorted(set(manifest) | set(baseline)) if manifest.get(p) != baseline.get(p)]
            atomic_json(directory / 'manifest.json', manifest)
            self.update(phase='testing', message='Testowanie zapisanej wersji…', files=changes)
            if not changes:
                self.update(phase='no_changes', message='Brak zmian do wdrożenia.')
                return
            # Run project tests as an unprivileged isolated process with no data,
            # network, host config, Docker socket, ChatGPT login or API secrets.
            tests = sorted(p for p in manifest if p.startswith('test/') and p.endswith('.test.mjs'))
            self.runner(['docker', 'run', '--rm', '--name', 'zorza-deploy-test', '--network', 'none',
                         '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL',
                         '--security-opt', 'no-new-privileges:true', '--pids-limit', '128',
                         '--memory', '768m', '--cpus', '1', '--tmpfs', '/tmp:rw,nosuid,nodev,size=128m',
                         '-v', f'{directory / "source"}:/workspace:ro', '-w', '/workspace',
                         'node:24-bookworm-slim', 'node', '--test', *tests], timeout=180)
            self.runner(['docker', 'build', '--network', 'none', '--file', str(self.config / 'Deployment.Dockerfile'),
                         '--tag', f'zorza-release:{identifier}', str(directory / 'source')], timeout=180)
            self.update(phase='ready', message='Testy przeszły. Wersja gotowa do wdrożenia.', tested=True)
        except Exception as error:
            # Only isolated test/build output is publishable, never runtime output.
            self.update(phase='failed', message='Przygotowanie nie powiodło się. Działająca wersja pozostaje bez zmian.',
                        test_output=getattr(error, 'output', ''))

    def prune(self, preparing):
        active_path = self.root / 'active.json'
        active = json.loads(active_path.read_text()).get('id') if active_path.exists() else None
        versions = sorted((p for p in self.root.iterdir() if p.is_dir() and re.fullmatch('[a-f0-9]{32}', p.name)),
                          key=lambda p: p.stat().st_mtime, reverse=True)
        # Retain five recent attempts, the active release and the preparing one.
        for old in versions[5:]:
            if old.name in {preparing, active}:
                continue
            for tag in ('zorza-release:', 'zorza-rollback:'):
                try:
                    self.runner(['docker', 'image', 'rm', tag + old.name], timeout=20)
                except Exception:
                    pass  # Docker refuses removal of an in-use image.
            for parent, _, _ in os.walk(old):
                Path(parent).chmod(0o700)
            shutil.rmtree(old)

    def deploy(self, identifier):
        with self.guard:
            if self.current.get('phase') != 'ready' or identifier != self.current.get('id') or not re.fullmatch('[a-f0-9]{32}', identifier or ''):
                raise ValueError('Wersja nie jest gotowa albo została zastąpiona. Sprawdź zmiany ponownie.')
            self.current.update(phase='deploying', message='Wdrażanie zatwierdzonej wersji…')
            atomic_json(self.status_file, self.current)
        threading.Thread(target=self.deploy_work, args=(identifier,), daemon=True).start()
        return self.status()

    def healthy(self):
        # Run a fixed health probe, never a command from the request or workspace.
        self.runner(['docker', 'exec', 'zorza-app', 'node', '-e',
                     "Promise.all(['/health','/api/session'].map(p=>fetch('http://127.0.0.1:3000'+p).then(async r=>{if(!r.ok)throw Error();const v=await r.json();if(p==='/health'&&v.ok!==true)throw Error();if(p==='/api/session'&&typeof v.authenticated!=='boolean')throw Error();}))).catch(()=>process.exit(1))"], timeout=10)

    def wait_healthy(self):
        for _ in range(20):
            try:
                self.healthy()
                return
            except Exception:
                time.sleep(1)
        raise RuntimeError('Nowa wersja nie odpowiada')

    def backup_database(self, target):
        database = self.data / 'sygnal.sqlite'
        if database.exists():
            if database.is_symlink() or not database.is_file():
                raise ValueError('Nieprawidłowy plik bazy')
            with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as source, sqlite3.connect(target) as backup:
                source.backup(backup)
            os.chmod(target, 0o600)

    def restore_database(self, backup):
        if backup.exists():
            directory = os.open(self.data, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            temporary = '.restore-' + uuid.uuid4().hex
            try:
                fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
                with os.fdopen(fd, 'wb') as out, backup.open('rb') as source:
                    shutil.copyfileobj(source, out)
                    out.flush()
                    os.fsync(out.fileno())
                    if os.geteuid() == 0:
                        os.fchown(out.fileno(), 1000, 1000)
                for suffix in ('-wal', '-shm'):
                    try:
                        os.unlink('sygnal.sqlite' + suffix, dir_fd=directory)
                    except FileNotFoundError:
                        pass
                # Replace the entry itself; never write through a data-directory symlink.
                os.replace(temporary, 'sygnal.sqlite', src_dir_fd=directory, dst_dir_fd=directory)
            finally:
                os.close(directory)

    def deploy_work(self, identifier):
        stopped = False
        previous = None
        backup = self.root / identifier / 'database-before.sqlite'
        try:
            previous = self.runner(['docker', 'inspect', '--format', '{{.Image}}', 'zorza-app'], timeout=20)
            if not re.fullmatch(r'sha256:[a-f0-9]{64}', previous):
                raise RuntimeError('Brak poprzedniej wersji')
            rollback_tag = f'zorza-rollback:{identifier}'
            self.runner(['docker', 'tag', previous, rollback_tag], timeout=20)
            atomic_json(self.root / identifier / 'rollback.json', {'image': rollback_tag})
            # Bootstrap also works when no earlier deployment override exists.
            self.set_image(rollback_tag)
            self.compose('stop', 'app')
            stopped = True
            self.backup_database(backup)
            self.set_image(f'zorza-release:{identifier}')
            self.compose('up', '-d', '--no-deps', '--no-build', 'app')
            self.wait_healthy()
            atomic_json(self.root / 'baseline.json', json.loads((self.root / identifier / 'manifest.json').read_text()))
            atomic_json(self.root / 'active.json', {'id': identifier})
            self.update(phase='succeeded', message='Backend wdrożony i sprawdzony.', deployed_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
        except Exception:
            if stopped and previous:
                try:
                    self.compose('stop', 'app')
                    self.restore_database(backup)
                    self.set_image(f'zorza-rollback:{identifier}')
                    self.compose('up', '-d', '--no-deps', '--no-build', 'app')
                    self.wait_healthy()
                    self.update(phase='rolled_back', message='Nowa wersja nie zadziałała. Przywrócono poprzedni backend i dane sprzed wdrożenia.')
                    return
                except Exception:
                    self.update(phase='interrupted', message='Wymagana pomoc administratorki przy przywróceniu aplikacji.')
                    return
            self.update(phase='failed', message='Wdrożenie nie rozpoczęło się. Działająca wersja pozostaje bez zmian.')


def serve(controller, socket_path=SOCKET):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def handle_request(self):
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size < 0 or size > 1024:
                    raise ValueError('Nieprawidłowe żądanie')
                body = json.loads(self.rfile.read(size) or b'{}')
                if self.command == 'GET' and self.path == '/status':
                    result = controller.status()
                elif self.command == 'POST' and self.path == '/prepare' and body == {}:
                    result = controller.prepare()
                elif self.command == 'POST' and self.path == '/deploy' and set(body) == {'id'}:
                    result = controller.deploy(body['id'])
                else:
                    raise ValueError('Nieobsługiwana operacja')
                status_code = 200
            except (ValueError, TypeError, json.JSONDecodeError):
                status_code, result = 409, {'error': 'Operacja niedostępna. Sprawdź status wersji.'}
            data = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_POST = handle_request

    class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
        daemon_threads = True
        allow_reuse_address = True

    socket_path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
    socket_path.unlink(missing_ok=True)
    with Server(str(socket_path), Handler) as server:
        os.chown(socket_path, 1000, 1000)
        os.chmod(socket_path, 0o600)
        server.serve_forever()


if __name__ == '__main__':
    serve(Controller())
