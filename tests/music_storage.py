"""Exercise restore safety and completeness without cloud credentials."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('music_storage', Path(__file__).resolve().parents[1] / 'tools/music_storage.py')
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class StorageTests(unittest.TestCase):
    def test_round_trip_excludes_machine_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            home = root / 'source'
            for name in ['sessions/a/events/e.json', 'work/notes.txt', 'preferences/p.json',
                         'toolchain/private.txt', 'config.json', 'sync-state.json', 'backups/old.zip']:
                p = home / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(name)
            archive = root / 'snapshot.zip'
            manifest = storage.pack(home, archive, 'test')
            self.assertEqual(set(manifest['files']), {'sessions/a/events/e.json', 'work/notes.txt', 'preferences/p.json'})
            restored = root / 'restored'
            storage.unpack(archive, restored, manifest)
            self.assertEqual(storage.inventory(restored), manifest['files'])

    def test_three_way_restore_preserves_local_work(self):
        base = {'work/a': 'old', 'work/b': 'old'}
        local = {'work/a': 'old', 'work/b': 'local', 'work/local': 'unique'}
        remote = {'work/a': 'new', 'work/b': 'old', 'work/new': 'new'}
        self.assertEqual(storage.merge_plan(local, remote, base), ['work/a', 'work/new'])

    def test_conflicting_edits_stop_restore(self):
        with self.assertRaisesRegex(ValueError, 'Both copies differ'):
            storage.merge_plan({'work/a': 'local'}, {'work/a': 'remote'}, {'work/a': 'base'})

    def test_immutable_revision_cannot_be_replaced(self):
        name = 'sessions/a/revisions/r-a/score.json'
        with self.assertRaises(ValueError):
            storage.merge_plan({name: 'old'}, {name: 'changed'}, {name: 'old'})

    def test_corrupt_and_unsafe_archives_are_rejected(self):
        for name in ['work/a', 'work/../../config.json', '/work/a', 'config.json']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                manifest = {'schema': 1, 'snapshot': 'test', 'files': {name: 'incorrect-hash'}}
                archive = root / 'bad.zip'
                with zipfile.ZipFile(archive, 'w') as out:
                    out.writestr('manifest.json', json.dumps(manifest))
                    out.writestr(name, 'bad')
                with self.assertRaises(ValueError):
                    storage.unpack(archive, root / 'stage', manifest)
                self.assertFalse((root / 'config.json').exists())

    def test_symlinks_are_not_uploaded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'work').mkdir()
            (root / 'private').write_text('secret')
            (root / 'work/link').symlink_to(root / 'private')
            with self.assertRaises(ValueError):
                storage.inventory(root)


class FakeBucket(storage.Storage):
    """A Storage whose wrangler calls read and write a local directory instead of R2."""
    def __init__(self, home, bucket):
        self.config = {'prefix': 'slopwave', 'bucket': 'b', 'profile': 'p', 'account_id': 'a'}
        self.home = home; self.home.mkdir(parents=True, exist_ok=True)
        self.cache = home / 'backups'; self.cache.mkdir(exist_ok=True)
        self.state_path = home / 'sync-state.json'
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {'snapshot': None, 'files': {}}
        self.bucket = bucket; self.puts = []

    def wrangler(self, *args):
        if args[:2] == ('bulk', 'put'):
            for entry in json.loads(Path(args[args.index('--filename') + 1]).read_text()):
                self.store(entry['key'], Path(entry['file']))
            return
        verb, key, path = args[1], args[2].split('/', 1)[1], Path(args[args.index('--file') + 1])
        if verb == 'put':
            self.store(key, path)
        elif (self.bucket / key).exists():
            path.write_bytes((self.bucket / key).read_bytes())
        elif key.endswith('latest.json'):
            path.write_text(json.dumps({'schema': 2, 'snapshot': None, 'files': {}}))
        else:
            raise ValueError(f'missing {key}')

    def store(self, key, path):
        self.puts.append(key)
        target = self.bucket / key; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(path.read_bytes())


class BlobSyncTests(unittest.TestCase):
    def test_push_uploads_only_new_files_and_pull_restores(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            a = FakeBucket(root / 'mac-a', root / 'r2')
            for name in ['work/x/brief.json', 'work/x/copy.json', 'sessions/x/revisions/r-1/song.wav']:
                p = a.home / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text('same' if 'json' in name else 'audio')
            a.push()
            blobs = [k for k in a.puts if '/blobs/' in k]
            self.assertEqual(len(blobs), 2)  # two identical files share one blob
            a.puts.clear()
            (a.home / 'work/x/plan.json').write_text('new')
            a.push()
            self.assertEqual([k for k in a.puts if '/blobs/' in k], ['slopwave/blobs/' + storage.digest(a.home / 'work/x/plan.json')])
            b = FakeBucket(root / 'mac-b', root / 'r2')
            b.pull()
            self.assertEqual(storage.inventory(b.home), storage.inventory(a.home))
            # Changes from the second Mac come back as a small pull.
            (b.home / 'work/x/plan.json').write_text('newer')
            b.push(); a.pull()
            self.assertEqual((a.home / 'work/x/plan.json').read_text(), 'newer')

    def test_stale_writer_must_pull_first(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            a, b = FakeBucket(root / 'a', root / 'r2'), FakeBucket(root / 'b', root / 'r2')
            (a.home / 'work').mkdir(); (a.home / 'work/a').write_text('a'); a.push()
            (b.home / 'work').mkdir(); (b.home / 'work/b').write_text('b')
            with self.assertRaisesRegex(ValueError, 'pull first'):
                b.push()

    def test_corrupt_blob_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            a = FakeBucket(root / 'a', root / 'r2')
            (a.home / 'work').mkdir(); (a.home / 'work/a').write_text('a'); a.push()
            (root / 'r2/slopwave/blobs' / storage.digest(a.home / 'work/a')).write_text('tampered')
            b = FakeBucket(root / 'b', root / 'r2')
            with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
                b.pull()
            self.assertFalse((b.home / 'work/a').exists())


if __name__ == '__main__':
    unittest.main()
