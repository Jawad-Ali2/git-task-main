# Git Task Management System

A full-stack task management application with GitHub OAuth integration, built with NestJS, Next.js, PostgreSQL, and Redis.

## 🚀 Features

- **GitHub OAuth Authentication** - Secure login using GitHub accounts
- **JWT-based Authorization** - Token-based authentication with HTTP-only cookies
- **User Management** - User profiles with GitHub integration
- **Redis Caching** - Performance optimization with Redis
- **PostgreSQL Database** - Reliable data persistence
- **RESTful API** - Clean API architecture with NestJS
- **Modern Frontend** - Next.js 16 with App Router and TypeScript

## 📋 Prerequisites

Before running this project, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** (v12 or higher)
- **Docker** (for Redis)
- **Git**

## 🛠️ Tech Stack

### Backend (API)
- **NestJS** - Progressive Node.js framework
- **TypeORM** - ORM for database operations
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Passport.js** - Authentication middleware
- **JWT** - JSON Web Tokens for auth

### Frontend (Client)
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Axios** - HTTP client for API requests
- **Tailwind CSS** - Utility-first CSS framework
- **React Context** - State management for authentication

## ⚙️ Environment Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd git-task-main
```

### 2. Configure Environment Variables

#### API (.env file in `api` folder)
Create `api/.env` file with the following:

```env
# Database Configuration
DATABASE_HOST=your_db_host
DATABASE_PORT=5432
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_db_password
DATABASE_NAME=gittask

# JWT Configuration - Separate secrets for security
JWT_ACCESS_SECRET=your_super_secret_access_token_key_min_32_characters_long
JWT_REFRESH_SECRET=your_different_super_secret_refresh_token_key_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/auth/github/callback

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Encryption Key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_32_byte_hex_encryption_key

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000
```

#### Client (.env.local file in `client` folder)
Create `client/.env.local` file with:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 3. Setup GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name:** Git Task Manager (or your preferred name)
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:5000/auth/github/callback`
4. Copy the **Client ID** and **Client Secret**
5. Add them to your `api/.env` file

### 4. Setup PostgreSQL Database

```bash
# Create database
psql -U postgres
CREATE DATABASE gittask;
\q
```

## 🚀 Installation

### Install Dependencies

#### API
```bash
cd api
npm install
```

#### Client
```bash
cd client
npm install
```

### Required Packages

**Backend:**
```bash
cd api
npm install @nestjs/passport passport passport-github2 passport-jwt @nestjs/jwt cookie-parser
npm install -D @types/passport-github2 @types/passport-jwt @types/cookie-parser
```

**Frontend:**
```bash
cd client
npm install axios
```

## 🔧 Running the Application

### 1. Start Redis
```bash
docker run -d --name redis-git-task -p 6379:6379 redis:latest
```

### 2. Run Database Migrations
```bash
cd api
npm run migration:run
```

### 3. Start Development Servers

#### API Server
```bash
cd api
npm run start:dev
```
Server will run at: http://localhost:5000

#### Client
```bash
cd client
npm run dev
```
Client will run at: http://localhost:3000

## 📡 API Endpoints

### Authentication
- `GET /auth/github` - Initiate GitHub OAuth flow
- `GET /auth/github/callback` - GitHub OAuth callback (sets HTTP-only cookies)
- `GET /auth/profile` - Get current authenticated user (Protected)
- `POST /auth/refresh` - Refresh access token using refresh token cookie
- `POST /auth/logout` - Logout and clear tokens (Protected)

### Repositories
- `GET /repositories/list` - Fetch all GitHub repositories (with pagination & search) (Protected)
- `POST /repositories/save` - Save selected repositories to database (Protected)
- `GET /repositories` - Get user's saved repositories from database (Protected)

**Repository Management:**
- Users can browse all their GitHub repos with pagination (30 per page)
- Search/filter repositories by name or description
- Select up to 20 repositories to save
- Only saved repositories will be used for task extraction
- Repository list is cached in Redis for 10 minutes

## 🗂️ Project Structure

