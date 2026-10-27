"""Serve the game on its stable local origin and open Chrome when installed."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import subprocess
import urllib.request
from urllib.parse import urlsplit
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:8765/index.html?intro=full'
HEALTH_URL = 'http://127.0.0.1:8765/home.html'


def open_game():
    for folder in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'):
        base = os.environ.get(folder)
        if not base:
            continue
        chrome = Path(base) / 'Google/Chrome/Application/chrome.exe'
        if chrome.is_file():
            subprocess.Popen([str(chrome), URL])
            return
    webbrowser.open(URL)


class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


    def end_headers(self):
        # Revalidate code after updates; leave large music/image assets cacheable.
        if Path(urlsplit(self.path).path).suffix.lower() in ('.html', '.js', '.css') or urlsplit(self.path).path.endswith('/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    try:
        server = ThreadingHTTPServer(('127.0.0.1', 8765), GameHandler)
    except OSError:
        # Do not silently change ports: browser saves belong to a specific origin.
        try:
            with urllib.request.urlopen(HEALTH_URL, timeout=2) as response:
                page = response.read().decode('utf-8')
            if 'js/battle-store.js' not in page or 'js/home.js' not in page:
                raise ValueError('This port is serving another application.')
        except Exception as error:
            print('Port 8765 is unavailable. Close the other server and retry.\n', error)
            return 1
        open_game()
        return 0
    print('Game: ' + URL + '\nKeep this window open while playing. Ctrl+C stops the server.')
    open_game()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
