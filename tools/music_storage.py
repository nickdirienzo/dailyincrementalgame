"""Private R2 snapshots of consumer music data; never upload runtimes or credentials.

Schema 2 stores each file once, as blobs/<sha256>, and a snapshot is a JSON manifest mapping
paths to hashes. A push uploads only blobs the remote head doesn't already reference, so no
upload approaches Wrangler's 300 MiB per-object limit and pushes stay small. Schema 1 heads
(one zip per snapshot) can still be pulled.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOTS = ('sessions', 'work', 'preferences')
SCHEMAS = (1, 2)
MAX_BLOB = 300 * 1024 * 1024  # Wrangler's per-object upload limit
PARALLEL = 8


def digest(path):
    # hashlib.file_digest needs Python 3.11; read in chunks so older interpreters work too.
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def is_hash(value):
    return isinstance(value, str) and len(value) == 64 and all(c in '0123456789abcdef' for c in value)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def safe_path(name):
    path = PurePosixPath(name)
    if ('\\' in name or path.is_absolute() or '..' in path.parts
            or len(path.parts) < 2 or path.parts[0] not in DATA_ROOTS
            or str(path) != name):
        raise ValueError(f'Unexpected snapshot path: {name}')
    return path


def inventory(home):
    files = {}
    for directory in DATA_ROOTS:
        base = home / directory
        if base.is_symlink():
            raise ValueError(f'Refusing symlink: {base}')
        if not base.exists():
            continue
        for path in sorted(base.rglob('*')):
            if path.is_symlink():
                raise ValueError(f'Refusing symlink: {path}')
            if path.is_file():
                name = path.relative_to(home).as_posix()
                safe_path(name)
                files[name] = digest(path)
    return files


def pack(home, destination, snapshot, names=None):
    files = inventory(home)
    if names is not None:
        files = {name: files[name] for name in names if name in files}
    manifest = {'schema': 1, 'snapshot': snapshot, 'files': files}
    with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
        archive.writestr('manifest.json', json.dumps(manifest))
        for name in files:
            archive.write(home / name, name)
    current = inventory(home)
    if any(current.get(name) != h for name, h in files.items()):
        raise ValueError('Music files changed while packing. Stop authoring and retry.')
    return manifest


def unpack(archive_path, destination, expected):
    with zipfile.ZipFile(archive_path) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        if manifest != expected:
            raise ValueError('Archive manifest does not match the selected snapshot')
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != {'manifest.json', *manifest['files']}:
            raise ValueError('Unexpected or duplicate archive members')
        for name, wanted in manifest['files'].items():
            safe_path(name)
            info = archive.getinfo(name)
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('Snapshot contains a symlink')
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(name) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output)
            if digest(target) != wanted:
                raise ValueError(f'Checksum mismatch: {name}')
    return manifest


def merge_plan(local, incoming, base):
    changed, conflicts = [], []
    for name, remote_hash in incoming.items():
        safe_path(name)
        local_hash = local.get(name)
        if local_hash == remote_hash:
            continue
        immutable = name.startswith('sessions/') and ('/revisions/' in name or '/events/' in name)
        if local_hash is None:
            changed.append(name)
        elif immutable:
            conflicts.append(name)
        elif local_hash == base.get(name):
            changed.append(name)
        elif remote_hash != base.get(name):
            conflicts.append(name)
        # Otherwise only the local copy changed; keep it for the next push.
    if conflicts:
        raise ValueError('Both copies differ; no files restored. Resolve these explicitly:\n' + '\n'.join(conflicts))
    return changed


class Storage:
    def __init__(self):
        self.config = json.loads((ROOT / 'music-storage.json').read_text())
        self.home = ROOT / '.slopwave'
        self.home.mkdir(exist_ok=True)
        self.state_path = self.home / 'sync-state.json'
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {'snapshot': None, 'files': {}}
        self.cache = self.home / 'backups'
        self.cache.mkdir(exist_ok=True)

    def wrangler(self, *args):
        cfg = self.config
        env = dict(os.environ, CLOUDFLARE_ACCOUNT_ID=cfg['account_id'], WRANGLER_SEND_METRICS='false')
        # Explicit named profile and account prevent accidental use of the default login.
        command = ['node', str(ROOT / 'node_modules/wrangler/bin/wrangler.js'), 'r2', *args,
                   '--profile', cfg['profile'], '--cwd', str(self.home), '--remote']
        done = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
        if done.returncode:
            raise ValueError(f'wrangler r2 {args[0]} {args[1]} failed:\n{done.stdout[-2000:]}{done.stderr[-2000:]}')

    def key(self, name):
        return f"{self.config['prefix']}/{name}"

    def transfer(self, verb, key, path):
        self.wrangler('object', verb, f"{self.config['bucket']}/{self.key(key)}", '--file', str(path))

    def put_blobs(self, hashes, paths):
        """Uploads blobs (hash -> local path) with one bulk call."""
        for h in hashes:
            if paths[h].stat().st_size > MAX_BLOB:
                raise ValueError(f'{paths[h]} is over 300 MiB; Wrangler cannot upload it.')
        with tempfile.TemporaryDirectory(dir=self.cache) as temporary:
            listing = Path(temporary) / 'blobs.json'
            listing.write_text(json.dumps([{'key': self.key(f'blobs/{h}'), 'file': str(paths[h])} for h in hashes]))
            self.wrangler('bulk', 'put', self.config['bucket'], '--filename', str(listing), '--concurrency', '8')

    def get_blobs(self, hashes, directory):
        """Downloads blobs into directory/<hash>, verifying each one."""
        def one(h):
            target = directory / h
            self.transfer('get', f'blobs/{h}', target)
            if digest(target) != h:
                raise ValueError(f'Checksum mismatch for blob {h}')
        with ThreadPoolExecutor(PARALLEL) as pool:
            list(pool.map(one, sorted(hashes)))

    def head(self):
        with tempfile.TemporaryDirectory(dir=self.cache) as temporary:
            target = Path(temporary) / 'latest.json'
            self.transfer('get', 'latest.json', target)
            head = json.loads(target.read_text())
        if head.get('schema') not in SCHEMAS:
            raise ValueError('Unknown remote snapshot schema; update this repository (git pull) first.')
        if head.get('schema') == 2 and not all(is_hash(h) for h in head['files'].values()):
            raise ValueError('Remote manifest has an invalid file hash')
        return head

    def push(self):
        head = self.head()
        if head['snapshot'] != self.state['snapshot']:
            raise ValueError('R2 has a different snapshot. Run npm run music:pull first.')
        current = inventory(self.home)
        if set(self.state['files']) - set(current):
            raise ValueError('Previously synced files are missing locally. Restore them before pushing.')
        # A schema 1 head still needs one push to move every file into blobs.
        if head['snapshot'] and current == self.state['files'] and head['schema'] == 2:
            print('Music history is already backed up.'); return
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:12]
        # Blobs the remote head references are already in R2 (they were uploaded before it was published).
        known = set(head['files'].values()) if head.get('schema') == 2 else set()
        paths = {}
        for name, h in current.items():
            paths.setdefault(h, self.home / name)
        fresh = sorted(set(paths) - known)
        if fresh:
            size = sum(paths[h].stat().st_size for h in fresh)
            print(f'Uploading {len(fresh)} new files ({size / 2**20:.1f} MiB)...')
            self.put_blobs(fresh, paths)
        if inventory(self.home) != current:
            raise ValueError('Music files changed while uploading. Stop authoring and retry.')
        # Uploaded blobs stay valid even if a second writer advances the head meanwhile.
        if self.head() != head:
            raise ValueError('Remote changed during upload; pull before retrying (uploaded files are kept).')
        manifest = {'schema': 2, 'snapshot': stamp, 'files': current}
        remote = manifest
        pointer = self.cache / (stamp + '.json')
        write_json(pointer, remote)
        self.transfer('put', f'snapshots/{stamp}.json', pointer)
        self.transfer('put', 'latest.json', pointer)
        if self.head() != remote:
            raise ValueError('Remote changed after upload; pull before continuing.')
        write_json(self.state_path, manifest); self.state = manifest
        print(f'Backed up {len(manifest["files"])} files as {stamp}.')

    def pull(self):
        head = self.head()
        if head['snapshot'] is None:
            print('The music bucket is empty.'); return
        snapshot = head['snapshot']
        if not isinstance(snapshot, str) or not all(c.isalnum() or c == '-' for c in snapshot):
            raise ValueError('Invalid snapshot identifier')
        with tempfile.TemporaryDirectory(dir=self.cache) as temporary:
            temporary = Path(temporary)
            incoming = {key: head[key] for key in ('schema', 'snapshot', 'files')}
            local = inventory(self.home)
            changed = merge_plan(local, incoming['files'], self.state['files'])
            if head['schema'] == 1:
                archive = temporary / 'snapshot.zip'
                self.transfer('get', f'snapshots/{snapshot}.zip', archive)
                if digest(archive) != head['archive_sha256']:
                    raise ValueError('Downloaded archive checksum does not match')
                extracted = temporary / 'extracted'
                unpack(archive, extracted, incoming)
                source = lambda name: extracted / name
            else:
                blobs = temporary / 'blobs'; blobs.mkdir()
                wanted = {incoming['files'][name] for name in changed}
                if wanted:
                    print(f'Downloading {len(wanted)} files...')
                self.get_blobs(wanted, blobs)
                source = lambda name: blobs / incoming['files'][name]
            if changed:
                # Back up only the local files this pull replaces.
                replaced = [name for name in changed if name in local]
                if replaced:
                    backup_id = 'before-pull-' + uuid.uuid4().hex
                    pack(self.home, self.cache / (backup_id + '.zip'), backup_id, replaced)
                # Preflight checks finish before writing anything into consumer data.
                if inventory(self.home) != local:
                    raise ValueError('Local music changed during restore; retry when authoring is idle.')
                for name in changed:
                    destination = self.home / name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    staging = destination.with_name(destination.name + '.r2-restore')
                    shutil.copyfile(source(name), staging)
                    staging.replace(destination)
            write_json(self.state_path, incoming); self.state = incoming
            print(f'Pulled {snapshot}: restored {len(changed)} files; retained local-only work.')

    def verify(self):
        # Exercise the actual pull path against an empty workspace, like a second Mac.
        with tempfile.TemporaryDirectory(dir=self.cache) as temporary:
            fresh = object.__new__(Storage)
            fresh.config = self.config
            fresh.home = Path(temporary)
            fresh.cache = fresh.home / 'backups'
            fresh.cache.mkdir()
            fresh.state_path = fresh.home / 'sync-state.json'
            fresh.state = {'snapshot': None, 'files': {}}
            fresh.pull()
            restored = json.loads(fresh.state_path.read_text())
            if inventory(fresh.home) != restored['files']:
                raise ValueError('Fresh restore inventory differs from its manifest')
            print(f'Verified a fresh restore of {len(restored["files"])} files.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['push', 'pull', 'status', 'verify'])
    args = parser.parse_args()
    storage = Storage()
    try:
        if args.command == 'status':
            head = storage.head()
            current = inventory(storage.home)
            print(json.dumps({'remote_snapshot': head['snapshot'], 'local_snapshot': storage.state['snapshot'],
                              'local_changes': current != storage.state['files'], 'local_files': len(current)}, indent=2))
        else:
            getattr(storage, args.command)()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
