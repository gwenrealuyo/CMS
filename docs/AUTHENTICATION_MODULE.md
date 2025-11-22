# Authentication & Access Control Module Guide

## Overview

The Authentication module provides JWT-based authentication and role-based access control (RBAC) for the Church Management System. Key features include:

- **JWT Token Authentication**: Stateless authentication using JSON Web Tokens
- **Role-Based Access Control**: Granular permissions based on user roles (ADMIN, PASTOR, COORDINATOR, MEMBER, VISITOR)
- **Login/Logout**: Secure authentication with "Remember Me" functionality
- **Token Refresh**: Automatic token refresh before expiration
- **Protected Routes**: Frontend route protection with role-based access
- **VISITOR Exclusion**: VISITOR role cannot log in to the system

## Authentication Method

### JWT Tokens

The system uses **JWT (JSON Web Tokens)** for stateless authentication:

- **Access Token**: Short-lived (15 minutes) for security
- **Refresh Token**: Longer-lived (7 days default, 30 days with "Remember Me")
- **Token Storage**: Client-side (localStorage)
- **Token Rotation**: Enabled for refresh tokens

### Why JWT?

- Stateless: No server-side session storage required
- Scalable: Works across multiple servers
- API-friendly: Perfect for REST APIs
- Mobile-ready: Works well with mobile apps

## User Roles & Access Levels

### Role Hierarchy (from highest to lowest)

1. **ADMIN**: Full access to all modules
2. **PASTOR**: Access to all modules except admin settings
3. **COORDINATOR**: Access to clusters, events, people, lessons, attendance, ministries, sunday school
4. **MEMBER**: Read access to most modules, limited write access (own data)
5. **VISITOR**: Cannot log in (excluded from authentication)

### Login Eligibility

- **Can Log In**: MEMBER, COORDINATOR, PASTOR, ADMIN
- **Cannot Log In**: VISITOR (attempting to log in shows error: "Visitor accounts cannot log in. Please contact an administrator.")

## Backend Implementation

### Authentication App

**Location**: `backend/apps/authentication/`

#### Files Structure

- `urls.py`: Authentication endpoints
- `views.py`: Login, logout, current user views
- `serializers.py`: Login and user serializers
- `permissions.py`: Role-based permission classes
- `exceptions.py`: Custom exception handler for standardized errors
- `management/commands/create_admin.py`: Command to create initial admin user

### API Endpoints

**Base URL**: `/api/auth/`

#### Login
- **Endpoint**: `POST /api/auth/login/`
- **Authentication**: Not required (AllowAny)
- **Request Body**:
  ```json
  {
    "username": "john.doe",
    "password": "password123",
    "remember_me": false
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "user": {
      "id": 1,
      "username": "john.doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "full_name": "John Doe",
      "role": "ADMIN",
      "photo": null
    }
  }
  ```
- **Error Response** (400 Bad Request):
  ```json
  {
    "error": "authentication_failed",
    "message": "Visitor accounts cannot log in. Please contact an administrator.",
    "details": {
      "non_field_errors": ["Visitor accounts cannot log in. Please contact an administrator."]
    }
  }
  ```

#### Logout
- **Endpoint**: `POST /api/auth/logout/`
- **Authentication**: Required (IsAuthenticated)
- **Response** (200 OK):
  ```json
  {
    "message": "Successfully logged out"
  }
  ```
- **Note**: Tokens are cleared client-side. Database blacklisting can be implemented later if needed.

#### Token Refresh
- **Endpoint**: `POST /api/auth/token/refresh/`
- **Authentication**: Not required (uses refresh token in body)
- **Request Body**:
  ```json
  {
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
  ```

#### Current User
- **Endpoint**: `GET /api/auth/me/`
- **Authentication**: Required (IsAuthenticatedAndNotVisitor)
- **Response** (200 OK):
  ```json
  {
    "id": 1,
    "username": "john.doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "middle_name": "",
    "full_name": "John Doe",
    "role": "ADMIN",
    "photo": null
  }
  ```

### Permission Classes

**Location**: `backend/apps/authentication/permissions.py`

#### Available Permission Classes

1. **IsAuthenticatedAndNotVisitor**
   - Allows access only to authenticated users who are not VISITOR role
   - Base permission for all viewsets

2. **IsAdmin**
   - Allows access only to ADMIN role

3. **IsAdminOrPastor**
   - Allows access to ADMIN or PASTOR roles
   - Used for: Finance module

4. **IsCoordinatorOrAbove**
   - Allows access to COORDINATOR, PASTOR, or ADMIN roles
   - Used for: Clusters module, People write operations

5. **IsMemberOrAbove**
   - Allows access to MEMBER, COORDINATOR, PASTOR, or ADMIN roles
   - Excludes VISITOR
   - Used for: Events, Lessons, Ministries, Sunday School, Attendance, Evangelism, People read operations

### Module Permissions

