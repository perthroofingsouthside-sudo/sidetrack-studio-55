"""
Test suite for Duet Mode feature - Iteration 7
Tests: POST/GET /api/duets endpoints, filtering by username
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data - using existing battle and cover from DB
EXISTING_BATTLE_ID = "1b1fda06-dd91-4970-b6f8-9f7e83e57b63"
EXISTING_COVER_ID = "8458b304-d4d5-403d-9e92-4e853604964e"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestDuetEndpoints:
    """Duet CRUD endpoint tests"""
    
    created_duet_id = None
    
    def test_health_check(self, api_client):
        """Verify API is healthy"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_get_duets_empty_list(self, api_client):
        """GET /api/duets returns list (may be empty initially)"""
        response = api_client.get(f"{BASE_URL}/api/duets")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "duets" in data
        assert isinstance(data["duets"], list)
        print(f"✓ GET /api/duets returns list with {len(data['duets'])} duets")
    
    def test_get_duets_with_username_filter(self, api_client):
        """GET /api/duets?username=X filters by username"""
        response = api_client.get(f"{BASE_URL}/api/duets?username=TEST_DuetUser")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "duets" in data
        # All returned duets should have matching username
        for duet in data["duets"]:
            assert duet["username"] == "TEST_DuetUser"
        print("✓ GET /api/duets?username=TEST_DuetUser filters correctly")
    
    def test_create_duet_success(self, api_client):
        """POST /api/duets creates a duet record"""
        # Create a small audio file for testing
        audio_content = b"RIFF" + b"\x00" * 100  # Minimal fake audio
        files = {
            'file': ('duet.webm', io.BytesIO(audio_content), 'audio/webm')
        }
        data = {
            'username': 'TEST_DuetUser',
            'battle_id': EXISTING_BATTLE_ID,
            'cover_id': EXISTING_COVER_ID,
            'title': 'TEST_My Duet Recording'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/duets",
            data=data,
            files=files
        )
        assert response.status_code == 200
        result = response.json()
        assert result["success"]
        assert "duet" in result
        
        duet = result["duet"]
        assert duet["username"] == "TEST_DuetUser"
        assert duet["battle_id"] == EXISTING_BATTLE_ID
        assert duet["cover_id"] == EXISTING_COVER_ID
        assert duet["partner_username"] == "TestUser"  # From the cover
        assert "id" in duet
        
        # Store for later tests
        TestDuetEndpoints.created_duet_id = duet["id"]
        print(f"✓ POST /api/duets created duet with id: {duet['id']}")
    
    def test_get_duet_by_id(self, api_client):
        """GET /api/duets/{id} returns specific duet"""
        if not TestDuetEndpoints.created_duet_id:
            pytest.skip("No duet created in previous test")
        
        response = api_client.get(f"{BASE_URL}/api/duets/{TestDuetEndpoints.created_duet_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "duet" in data
        
        duet = data["duet"]
        assert duet["id"] == TestDuetEndpoints.created_duet_id
        assert duet["username"] == "TEST_DuetUser"
        assert duet["song_title"] == "Lose Yourself"  # From battle
        assert duet["song_artist"] == "Eminem"  # From battle
        print(f"✓ GET /api/duets/{TestDuetEndpoints.created_duet_id} returns correct duet")
    
    def test_get_duet_audio(self, api_client):
        """GET /api/duets/{id}/audio returns audio data"""
        if not TestDuetEndpoints.created_duet_id:
            pytest.skip("No duet created in previous test")
        
        response = api_client.get(f"{BASE_URL}/api/duets/{TestDuetEndpoints.created_duet_id}/audio")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "audio_data" in data
        assert len(data["audio_data"]) > 0  # Should have base64 audio
        print(f"✓ GET /api/duets/{TestDuetEndpoints.created_duet_id}/audio returns audio data")
    
    def test_get_duet_not_found(self, api_client):
        """GET /api/duets/{nonexistent} returns 404"""
        response = api_client.get(f"{BASE_URL}/api/duets/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ GET /api/duets/nonexistent returns 404")
    
    def test_get_duet_audio_not_found(self, api_client):
        """GET /api/duets/{nonexistent}/audio returns 404"""
        response = api_client.get(f"{BASE_URL}/api/duets/nonexistent-id-12345/audio")
        assert response.status_code == 404
        print("✓ GET /api/duets/nonexistent/audio returns 404")
    
    def test_create_duet_invalid_battle(self, api_client):
        """POST /api/duets with invalid battle_id returns 404"""
        audio_content = b"RIFF" + b"\x00" * 100
        files = {
            'file': ('duet.webm', io.BytesIO(audio_content), 'audio/webm')
        }
        data = {
            'username': 'TEST_DuetUser',
            'battle_id': 'invalid-battle-id',
            'cover_id': EXISTING_COVER_ID,
            'title': 'TEST_Invalid Duet'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/duets",
            data=data,
            files=files
        )
        assert response.status_code == 404
        print("✓ POST /api/duets with invalid battle returns 404")
    
    def test_create_duet_invalid_cover(self, api_client):
        """POST /api/duets with invalid cover_id returns 404"""
        audio_content = b"RIFF" + b"\x00" * 100
        files = {
            'file': ('duet.webm', io.BytesIO(audio_content), 'audio/webm')
        }
        data = {
            'username': 'TEST_DuetUser',
            'battle_id': EXISTING_BATTLE_ID,
            'cover_id': 'invalid-cover-id',
            'title': 'TEST_Invalid Duet'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/duets",
            data=data,
            files=files
        )
        assert response.status_code == 404
        print("✓ POST /api/duets with invalid cover returns 404")
    
    def test_get_duets_filtered_by_username(self, api_client):
        """GET /api/duets?username=TEST_DuetUser returns created duet"""
        response = api_client.get(f"{BASE_URL}/api/duets?username=TEST_DuetUser")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        
        # Should find at least the duet we created
        duets = data["duets"]
        assert len(duets) >= 1
        
        # Verify all returned duets have correct username
        for duet in duets:
            assert duet["username"] == "TEST_DuetUser"
        print(f"✓ GET /api/duets?username=TEST_DuetUser returns {len(duets)} duets")


class TestBattleCoversForDuet:
    """Test battle/cover endpoints used by DuetStudio"""
    
    def test_get_battle_with_covers(self, api_client):
        """GET /api/battles/{id} returns battle with covers"""
        response = api_client.get(f"{BASE_URL}/api/battles/{EXISTING_BATTLE_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "battle" in data
        assert "covers" in data
        
        battle = data["battle"]
        assert battle["id"] == EXISTING_BATTLE_ID
        assert battle["song_title"] == "Lose Yourself"
        
        covers = data["covers"]
        assert len(covers) >= 1
        print(f"✓ GET /api/battles/{EXISTING_BATTLE_ID} returns battle with {len(covers)} covers")
    
    def test_get_cover_audio(self, api_client):
        """GET /api/battles/{battle_id}/cover/{cover_id}/audio returns audio"""
        response = api_client.get(f"{BASE_URL}/api/battles/{EXISTING_BATTLE_ID}/cover/{EXISTING_COVER_ID}/audio")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "audio_data" in data
        print(f"✓ GET /api/battles/{EXISTING_BATTLE_ID}/cover/{EXISTING_COVER_ID}/audio returns audio")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
