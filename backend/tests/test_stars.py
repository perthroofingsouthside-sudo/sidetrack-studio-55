"""
Test suite for SIDETRACK Studios - Become a Star (Karaoke) Feature
Tests all /api/stars/* endpoints for the karaoke performance feed and voting system.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_StarUser_"

class TestStarEndpoints:
    """Tests for Become a Star (Karaoke) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_perf_id = None
        yield
        # Cleanup would go here if needed
    
    # --- Health Check ---
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("PASS: Health endpoint returns healthy")
    
    # --- GET /api/stars/feed ---
    def test_star_feed_returns_list(self):
        """Test GET /api/stars/feed returns performances list"""
        response = self.session.get(f"{BASE_URL}/api/stars/feed?limit=30")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "performances" in data
        assert isinstance(data["performances"], list)
        print(f"PASS: Star feed returns {len(data['performances'])} performances")
    
    # --- GET /api/stars/leaderboard ---
    def test_star_leaderboard_returns_list(self):
        """Test GET /api/stars/leaderboard returns top performances"""
        response = self.session.get(f"{BASE_URL}/api/stars/leaderboard?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"PASS: Star leaderboard returns {len(data['leaderboard'])} entries")
    
    # --- POST /api/stars (Create Performance) ---
    def test_create_star_performance(self):
        """Test POST /api/stars creates a star performance"""
        # Create a test audio file (minimal webm-like data)
        test_audio = b"WEBM_TEST_AUDIO_DATA_" + uuid.uuid4().bytes
        
        files = {
            'file': ('karaoke.webm', test_audio, 'audio/webm')
        }
        form_data = {
            'username': f'{TEST_PREFIX}{uuid.uuid4().hex[:8]}',
            'song_title': 'Test Song for Karaoke',
            'song_artist': 'Test Artist',
            'song_cover_url': 'https://example.com/cover.jpg',
            'song_id': '12345',
            'title': 'My Test Performance'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stars",
            data=form_data,
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "performance" in data
        perf = data["performance"]
        assert perf["username"] == form_data["username"]
        assert perf["song_title"] == form_data["song_title"]
        assert perf["song_artist"] == form_data["song_artist"]
        assert "id" in perf
        assert perf["votes"] == 0
        
        # Store for later tests
        self.__class__.created_perf_id = perf["id"]
        print(f"PASS: Created star performance with ID: {perf['id']}")
        return perf["id"]
    
    # --- GET /api/stars/{id} ---
    def test_get_star_performance_by_id(self):
        """Test GET /api/stars/{id} returns specific performance"""
        # First create a performance
        perf_id = self.test_create_star_performance()
        
        response = self.session.get(f"{BASE_URL}/api/stars/{perf_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "performance" in data
        assert data["performance"]["id"] == perf_id
        print(f"PASS: GET /api/stars/{perf_id} returns correct performance")
    
    # --- GET /api/stars/{id}/audio ---
    def test_get_star_audio(self):
        """Test GET /api/stars/{id}/audio returns audio data"""
        # First create a performance
        perf_id = self.test_create_star_performance()
        
        response = self.session.get(f"{BASE_URL}/api/stars/{perf_id}/audio")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "audio_data" in data
        assert len(data["audio_data"]) > 0  # Should have base64 audio data
        print(f"PASS: GET /api/stars/{perf_id}/audio returns audio data")
    
    # --- POST /api/stars/{id}/vote ---
    def test_vote_star_performance(self):
        """Test POST /api/stars/{id}/vote allows voting"""
        # First create a performance
        perf_id = self.test_create_star_performance()
        
        voter_id = f"voter_{uuid.uuid4().hex[:8]}"
        form_data = {'voter_id': voter_id}
        
        response = requests.post(
            f"{BASE_URL}/api/stars/{perf_id}/vote",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "performance" in data
        assert data["performance"]["votes"] == 1
        print(f"PASS: Vote on performance {perf_id} succeeded, votes now: 1")
    
    # --- POST /api/stars/{id}/vote (Duplicate Vote) ---
    def test_duplicate_vote_returns_400(self):
        """Test POST /api/stars/{id}/vote returns 400 on duplicate vote"""
        # First create a performance
        perf_id = self.test_create_star_performance()
        
        voter_id = f"voter_{uuid.uuid4().hex[:8]}"
        form_data = {'voter_id': voter_id}
        
        # First vote
        response1 = requests.post(
            f"{BASE_URL}/api/stars/{perf_id}/vote",
            data=form_data
        )
        assert response1.status_code == 200
        
        # Second vote with same voter_id should fail
        response2 = requests.post(
            f"{BASE_URL}/api/stars/{perf_id}/vote",
            data=form_data
        )
        assert response2.status_code == 400
        data = response2.json()
        assert "Already voted" in data.get("detail", "")
        print("PASS: Duplicate vote returns 400 with 'Already voted' message")
    
    # --- GET /api/stars/nonexistent ---
    def test_get_nonexistent_performance_returns_404(self):
        """Test GET /api/stars/nonexistent returns 404"""
        response = self.session.get(f"{BASE_URL}/api/stars/nonexistent-id-12345")
        assert response.status_code == 404
        print("PASS: GET /api/stars/nonexistent returns 404")
    
    # --- POST /api/stars/{nonexistent}/vote ---
    def test_vote_nonexistent_performance_returns_404(self):
        """Test POST /api/stars/nonexistent/vote returns 404"""
        form_data = {'voter_id': 'test_voter'}
        response = requests.post(
            f"{BASE_URL}/api/stars/nonexistent-id-12345/vote",
            data=form_data
        )
        assert response.status_code == 404
        print("PASS: POST /api/stars/nonexistent/vote returns 404")
    
    # --- GET /api/stars/{nonexistent}/audio ---
    def test_get_nonexistent_audio_returns_404(self):
        """Test GET /api/stars/nonexistent/audio returns 404"""
        response = self.session.get(f"{BASE_URL}/api/stars/nonexistent-id-12345/audio")
        assert response.status_code == 404
        print("PASS: GET /api/stars/nonexistent/audio returns 404")
    
    # --- POST /api/stars with empty file ---
    def test_create_star_with_empty_file_returns_400(self):
        """Test POST /api/stars with empty file returns 400"""
        files = {
            'file': ('karaoke.webm', b'', 'audio/webm')
        }
        form_data = {
            'username': f'{TEST_PREFIX}empty',
            'song_title': 'Test Song',
            'song_artist': 'Test Artist',
            'song_cover_url': '',
            'song_id': '',
            'title': 'Empty Test'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stars",
            data=form_data,
            files=files
        )
        assert response.status_code == 400
        data = response.json()
        assert "Empty audio file" in data.get("detail", "")
        print("PASS: POST /api/stars with empty file returns 400")


class TestMusicSearchForKaraoke:
    """Tests for music search used in karaoke song selection"""
    
    def test_music_search_returns_tracks(self):
        """Test GET /api/music/search returns iTunes tracks for karaoke"""
        response = requests.get(f"{BASE_URL}/api/music/search?q=hello&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "tracks" in data
        assert len(data["tracks"]) > 0
        
        # Verify track structure has fields needed for karaoke
        track = data["tracks"][0]
        assert "id" in track
        assert "title" in track
        assert "artist" in track
        assert "cover_url" in track
        assert "preview_url" in track  # Important for karaoke backing track
        print(f"PASS: Music search returns {len(data['tracks'])} tracks with preview URLs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
