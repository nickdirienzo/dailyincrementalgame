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


if __name__ == '__main__':
    unittest.main()
