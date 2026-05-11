#!/usr/bin/env python3
"""
Backend API tests for Vitea Publica Portal
Tests all endpoints with proper authentication and data validation
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://finances-theory.preview.emergentagent.com/api"
ADMIN_PASSWORD = "vitea2025"
HEADERS_AUTH = {"Authorization": f"Bearer {ADMIN_PASSWORD}"}
HEADERS_JSON = {"Content-Type": "application/json"}
HEADERS_AUTH_JSON = {**HEADERS_AUTH, **HEADERS_JSON}

# Test tracking
tests_passed = 0
tests_failed = 0
test_entities = {"videos": [], "links": []}  # Track created entities for cleanup


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


def test_health():
    """Test 1: GET /api/health"""
    print("\n=== Test 1: GET /api/health ===")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True and data.get("service") == "vitea-publica":
                log_test("Health endpoint", True, f"Response: {data}")
            else:
                log_test("Health endpoint", False, f"Unexpected response: {data}")
        else:
            log_test("Health endpoint", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Health endpoint", False, f"Exception: {str(e)}")


def test_auth_login():
    """Test 2: POST /api/auth/login"""
    print("\n=== Test 2: POST /api/auth/login ===")
    
    # Test with correct password
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"password": ADMIN_PASSWORD},
            headers=HEADERS_JSON,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True and data.get("token") == ADMIN_PASSWORD:
                log_test("Login with correct password", True, f"Token received: {data.get('token')}")
            else:
                log_test("Login with correct password", False, f"Unexpected response: {data}")
        else:
            log_test("Login with correct password", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Login with correct password", False, f"Exception: {str(e)}")
    
    # Test with wrong password
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"password": "wrongpassword"},
            headers=HEADERS_JSON,
            timeout=10
        )
        
        if response.status_code == 401:
            data = response.json()
            if "error" in data and "invalide" in data["error"].lower():
                log_test("Login with wrong password (401)", True, f"Error message: {data.get('error')}")
            else:
                log_test("Login with wrong password (401)", False, f"Missing proper error message: {data}")
        else:
            log_test("Login with wrong password (401)", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("Login with wrong password (401)", False, f"Exception: {str(e)}")


def test_config_get():
    """Test 3: GET /api/config (public)"""
    print("\n=== Test 3: GET /api/config (public) ===")
    try:
        response = requests.get(f"{BASE_URL}/config", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["heroTitle", "heroSubtitle", "heroBackground", "introText", "brandName", "brandTagline"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                log_test("Config GET - all fields present", True, f"Fields: {', '.join(required_fields)}")
            else:
                log_test("Config GET - all fields present", False, f"Missing fields: {missing_fields}")
        else:
            log_test("Config GET", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Config GET", False, f"Exception: {str(e)}")


def test_videos_get():
    """Test 4: GET /api/videos (public)"""
    print("\n=== Test 4: GET /api/videos (public) ===")
    try:
        response = requests.get(f"{BASE_URL}/videos", timeout=10)
        
        if response.status_code == 200:
            videos = response.json()
            if isinstance(videos, list):
                log_test("Videos GET - returns array", True, f"Found {len(videos)} videos")
                
                # Check structure and no _id field
                if videos:
                    video = videos[0]
                    required_fields = ["id", "title", "description", "url", "category", "order", "createdAt"]
                    missing_fields = [f for f in required_fields if f not in video]
                    has_mongo_id = "_id" in video
                    
                    if not missing_fields and not has_mongo_id:
                        log_test("Video structure valid (UUID, no _id)", True, f"Fields: {', '.join(required_fields)}")
                    else:
                        details = []
                        if missing_fields:
                            details.append(f"Missing: {missing_fields}")
                        if has_mongo_id:
                            details.append("ERROR: _id field exposed!")
                        log_test("Video structure valid", False, "; ".join(details))
                    
                    # Check order sorting
                    orders = [v.get("order", 999) for v in videos]
                    is_sorted = all(orders[i] <= orders[i+1] for i in range(len(orders)-1))
                    log_test("Videos sorted by order", is_sorted, f"Orders: {orders[:5]}")
            else:
                log_test("Videos GET - returns array", False, f"Expected array, got {type(videos)}")
        else:
            log_test("Videos GET", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Videos GET", False, f"Exception: {str(e)}")


def test_links_get():
    """Test 5: GET /api/links (public)"""
    print("\n=== Test 5: GET /api/links (public) ===")
    try:
        response = requests.get(f"{BASE_URL}/links", timeout=10)
        
        if response.status_code == 200:
            links = response.json()
            if isinstance(links, list):
                log_test("Links GET - returns array", True, f"Found {len(links)} links")
                
                # Check structure and no _id field
                if links:
                    link = links[0]
                    required_fields = ["id", "label", "url", "icon", "order"]
                    missing_fields = [f for f in required_fields if f not in link]
                    has_mongo_id = "_id" in link
                    
                    if not missing_fields and not has_mongo_id:
                        log_test("Link structure valid (UUID, no _id)", True, f"Fields: {', '.join(required_fields)}")
                    else:
                        details = []
                        if missing_fields:
                            details.append(f"Missing: {missing_fields}")
                        if has_mongo_id:
                            details.append("ERROR: _id field exposed!")
                        log_test("Link structure valid", False, "; ".join(details))
                    
                    # Check order sorting
                    orders = [l.get("order", 999) for l in links]
                    is_sorted = all(orders[i] <= orders[i+1] for i in range(len(orders)-1))
                    log_test("Links sorted by order", is_sorted, f"Orders: {orders}")
            else:
                log_test("Links GET - returns array", False, f"Expected array, got {type(links)}")
        else:
            log_test("Links GET", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Links GET", False, f"Exception: {str(e)}")


def test_auth_guard():
    """Test 6: Auth guard on protected routes"""
    print("\n=== Test 6: Auth guard on protected routes ===")
    
    # Test POST /api/videos without auth
    try:
        response = requests.post(
            f"{BASE_URL}/videos",
            json={"title": "Test", "url": "https://test.com"},
            headers=HEADERS_JSON,
            timeout=10
        )
        
        if response.status_code == 401:
            log_test("POST /api/videos without auth → 401", True)
        else:
            log_test("POST /api/videos without auth → 401", False, f"Got {response.status_code}")
    except Exception as e:
        log_test("POST /api/videos without auth → 401", False, f"Exception: {str(e)}")
    
    # Test POST /api/links without auth
    try:
        response = requests.post(
            f"{BASE_URL}/links",
            json={"label": "Test", "url": "https://test.com"},
            headers=HEADERS_JSON,
            timeout=10
        )
        
        if response.status_code == 401:
            log_test("POST /api/links without auth → 401", True)
        else:
            log_test("POST /api/links without auth → 401", False, f"Got {response.status_code}")
    except Exception as e:
        log_test("POST /api/links without auth → 401", False, f"Exception: {str(e)}")
    
    # Test PUT /api/config without auth
    try:
        response = requests.put(
            f"{BASE_URL}/config",
            json={"heroTitle": "Test"},
            headers=HEADERS_JSON,
            timeout=10
        )
        
        if response.status_code == 401:
            log_test("PUT /api/config without auth → 401", True)
        else:
            log_test("PUT /api/config without auth → 401", False, f"Got {response.status_code}")
    except Exception as e:
        log_test("PUT /api/config without auth → 401", False, f"Exception: {str(e)}")
    
    # Test with wrong token
    try:
        response = requests.post(
            f"{BASE_URL}/videos",
            json={"title": "Test", "url": "https://test.com"},
            headers={"Authorization": "Bearer wrongtoken", **HEADERS_JSON},
            timeout=10
        )
        
        if response.status_code == 401:
            log_test("POST /api/videos with wrong token → 401", True)
        else:
            log_test("POST /api/videos with wrong token → 401", False, f"Got {response.status_code}")
    except Exception as e:
        log_test("POST /api/videos with wrong token → 401", False, f"Exception: {str(e)}")


def test_videos_crud():
    """Test 7: CRUD operations on videos"""
    print("\n=== Test 7: Videos CRUD operations ===")
    
    # CREATE
    video_data = {
        "title": "Test Video Vitaliste",
        "description": "Description de test pour la théorie vitaliste",
        "url": "https://www.youtube.com/watch?v=test123",
        "category": "Test",
        "order": 1000
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/videos",
            json=video_data,
            headers=HEADERS_AUTH_JSON,
            timeout=10
        )
        
        if response.status_code == 200:
            created_video = response.json()
            video_id = created_video.get("id")
            
            if video_id and "_id" not in created_video:
                log_test("POST /api/videos - create", True, f"Created video with UUID: {video_id}")
                test_entities["videos"].append(video_id)
                
                # UPDATE
                update_data = {"title": "Test Video Updated", "category": "Test Updated"}
                response = requests.put(
                    f"{BASE_URL}/videos/{video_id}",
                    json=update_data,
                    headers=HEADERS_AUTH_JSON,
                    timeout=10
                )
                
                if response.status_code == 200:
                    updated_video = response.json()
                    if updated_video.get("title") == "Test Video Updated" and updated_video.get("category") == "Test Updated":
                        log_test("PUT /api/videos/{id} - update", True, f"Updated video {video_id}")
                    else:
                        log_test("PUT /api/videos/{id} - update", False, f"Update not reflected: {updated_video}")
                else:
                    log_test("PUT /api/videos/{id} - update", False, f"Status {response.status_code}")
                
                # DELETE
                response = requests.delete(
                    f"{BASE_URL}/videos/{video_id}",
                    headers=HEADERS_AUTH,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok") == True:
                        log_test("DELETE /api/videos/{id}", True, f"Deleted video {video_id}")
                        test_entities["videos"].remove(video_id)
                    else:
                        log_test("DELETE /api/videos/{id}", False, f"Unexpected response: {data}")
                else:
                    log_test("DELETE /api/videos/{id}", False, f"Status {response.status_code}")
            else:
                log_test("POST /api/videos - create", False, f"No UUID or _id exposed: {created_video}")
        else:
            log_test("POST /api/videos - create", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Videos CRUD", False, f"Exception: {str(e)}")


def test_links_crud():
    """Test 8: CRUD operations on links"""
    print("\n=== Test 8: Links CRUD operations ===")
    
    # CREATE
    link_data = {
        "label": "Test Link Vitaliste",
        "url": "https://test.vitea-publica.org",
        "icon": "TestIcon",
        "order": 1000
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/links",
            json=link_data,
            headers=HEADERS_AUTH_JSON,
            timeout=10
        )
        
        if response.status_code == 200:
            created_link = response.json()
            link_id = created_link.get("id")
            
            if link_id and "_id" not in created_link:
                log_test("POST /api/links - create", True, f"Created link with UUID: {link_id}")
                test_entities["links"].append(link_id)
                
                # UPDATE
                update_data = {"label": "Test Link Updated", "icon": "UpdatedIcon"}
                response = requests.put(
                    f"{BASE_URL}/links/{link_id}",
                    json=update_data,
                    headers=HEADERS_AUTH_JSON,
                    timeout=10
                )
                
                if response.status_code == 200:
                    updated_link = response.json()
                    if updated_link.get("label") == "Test Link Updated" and updated_link.get("icon") == "UpdatedIcon":
                        log_test("PUT /api/links/{id} - update", True, f"Updated link {link_id}")
                    else:
                        log_test("PUT /api/links/{id} - update", False, f"Update not reflected: {updated_link}")
                else:
                    log_test("PUT /api/links/{id} - update", False, f"Status {response.status_code}")
                
                # DELETE
                response = requests.delete(
                    f"{BASE_URL}/links/{link_id}",
                    headers=HEADERS_AUTH,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok") == True:
                        log_test("DELETE /api/links/{id}", True, f"Deleted link {link_id}")
                        test_entities["links"].remove(link_id)
                    else:
                        log_test("DELETE /api/links/{id}", False, f"Unexpected response: {data}")
                else:
                    log_test("DELETE /api/links/{id}", False, f"Status {response.status_code}")
            else:
                log_test("POST /api/links - create", False, f"No UUID or _id exposed: {created_link}")
        else:
            log_test("POST /api/links - create", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Links CRUD", False, f"Exception: {str(e)}")


def test_videos_reorder():
    """Test 9: Bulk reorder videos"""
    print("\n=== Test 9: POST /api/videos/reorder ===")
    
    # Create 2 test videos
    video_ids = []
    try:
        for i in range(2):
            response = requests.post(
                f"{BASE_URL}/videos",
                json={
                    "title": f"Reorder Test Video {i+1}",
                    "url": f"https://test.com/video{i+1}",
                    "category": "Test",
                    "order": 2000 + i
                },
                headers=HEADERS_AUTH_JSON,
                timeout=10
            )
            if response.status_code == 200:
                video_id = response.json().get("id")
                video_ids.append(video_id)
                test_entities["videos"].append(video_id)
        
        if len(video_ids) == 2:
            # Reorder: swap orders
            reorder_data = {
                "items": [
                    {"id": video_ids[0], "order": 2001},
                    {"id": video_ids[1], "order": 2000}
                ]
            }
            
            response = requests.post(
                f"{BASE_URL}/videos/reorder",
                json=reorder_data,
                headers=HEADERS_AUTH_JSON,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") == True and data.get("updated") == 2:
                    log_test("POST /api/videos/reorder", True, f"Reordered {data.get('updated')} videos")
                    
                    # Verify order changed
                    response = requests.get(f"{BASE_URL}/videos", timeout=10)
                    if response.status_code == 200:
                        videos = response.json()
                        test_videos = [v for v in videos if v.get("id") in video_ids]
                        if len(test_videos) == 2:
                            orders = {v["id"]: v["order"] for v in test_videos}
                            if orders[video_ids[0]] == 2001 and orders[video_ids[1]] == 2000:
                                log_test("Verify reorder persisted", True, f"Orders updated correctly")
                            else:
                                log_test("Verify reorder persisted", False, f"Orders not updated: {orders}")
                else:
                    log_test("POST /api/videos/reorder", False, f"Unexpected response: {data}")
            else:
                log_test("POST /api/videos/reorder", False, f"Status {response.status_code}")
        else:
            log_test("POST /api/videos/reorder", False, "Could not create test videos")
    except Exception as e:
        log_test("Videos reorder", False, f"Exception: {str(e)}")
    finally:
        # Cleanup
        for vid in video_ids:
            try:
                requests.delete(f"{BASE_URL}/videos/{vid}", headers=HEADERS_AUTH, timeout=10)
                if vid in test_entities["videos"]:
                    test_entities["videos"].remove(vid)
            except:
                pass


def test_links_reorder():
    """Test 10: Bulk reorder links"""
    print("\n=== Test 10: POST /api/links/reorder ===")
    
    # Create 2 test links
    link_ids = []
    try:
        for i in range(2):
            response = requests.post(
                f"{BASE_URL}/links",
                json={
                    "label": f"Reorder Test Link {i+1}",
                    "url": f"https://test.com/link{i+1}",
                    "icon": "TestIcon",
                    "order": 2000 + i
                },
                headers=HEADERS_AUTH_JSON,
                timeout=10
            )
            if response.status_code == 200:
                link_id = response.json().get("id")
                link_ids.append(link_id)
                test_entities["links"].append(link_id)
        
        if len(link_ids) == 2:
            # Reorder: swap orders
            reorder_data = {
                "items": [
                    {"id": link_ids[0], "order": 2001},
                    {"id": link_ids[1], "order": 2000}
                ]
            }
            
            response = requests.post(
                f"{BASE_URL}/links/reorder",
                json=reorder_data,
                headers=HEADERS_AUTH_JSON,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") == True and data.get("updated") == 2:
                    log_test("POST /api/links/reorder", True, f"Reordered {data.get('updated')} links")
                    
                    # Verify order changed
                    response = requests.get(f"{BASE_URL}/links", timeout=10)
                    if response.status_code == 200:
                        links = response.json()
                        test_links = [l for l in links if l.get("id") in link_ids]
                        if len(test_links) == 2:
                            orders = {l["id"]: l["order"] for l in test_links}
                            if orders[link_ids[0]] == 2001 and orders[link_ids[1]] == 2000:
                                log_test("Verify reorder persisted", True, f"Orders updated correctly")
                            else:
                                log_test("Verify reorder persisted", False, f"Orders not updated: {orders}")
                else:
                    log_test("POST /api/links/reorder", False, f"Unexpected response: {data}")
            else:
                log_test("POST /api/links/reorder", False, f"Status {response.status_code}")
        else:
            log_test("POST /api/links/reorder", False, "Could not create test links")
    except Exception as e:
        log_test("Links reorder", False, f"Exception: {str(e)}")
    finally:
        # Cleanup
        for lid in link_ids:
            try:
                requests.delete(f"{BASE_URL}/links/{lid}", headers=HEADERS_AUTH, timeout=10)
                if lid in test_entities["links"]:
                    test_entities["links"].remove(lid)
            except:
                pass


def test_config_update():
    """Test 11: PUT /api/config"""
    print("\n=== Test 11: PUT /api/config ===")
    
    # Get current config
    try:
        response = requests.get(f"{BASE_URL}/config", timeout=10)
        if response.status_code != 200:
            log_test("PUT /api/config", False, "Could not get current config")
            return
        
        original_config = response.json()
        original_title = original_config.get("heroTitle")
        
        # Update config
        new_title = "Test Titre Vitaliste Modifié"
        response = requests.put(
            f"{BASE_URL}/config",
            json={"heroTitle": new_title},
            headers=HEADERS_AUTH_JSON,
            timeout=10
        )
        
        if response.status_code == 200:
            updated_config = response.json()
            if updated_config.get("heroTitle") == new_title:
                log_test("PUT /api/config - update field", True, f"Updated heroTitle to: {new_title}")
                
                # Restore original
                response = requests.put(
                    f"{BASE_URL}/config",
                    json={"heroTitle": original_title},
                    headers=HEADERS_AUTH_JSON,
                    timeout=10
                )
                
                if response.status_code == 200:
                    log_test("PUT /api/config - restore original", True, f"Restored heroTitle")
                else:
                    log_test("PUT /api/config - restore original", False, f"Status {response.status_code}")
            else:
                log_test("PUT /api/config - update field", False, f"Update not reflected: {updated_config.get('heroTitle')}")
        else:
            log_test("PUT /api/config", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Config update", False, f"Exception: {str(e)}")


def cleanup():
    """Clean up test entities"""
    print("\n=== Cleanup ===")
    
    for video_id in test_entities["videos"]:
        try:
            requests.delete(f"{BASE_URL}/videos/{video_id}", headers=HEADERS_AUTH, timeout=10)
            print(f"Cleaned up video: {video_id}")
        except Exception as e:
            print(f"Failed to cleanup video {video_id}: {str(e)}")
    
    for link_id in test_entities["links"]:
        try:
            requests.delete(f"{BASE_URL}/links/{link_id}", headers=HEADERS_AUTH, timeout=10)
            print(f"Cleaned up link: {link_id}")
        except Exception as e:
            print(f"Failed to cleanup link {link_id}: {str(e)}")


def main():
    """Run all tests"""
    print("=" * 80)
    print("VITEA PUBLICA API BACKEND TESTS")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    try:
        # Run all tests
        test_health()
        test_auth_login()
        test_config_get()
        test_videos_get()
        test_links_get()
        test_auth_guard()
        test_videos_crud()
        test_links_crud()
        test_videos_reorder()
        test_links_reorder()
        test_config_update()
        
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
            sys.exit(1)
        else:
            print("\n🎉 All tests passed!")
            sys.exit(0)


if __name__ == "__main__":
    main()
