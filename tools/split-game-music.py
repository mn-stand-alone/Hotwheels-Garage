"""Cut scene music from the user-supplied playlist; original stays untouched."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.cache/audio-tools'))
import imageio_ffmpeg

source = next(p for p in ROOT.glob('*.m4a') if '超强节奏感' in p.name)
output = ROOT / 'assets/audio'
output.mkdir(parents=True, exist_ok=True)
cuts = [
    ('home', '大厅 · 律动启程', 214, 150),
    ('garage', '车库 · 悠闲巡游', 561, 180),
    ('sprint', '滨海天际线 · 海岸节拍', 834, 120),
    ('fork', '恐龙丛林 · 强劲脉冲', 1169, 120),
    ('loop', '海上巨环 · 高空疾驰', 1712, 120),
]
manifest = {'source': source.name, 'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'selection': 'Silence boundaries and measured energy; scene labels are not original song titles.', 'tracks': []}
for key, title, start, duration in cuts:
    target = output / (key + '.m4a')
    filters = f'loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=1.2,afade=t=out:st={duration-2}:d=2'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
                    '-ss', str(start), '-i', str(source), '-t', str(duration), '-vn', '-map_metadata', '-1',
                    '-af', filters, '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '160k',
                    '-movflags', '+faststart', str(target)], check=True)
    manifest['tracks'].append({'id': key, 'title': title, 'file': target.name, 'start': start,
                               'duration': duration, 'bytes': target.stat().st_size})
    print(key, start, duration, target.stat().st_size, flush=True)
(output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
