"""Assemble a pinned Web CLI artifact and Electron without executing either runtime."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tarfile
import urllib.request
import zipfile

BACKEND_SOURCE = 'ff8c87f00958c56d07653c59a94ce893df860e94'
BACKEND_NAME = 'dsh-kylin-arm64-0.2.2-rc.5'
BACKEND_SHA256 = '9797eb1058d5f92f297715041251ae521cab1063e82fe19f03e0f64a592d3427'
ELECTRON_VERSION = '44.7.0'
ELECTRON_SHA256 = '9cd736d1f5873839553c3fa6c8c5e57635ec4a399cc2d32e79c82a02d9cd2258'
ELECTRON_URL = f'https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}/electron-v{ELECTRON_VERSION}-linux-arm64.zip'


def digest(path):
    """Return a streaming SHA-256 digest of a regular file."""
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def version_tuple(value):
    """Compare numeric ELF requirement versions rather than lexical strings."""
    return tuple(map(int, value.split('.')))


def main():
    """Validate both inputs and every ELF before publishing the portable archive."""
    sources = Path(__file__).resolve().parent
    version = json.loads(Path('package.json').read_text())['version']
    if version != '0.2.2-rc.5':
        raise RuntimeError('The frozen backend requires DSH 0.2.2-rc.5')
    name = f'dsh-kylin-arm64-desktop-{version}'
    temporary = Path(os.environ['RUNNER_TEMP'])
    stage = temporary / name
    stage.mkdir()
    backend_archive = Path('backend-artifact') / f'{BACKEND_NAME}.tar.gz'
    if digest(backend_archive) != BACKEND_SHA256:
        raise RuntimeError('Backend archive SHA-256 mismatch')
    with tarfile.open(backend_archive, 'r:gz') as archive:
        if any(Path(member.name).parts[0] != BACKEND_NAME for member in archive.getmembers()):
            raise RuntimeError('Unexpected backend archive root')
        archive.extractall(stage, filter='data')
    (stage / BACKEND_NAME).rename(stage / 'backend')
    backend_info = json.loads((stage / 'backend/build-info.json').read_text())
    if backend_info['source_sha'] != BACKEND_SOURCE or backend_info['version'] != version:
        raise RuntimeError('Backend source or version mismatch')
    electron_archive = temporary / 'electron-linux-arm64.zip'
    with urllib.request.urlopen(ELECTRON_URL, timeout=120) as response, electron_archive.open('wb') as output:
        shutil.copyfileobj(response, output)
    if digest(electron_archive) != ELECTRON_SHA256:
        raise RuntimeError('Electron archive SHA-256 mismatch')
    electron = stage / 'electron'
    with zipfile.ZipFile(electron_archive) as archive:
        for member in archive.infolist():
            target = electron / member.filename
            if not target.resolve().is_relative_to(electron.resolve()):
                raise RuntimeError('Unexpected Electron archive path')
            archive.extract(member, electron)
            mode = stat.S_IMODE(member.external_attr >> 16)
            if mode and target.is_file():
                target.chmod(mode & 0o777)
    app = electron / 'resources/app'
    app.mkdir()
    (app / 'package.json').write_text(json.dumps({
        'name': 'dsh-kylin-desktop-trial', 'version': version,
        'private': True, 'type': 'module', 'main': 'main.mjs',
    }, indent=2) + '\n')
    shutil.copy2(sources / 'main.mjs', app / 'main.mjs')
    for filename in ('start.sh', 'doctor.sh'):
        shutil.copy2(sources / filename, stage / filename)
        (stage / filename).chmod(0o755)
    shutil.copy2(sources / 'README.txt', stage / '使用说明.txt')
    report = []
    for path in sorted(stage.rglob('*')):
        if not path.is_file():
            continue
        with path.open('rb') as stream:
            if stream.read(4) != b'\x7fELF':
                continue
        header = subprocess.check_output(['readelf', '-h', str(path)], text=True)
        if not re.search(r'Machine:\s+AArch64\s*$', header, re.MULTILINE):
            raise RuntimeError(f'Wrong ELF architecture: {path}')
        requirements = subprocess.check_output(['readelf', '--version-info', str(path)], text=True)
        versions = set(re.findall(r'\bName: GLIBC_([0-9.]+)', requirements))
        highest = max(versions, key=version_tuple) if versions else None
        cxx = set(re.findall(r'\bName: GLIBCXX_([0-9.]+)', requirements))
        highest_cxx = max(cxx, key=version_tuple) if cxx else None
        if highest and version_tuple(highest) > version_tuple('2.31'):
            raise RuntimeError(f'{path}: GLIBC_{highest} exceeds target 2.31')
        if highest_cxx and version_tuple(highest_cxx) > version_tuple('3.4.28'):
            raise RuntimeError(f'{path}: GLIBCXX_{highest_cxx} exceeds target 3.4.28')
        report.append({'file': str(path.relative_to(stage)), 'machine': 'AArch64',
                       'maximum_glibc': highest, 'maximum_glibcxx': highest_cxx})
    if not report:
        raise RuntimeError('No ELF files found')
    (stage / 'elf-report.json').write_text(json.dumps(report, indent=2) + '\n')
    info = {
        'version': version, 'source_sha': os.environ['GITHUB_SHA'],
        'backend_source_sha': BACKEND_SOURCE, 'backend_archive_sha256': BACKEND_SHA256,
        'backend_run_url': 'https://github.com/mofanh/deepseek-harness/actions/runs/44690708637',
        'electron_version': ELECTRON_VERSION, 'electron_download_url': ELECTRON_URL,
        'electron_archive_sha256': ELECTRON_SHA256,
        'run_url': f"{os.environ['GITHUB_SERVER_URL']}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}",
        'platform': 'linux-arm64', 'elf_glibc_ceiling': '2.31', 'elf_glibcxx_ceiling': '3.4.28',
        'elf_files_checked': len(report), 'runtime_tests': 'not-performed',
        'product': 'experimental Electron wrapper of the Web profile',
    }
    (stage / 'build-info.json').write_text(json.dumps(info, indent=2) + '\n')
    files = sorted(path for path in stage.rglob('*') if path.is_file())
    (stage / 'SHA256SUMS').write_text(''.join(f'{digest(path)}  {path.relative_to(stage)}\n' for path in files))
    output = Path('dist-desktop')
    output.mkdir()
    destination = output / f'{name}.tar.gz'
    with tarfile.open(destination, 'w:gz', compresslevel=6) as archive:
        archive.add(stage, arcname=name)
    (output / f'{name}.tar.gz.sha256').write_text(f'{digest(destination)}  {destination.name}\n')
    shutil.copy2(stage / 'build-info.json', output)
    shutil.copy2(stage / 'elf-report.json', output)
    with Path(os.environ['GITHUB_ENV']).open('a') as env:
        env.write(f'ARCHIVE_NAME={name}\n')
    print(json.dumps(info, indent=2))
    print(f'Archive size: {destination.stat().st_size} bytes')


if __name__ == '__main__':
    main()
