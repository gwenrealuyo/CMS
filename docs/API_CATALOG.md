## API Catalog (Active Routes)

Base URL: `/api/people/`

### Authentication

- **JWT Token Authentication**: All endpoints require authentication except login
- **Base URL**: `/api/auth/`
- **Endpoints**:
  - `POST /api/auth/login/` - Login (returns access + refresh tokens)
  - `POST /api/auth/logout/` - Logout (clears tokens)
  - `POST /api/auth/token/refresh/` - Refresh access token
  - `GET /api/auth/me/` - Get current authenticated user
- **Role-Based Access**: Different modules have different permission requirements
- **VISITOR Exclusion**: VISITOR role cannot log in
- See `docs/AUTHENTICATION_MODULE.md` for detailed documentation

### Person

- List: `GET /api/people/`
  - Query: `search` (username, email, first_name, last_name), `role`
- Retrieve: `GET /api/people/{id}/`
- Create: `POST /api/people/`
  - Required: `first_name`, `last_name`, `role`
  - Auto: `username` generated from first two letters of first name + last name; uniqueness enforced by suffixing a counter
- Update: `PUT /api/people/{id}/`
- Partial Update: `PATCH /api/people/{id}/`
- Delete: `DELETE /api/people/{id}/`

Person fields (serializer)

```
id, username (read-only), first_name, last_name, middle_name?, suffix?, gender?,
facebook_name?, photo?, role, phone?, address?, country?, date_of_birth?,
date_first_attended?, inviter (Person id)?, member_id?, status?
```

### Family

- List: `GET /api/people/families/`
- Retrieve: `GET /api/people/families/{id}/`
- Create: `POST /api/people/families/`
- Update: `PUT /api/people/families/{id}/`
- Partial Update: `PATCH /api/people/families/{id}/`
- Delete: `DELETE /api/people/families/{id}/`

Family fields (serializer)

```
id, name, leader (Person id | null), members (Person ids[]), address?, created_at (read-only)
```

### Cluster

- List: `GET /api/people/clusters/`
- Retrieve: `GET /api/people/clusters/{id}/`
- Create: `POST /api/people/clusters/`
- Update: `PUT /api/people/clusters/{id}/`
- Partial Update: `PATCH /api/people/clusters/{id}/`
- Delete: `DELETE /api/people/clusters/{id}/`

Cluster fields (serializer)

```
id, code, name, coordinator (Person id | null), families (Family ids[]),
description?, created_at (read-only)
```

### Journey

- List: `GET /api/people/journeys/`
  - Query: `user` (Person ID), `type`
- Retrieve: `GET /api/people/journeys/{id}/`
- Create: `POST /api/people/journeys/`
  - Required: `user` (Person ID), `date`, `type`
  - Optional: `title`, `description`, `verified_by` (Person ID)
- Update: `PUT /api/people/journeys/{id}/`
- Partial Update: `PATCH /api/people/journeys/{id}/`
- Delete: `DELETE /api/people/journeys/{id}/`

Journey fields (serializer)

```
id, user (Person ID), title?, date, type (LESSON|BAPTISM|SPIRIT|CLUSTER|NOTE),
description?, verified_by (Person ID | null), created_at (read-only)
```

### Notes

- Media uploads for `photo` use `MEDIA_URL = /media/` and `MEDIA_ROOT` from settings.
- Pagination is default DRF (not explicitly configured).
- Person serializer includes `journeys` field (read-only) with full journey data.