| Module | Read Permission | Write Permission |
|--------|----------------|------------------|
| **People** | IsMemberOrAbove | IsCoordinatorOrAbove |
| **Finance** | IsAdminOrPastor | IsAdminOrPastor |
| **Events** | IsMemberOrAbove | IsMemberOrAbove |
| **Clusters** | IsCoordinatorOrAbove | IsCoordinatorOrAbove |
| **Lessons** | IsMemberOrAbove | IsMemberOrAbove |
| **Ministries** | IsMemberOrAbove | IsMemberOrAbove |
| **Sunday School** | IsMemberOrAbove | IsMemberOrAbove |
| **Attendance** | IsMemberOrAbove | IsMemberOrAbove |
| **Evangelism** | IsMemberOrAbove | IsMemberOrAbove |

**Note**: All viewsets also include `IsAuthenticatedAndNotVisitor` to exclude VISITOR role.

### JWT Configuration

**Location**: `backend/core/settings.py`

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": os.getenv("JWT_SECRET_KEY", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
}
```

### Remember Me Functionality

When a user checks "Remember Me" during login:
- Refresh token lifetime extends to **30 days** (instead of 7 days)
- Preference is stored in localStorage
- Access token lifetime remains 15 minutes (security)

## Frontend Implementation

### Authentication Context

**Location**: `frontend/src/contexts/AuthContext.tsx`

Provides:
- `user`: Current user object (null if not authenticated)
- `isAuthenticated`: Boolean indicating authentication status
- `isLoading`: Boolean indicating if auth check is in progress
- `login(username, password, rememberMe)`: Login function
- `logout()`: Logout function
- `refreshUser()`: Refresh current user data

**Usage**:
```typescript
import { useAuth } from "@/src/contexts/AuthContext";

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // Use auth state
}
```

### Protected Routes

**Location**: `frontend/src/components/auth/ProtectedRoute.tsx`

Wraps pages/components that require authentication:

```typescript
<ProtectedRoute allowedRoles={["ADMIN", "PASTOR"]}>
  <FinancePage />
</ProtectedRoute>
```

**Props**:
- `children`: React node to render if authenticated
- `allowedRoles` (optional): Array of roles that can access this route

**Behavior**:
- Redirects to `/login` if not authenticated
- Redirects to `/dashboard` if user doesn't have required role
- Shows loading state while checking authentication

### API Client

**Location**: `frontend/src/lib/api.ts`

#### Authentication Methods

```typescript
import { authApi } from "@/src/lib/api";

// Login
await authApi.login(username, password, rememberMe);

// Logout
await authApi.logout();

// Refresh token
await authApi.refreshToken();

// Get current user
const response = await authApi.getCurrentUser();
```

#### Token Management

```typescript
import { tokenStorage } from "@/src/lib/api";

// Get tokens
const accessToken = tokenStorage.getAccessToken();
const refreshToken = tokenStorage.getRefreshToken();

// Set tokens
tokenStorage.setTokens(access, refresh, rememberMe);

// Clear tokens
tokenStorage.clearTokens();
```

#### Automatic Token Injection

All API requests automatically include the JWT token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

#### Automatic Token Refresh

The API client automatically:
- Refreshes access tokens when they expire (401 errors)
- Queues requests while refreshing
- Redirects to login if refresh fails

### Pages

#### Login Page
- **Location**: `frontend/src/app/login/page.tsx`
- **Route**: `/login`
- **Features**:
  - Username/email and password input
  - "Remember Me" checkbox
  - "Forgot Password" link
  - Error message display
  - Redirects to dashboard on success
  - Prevents VISITOR role login

#### Forgot Password Page
- **Location**: `frontend/src/app/forgot-password/page.tsx`
- **Route**: `/forgot-password`
- **Features**:
  - Shows "Contact administrator" message
  - Placeholder for future email-based password reset

### UI Components

#### Navbar
- **Location**: `frontend/src/components/layout/Navbar.tsx`
- **Features**:
  - Displays user's full name and role
  - Shows user photo if available
  - Logout functionality
  - Profile dropdown menu

#### Sidebar
- **Location**: `frontend/src/components/layout/Sidebar.tsx`
- **Features**:
  - Role-based menu filtering
  - Hides Finance link for non-ADMIN/non-PASTOR users
  - Hides Clusters link for non-COORDINATOR users
  - Completely hides items (no disabled/grayed-out states)

## User Management

### Creating Admin Users

**Management Command**: `python manage.py create_admin`

```bash
python manage.py create_admin
# Prompts for: username, email, password
```

Or with arguments:
```bash
python manage.py create_admin --username admin --email admin@church.com --password securepass123
```

### Setting Default Passwords

**Management Command**: `python manage.py set_default_passwords`

```bash
# Set default password for users without passwords
python manage.py set_default_passwords

# Use custom default password
python manage.py set_default_passwords --default-password mypassword123

