"""
Test suite for SIDETRACK Studios - Playlist CRUD and related features (Iteration 6)
Tests: Playlist creation, listing, track management, privacy toggle, deletion
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health and API availability tests"""
    
    def test_health_endpoint(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")

class TestPlaylistCRUD:
    """Playlist CRUD operations tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_owner = f"TEST_user_{uuid.uuid4().hex[:8]}"
        self.created_playlist_ids = []
        yield
        # Cleanup
        for pl_id in self.created_playlist_ids:
            try:
                requests.delete(f"{BASE_URL}/api/playlists/{pl_id}", timeout=10)
            except:
                pass
    
    def test_create_playlist_public(self):
        """Test creating a public playlist"""
        payload = {
            "name": f"TEST_Playlist_{uuid.uuid4().hex[:6]}",
            "description": "Test playlist description",
            "is_public": True,
            "owner": self.test_owner
        }
        response = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "playlist" in data
        assert data["playlist"]["name"] == payload["name"]
        assert data["playlist"]["is_public"]
        assert data["playlist"]["owner"] == self.test_owner
        assert "id" in data["playlist"]
        self.created_playlist_ids.append(data["playlist"]["id"])
        print(f"✓ Created public playlist: {data['playlist']['id']}")
        return data["playlist"]["id"]
    
    def test_create_playlist_private(self):
        """Test creating a private playlist"""
        payload = {
            "name": f"TEST_Private_{uuid.uuid4().hex[:6]}",
            "is_public": False,
            "owner": self.test_owner
        }
        response = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert not data["playlist"]["is_public"]
        self.created_playlist_ids.append(data["playlist"]["id"])
        print(f"✓ Created private playlist: {data['playlist']['id']}")
    
    def test_list_playlists_by_owner(self):
        """Test listing playlists filtered by owner"""
        # Create a playlist first
        payload = {
            "name": f"TEST_List_{uuid.uuid4().hex[:6]}",
            "is_public": True,
            "owner": self.test_owner
        }
        create_resp = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        assert create_resp.status_code == 200
        pl_id = create_resp.json()["playlist"]["id"]
        self.created_playlist_ids.append(pl_id)
        
        # List by owner
        response = requests.get(f"{BASE_URL}/api/playlists?owner={self.test_owner}", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "playlists" in data
        assert len(data["playlists"]) >= 1
        print(f"✓ Listed {len(data['playlists'])} playlists for owner")
    
    def test_list_public_playlists(self):
        """Test listing public playlists only"""
        response = requests.get(f"{BASE_URL}/api/playlists?public_only=true", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "playlists" in data
        # All returned playlists should be public
        for pl in data["playlists"]:
            assert pl.get("is_public", True)
        print(f"✓ Listed {len(data['playlists'])} public playlists")
    
    def test_get_playlist_by_id(self):
        """Test getting a specific playlist by ID"""
        # Create playlist
        payload = {
            "name": f"TEST_Get_{uuid.uuid4().hex[:6]}",
            "is_public": True,
            "owner": self.test_owner
        }
        create_resp = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        pl_id = create_resp.json()["playlist"]["id"]
        self.created_playlist_ids.append(pl_id)
        
        # Get by ID
        response = requests.get(f"{BASE_URL}/api/playlists/{pl_id}", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["playlist"]["id"] == pl_id
        assert data["playlist"]["name"] == payload["name"]
        print(f"✓ Retrieved playlist by ID: {pl_id}")
    
    def test_get_nonexistent_playlist(self):
        """Test getting a playlist that doesn't exist"""
        fake_id = f"nonexistent_{uuid.uuid4().hex}"
        response = requests.get(f"{BASE_URL}/api/playlists/{fake_id}", timeout=10)
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent playlist")
    
    def test_update_playlist_name_and_privacy(self):
        """Test updating playlist name and privacy via PUT"""
        # Create playlist
        payload = {
            "name": f"TEST_Update_{uuid.uuid4().hex[:6]}",
            "is_public": True,
            "owner": self.test_owner
        }
        create_resp = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        pl_id = create_resp.json()["playlist"]["id"]
        self.created_playlist_ids.append(pl_id)
        
        # Update via form data
        update_data = {"name": "Updated Name", "is_public": "false"}
        response = requests.put(f"{BASE_URL}/api/playlists/{pl_id}", data=update_data, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["playlist"]["name"] == "Updated Name"
        assert not data["playlist"]["is_public"]
        print("✓ Updated playlist name and privacy")
    
    def test_delete_playlist(self):
        """Test deleting a playlist"""
        # Create playlist
        payload = {
            "name": f"TEST_Delete_{uuid.uuid4().hex[:6]}",
            "is_public": True,
            "owner": self.test_owner
        }
        create_resp = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        pl_id = create_resp.json()["playlist"]["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/playlists/{pl_id}", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        
        # Verify deleted
        get_resp = requests.get(f"{BASE_URL}/api/playlists/{pl_id}", timeout=10)
        assert get_resp.status_code == 404
        print("✓ Deleted playlist and verified removal")


class TestPlaylistTracks:
    """Tests for adding/removing tracks from playlists"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test playlist"""
        self.test_owner = f"TEST_tracks_{uuid.uuid4().hex[:8]}"
        # Create a playlist for track tests
        payload = {
            "name": f"TEST_Tracks_{uuid.uuid4().hex[:6]}",
            "is_public": True,
            "owner": self.test_owner
        }
        resp = requests.post(f"{BASE_URL}/api/playlists", json=payload, timeout=10)
        self.playlist_id = resp.json()["playlist"]["id"]
        yield
        # Cleanup
        try:
            requests.delete(f"{BASE_URL}/api/playlists/{self.playlist_id}", timeout=10)
        except:
            pass
    
    def test_add_track_to_playlist(self):
        """Test adding a track to a playlist"""
        track_data = {
            "track_id": f"track_{uuid.uuid4().hex[:8]}",
            "title": "Test Song",
            "artist": "Test Artist",
            "album": "Test Album",
            "cover_url": "https://example.com/cover.jpg",
            "preview_url": "https://example.com/preview.mp3",
            "duration_ms": 180000
        }
        response = requests.post(
            f"{BASE_URL}/api/playlists/{self.playlist_id}/tracks",
            json=track_data,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert data["playlist"]["track_count"] == 1
        assert len(data["playlist"]["tracks"]) == 1
        assert data["playlist"]["tracks"][0]["title"] == "Test Song"
        print("✓ Added track to playlist")
    
    def test_add_multiple_tracks(self):
        """Test adding multiple tracks"""
        for i in range(3):
            track_data = {
                "track_id": f"track_{uuid.uuid4().hex[:8]}",
                "title": f"Song {i+1}",
                "artist": f"Artist {i+1}",
                "album": "",
                "cover_url": "",
                "preview_url": "",
                "duration_ms": 200000
            }
            resp = requests.post(
                f"{BASE_URL}/api/playlists/{self.playlist_id}/tracks",
                json=track_data,
                timeout=10
            )
            assert resp.status_code == 200
        
        # Verify count
        get_resp = requests.get(f"{BASE_URL}/api/playlists/{self.playlist_id}", timeout=10)
        assert get_resp.json()["playlist"]["track_count"] == 3
        print("✓ Added 3 tracks to playlist")
    
    def test_remove_track_from_playlist(self):
        """Test removing a track from a playlist"""
        # Add a track first
        track_id = f"track_remove_{uuid.uuid4().hex[:8]}"
        track_data = {
            "track_id": track_id,
            "title": "To Be Removed",
            "artist": "Test",
            "album": "",
            "cover_url": "",
            "preview_url": "",
            "duration_ms": 100000
        }
        add_resp = requests.post(
            f"{BASE_URL}/api/playlists/{self.playlist_id}/tracks",
            json=track_data,
            timeout=10
        )
        assert add_resp.status_code == 200
        
        # Remove the track
        response = requests.delete(
            f"{BASE_URL}/api/playlists/{self.playlist_id}/tracks/{track_id}",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        
        # Verify removed
        get_resp = requests.get(f"{BASE_URL}/api/playlists/{self.playlist_id}", timeout=10)
        tracks = get_resp.json()["playlist"]["tracks"]
        track_ids = [t["track_id"] for t in tracks]
        assert track_id not in track_ids
        print("✓ Removed track from playlist")
    
    def test_remove_nonexistent_track(self):
        """Test removing a track that doesn't exist"""
        response = requests.delete(
            f"{BASE_URL}/api/playlists/{self.playlist_id}/tracks/nonexistent_track",
            timeout=10
        )
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent track removal")


class TestMusicSearchForPlaylists:
    """Test music search to verify tracks can be found for adding to playlists"""
    
    def test_music_search_returns_tracks(self):
        """Test that music search returns tracks with required fields"""
        response = requests.get(f"{BASE_URL}/api/music/search?q=Taylor+Swift&limit=5", timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert len(data["tracks"]) > 0
        
        # Verify track has fields needed for playlist
        track = data["tracks"][0]
        assert "id" in track
        assert "title" in track
        assert "artist" in track
        print(f"✓ Music search returned {len(data['tracks'])} tracks with required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