```
git-task-main/
├── api/                    # NestJS Backend
│   ├── src/
│   │   ├── auth/          # Authentication module
│   │   │   ├── strategies/
│   │   │   │   ├── github.strategy.ts
│   │   │   │   └── jwt.strategy.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── users/         # Users module
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   ├── repositories/   # Repositories module
│   │   │   ├── entities/
│   │   │   │   └── repository.entity.ts
│   │   │   ├── repositories.controller.ts
│   │   │   ├── repositories.service.ts
│   │   │   └── repositories.module.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── api-tests.http     # REST Client tests
│   ├── .env
│   └── package.json
├── client/                # React Frontend
│   ├── src/
│   │   ├── app/           # App Router
│   │   ├── components/    # Shared components
│   │   ├── context/       # React Context for auth
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Pages (routes)
│   │   ├── styles/        # Global styles
│   │   └── utils/         # Utility functions
│   ├── .env.local
│   └── package.json
├── start.bat             # Startup script
└── README.md
```

## 🔐 Authentication Flow

1. User clicks "Login with GitHub"
2. Redirected to GitHub OAuth page
3. User authorizes the application
4. GitHub redirects back with authorization code
5. Backend exchanges code for access token
6. User info is fetched and saved to database
7. **JWT access token (15min) and refresh token (7days) are generated**
8. **Tokens are set as secure HTTP-only cookies**
9. User is redirected to dashboard
10. **Access token is automatically refreshed before expiry**
11. **Refresh token uses rotation for enhanced security**

## 🛡️ Security Features

- **HTTP-only Cookies** - Tokens not accessible via JavaScript (XSS protection)
- **Secure Flag** - Cookies only sent over HTTPS in production
- **SameSite** - CSRF protection
- **Token Rotation** - Refresh tokens are rotated on each use
- **Hashed Refresh Tokens** - Stored as SHA-256 hashes in database
- **Short-lived Access Tokens** - 15-minute expiry reduces risk
- **Separate JWT Secrets** - Access and refresh tokens use different secrets for enhanced security
- **Automatic Token Refresh** - Seamless UX with security

## 🔐 JWT Token Architecture

This application uses **dual JWT tokens** with separate secrets for maximum security:

### Access Token
- **Secret:** `JWT_ACCESS_SECRET` (unique secret)
- **Expiry:** 15 minutes (short-lived)
- **Usage:** API authentication
- **Storage:** HTTP-only cookie

### Refresh Token
- **Secret:** `JWT_REFRESH_SECRET` (different secret)
- **Expiry:** 7 days (long-lived)
- **Usage:** Obtaining new access tokens
- **Storage:** HTTP-only cookie + hashed in database

### Why Separate Secrets?
1. **Security Isolation** - Compromised access token doesn't affect refresh tokens
2. **Token Invalidation** - Can invalidate all access tokens independently
3. **OAuth 2.0 BCP Compliance** - Follows best practices
4. **Defense in Depth** - Multiple layers of security

## 🐛 Common Issues & Solutions

### Issue: "relation 'users' does not exist"
**Solution:** Enable `synchronize: true` in TypeORM config (dev only) or run migrations

### Issue: "secretOrPrivateKey must have a value"
**Solution:** Ensure `JWT_SECRET` is set in `api/.env` file

### Issue: Redis connection failed
**Solution:** Make sure Docker is running and Redis container is started:
```bash
docker start redis-git-task
```

### Issue: GitHub OAuth not working
**Solution:** Verify callback URL matches in both GitHub OAuth app settings and `.env` file

## 📝 Development Notes

- **TypeORM Synchronize:** Currently set to `true` for development. Change to `false` and use migrations in production.
- **CORS:** Configured to allow requests from `http://localhost:5173` (client)
- **JWT Expiration:** Tokens expire in 7 days (configurable in auth module)

## 🚢 Production Deployment

1. Set `NODE_ENV=production`
2. Disable TypeORM `synchronize`
3. Use environment-specific `.env` files
4. Set up proper CORS origins
5. Use strong JWT secrets
6. Enable HTTPS
7. Set up proper Redis and PostgreSQL instances

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [React Documentation](https://react.dev/)

## 👥 Contributors

- Your Name - Initial work

## 📄 License

This project is licensed under the MIT License.