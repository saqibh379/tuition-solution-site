# Live Deployment

## Recommended setup

- Keep the website on `https://www.tuitionsol.com`
- Run the Node/MongoDB backend on either:
  - `https://api.tuitionsol.com`, or
  - the same host if your cPanel account supports Node.js apps and reverse proxy

## Why local `npm start` is not needed

The local server is only for development. In production, the backend must run on your hosting server or on a separate Node host 24/7. The live website then calls that remote API.

## Production environment variables

Create a production `.env` on the server:

```env
MONGODB_URI=...
MONGODB_DB_NAME=Tuition_Solution
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this
ADMIN_SESSION_SECRET=change-this-secret
LMS_SESSION_SECRET=change-this-lms-secret
LMS_SUPER_ADMIN_USERNAME=superadmin
LMS_SUPER_ADMIN_PASSWORD=change-this-super-admin-password
LMS_SUPER_ADMIN_NAME=Super Admin
LMS_SUPER_ADMIN_EMAIL=admin@tuitionsol.com
ALLOWED_ORIGINS=https://www.tuitionsol.com,https://tuitionsol.com
COOKIE_SECURE=true
```

## LMS variables

- `LMS_SESSION_SECRET` signs the separate LMS login cookie for super admin, teacher, and student portals.
- `LMS_SUPER_ADMIN_USERNAME`, `LMS_SUPER_ADMIN_PASSWORD`, `LMS_SUPER_ADMIN_NAME`, and `LMS_SUPER_ADMIN_EMAIL` seed the first LMS super admin if no super admin exists in MongoDB yet.
- Once the first LMS super admin is seeded, future teacher and student accounts are managed from the LMS super admin dashboard instead of environment variables.

## Frontend API binding

If backend is on a separate host/subdomain, set this in `js/runtime-config.js` before deploying:

```js
window.TUITION_SOLUTION_API_BASE_URL = 'https://api.tuitionsol.com';
```

If backend and frontend share the same origin, leave it empty.

## LMS frontend pages

These static pages must be deployed with the main website:

- `lms.html` for unified LMS login across super admin, teacher, and student users
- `lms-admin.html` for the super admin dashboard after login
- `teacher-portal.html` for teacher workflows
- `student-portal.html` for read-only student progress

They all use the same backend API host configured through `js/runtime-config.js`.

## Atlas checklist

- Add the production server public IP in MongoDB Atlas Network Access
- Use the production MongoDB URI in server `.env`
- Keep MongoDB credentials out of frontend files

## Deployment paths

### Option 1: cPanel Node.js app

Recommended for EasyHost/cPanel when the main website is already deployed from GitHub to `public_html`:

**Static website**

- Keep `www.tuitionsol.com` connected to the GitHub deployment in `public_html`.
- Keep `.cpanel.yml` deploying only frontend files into `public_html`.

**Backend app**

- Create a subdomain such as `api.tuitionsol.com` in cPanel.
- In cPanel Node.js, create the application with:
  - Application root: a folder outside `public_html`, for example `tuition-backend`
  - Application URL: `api.tuitionsol.com`
  - Application startup file: `index.js`
  - Application mode: `Production`
- Upload or clone the full repo into that application root so `server/`, `package.json`, `js/`, `css/`, and HTML files are available to Node.
- Run `npm install` from the Node.js app interface or cPanel terminal.
- Add all production environment variables in the Node.js app screen.
- Restart the Node.js app.

**Frontend API binding**

- In the frontend copy deployed to `public_html`, set `js/runtime-config.js` to:

```js
window.TUITION_SOLUTION_API_BASE_URL = 'https://api.tuitionsol.com';
```

This keeps the public website URL as `https://www.tuitionsol.com` while all forms, admin, and LMS API calls run through the online backend at `https://api.tuitionsol.com`.

Legacy short checklist:

1. Create a Node.js app in cPanel
2. Upload this repo to the app directory
3. Run `npm install`
4. Add the production environment variables
5. Set startup file to `index.js`
6. Point `api.tuitionsol.com` to that app
7. Leave the static site on `public_html`
8. Set `js/runtime-config.js` to `https://api.tuitionsol.com`
9. Deploy the new LMS frontend pages to `public_html` alongside the main site files

### Option 2: Separate backend host

1. Deploy the backend to Render, Railway, VPS, or another Node host
2. Set `api.tuitionsol.com` DNS to that host
3. Add the same environment variables there
4. Set `js/runtime-config.js` to `https://api.tuitionsol.com`
5. Deploy the updated frontend to `public_html`

## LMS smoke test after deployment

1. Open `lms.html` and verify the single shared LMS login form loads.
2. Log in with the seeded super admin credentials and confirm redirect to `lms-admin.html`.
3. Create at least one teacher, one student, and one class from the super admin dashboard.
4. Assign the teacher and student to the class, then log in again through `lms.html` with those accounts to confirm role-scoped redirects.
5. From the teacher portal, save at least one assignment, quiz, attendance record, and marks entry.
6. From the student portal, confirm the same class data appears as read-only progress.