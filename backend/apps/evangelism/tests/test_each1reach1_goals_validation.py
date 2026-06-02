from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.clusters.models import Cluster
from apps.evangelism.models import Each1Reach1Goal
from apps.people.models import Person


class Each1Reach1GoalValidationTests(TestCase):
    endpoint = "/api/evangelism/each1reach1-goals/"
    duplicate_error = "A goal already exists for this cluster and year."

    def setUp(self):
        self.client = APIClient()
        self.admin = Person.objects.create_user(
            username="admin_goal_validation",
            password="password123",
            first_name="Admin",
            last_name="GoalValidation",
            role="ADMIN",
            status="ACTIVE",
        )
        self.coordinator = Person.objects.create_user(
            username="goal_coord",
            password="password123",
            first_name="Goal",
            last_name="Coordinator",
            role="MEMBER",
            status="ACTIVE",
        )
        self.cluster_one = Cluster.objects.create(
            code="GOAL-CLU-1",
            name="Goal Cluster 1",
            coordinator=self.coordinator,
        )
        self.cluster_two = Cluster.objects.create(
            code="GOAL-CLU-2",
            name="Goal Cluster 2",
            coordinator=self.coordinator,
        )
        self.client.force_authenticate(user=self.admin)

    def test_create_duplicate_cluster_year_returns_friendly_error(self):
        year = 2026
        Each1Reach1Goal.objects.create(
            cluster=self.cluster_one,
            year=year,
            target_conversions=12,
        )

        response = self.client.post(
            self.endpoint,
            {
                "cluster_id": self.cluster_one.id,
                "year": year,
                "target_conversions": 20,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertEqual(
            response_data.get("message"),
            self.duplicate_error,
            response_data,
        )
        self.assertEqual(
            response_data.get("details", {}).get("non_field_errors", [None])[0],
            self.duplicate_error,
            response_data,
        )

    def test_update_to_duplicate_cluster_year_returns_friendly_error(self):
        year = 2027
        existing_goal = Each1Reach1Goal.objects.create(
            cluster=self.cluster_one,
            year=year,
            target_conversions=10,
        )
        editable_goal = Each1Reach1Goal.objects.create(
            cluster=self.cluster_two,
            year=year,
            target_conversions=8,
        )

        response = self.client.patch(
            f"{self.endpoint}{editable_goal.id}/",
            {
                "cluster_id": self.cluster_one.id,
                "year": year,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response_data = response.json()
        self.assertEqual(
            response_data.get("message"),
            self.duplicate_error,
            response_data,
        )
        self.assertEqual(
            response_data.get("details", {}).get("non_field_errors", [None])[0],
            self.duplicate_error,
            response_data,
        )
        self.assertTrue(
            Each1Reach1Goal.objects.filter(id=existing_goal.id, cluster=self.cluster_one).exists()
        )

    def test_create_non_duplicate_cluster_year_succeeds(self):
        year = 2028
        response = self.client.post(
            self.endpoint,
            {
                "cluster_id": self.cluster_one.id,
                "year": year,
                "target_conversions": 15,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["year"], year)
        self.assertEqual(
            int(response.json()["cluster"]["id"]), int(self.cluster_one.id)
        )
