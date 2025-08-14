"""
Integration tests for CogniSyncClient.
"""
import os
import unittest
from cogni_sync_client.client import CogniSyncClient

class TestCogniSyncClient(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_url = os.getenv('COGNISYNC_KG_BASE_URL', 'http://localhost:3002')
        cls.api_key = os.getenv('COGNISYNC_KG_API_KEY', 'YOUR_API_KEY')
        cls.client = CogniSyncClient(cls.base_url, cls.api_key)

    def test_health(self):
        resp = self.client.health()
        self.assertIn('status', resp)

    def test_list_entities(self):
        resp = self.client.list_entities()
        self.assertIsInstance(resp, (list, dict))

if __name__ == '__main__':
    unittest.main()
