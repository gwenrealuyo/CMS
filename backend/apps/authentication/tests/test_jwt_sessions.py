"""JWT refresh lifetime, rotation blacklist, and logout blacklist tests."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.serializers import (
    REMEMBER_ME_CLAIM,
    REFRESH_TOKEN_LIFETIME_DEFAULT,
    REFRESH_TOKEN_LIFETIME_REMEMBER_ME,
)
from apps.people.models import Branch

Person = get_user_model()

LIFETIME_SLACK_SECONDS = 120


class JwtSessionTokenTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(
            name="JWT Test Branch",
            code="JWTTEST",
            is_active=True,
        )
        self.user = Person.objects.create_user(
            username="jwtsession",
            email="jwtsession@example.com",
            password="TestPass123!",
            first_name="Jwt",
            last_name="Session",
            role="MEMBER",
            status="ACTIVE",
            branch=self.branch,
            water_baptism_date=date(2020, 1, 1),
        )

    def _login(self, remember_me=False):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "jwtsession",
                "password": "TestPass123!",
                "remember_me": remember_me,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def _assert_refresh_lifetime(self, refresh_str, expected: timedelta):
        token = RefreshToken(refresh_str)
        remaining = token["exp"] - timezone.now().timestamp()
        self.assertAlmostEqual(
            remaining,
            expected.total_seconds(),
            delta=LIFETIME_SLACK_SECONDS,
        )

    def test_default_refresh_lifetime_is_two_days(self):
        data = self._login(remember_me=False)
        self._assert_refresh_lifetime(data["refresh"], REFRESH_TOKEN_LIFETIME_DEFAULT)
        token = RefreshToken(data["refresh"])
        self.assertFalse(bool(token.get(REMEMBER_ME_CLAIM)))

    def test_remember_me_refresh_lifetime_is_fourteen_days(self):
        data = self._login(remember_me=True)
        self._assert_refresh_lifetime(
            data["refresh"], REFRESH_TOKEN_LIFETIME_REMEMBER_ME
        )
        token = RefreshToken(data["refresh"])
        self.assertTrue(token.get(REMEMBER_ME_CLAIM))

    def test_refresh_rotates_and_blacklists_old_token(self):
        data = self._login(remember_me=False)
        old_refresh = data["refresh"]

        response = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        new_refresh = response.data["refresh"]
        self.assertNotEqual(old_refresh, new_refresh)

        rejected = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )
        self.assertEqual(rejected.status_code, 401)

        with self.assertRaises(TokenError):
            RefreshToken(old_refresh)

    def test_remember_me_survives_refresh_rotation(self):
        data = self._login(remember_me=True)
        response = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": data["refresh"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        new_refresh = response.data["refresh"]
        token = RefreshToken(new_refresh)
        self.assertTrue(token.get(REMEMBER_ME_CLAIM))
        self._assert_refresh_lifetime(new_refresh, REFRESH_TOKEN_LIFETIME_REMEMBER_ME)

    def test_logout_blacklists_refresh_token(self):
        data = self._login(remember_me=False)
        refresh = data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {data['access']}")

        logout = self.client.post(
            "/api/auth/logout/",
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(logout.status_code, 200, logout.data)

        rejected = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(rejected.status_code, 401)
