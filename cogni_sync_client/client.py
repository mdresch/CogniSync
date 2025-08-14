"""
CogniSync Knowledge Graph Client
A Python client for the CogniSync Knowledge Graph API.
"""
import requests
from typing import Optional, Dict, Any

class CogniSyncClient:
    """
    Client for interacting with the CogniSync Knowledge Graph Service API.
    Handles authentication and provides methods for API integration.
    """
    def __init__(self, base_url: str, api_key: str):
        """
        Initialize the client.
        :param base_url: Base URL of the Knowledge Graph API
        :param api_key: API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        })

    def health(self) -> Dict[str, Any]:
        """
        Health check endpoint.
        :return: Health status
        """
        url = f'{self.base_url}/api/v1/health'
        resp = self.session.get(url)
        resp.raise_for_status()
        return resp.json()

    def get_entity(self, entity_id: str) -> Dict[str, Any]:
        """
        Fetch an entity by ID.
        :param entity_id: The entity ID
        :return: Entity data
        """
        url = f'{self.base_url}/api/v1/entities/{entity_id}'
        resp = self.session.get(url)
        resp.raise_for_status()
        return resp.json()

    def list_entities(self, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        List all entities.
        :param params: Query parameters
        :return: List of entities
        """
        url = f'{self.base_url}/api/v1/entities'
        resp = self.session.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    def create_entity(self, data: Dict[str, Any]) -> Any:
        """
        Create a new entity.
        :param data: Entity data
        :return: Created entity
        """
        url = f'{self.base_url}/api/v1/entities'
        resp = self.session.post(url, json=data)
        resp.raise_for_status()
        return resp.json()

    def update_entity(self, entity_id: str, data: Dict[str, Any]) -> Any:
        """
        Update an entity.
        :param entity_id: The entity ID
        :param data: Updated entity data
        :return: Updated entity
        """
        url = f'{self.base_url}/api/v1/entities/{entity_id}'
        resp = self.session.put(url, json=data)
        resp.raise_for_status()
        return resp.json()

    def delete_entity(self, entity_id: str) -> Any:
        """
        Delete an entity.
        :param entity_id: The entity ID
        :return: Deletion result
        """
        url = f'{self.base_url}/api/v1/entities/{entity_id}'
        resp = self.session.delete(url)
        resp.raise_for_status()
        return resp.json()
