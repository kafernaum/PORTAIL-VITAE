#!/usr/bin/env python3
"""
Focused test for POST /api/videos and POST /api/links
Verifies that MongoDB _id field is NOT exposed in responses
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://finances-theory.preview.emergentagent.com/api"
ADMIN_PASSWORD = "vitea2025"
HEADERS_AUTH_JSON = {
    "Authorization": f"Bearer {ADMIN_PASSWORD}",
    "Content-Type": "application/json"
}
HEADERS_AUTH = {"Authorization": f"Bearer {ADMIN_PASSWORD}"}

# Test tracking
tests_passed = 0
tests_failed = 0
created_entities = {"videos": [], "links": []}


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    global tests_passed, tests_failed
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {name}")
    if details:
        print(f"   {details}")
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1


def test_post_videos():
    """Test POST /api/videos - verify no _id field in response"""
    print("\n=== Test 1: POST /api/videos (verify no _id) ===")
    
    video_data = {
        "title": "Vidéo Test Théorie Vitaliste",
        "description": "Test de vérification que le champ _id MongoDB n'est pas exposé",
        "url": "https://www.youtube.com/watch?v=test_vitea_2025",
        "category": "Test Vitaliste",
        "order": 9999
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/videos",
            json=video_data,
            headers=HEADERS_AUTH_JSON,
            timeout=10
        )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            created_video = response.json()
            print(f"   Response: {json.dumps(created_video, indent=2)}")
            
            # Check for required fields
            has_id = "id" in created_video
            has_mongo_id = "_id" in created_video
            
            # Verify structure
            required_fields = ["id", "title", "description", "url", "category", "order", "createdAt"]
            missing_fields = [f for f in required_fields if f not in created_video]
            
            if has_id and not has_mongo_id and not missing_fields:
                video_id = created_video.get("id")
                created_entities["videos"].append(video_id)
                log_test(
                    "POST /api/videos - no _id exposed",
                    True,
                    f"✓ Response has 'id' (UUID: {video_id})\n   ✓ Response does NOT have '_id'\n   ✓ All required fields present: {', '.join(required_fields)}"
                )
            else:
                issues = []
                if not has_id:
                    issues.append("Missing 'id' field")
                if has_mongo_id:
                    issues.append(f"❌ CRITICAL: '_id' field exposed with value: {created_video.get('_id')}")
                if missing_fields:
                    issues.append(f"Missing fields: {missing_fields}")
                
                log_test(
                    "POST /api/videos - no _id exposed",
                    False,
                    "\n   ".join(issues)
                )
        else:
            log_test(
                "POST /api/videos - no _id exposed",
                False,
                f"Expected status 200, got {response.status_code}: {response.text}"
            )
    except Exception as e:
        log_test("POST /api/videos - no _id exposed", False, f"Exception: {str(e)}")


def test_post_links():
    """Test POST /api/links - verify no _id field in response"""
    print("\n=== Test 2: POST /api/links (verify no _id) ===")
    
    link_data = {
        "label": "Lien Test Vitea Publica",
        "url": "https://test.vitea-publica.org/verification",
        "icon": "TestIcon",
        "order": 9999
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/links",
            json=link_data,
            headers=HEADERS_AUTH_JSON,
            timeout=10
        )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            created_link = response.json()
            print(f"   Response: {json.dumps(created_link, indent=2)}")
            
            # Check for required fields
            has_id = "id" in created_link
            has_mongo_id = "_id" in created_link
            
            # Verify structure
            required_fields = ["id", "label", "url", "icon", "order"]
            missing_fields = [f for f in required_fields if f not in created_link]
            
            if has_id and not has_mongo_id and not missing_fields:
                link_id = created_link.get("id")
                created_entities["links"].append(link_id)
                log_test(
                    "POST /api/links - no _id exposed",
                    True,
                    f"✓ Response has 'id' (UUID: {link_id})\n   ✓ Response does NOT have '_id'\n   ✓ All required fields present: {', '.join(required_fields)}"
                )
            else:
                issues = []
                if not has_id:
                    issues.append("Missing 'id' field")
                if has_mongo_id:
                    issues.append(f"❌ CRITICAL: '_id' field exposed with value: {created_link.get('_id')}")
                if missing_fields:
                    issues.append(f"Missing fields: {missing_fields}")
                
                log_test(
                    "POST /api/links - no _id exposed",
                    False,
                    "\n   ".join(issues)
                )
        else:
            log_test(
                "POST /api/links - no _id exposed",
                False,
                f"Expected status 200, got {response.status_code}: {response.text}"
            )
    except Exception as e:
        log_test("POST /api/links - no _id exposed", False, f"Exception: {str(e)}")


def cleanup():
    """Clean up created test entities"""
    print("\n=== Cleanup ===")
    
    for video_id in created_entities["videos"]:
        try:
            response = requests.delete(
                f"{BASE_URL}/videos/{video_id}",
                headers=HEADERS_AUTH,
                timeout=10
            )
            if response.status_code == 200:
                print(f"✓ Deleted video: {video_id}")
            else:
                print(f"⚠ Failed to delete video {video_id}: status {response.status_code}")
        except Exception as e:
            print(f"⚠ Exception deleting video {video_id}: {str(e)}")
    
    for link_id in created_entities["links"]:
        try:
            response = requests.delete(
                f"{BASE_URL}/links/{link_id}",
                headers=HEADERS_AUTH,
                timeout=10
            )
            if response.status_code == 200:
                print(f"✓ Deleted link: {link_id}")
            else:
                print(f"⚠ Failed to delete link {link_id}: status {response.status_code}")
        except Exception as e:
            print(f"⚠ Exception deleting link {link_id}: {str(e)}")


def main():
    """Run focused POST endpoint tests"""
    print("=" * 80)
    print("VITEA PUBLICA - POST ENDPOINTS VERIFICATION TEST")
    print("Testing: MongoDB _id field should NOT be exposed in responses")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    try:
        # Run tests
        test_post_videos()
        test_post_links()
        
    finally:
        # Always cleanup
        cleanup()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"✅ Passed: {tests_passed}")
        print(f"❌ Failed: {tests_failed}")
        print(f"Total: {tests_passed + tests_failed}")
        print("=" * 80)
        
        if tests_failed > 0:
            print("\n❌ Some tests failed - MongoDB _id field may still be exposed")
            sys.exit(1)
        else:
            print("\n🎉 All tests passed! MongoDB _id field is NOT exposed in POST responses")
            sys.exit(0)


if __name__ == "__main__":
    main()
