"""
Test Daily Skip Limiter Feature
- GET /api/skips/{user_id} - Get skip count for user
- POST /api/skips/{user_id}/use - Use one skip
- 50 skips per day limit, resets at midnight UTC
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSkipLimiter:
    """Daily skip limiter endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create unique test user ID for each test class run"""
        self.test_user_id = f"TEST_skip_user_{uuid.uuid4().hex[:8]}"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_skip_count_new_user(self):
        """GET /api/skips/{user_id} returns skips_used=0, skips_remaining=50, limit=50 for new user"""
        response = self.session.get(f"{BASE_URL}/api/skips/{self.test_user_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("user_id") == self.test_user_id, f"Expected user_id={self.test_user_id}"
        assert data.get("skips_used") == 0, f"Expected skips_used=0, got {data.get('skips_used')}"
        assert data.get("skips_remaining") == 50, f"Expected skips_remaining=50, got {data.get('skips_remaining')}"
        assert data.get("limit") == 50, f"Expected limit=50, got {data.get('limit')}"
        print(f"✓ New user {self.test_user_id} has 0 used, 50 remaining skips")
    
    def test_get_skip_count_includes_date(self):
        """GET /api/skips/{user_id} includes today's date in UTC format"""
        response = self.session.get(f"{BASE_URL}/api/skips/{self.test_user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Date should be in YYYY-MM-DD format
        date = data.get("date")
        assert date is not None, "Expected 'date' field in response"
        assert len(date) == 10, f"Expected date in YYYY-MM-DD format, got {date}"
        assert date.count("-") == 2, f"Expected date in YYYY-MM-DD format, got {date}"
        print(f"✓ Skip count includes date: {date}")
    
    def test_use_skip_decrements_remaining(self):
        """POST /api/skips/{user_id}/use decrements remaining by 1"""
        # First check initial state
        get_response = self.session.get(f"{BASE_URL}/api/skips/{self.test_user_id}")
        initial_remaining = get_response.json().get("skips_remaining", 50)
        
        # Use one skip
        use_response = self.session.post(f"{BASE_URL}/api/skips/{self.test_user_id}/use")
        
        assert use_response.status_code == 200, f"Expected 200, got {use_response.status_code}: {use_response.text}"
        
        data = use_response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("skips_remaining") == initial_remaining - 1, f"Expected {initial_remaining - 1} remaining, got {data.get('skips_remaining')}"
        assert data.get("skips_used") == 1, f"Expected skips_used=1, got {data.get('skips_used')}"
        print(f"✓ Skip used, remaining: {data.get('skips_remaining')}")
    
    def test_use_skip_multiple_times_decrements_correctly(self):
        """POST /api/skips/{user_id}/use multiple times decrements correctly each time"""
        # Use 3 skips in sequence
        for i in range(1, 4):
            response = self.session.post(f"{BASE_URL}/api/skips/{self.test_user_id}/use")
            assert response.status_code == 200, f"Skip {i} failed: {response.text}"
            data = response.json()
            expected_remaining = 50 - i
            assert data.get("skips_remaining") == expected_remaining, f"After {i} skips, expected {expected_remaining} remaining, got {data.get('skips_remaining')}"
            assert data.get("skips_used") == i, f"After {i} skips, expected skips_used={i}, got {data.get('skips_used')}"
        
        # Verify with GET
        get_response = self.session.get(f"{BASE_URL}/api/skips/{self.test_user_id}")
        data = get_response.json()
        assert data.get("skips_used") == 3, f"Expected skips_used=3, got {data.get('skips_used')}"
        assert data.get("skips_remaining") == 47, f"Expected skips_remaining=47, got {data.get('skips_remaining')}"
        print(f"✓ After 3 uses: used={data.get('skips_used')}, remaining={data.get('skips_remaining')}")
    
    def test_different_users_have_independent_counts(self):
        """Different user_ids have independent skip counts"""
        user_a = f"TEST_user_a_{uuid.uuid4().hex[:8]}"
        user_b = f"TEST_user_b_{uuid.uuid4().hex[:8]}"
        
        # Use 2 skips for user A
        for _ in range(2):
            self.session.post(f"{BASE_URL}/api/skips/{user_a}/use")
        
        # Use 5 skips for user B
        for _ in range(5):
            self.session.post(f"{BASE_URL}/api/skips/{user_b}/use")
        
        # Verify user A has 48 remaining
        res_a = self.session.get(f"{BASE_URL}/api/skips/{user_a}")
        data_a = res_a.json()
        assert data_a.get("skips_remaining") == 48, f"User A expected 48 remaining, got {data_a.get('skips_remaining')}"
        
        # Verify user B has 45 remaining
        res_b = self.session.get(f"{BASE_URL}/api/skips/{user_b}")
        data_b = res_b.json()
        assert data_b.get("skips_remaining") == 45, f"User B expected 45 remaining, got {data_b.get('skips_remaining')}"
        
        print(f"✓ User A: {data_a.get('skips_remaining')} remaining, User B: {data_b.get('skips_remaining')} remaining")


class TestSkipLimitExhaustion:
    """Test the 50-skip limit exhaustion scenario"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create unique test user ID for exhaustion test"""
        self.exhaustion_user = f"TEST_exhaust_{uuid.uuid4().hex[:8]}"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_after_50_uses_returns_429(self):
        """After 50 uses, POST /api/skips/{user_id}/use returns 429 with 'Daily skip limit reached'"""
        # Use all 50 skips
        print(f"Using 50 skips for user {self.exhaustion_user}...")
        for i in range(50):
            response = self.session.post(f"{BASE_URL}/api/skips/{self.exhaustion_user}/use")
            assert response.status_code == 200, f"Skip {i+1} failed unexpectedly: {response.text}"
            if (i + 1) % 10 == 0:
                print(f"  Used {i+1}/50 skips...")
        
        # 51st skip should return 429
        response = self.session.post(f"{BASE_URL}/api/skips/{self.exhaustion_user}/use")
        
        assert response.status_code == 429, f"Expected 429 after 50 skips, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "Daily skip limit reached" in data.get("detail", ""), f"Expected 'Daily skip limit reached' in detail, got {data}"
        print(f"✓ 51st skip correctly returned 429: {data.get('detail')}")
    
    def test_after_50_uses_get_shows_zero_remaining(self):
        """After 50 uses, GET /api/skips/{user_id} shows skips_remaining=0"""
        # Use all 50 skips
        print(f"Using 50 skips for user {self.exhaustion_user}...")
        for i in range(50):
            response = self.session.post(f"{BASE_URL}/api/skips/{self.exhaustion_user}/use")
            if response.status_code != 200:
                break
            if (i + 1) % 10 == 0:
                print(f"  Used {i+1}/50 skips...")
        
        # Verify GET shows 0 remaining
        get_response = self.session.get(f"{BASE_URL}/api/skips/{self.exhaustion_user}")
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data.get("skips_remaining") == 0, f"Expected skips_remaining=0, got {data.get('skips_remaining')}"
        assert data.get("skips_used") == 50, f"Expected skips_used=50, got {data.get('skips_used')}"
        print(f"✓ After exhaustion: used={data.get('skips_used')}, remaining={data.get('skips_remaining')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
