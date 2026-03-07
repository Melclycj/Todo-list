"""
Integration tests for /api/v1/tasks/* endpoints.

Uses auth_headers fixture for authenticated requests.
Tests exercise the full stack: HTTP → router → service → real DB.
"""
import uuid

import pytest
from httpx import AsyncClient


async def _make_headers(client: AsyncClient, email: str) -> dict:
    """Register a new user and return their Bearer auth headers."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TestPass123!"},
    )
    assert reg.status_code == 201, f"Registration failed for {email}: {reg.text}"
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "TestPass123!"},
    )
    assert login.status_code == 200, f"Login failed for {email}: {login.text}"
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


class TestTaskCreate:
    @pytest.mark.asyncio
    async def test_create_task_returns_201(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Buy groceries"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["title"] == "Buy groceries"
        assert body["data"]["status"] == "todo"
        assert body["data"]["archived"] is False
        assert "id" in body["data"]

    @pytest.mark.asyncio
    async def test_create_task_empty_title_returns_422(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/tasks",
            json={"title": ""},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_task_unauthenticated_returns_401(self, client):
        resp = await client.post("/api/v1/tasks", json={"title": "Task"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_create_task_with_description(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Read a book", "description": "Finish chapter 5"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["description"] == "Finish chapter 5"


class TestTaskList:
    @pytest.mark.asyncio
    async def test_list_tasks_empty(self, client, auth_headers):
        resp = await client.get("/api/v1/tasks", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"] == []

    @pytest.mark.asyncio
    async def test_list_tasks_returns_created_task(self, client, auth_headers):
        await client.post(
            "/api/v1/tasks",
            json={"title": "Walk the dog"},
            headers=auth_headers,
        )
        resp = await client.get("/api/v1/tasks", headers=auth_headers)
        assert resp.status_code == 200
        tasks = resp.json()["data"]
        assert len(tasks) == 1
        assert tasks[0]["title"] == "Walk the dog"

    @pytest.mark.asyncio
    async def test_list_tasks_unauthenticated_returns_401(self, client):
        resp = await client.get("/api/v1/tasks")
        assert resp.status_code == 401


class TestTaskGet:
    @pytest.mark.asyncio
    async def test_get_task_returns_200(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Water plants"},
            headers=auth_headers,
        )
        task_id = create_resp.json()["data"]["id"]

        resp = await client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == task_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_task_returns_404(self, client, auth_headers):
        resp = await client.get(
            f"/api/v1/tasks/{uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 404


class TestTaskUpdate:
    @pytest.mark.asyncio
    async def test_update_task_title(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Old title"},
            headers=auth_headers,
        )
        task_id = create_resp.json()["data"]["id"]

        resp = await client.patch(
            f"/api/v1/tasks/{task_id}",
            json={"title": "New title"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "New title"

    @pytest.mark.asyncio
    async def test_update_nonexistent_task_returns_404(self, client, auth_headers):
        resp = await client.patch(
            f"/api/v1/tasks/{uuid.uuid4()}",
            json={"title": "x"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestTaskStatusUpdate:
    @pytest.mark.asyncio
    async def test_status_todo_to_in_progress(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Code review"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]

        resp = await client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={"status": "in_progress"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_status_in_progress_to_done_sets_done_at(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Write tests"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]
        await client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={"status": "in_progress"},
            headers=auth_headers,
        )

        resp = await client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={"status": "done"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "done"
        assert data["done_at"] is not None

    @pytest.mark.asyncio
    async def test_invalid_status_transition_returns_400(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Deploy app"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]
        # Mark as done first
        await client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={"status": "done"},
            headers=auth_headers,
        )
        # Done → In Progress is invalid
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={"status": "in_progress"},
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestTaskDelete:
    @pytest.mark.asyncio
    async def test_delete_task_returns_200(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Temp task"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]

        resp = await client.delete(
            f"/api/v1/tasks/{task_id}", headers=auth_headers
        )
        assert resp.status_code == 200

        get_resp = await client.get(
            f"/api/v1/tasks/{task_id}", headers=auth_headers
        )
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_task_returns_404(self, client, auth_headers):
        resp = await client.delete(
            f"/api/v1/tasks/{uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 404


class TestTaskCreateWithTopics:
    """
    Verify that topic_ids passed at task creation time are correctly
    persisted and returned in the response.

    This is the regression test for the "create task with topic" bug
    where topics were silently dropped when supplied during creation.
    """

    @pytest.mark.asyncio
    async def test_create_task_with_single_topic_returns_topic_in_response(
        self, client, auth_headers
    ):
        """Topics passed at creation time appear in the response topics list."""
        # Create a topic first
        topic_resp = await client.post(
            "/api/v1/topics",
            json={"name": "Work"},
            headers=auth_headers,
        )
        assert topic_resp.status_code == 201
        topic_id = topic_resp.json()["data"]["id"]

        # Create a task and pass the topic_id at creation time
        task_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Finish report", "topic_ids": [topic_id]},
            headers=auth_headers,
        )
        assert task_resp.status_code == 201
        data = task_resp.json()["data"]

        assert "topics" in data
        assert len(data["topics"]) == 1
        assert data["topics"][0]["id"] == topic_id
        assert data["topics"][0]["name"] == "Work"

    @pytest.mark.asyncio
    async def test_create_task_with_multiple_topics_returns_all_topics(
        self, client, auth_headers
    ):
        """Multiple topic_ids passed at creation time all appear in the response."""
        topic_a = (
            await client.post(
                "/api/v1/topics", json={"name": "Home"}, headers=auth_headers
            )
        ).json()["data"]
        topic_b = (
            await client.post(
                "/api/v1/topics", json={"name": "Health"}, headers=auth_headers
            )
        ).json()["data"]

        task_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Morning routine", "topic_ids": [topic_a["id"], topic_b["id"]]},
            headers=auth_headers,
        )
        assert task_resp.status_code == 201
        returned_topic_ids = {t["id"] for t in task_resp.json()["data"]["topics"]}
        assert returned_topic_ids == {topic_a["id"], topic_b["id"]}

    @pytest.mark.asyncio
    async def test_create_task_without_topics_returns_empty_topics_list(
        self, client, auth_headers
    ):
        """A task created without topic_ids has an empty topics list."""
        task_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "No topics here"},
            headers=auth_headers,
        )
        assert task_resp.status_code == 201
        assert task_resp.json()["data"]["topics"] == []

    @pytest.mark.asyncio
    async def test_get_task_after_create_with_topic_still_returns_topic(
        self, client, auth_headers
    ):
        """The topic association persists when the task is re-fetched via GET."""
        topic_resp = await client.post(
            "/api/v1/topics",
            json={"name": "Finance"},
            headers=auth_headers,
        )
        topic_id = topic_resp.json()["data"]["id"]

        create_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Budget review", "topic_ids": [topic_id]},
            headers=auth_headers,
        )
        task_id = create_resp.json()["data"]["id"]

        get_resp = await client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        topics = get_resp.json()["data"]["topics"]
        assert len(topics) == 1
        assert topics[0]["id"] == topic_id

    @pytest.mark.asyncio
    async def test_create_task_with_nonexistent_topic_id_returns_empty_topics(
        self, client, auth_headers
    ):
        """An unknown topic_id is silently ignored — the task is still created."""
        import uuid
        fake_id = str(uuid.uuid4())

        task_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Ghost topic task", "topic_ids": [fake_id]},
            headers=auth_headers,
        )
        assert task_resp.status_code == 201
        # Non-existent topics are not included
        assert task_resp.json()["data"]["topics"] == []

    @pytest.mark.asyncio
    async def test_create_task_with_other_users_topic_does_not_assign_topic(
        self, client, auth_headers
    ):
        """A user cannot assign a topic that belongs to another user."""
        # Create a topic as a different user
        other_headers = await _make_headers(client, "topicowner@example.com")
        topic_resp = await client.post(
            "/api/v1/topics", json={"name": "Secret topic"}, headers=other_headers
        )
        other_topic_id = topic_resp.json()["data"]["id"]

        # Attempt to create a task using that foreign topic_id
        task_resp = await client.post(
            "/api/v1/tasks",
            json={"title": "Hijack attempt", "topic_ids": [other_topic_id]},
            headers=auth_headers,
        )
        assert task_resp.status_code == 201
        # The foreign topic must NOT appear in the result
        assert task_resp.json()["data"]["topics"] == []


class TestTaskCrossUserIsolation:
    """
    Verify that a user cannot read, modify, or delete another user's tasks.
    These tests catch regressions in the ownership check inside TaskService.
    """

    @pytest.mark.asyncio
    async def test_other_user_cannot_read_task(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Private task"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]

        other = await _make_headers(client, "other1@example.com")
        resp = await client.get(f"/api/v1/tasks/{task_id}", headers=other)
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_other_user_cannot_update_task(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Owner task"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]

        other = await _make_headers(client, "other2@example.com")
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}",
            json={"title": "Hijacked"},
            headers=other,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_other_user_cannot_update_status(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Status task"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]

        other = await _make_headers(client, "other3@example.com")
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}/status",
            json={"status": "in_progress"},
            headers=other,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_other_user_cannot_delete_task(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/tasks", json={"title": "Delete target"}, headers=auth_headers
        )
        task_id = create_resp.json()["data"]["id"]

        other = await _make_headers(client, "other4@example.com")
        resp = await client.delete(f"/api/v1/tasks/{task_id}", headers=other)
        assert resp.status_code == 403

        # Task should still exist for the original owner
        owner_resp = await client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
        assert owner_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_tasks_only_returns_own_tasks(self, client, auth_headers):
        """User A's tasks must not appear in User B's list."""
        await client.post(
            "/api/v1/tasks", json={"title": "User A task"}, headers=auth_headers
        )

        other = await _make_headers(client, "other5@example.com")
        resp = await client.get("/api/v1/tasks", headers=other)
        assert resp.status_code == 200
        assert resp.json()["data"] == []
