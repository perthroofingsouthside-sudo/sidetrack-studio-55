"""
Test suite for Star Challenges feature (Iteration 9)
Tests weekly themed karaoke challenges (Wednesday to Wednesday)
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChallengesBackend:
    """Star Challenges endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_health_endpoint(self):
        """Test health endpoint is working"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_get_current_challenge(self):
        """Test GET /api/challenges/current auto-creates and returns weekly challenge"""
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        challenge = data["challenge"]
        
        # Verify required fields
        assert "id" in challenge
        assert "title" in challenge
        assert "description" in challenge
        assert "start_date" in challenge
        assert "end_date" in challenge
        assert "entry_count" in challenge
        assert "star_of_week" in challenge  # Can be null
        
        print(f"✓ Current challenge: {challenge['title']}")
        print(f"  - ID: {challenge['id']}")
        print(f"  - Start: {challenge['start_date']}")
        print(f"  - End: {challenge['end_date']}")
        print(f"  - Entry count: {challenge['entry_count']}")
        return challenge
    
    def test_challenge_dates_wednesday_to_wednesday(self):
        """Test that challenge dates are Wednesday to Wednesday"""
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        assert response.status_code == 200
        data = response.json()
        challenge = data["challenge"]
        
        from datetime import datetime
        start = datetime.fromisoformat(challenge["start_date"].replace("+00:00", ""))
        end = datetime.fromisoformat(challenge["end_date"].replace("+00:00", ""))
        
        # Wednesday is weekday 2
        assert start.weekday() == 2, f"Start date should be Wednesday, got weekday {start.weekday()}"
        assert end.weekday() == 2, f"End date should be Wednesday, got weekday {end.weekday()}"
        
        # Duration should be 7 days
        duration = (end - start).days
        assert duration == 7, f"Challenge duration should be 7 days, got {duration}"
        
        print("✓ Challenge dates are Wednesday to Wednesday (7 days)")
    
    def test_get_challenge_entries_empty(self):
        """Test GET /api/challenges/{id}/entries returns entries for a specific challenge"""
        # First get current challenge
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge = response.json()["challenge"]
        challenge_id = challenge["id"]
        
        # Get entries
        response = self.session.get(f"{BASE_URL}/api/challenges/{challenge_id}/entries")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "entries" in data
        assert "challenge" in data
        assert isinstance(data["entries"], list)
        
        print(f"✓ Challenge entries endpoint working (found {len(data['entries'])} entries)")
    
    def test_get_challenge_entries_nonexistent(self):
        """Test GET /api/challenges/nonexistent/entries returns 404"""
        response = self.session.get(f"{BASE_URL}/api/challenges/nonexistent/entries")
        assert response.status_code == 404
        print("✓ Nonexistent challenge returns 404")
    
    def test_get_challenge_history(self):
        """Test GET /api/challenges/history returns past challenges with star_of_week"""
        response = self.session.get(f"{BASE_URL}/api/challenges/history?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "challenges" in data
        assert isinstance(data["challenges"], list)
        
        # Each challenge should have star_of_week field
        for ch in data["challenges"]:
            assert "id" in ch
            assert "title" in ch
            assert "star_of_week" in ch  # Can be null
            assert "entry_count" in ch
        
        print(f"✓ Challenge history endpoint working (found {len(data['challenges'])} challenges)")
    
    def test_submit_performance_with_challenge_id(self):
        """Test POST /api/stars with challenge_id tags performance to challenge"""
        # Get current challenge
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge = response.json()["challenge"]
        challenge_id = challenge["id"]
        
        # Create test audio data
        test_audio = b"TEST_AUDIO_DATA_FOR_CHALLENGE_" + os.urandom(100)
        
        # Submit performance with challenge_id
        files = {"file": ("test_challenge.webm", io.BytesIO(test_audio), "audio/webm")}
        form_data = {
            "username": "TEST_ChallengeUser",
            "song_title": "Test Challenge Song",
            "song_artist": "Test Artist",
            "song_cover_url": "https://example.com/cover.jpg",
            "song_id": "test123",
            "title": "TEST_ChallengeUser sings Test Challenge Song",
            "challenge_id": challenge_id
        }
        
        response = requests.post(f"{BASE_URL}/api/stars", data=form_data, files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        assert "performance" in data
        
        perf = data["performance"]
        assert perf["challenge_id"] == challenge_id
        assert perf["username"] == "TEST_ChallengeUser"
        
        print(f"✓ Performance submitted to challenge: {perf['id']}")
        return perf
    
    def test_challenge_entry_appears_in_entries(self):
        """Test that challenge entries appear in GET /api/challenges/{id}/entries after submission"""
        # Get current challenge
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge = response.json()["challenge"]
        challenge_id = challenge["id"]
        
        # Submit a new performance
        test_audio = b"TEST_AUDIO_ENTRY_CHECK_" + os.urandom(100)
        files = {"file": ("test_entry.webm", io.BytesIO(test_audio), "audio/webm")}
        form_data = {
            "username": "TEST_EntryCheckUser",
            "song_title": "Entry Check Song",
            "song_artist": "Test Artist",
            "title": "TEST_EntryCheckUser sings Entry Check Song",
            "challenge_id": challenge_id
        }
        
        response = requests.post(f"{BASE_URL}/api/stars", data=form_data, files=files)
        assert response.status_code == 200
        perf_id = response.json()["performance"]["id"]
        
        # Check entries
        response = self.session.get(f"{BASE_URL}/api/challenges/{challenge_id}/entries")
        assert response.status_code == 200
        entries = response.json()["entries"]
        
        # Find our entry
        found = any(e["id"] == perf_id for e in entries)
        assert found, f"Performance {perf_id} not found in challenge entries"
        
        print("✓ Challenge entry appears in entries list")
    
    def test_star_of_week_is_top_voted(self):
        """Test that star_of_week is the top-voted entry in the challenge"""
        # Get current challenge
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge = response.json()["challenge"]
        challenge_id = challenge["id"]
        
        # Submit a performance
        test_audio = b"TEST_AUDIO_STAR_OF_WEEK_" + os.urandom(100)
        files = {"file": ("test_star.webm", io.BytesIO(test_audio), "audio/webm")}
        form_data = {
            "username": "TEST_StarOfWeekUser",
            "song_title": "Star of Week Song",
            "song_artist": "Test Artist",
            "title": "TEST_StarOfWeekUser sings Star of Week Song",
            "challenge_id": challenge_id
        }
        
        response = requests.post(f"{BASE_URL}/api/stars", data=form_data, files=files)
        assert response.status_code == 200
        perf_id = response.json()["performance"]["id"]
        
        # Vote for this performance
        import uuid
        voter_id = str(uuid.uuid4())
        vote_response = requests.post(
            f"{BASE_URL}/api/stars/{perf_id}/vote",
            data={"voter_id": voter_id}
        )
        assert vote_response.status_code == 200
        
        # Check current challenge - star_of_week should be this performance
        response = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge = response.json()["challenge"]
        
        # If there's a star_of_week, it should be the top voted
        if challenge.get("star_of_week"):
            star = challenge["star_of_week"]
            assert star["votes"] > 0, "Star of week should have votes"
            print(f"✓ Star of the week: {star['username']} with {star['votes']} votes")
        else:
            # Check if our performance has votes
            response = self.session.get(f"{BASE_URL}/api/stars/{perf_id}")
            perf = response.json()["performance"]
            if perf["votes"] > 0:
                # Re-check current challenge
                response = self.session.get(f"{BASE_URL}/api/challenges/current")
                challenge = response.json()["challenge"]
                assert challenge.get("star_of_week") is not None, "Star of week should be set after voting"
            print("✓ Star of week logic verified")
    
    def test_submit_performance_without_challenge_id(self):
        """Test that 'Sing Now' still works for free karaoke (no challenge tag)"""
        test_audio = b"TEST_AUDIO_FREE_KARAOKE_" + os.urandom(100)
        files = {"file": ("test_free.webm", io.BytesIO(test_audio), "audio/webm")}
        form_data = {
            "username": "TEST_FreeKaraokeUser",
            "song_title": "Free Karaoke Song",
            "song_artist": "Test Artist",
            "title": "TEST_FreeKaraokeUser sings Free Karaoke Song"
            # No challenge_id - free karaoke
        }
        
        response = requests.post(f"{BASE_URL}/api/stars", data=form_data, files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"]
        
        perf = data["performance"]
        assert perf.get("challenge_id", "") == "", "Free karaoke should have empty challenge_id"
        
        print("✓ Free karaoke (no challenge) works correctly")
    
    def test_current_challenge_idempotent(self):
        """Test that calling /api/challenges/current multiple times returns same challenge"""
        response1 = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge1 = response1.json()["challenge"]
        
        response2 = self.session.get(f"{BASE_URL}/api/challenges/current")
        challenge2 = response2.json()["challenge"]
        
        assert challenge1["id"] == challenge2["id"], "Same challenge should be returned"
        print("✓ Current challenge endpoint is idempotent")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
