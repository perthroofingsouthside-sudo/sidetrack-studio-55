"""
Iteration 11 Backend Tests - SIDETRACK Studios
Tests for:
- Health endpoint
- LRCLIB lyrics search integration
- Music search/browse endpoints
- Playlists CRUD
- Battle Arena endpoints
- Become a Star endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Health and basic API tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Root endpoint: {data}")


class TestLRCLIBIntegration:
    """Tests for LRCLIB lyrics API integration"""
    
    def test_lyrics_search_with_synced_lyrics(self):
        """Test /api/lyrics/search returns LRCLIB data with has_synced=true for known song"""
        response = requests.get(f"{BASE_URL}/api/lyrics/search", params={
            "track": "Shape of You",
            "artist": "Ed Sheeran"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["has_synced"]
        assert data["track_name"] == "Shape of You"
        print(f"✓ LRCLIB search (Shape of You): has_synced={data['has_synced']}")
    
    def test_lyrics_search_bohemian_rhapsody(self):
        """Test /api/lyrics/search for Bohemian Rhapsody by Queen"""
        response = requests.get(f"{BASE_URL}/api/lyrics/search", params={
            "track": "Bohemian Rhapsody",
            "artist": "Queen"
        })
        assert response.status_code == 200
        data = response.json()
        # Note: This may return success=false if LRCLIB doesn't find exact match
        print(f"✓ LRCLIB search (Bohemian Rhapsody): {data}")
    
    def test_lyrics_search_without_artist(self):
        """Test /api/lyrics/search works without artist parameter"""
        response = requests.get(f"{BASE_URL}/api/lyrics/search", params={
            "track": "Blinding Lights"
        })
        assert response.status_code == 200
        data = response.json()
        print(f"✓ LRCLIB search (no artist): {data}")


class TestMusicEndpoints:
    """Tests for iTunes music streaming endpoints"""
    
    def test_music_search(self):
        """Test /api/music/search returns tracks"""
        response = requests.get(f"{BASE_URL}/api/music/search", params={
            "q": "Taylor Swift",
            "limit": 5
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert len(data["tracks"]) > 0
        track = data["tracks"][0]
        assert "title" in track
        assert "artist" in track
        print(f"✓ Music search: {len(data['tracks'])} tracks found")
    
    def test_top_songs(self):
        """Test /api/music/top-songs returns chart data"""
        response = requests.get(f"{BASE_URL}/api/music/top-songs", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert len(data["tracks"]) > 0
        print(f"✓ Top songs: {len(data['tracks'])} tracks")
    
    def test_top_albums(self):
        """Test /api/music/top-albums returns album data"""
        response = requests.get(f"{BASE_URL}/api/music/top-albums", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert len(data["albums"]) > 0
        album = data["albums"][0]
        assert "name" in album
        assert "artist" in album
        print(f"✓ Top albums: {len(data['albums'])} albums")


class TestPlaylistsCRUD:
    """Tests for playlist CRUD operations"""
    
    @pytest.fixture
    def test_playlist_id(self):
        """Create a test playlist and return its ID"""
        response = requests.post(f"{BASE_URL}/api/playlists", json={
            "name": "TEST_Iteration11_Playlist",
            "description": "Test playlist for iteration 11",
            "is_public": True,
            "owner": "test_user_11"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        playlist_id = data["playlist"]["id"]
        yield playlist_id
        # Cleanup
        requests.delete(f"{BASE_URL}/api/playlists/{playlist_id}")
    
    def test_create_playlist(self, test_playlist_id):
        """Test playlist creation"""
        assert test_playlist_id is not None
        print(f"✓ Playlist created: {test_playlist_id}")
    
    def test_get_playlist(self, test_playlist_id):
        """Test getting a playlist by ID"""
        response = requests.get(f"{BASE_URL}/api/playlists/{test_playlist_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["playlist"]["name"] == "TEST_Iteration11_Playlist"
        print(f"✓ Get playlist: {data['playlist']['name']}")
    
    def test_list_playlists(self):
        """Test listing playlists"""
        response = requests.get(f"{BASE_URL}/api/playlists", params={"owner": "test_user_11"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ List playlists: {len(data['playlists'])} playlists")


class TestBattleArena:
    """Tests for Cover Battle endpoints"""
    
    def test_list_battles(self):
        """Test /api/battles returns battle list"""
        response = requests.get(f"{BASE_URL}/api/battles", params={"status": "active", "limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ List battles: {len(data['battles'])} active battles")
    
    def test_battle_leaderboard(self):
        """Test /api/battles/leaderboard/top returns top covers"""
        response = requests.get(f"{BASE_URL}/api/battles/leaderboard/top", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Battle leaderboard: {len(data['leaderboard'])} top covers")


class TestBecomeAStar:
    """Tests for Become a Star (karaoke) endpoints"""
    
    def test_star_feed(self):
        """Test /api/stars/feed returns performances"""
        response = requests.get(f"{BASE_URL}/api/stars/feed", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Star feed: {len(data['performances'])} performances")
    
    def test_star_leaderboard(self):
        """Test /api/stars/leaderboard returns top performers"""
        response = requests.get(f"{BASE_URL}/api/stars/leaderboard", params={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        print(f"✓ Star leaderboard: {len(data['leaderboard'])} top performers")
    
    def test_current_challenge(self):
        """Test /api/challenges/current returns weekly challenge"""
        response = requests.get(f"{BASE_URL}/api/challenges/current")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "challenge" in data
        challenge = data["challenge"]
        assert "title" in challenge
        assert "description" in challenge
        print(f"✓ Current challenge: {challenge['title']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
