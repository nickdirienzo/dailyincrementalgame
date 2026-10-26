"""Private R2 snapshots of consumer music data; never upload runtimes or credentials."""
import argparse
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


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


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


def pack(home, destination, snapshot):
    files = inventory(home)
    manifest = {'schema': 1, 'snapshot': snapshot, 'files': files}
    with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
        archive.writestr('manifest.json', json.dumps(manifest))
        for name in files:
            archive.write(home / name, name)
    if inventory(home) != files:
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

    def transfer(self, verb, key, path):
        cfg = self.config
        env = dict(os.environ, CLOUDFLARE_ACCOUNT_ID=cfg['account_id'], WRANGLER_SEND_METRICS='false')
        # Explicit named profile and account prevent accidental use of the default login.
        command = ['node', str(ROOT / 'node_modules/wrangler/bin/wrangler.js'),
                   'r2', 'object', verb, f"{cfg['bucket']}/{cfg['prefix']}/{key}",
                   '--profile', cfg['profile'], '--cwd', str(self.home), '--remote', '--file', str(path)]
        subprocess.run(command, cwd=ROOT, env=env, check=True)

    def head(self):
        with tempfile.TemporaryDirectory(dir=self.cache) as temporary:
            target = Path(temporary) / 'latest.json'
            self.transfer('get', 'latest.json', target)
            head = json.loads(target.read_text())
        if head.get('schema') != 1:
            raise ValueError('Unknown remote snapshot schema')
        return head

    def push(self):
        head = self.head()
        if head['snapshot'] != self.state['snapshot']:
            raise ValueError('R2 has a different snapshot. Run npm run music:pull first.')
        current = inventory(self.home)
        if set(self.state['files']) - set(current):
            raise ValueError('Previously synced files are missing locally. Restore them before pushing.')
        if head['snapshot'] and current == self.state['files']:
            print('Music history is already backed up.'); return
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:12]
        archive = self.cache / (stamp + '.zip')
        manifest = pack(self.home, archive, stamp)
        remote = {**manifest, 'archive_sha256': digest(archive)}
        self.transfer('put', f'snapshots/{stamp}.zip', archive)
        # Retain the named archive even if a second writer advances the head meanwhile.
        if self.head() != head:
            raise ValueError(f'Remote changed during upload. Snapshot {stamp} is preserved; pull before retrying.')
        pointer = self.cache / (stamp + '.json')
        write_json(pointer, remote)
        self.transfer('put', f'snapshots/{stamp}.json', pointer)
        self.transfer('put', 'latest.json', pointer)
        if self.head() != remote:
            raise ValueError('Remote changed after upload; pull before continuing.')
        write_json(self.state_path, manifest)
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
            archive = temporary / 'snapshot.zip'
            self.transfer('get', f'snapshots/{snapshot}.zip', archive)
            if digest(archive) != head['archive_sha256']:
                raise ValueError('Downloaded archive checksum does not match')
            incoming = {key: head[key] for key in ('schema', 'snapshot', 'files')}
            extracted = temporary / 'extracted'
            unpack(archive, extracted, incoming)
            local = inventory(self.home)
            changed = merge_plan(local, incoming['files'], self.state['files'])
            if changed:
                backup_id = 'before-pull-' + uuid.uuid4().hex
                pack(self.home, self.cache / (backup_id + '.zip'), backup_id)
                # Preflight checks finish before writing anything into consumer data.
                if inventory(self.home) != local:
                    raise ValueError('Local music changed during restore; retry when authoring is idle.')
                for name in changed:
                    destination = self.home / name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    staging = destination.with_name(destination.name + '.r2-restore')
                    shutil.copyfile(extracted / name, staging)
                    staging.replace(destination)
            write_json(self.state_path, incoming)
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
