# Render Deployment Guide

## Prerequisites
- GitHub account with your repository
- Render account (sign up at https://render.com)

## Step 1: Deploy PostgreSQL Database

1. Go to Render Dashboard → New → PostgreSQL
2. Configure:
   - **Name**: `cms-database`
   - **Database**: `church_management`
   - **User**: `cms_user` (or any username)
   - **Plan**: Free
3. Click "Create Database"
4. **Save the connection details** shown on the database page (Internal Database URL)

## Step 2: Deploy Backend (Django)

1. Go to Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `cms-backend` (or your preferred name)
   - **Environment**: `Python 3`
   - **Build Command**: `cd backend && chmod +x build.sh && ./build.sh`
   - **Start Command**: `cd backend && gunicorn core.wsgi:application`
   - **Root Directory**: Leave empty (or set to `backend` if needed)

4. **Add Environment Variables** (go to Environment tab):
   ```
   PYTHON_VERSION=3.11.0
   SECRET_KEY=<generate a strong secret key - use a password generator>
   DEBUG=False
   DB_NAME=<database name from Step 1>
   DB_USER=<database user from Step 1>
   DB_PASSWORD=<database password from Step 1>
   DB_HOST=<database host from Step 1>
   DB_PORT=5432
   ALLOWED_HOSTS=cms-backend.onrender.com
   FRONTEND_URL=https://your-frontend-name.onrender.com
   CORS_ALLOWED_ORIGINS=https://your-frontend-name.onrender.com
   ```
   **Note**: Replace `cms-backend.onrender.com` and `your-frontend-name.onrender.com` with your actual service names after deployment.

5. Click "Create Web Service"
6. **Wait for deployment** (first deployment takes 5-10 minutes)
7. **Note your backend URL** (e.g., `https://cms-backend.onrender.com`)

## Step 3: Deploy Frontend (Next.js)

1. Go to Render Dashboard → New → Static Site
2. Connect your GitHub repository
3. Configure:
   - **Name**: `cms-frontend` (or your preferred name)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/out`
   - **Root Directory**: Leave empty

4. **Add Environment Variable**:
   ```
   NEXT_PUBLIC_API_URL=https://cms-backend.onrender.com/api
   ```
   **Note**: Replace `cms-backend.onrender.com` with your actual backend URL from Step 2.

5. Click "Create Static Site"
6. **Wait for deployment** and note your frontend URL (e.g., `https://cms-frontend.onrender.com`)

## Step 4: Update CORS Settings in Backend

1. Go back to your backend service in Render Dashboard
2. Click on "Environment" tab
3. Update these environment variables with your actual URLs:
   - `FRONTEND_URL`: Set to your frontend URL (e.g., `https://cms-frontend.onrender.com`)
   - `CORS_ALLOWED_ORIGINS`: Set to your frontend URL (e.g., `https://cms-frontend.onrender.com`)
   - `ALLOWED_HOSTS`: Set to your backend domain (e.g., `cms-backend.onrender.com`)

4. Click "Save Changes"
5. The service will automatically redeploy with new settings

## Step 5: Create Superuser (Optional but Recommended)

1. In Render Dashboard, go to your backend service
2. Click on "Shell" tab (at the top)
3. Run the following commands:
   ```bash
   cd backend
   python manage.py createsuperuser
   ```
4. Follow the prompts to create an admin user:
   - Username
   - Email (optional)
   - Password (enter twice)
5. You can now access the admin panel at: `https://your-backend-url.onrender.com/admin/`

## Step 6: Test Your Deployment

1. Visit your frontend URL
2. Try logging in (create a user first via admin if needed)
3. Test API endpoints
4. Check browser console for any CORS errors

## Troubleshooting

### Backend won't start
- **Check build logs**: Click on your service → Logs tab
- **Verify environment variables**: Ensure all required variables are set
- **Check database connection**: Verify DB credentials are correct
- **Static files error**: Ensure `build.sh` includes `collectstatic` command

### CORS errors in browser
- Verify `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` match your frontend URL exactly
- URLs must include `https://` protocol (not `http://`)
- Check for trailing slashes - should NOT have trailing slash
- Redeploy backend after changing CORS settings

### Database connection errors
- Verify database is running (free tier spins down after 90 days of inactivity)
- Check all database credentials in environment variables
- Ensure database name matches in both database service and backend env vars

### Static files not loading
- Verify `STATIC_ROOT` is set in settings.py
- Check that `collectstatic` runs successfully in build logs
- Ensure WhiteNoise is installed (`whitenoise==6.6.0` in requirements.txt)

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set correctly in frontend environment variables
- Check that backend URL includes `/api` at the end
- Test backend URL directly in browser: `https://your-backend.onrender.com/api/auth/me/`

### Service keeps restarting
- Check logs for errors
- Verify all environment variables are set
- Check database connection is working
- Ensure build script completes successfully

## Important Notes

- **Free Tier Limitations**:
  - Services spin down after 15 minutes of inactivity (first request after spin-down takes 30-60 seconds)
  - Database may spin down after 90 days of inactivity
  - Limited resources (512MB RAM, shared CPU)

- **Security**:
  - Never commit `.env` files to git
  - Use strong `SECRET_KEY` (generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
  - Keep `DEBUG=False` in production

- **Performance**:
  - Consider upgrading to paid plans for better performance
  - Free tier is suitable for testing with a few users
  - First request after spin-down will be slow

## Next Steps After Deployment

1. Set up database backups (recommended for production)
2. Configure custom domain (optional, paid feature)
3. Set up monitoring/alerts
4. Consider upgrading to paid plan for production use
5. Set up CI/CD for automatic deployments
