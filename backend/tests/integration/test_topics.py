"""
Integration tests for /api/v1/topics/* endpoints.
"""
import uuid

import pytest


class TestTopicCreate:
    @pytest.mark.asyncio
    async def test_create_topic_returns_201(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/topics",
            json={"name": "Work"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["name"] == "Work"
        assert "id" in body["data"]

    @pytest.mark.asyncio
    async def test_create_duplicate_topic_returns_400(self, client, auth_headers):
        await client.post(
            "/api/v1/topics", json={"name": "Personal"}, headers=auth_headers
        )
        resp = await client.post(
            "/api/v1/topics", json={"name": "Personal"}, headers=auth_headers
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_create_topic_unauthenticated_returns_403(self, client):
        resp = await client.post("/api/v1/topics", json={"name": "Work"})
        assert resp.status_code == 403


class TestTopicList:
    @pytest.mark.asyncio
    async def test_list_topics_empty(self, client, auth_headers):
        resp = await client.get("/api/v1/topics", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    @pytest.mark.asyncio
    async def test_list_topics_returns_created(self, client, auth_headers):
        await client.post(
            "/api/v1/topics", json={"name": "Fitness"}, headers=auth_headers
        )
        resp = await client.get("/api/v1/topics", headers=auth_headers)
        topics = resp.json()["data"]
        assert len(topics) == 1
        assert topics[0]["name"] == "Fitness"


class TestTopicRename:
    @pytest.mark.asyncio
    async def test_rename_topic(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/topics", json={"name": "Old Name"}, headers=auth_headers
        )
        topic_id = create_resp.json()["data"]["id"]

        resp = await client.patch(
            f"/api/v1/topics/{topic_id}",
            json={"name": "New Name"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_rename_nonexistent_topic_returns_404(self, client, auth_headers):
        resp = await client.patch(
            f"/api/v1/topics/{uuid.uuid4()}",
            json={"name": "x"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestTopicDelete:
    @pytest.mark.asyncio
    async def test_delete_topic_returns_200(self, client, auth_headers):
        create_resp = await client.post(
            "/api/v1/topics", json={"name": "Temp"}, headers=auth_headers
        )
        topic_id = create_resp.json()["data"]["id"]

        resp = await client.delete(
            f"/api/v1/topics/{topic_id}", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_nonexistent_topic_returns_404(self, client, auth_headers):
        resp = await client.delete(
            f"/api/v1/topics/{uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 404
