"""Run slopwave using this project's installed runtime, from the consumer root."""
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]


def main():
    config_path = ROOT / '.slopwave/config.json'
    if not config_path.exists():
        sys.exit('Missing .slopwave/config.json. Run npm run music:setup with Python 3.10–3.12 and Node 22.15+.')
    config = json.loads(config_path.read_text())
    args = sys.argv[1:]
    if args[:2] == ['session', 'render']:
        for flag, key in (('--toolchain', 'toolchain'), ('--node', 'node')):
            if not any(arg == flag or arg.startswith(flag + '=') for arg in args):
                args.extend([flag, config[key]])
    os.chdir(ROOT)
    os.environ['PATH'] = str(Path(config['node']).parent) + os.pathsep + os.environ.get('PATH', '')
    os.execv(config['python'], [config['python'], '-m', 'slopwave', *args])


if __name__ == '__main__':
    main()
