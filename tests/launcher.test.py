import importlib.util
from pathlib import Path
import sys
import unittest
import threading
import urllib.request
from unittest.mock import patch, MagicMock
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('serve_game', Path(__file__).resolve().parents[1] / 'tools/serve-game.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LauncherTests(unittest.TestCase):
    def test_intro_entry_and_same_origin_health_probe(self):
        self.assertEqual(module.URL, 'http://127.0.0.1:8765/index.html?intro=full')
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'<script src="js/battle-store.js"></script><script src="js/home.js"></script>'
        with patch.object(module, 'ThreadingHTTPServer', side_effect=OSError), patch.object(module.urllib.request, 'urlopen', return_value=response) as probe, patch.object(module, 'open_game') as launch:
            self.assertEqual(module.main(), 0)
            probe.assert_called_once_with(module.HEALTH_URL, timeout=2)
            launch.assert_called_once()

    def test_served_code_revalidates_and_contains_latest_ai(self):
        server = module.ThreadingHTTPServer(('127.0.0.1', 0), module.GameHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            origin = f'http://127.0.0.1:{server.server_port}'
            with urllib.request.urlopen(origin + '/index.html?intro=full') as response:
                self.assertEqual(response.headers.get('Cache-Control'), 'no-cache')
                self.assertIn('js/intro.js', response.read().decode('utf-8'))
            with urllib.request.urlopen(origin + '/js/battle-ai.js') as response:
                self.assertEqual(response.headers.get('Cache-Control'), 'no-cache')
                self.assertIn('const horizon=.5,', response.read().decode('utf-8-sig'))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_do_not_open_unrelated_service(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'<html>unrelated</html>'
        with patch.object(module, 'ThreadingHTTPServer', side_effect=OSError), patch.object(module.urllib.request, 'urlopen', return_value=response), patch.object(module, 'open_game') as launch, patch('builtins.print'):
            self.assertEqual(module.main(), 1)
            launch.assert_not_called()

if __name__ == '__main__':
    unittest.main()
