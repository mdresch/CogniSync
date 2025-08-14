"""
Example usage of the CogniSyncClient for the Knowledge Graph API.
"""
from cogni_sync_client.client import CogniSyncClient
import os

# Example: Set these as environment variables or replace with your values
def main():
    BASE_URL = os.getenv('COGNISYNC_KG_BASE_URL', 'http://localhost:3002')
    API_KEY = os.getenv('COGNISYNC_KG_API_KEY', 'YOUR_API_KEY')

    client = CogniSyncClient(BASE_URL, API_KEY)

    # Health check
    try:
        health = client.health()
        print('Health:', health)
    except Exception as e:
        print('Health check failed:', e)

    # List entities
    try:
        entities = client.list_entities()
        print('Entities:', entities)
    except Exception as e:
        print('List entities failed:', e)

if __name__ == '__main__':
    main()
