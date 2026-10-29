# Tastebuds — Recipe Sharing Website

A responsive full-stack recipe-sharing platform based on the uploaded project abstract. Users can discover recipes, search and filter, publish recipes, save favorites, like dishes, and leave comments. An admin dashboard supports basic user and recipe moderation.

## Tech stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express REST API
- Database: SQLite using `better-sqlite3`
- Authentication: bcrypt password hashing + JWT
- Image support: image URLs and optional Multer upload endpoint groundwork (see note below)
- Version control: Git / GitHub ready

## Requirements
- Node.js 18 or newer
- npm

## Run locally
1. Extract the project folder.
2. Open a terminal in the project folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env`, then change `JWT_SECRET` and the admin password.
5. Start the app:
   ```bash
   npm start
   ```
6. Open http://localhost:3000

The SQLite database is created automatically at `data/recipes.db`; starter recipes are inserted on the first run.

## Demo accounts
- Regular account: create one using **Sign in → Create account**.
- Admin: configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before first launch. The admin user is created automatically if that email is not already in the database.
- Seed recipe author: `hello@tastebuds.local` / `RecipeDemo123!` (demo only; change/remove for any public deployment).

## Main features
- Registration, sign-in, hashed passwords, JWT sessions
- Recipe create, read, update, delete (CRUD)
- Search by title, description, or ingredients
- Category and difficulty filters; newest/popular sorting
- Favorites, likes, and comments
- Admin dashboard with counts, user removal, and recipe moderation
- Responsive layout for desktop and mobile
- SQLite persistence and sample recipe content

## API overview
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current account |
| GET | `/api/recipes` | Search/list recipes |
| GET | `/api/recipes/:id` | Recipe details |
| POST | `/api/recipes` | Create recipe (auth) |
| PUT | `/api/recipes/:id` | Edit own recipe/admin |
| DELETE | `/api/recipes/:id` | Delete own recipe/admin |
| POST | `/api/recipes/:id/favorite` | Toggle favorite (auth) |
| POST | `/api/recipes/:id/like` | Toggle like (auth) |
| POST | `/api/recipes/:id/comments` | Add comment (auth) |
| GET | `/api/admin/stats` | Admin metrics (admin) |
| GET | `/api/admin/recipes` | Admin recipe list (admin) |
| DELETE | `/api/admin/users/:id` | Remove member (admin) |

## Uploads and deployment notes
The current recipe form accepts an image URL. The backend includes a Multer storage configuration for local image files, but a dedicated multipart upload route and file-picker UI still need to be connected if direct file upload is required by your project evaluation. Do not expose this demo unchanged as a production service. Before public deployment, add rate limiting, stronger validation, CSRF/security headers as appropriate, HTTPS, database backups, image moderation, account recovery, and a production-grade secret manager. Change all demo credentials.

## GitHub
```bash
git init
git add .
git commit -m "Build Tastebuds recipe sharing website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/recipe-sharing-website.git
git push -u origin main
```
Git practical demonstration: Basic Git commands implemented successfully.