#!/usr/bin/env python3
"""
AuraSplit Backend API Testing Suite
Tests all endpoints for the music recognition and stem separation app
"""

import requests
import sys
import json
import io
from datetime import datetime
from pathlib import Path

class AuraSplitAPITester:
    def __init__(self, base_url="https://vocal-studio-55.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_song_id = None
        self.test_recording_id = None

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {"raw_response": response.text}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET", 
            "health",
            200
        )
        if success:
            self.log(f"   Health status: {response.get('status', 'unknown')}")
            self.log(f"   Shazam configured: {response.get('shazam_configured', False)}")
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        if success:
            self.log(f"   Message: {response.get('message', 'No message')}")
        return success

    def test_song_recognition(self):
        """Test song recognition with mock audio file"""
        # Create a small mock audio file
        mock_audio = b"mock_audio_data_for_testing" * 100  # Make it reasonably sized
        files = {'file': ('test_audio.webm', io.BytesIO(mock_audio), 'audio/webm')}
        
        success, response = self.run_test(
            "Song Recognition",
            "POST",
            "recognize",
            200,
            files=files
        )
        
        if success and response.get('success'):
            song = response.get('song', {})
            self.test_song_id = song.get('id')
            self.log(f"   Recognized: {song.get('title', 'Unknown')} by {song.get('artist', 'Unknown')}")
            self.log(f"   Demo mode: {response.get('demo', False)}")
            self.log(f"   Song ID: {self.test_song_id}")
            return True
        return False

    def test_get_song(self):
        """Test getting song by ID"""
        if not self.test_song_id:
            self.log("⚠️  Skipping get song test - no song ID available")
            return False
            
        success, response = self.run_test(
            "Get Song by ID",
            "GET",
            f"songs/{self.test_song_id}",
            200
        )
        
        if success:
            self.log(f"   Title: {response.get('title', 'Unknown')}")
            self.log(f"   Artist: {response.get('artist', 'Unknown')}")
        return success

    def test_stem_separation(self):
        """Test stem separation (mocked)"""
        if not self.test_song_id:
            self.log("⚠️  Skipping stem separation test - no song ID available")
            return False
            
        success, response = self.run_test(
            "Stem Separation",
            "POST",
            f"songs/{self.test_song_id}/separate",
            200
        )
        
        if success and response.get('success'):
            stems = response.get('stems', {})
            self.log(f"   Status: {stems.get('status', 'unknown')}")
            self.log(f"   Mocked: {response.get('mocked', False)}")
            self.log(f"   Vocals URL: {stems.get('vocals_url', 'none')}")
            self.log(f"   Guitar URL: {stems.get('guitar_url', 'none')}")
        return success

    def test_get_stems(self):
        """Test getting stems for a song"""
        if not self.test_song_id:
            self.log("⚠️  Skipping get stems test - no song ID available")
            return False
            
        success, response = self.run_test(
            "Get Stems",
            "GET",
            f"songs/{self.test_song_id}/stems",
            200
        )
        
        if success:
            if response.get('success'):
                stems = response.get('stems', {})
                self.log(f"   Found stems with status: {stems.get('status', 'unknown')}")
            else:
                self.log(f"   No stems found: {response.get('message', 'unknown')}")
        return success

    def test_get_lyrics(self):
        """Test getting lyrics and chords (mocked)"""
        if not self.test_song_id:
            self.log("⚠️  Skipping lyrics test - no song ID available")
            return False
            
        success, response = self.run_test(
            "Get Lyrics & Chords",
            "GET",
            f"songs/{self.test_song_id}/lyrics",
            200
        )
        
        if success and response.get('success'):
            lyrics_count = len(response.get('lyrics', []))
            chords_count = len(response.get('chords', []))
            self.log(f"   Lyrics lines: {lyrics_count}")
            self.log(f"   Chord changes: {chords_count}")
            self.log(f"   Mocked: {response.get('mocked', False)}")
        return success

    def test_create_recording(self):
        """Test creating a recording"""
        if not self.test_song_id:
            self.log("⚠️  Skipping recording creation test - no song ID available")
            return False
            
        recording_data = {
            "song_id": self.test_song_id,
            "title": "Test Recording",
            "recording_type": "audio",
            "duration": 30.5
        }
        
        success, response = self.run_test(
            "Create Recording",
            "POST",
            "recordings",
            200,
            data=recording_data
        )
        
        if success and response.get('success'):
            recording = response.get('recording', {})
            self.test_recording_id = recording.get('id')
            self.log(f"   Recording ID: {self.test_recording_id}")
            self.log(f"   Title: {recording.get('title', 'Unknown')}")
            self.log(f"   Type: {recording.get('recording_type', 'unknown')}")
        return success

    def test_list_recordings(self):
        """Test listing recordings"""
        success, response = self.run_test(
            "List Recordings",
            "GET",
            "recordings",
            200
        )
        
        if success and response.get('success'):
            recordings = response.get('recordings', [])
            self.log(f"   Found {len(recordings)} recordings")
        return success

    def test_get_recording(self):
        """Test getting a specific recording"""
        if not self.test_recording_id:
            self.log("⚠️  Skipping get recording test - no recording ID available")
            return False
            
        success, response = self.run_test(
            "Get Recording by ID",
            "GET",
            f"recordings/{self.test_recording_id}",
            200
        )
        
        if success and response.get('success'):
            recording = response.get('recording', {})
            self.log(f"   Title: {recording.get('title', 'Unknown')}")
            self.log(f"   Duration: {recording.get('duration', 0)}s")
        return success

    def test_save_recording_audio(self):
        """Test saving audio data to recording"""
        if not self.test_recording_id:
            self.log("⚠️  Skipping save audio test - no recording ID available")
            return False
            
        # Create mock audio data
        mock_audio = b"mock_audio_data_for_recording" * 50
        files = {'file': ('recording.webm', io.BytesIO(mock_audio), 'audio/webm')}
        
        success, response = self.run_test(
            "Save Recording Audio",
            "POST",
            f"recordings/{self.test_recording_id}/audio",
            200,
            files=files
        )
        
        if success and response.get('success'):
            self.log(f"   Audio saved: {response.get('message', 'unknown')}")
        return success

    def test_list_songs(self):
        """Test listing all songs"""
        success, response = self.run_test(
            "List All Songs",
            "GET",
            "songs",
            200
        )
        
        if success and response.get('success'):
            songs = response.get('songs', [])
            self.log(f"   Found {len(songs)} songs")
            if songs:
                latest = songs[0]
                self.log(f"   Latest: {latest.get('title', 'Unknown')} by {latest.get('artist', 'Unknown')}")
        return success

    def test_delete_recording(self):
        """Test deleting a recording (cleanup)"""
        if not self.test_recording_id:
            self.log("⚠️  Skipping delete recording test - no recording ID available")
            return False
            
        success, response = self.run_test(
            "Delete Recording",
            "DELETE",
            f"recordings/{self.test_recording_id}",
            200
        )
        
        if success and response.get('success'):
            self.log(f"   Deleted: {response.get('message', 'unknown')}")
        return success

    def run_all_tests(self):
        """Run all API tests in sequence"""
        self.log("🚀 Starting AuraSplit API Tests")
        self.log(f"   Base URL: {self.base_url}")
        self.log(f"   API URL: {self.api_url}")
        
        # Core API tests
        self.test_health_check()
        self.test_root_endpoint()
        
        # Song recognition flow
        self.test_song_recognition()
        self.test_get_song()
        self.test_stem_separation()
        self.test_get_stems()
        self.test_get_lyrics()
        
        # Recording flow
        self.test_create_recording()
        self.test_list_recordings()
        self.test_get_recording()
        self.test_save_recording_audio()
        
        # List operations
        self.test_list_songs()
        
        # Cleanup
        self.test_delete_recording()
        
        # Print results
        self.log(f"\n📊 Test Results:")
        self.log(f"   Tests run: {self.tests_run}")
        self.log(f"   Tests passed: {self.tests_passed}")
        self.log(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!")
            return 0
        else:
            self.log(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = AuraSplitAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())