# Force reset all passwords (including existing ones)
python manage.py set_default_passwords --force
```

**What it does**:
- Sets passwords for users who don't have usable passwords
- Skips users who already have passwords (unless `--force` is used)
- Default password: `changeme123`

**Note**: Sample data users (created via `populate_sample_data`) have password `"password123"`.

### Password Management in Django Admin

1. Go to `/admin/`
2. Navigate to **People** → **Persons**
3. Click on a user to edit
4. Use Django admin's password change form to reset passwords

## Error Handling

### Standardized Error Format

All authentication errors follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes

- `authentication_failed`: Invalid credentials or VISITOR login attempt
- `authentication_required`: Token missing or invalid
- `permission_denied`: User doesn't have required role
- `token_expired`: Access token expired (handled automatically)

### Frontend Error Display

Errors are extracted from:
1. `error.response.data.message` (primary)
2. `error.response.data.details.non_field_errors` (fallback)
3. `error.message` (generic fallback)

## Security Considerations

### Token Security

- **Access tokens**: Short-lived (15 minutes) to minimize exposure if stolen
- **Refresh tokens**: Longer-lived but can be rotated
- **Storage**: localStorage (consider httpOnly cookies for production)
- **HTTPS**: Required in production to protect tokens in transit

### Password Security

- Passwords are hashed using Django's default password hasher (PBKDF2)
- Password validation rules enforced (minimum length, complexity)
- Default passwords should be changed on first login

### Role-Based Security

- Permissions checked on both frontend and backend
- Frontend UI hiding prevents accidental access attempts
- Backend permissions are the source of truth

## Testing

### Manual Testing Checklist

1. **Login Flow**:
   - [ ] Login with valid credentials → success
   - [ ] Login with invalid credentials → error message
   - [ ] Login with VISITOR role → specific error message
   - [ ] "Remember Me" extends refresh token lifetime

2. **Token Management**:
   - [ ] Access token expires after 15 minutes
   - [ ] Token auto-refreshes before expiration
   - [ ] Logout clears tokens

3. **Role-Based Access**:
   - [ ] MEMBER can access People, Events, Lessons, etc.
   - [ ] MEMBER cannot access Finance
   - [ ] MEMBER cannot access Clusters
   - [ ] COORDINATOR can access Clusters
   - [ ] ADMIN/PASTOR can access Finance
   - [ ] Sidebar hides Finance for non-ADMIN/non-PASTOR
   - [ ] Sidebar hides Clusters for non-COORDINATOR

4. **Protected Routes**:
   - [ ] Unauthenticated users redirected to login
   - [ ] Users without required role redirected to dashboard
   - [ ] Authenticated users can access allowed routes

### API Testing

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123", "remember_me": false}'

# Get current user (requires token)
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer <access_token>"

# Refresh token
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```

## Environment Variables

**File**: `backend/env.example`

```bash
# JWT Configuration (uses SECRET_KEY if not set)
# JWT_SECRET_KEY=your-jwt-secret-key-here

# Email Configuration (for password reset - deferred until email server is set up)
# EMAIL_HOST=smtp.example.com
# EMAIL_PORT=587
# EMAIL_HOST_USER=your_email@example.com
# EMAIL_HOST_PASSWORD=your_password
# EMAIL_USE_TLS=True
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
```

## Future Enhancements

### Planned Features

1. **Email-Based Password Reset**
   - Currently: Admin-only password reset
   - Future: Email with reset link when email server is configured

2. **Token Blacklisting** (Optional)
   - Currently: Client-side token clearing
   - Future: Database blacklist for immediate token invalidation

3. **Two-Factor Authentication** (Optional)
   - Additional security layer for sensitive accounts

4. **Session Management**
   - View active sessions
   - Revoke specific sessions

### Password Reset Flow (When Email is Available)

1. User requests password reset via email
2. Backend generates secure token, stores hash, sends email
3. Reset link: `frontend/reset-password?token=<token>`
4. User enters new password
5. Backend validates token, updates password, invalidates token
6. User redirected to login

## Troubleshooting

### Common Issues

1. **"Invalid credentials" error**
   - Check username/email and password
   - Verify user has a password set
   - Check user role (VISITOR cannot log in)

2. **Token refresh fails**
   - Check refresh token is valid
   - Verify token hasn't expired
   - Check localStorage for token storage

3. **401 Unauthorized errors**
   - Verify access token is included in request
   - Check token hasn't expired
   - Verify user is authenticated

4. **Permission denied errors**
   - Check user's role
   - Verify permission classes on viewset
   - Check if user is VISITOR (excluded from all access)

### Debugging

1. **Check token in localStorage**:
   ```javascript
   // In browser console
   localStorage.getItem('access_token')
   localStorage.getItem('refresh_token')
   ```

2. **Check user role**:
   ```python
   # In Django shell
   from apps.people.models import Person
   user = Person.objects.get(username='username')
   print(user.role)
   print(user.has_usable_password())
   ```

3. **Test login endpoint**:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login/ \
     -H "Content-Type: application/json" \
     -d '{"username": "test", "password": "test123"}'
   ```

## Summary

The Authentication module provides:
- ✅ Secure JWT-based authentication
- ✅ Role-based access control (5 roles, 5 permission classes)
- ✅ Protected routes (frontend and backend)
- ✅ Automatic token refresh
- ✅ "Remember Me" functionality
- ✅ VISITOR role exclusion
- ✅ Management commands for user setup
- ✅ Standardized error handling

All modules are protected with appropriate permissions, and the frontend provides role-based UI filtering for a seamless user experience.

