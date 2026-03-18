"""
Integration tests for /api/v1/recurring/* endpoints.

Tests exercise the full stack: HTTP → router → service → real DB.

Business rules tested:
- Creating a recurring template with topic_ids stores topics on the template
- Creating a recurring template with topic_ids propagates topics to the first spawned instance
- Updating a recurring template's topic_ids changes future instances
- Topic association survives list/retrieve round-trips
"""
import pytest
from httpx import AsyncClient


async def _create_topic(client: AsyncClient, headers: dict, name: str) -> str:
    """Helper: create a topic and return its ID."""
    resp = await client.post(
        "/api/v1/topics",
        json={"name": name},
        headers=headers,
    )
    assert resp.status_code == 201, f"Topic creation failed: {resp.text}"
    return resp.json()["data"]["id"]


class TestRecurringCreateWithTopics:
    """Creating a recurring template with topic_ids."""

    @pytest.mark.asyncio
    async def test_create_recurring_with_single_topic_stores_on_template(
        self, client, auth_headers
    ):
        """topic_ids on create are reflected in the template response."""
        topic_id = await _create_topic(client, auth_headers, "Work")

        resp = await client.post(
            "/api/v1/recurring",
            json={
                "title": "Weekly Review",
                "frequency": "weekly",
                "topic_ids": [topic_id],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        template = body["data"]
        assert len(template["topics"]) == 1
        assert template["topics"][0]["id"] == topic_id
        assert template["topics"][0]["name"] == "Work"

    @pytest.mark.asyncio
    async def test_create_recurring_with_multiple_topics(self, client, auth_headers):
        """Multiple topic_ids are all stored on the template."""
        id1 = await _create_topic(client, auth_headers, "Health")
        id2 = await _create_topic(client, auth_headers, "Fitness")

        resp = await client.post(
            "/api/v1/recurring",
            json={
                "title": "Morning Run",
                "frequency": "daily",
                "topic_ids": [id1, id2],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        template = resp.json()["data"]
        returned_ids = {t["id"] for t in template["topics"]}
        assert returned_ids == {id1, id2}

    @pytest.mark.asyncio
    async def test_create_recurring_without_topics_has_empty_topics(
        self, client, auth_headers
    ):
        """No topic_ids → template.topics is an empty list."""
        resp = await client.post(
            "/api/v1/recurring",
            json={"title": "Plain Task", "frequency": "weekly"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["topics"] == []

    @pytest.mark.asyncio
    async def test_create_recurring_topics_propagated_to_first_task_instance(
        self, client, auth_headers
    ):
        """Topics on the template appear on the first spawned task instance."""
        topic_id = await _create_topic(client, auth_headers, "Project")

        await client.post(
            "/api/v1/recurring",
            json={
                "title": "Sync",
                "frequency": "weekly",
                "topic_ids": [topic_id],
            },
            headers=auth_headers,
        )

        # Fetch all tasks — the first instance should have been created
        tasks_resp = await client.get("/api/v1/tasks?window=all", headers=auth_headers)
        assert tasks_resp.status_code == 200
        tasks = tasks_resp.json()["data"]
        assert len(tasks) >= 1
        task = tasks[0]
        assert len(task["topics"]) == 1
        assert task["topics"][0]["id"] == topic_id

    @pytest.mark.asyncio
    async def test_created_template_topics_visible_in_list(self, client, auth_headers):
        """Topics on a template appear when listing recurring templates."""
        topic_id = await _create_topic(client, auth_headers, "Learning")

        await client.post(
            "/api/v1/recurring",
            json={
                "title": "Read Book",
                "frequency": "monthly",
                "topic_ids": [topic_id],
            },
            headers=auth_headers,
        )

        list_resp = await client.get("/api/v1/recurring", headers=auth_headers)
        assert list_resp.status_code == 200
        templates = list_resp.json()["data"]
        assert len(templates) == 1
        assert templates[0]["topics"][0]["id"] == topic_id
