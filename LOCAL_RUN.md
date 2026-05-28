# Local Run Guide

This project runs as a Node.js server and serves the website plus LMS pages from the same local URL.

## 1. Prerequisites

- Node.js installed
- `npm install` already completed
- A working MongoDB connection string in `.env`

## 2. Local `.env` values

Make sure your local `.env` has these values set correctly:

```env
MONGODB_URI=your-working-mongodb-uri
MONGODB_FALLBACK_URI=mongodb://127.0.0.1:27017/Tuition_Solution
MONGODB_DB_NAME=Tuition_Solution
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_SESSION_SECRET=change-this-secret-before-production
LMS_SESSION_SECRET=change-this-lms-secret-before-production
LMS_SUPER_ADMIN_USERNAME=superadmin
LMS_SUPER_ADMIN_PASSWORD=change-this-super-admin-password
LMS_SUPER_ADMIN_NAME=Super Admin
LMS_SUPER_ADMIN_EMAIL=admin@tuitionsol.com
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
COOKIE_SECURE=false
```

### Important for local run

- `COOKIE_SECURE=false` hona chahiye local HTTP testing ke liye.
- `ALLOWED_ORIGINS` me local browser origin dena better hai.
- `MONGODB_URI` valid hona chahiye, warna server start nahi hoga.
- Agar Atlas DNS issue de, server local MongoDB fallback try kar sakta hai via `MONGODB_FALLBACK_URI`.

## 3. Server run command

Project root me ye command chalayein:

```powershell
npm start
```

Development watch mode ke liye:

```powershell
npm run dev
```

## 4. Browser me kya open karna hai

Jab server successfully start ho jaye, browser me ye URLs open karein:

- Main website: `http://localhost:3000/`
- LMS login page: `http://localhost:3000/lms.html`
- LMS super admin dashboard: `http://localhost:3000/lms-admin.html`
- Teacher portal: `http://localhost:3000/teacher-portal.html`
- Student portal: `http://localhost:3000/student-portal.html`
- Existing admin panel: `http://localhost:3000/admin.html`

### Recommended flow

1. Pehle `http://localhost:3000/lms.html` open karein
2. Isi single form se super admin login karein
3. System aapko automatically `lms-admin.html` dashboard par redirect karega
4. Teacher aur student account create karein
5. Class create karke teacher aur students assign karein
6. Phir dubara `http://localhost:3000/lms.html` par jaa kar teacher ya student login test karein

## 5. LMS login notes

- LMS ke liye ab ek hi login form hai: `lms.html`
- Super admin, teacher, aur student sab isi page se sign in karte hain
- Login ke baad system role detect karke sahi portal kholta hai

### Super admin

Super admin credentials `.env` se aate hain:

- `LMS_SUPER_ADMIN_USERNAME`
- `LMS_SUPER_ADMIN_PASSWORD`

### Teacher and student

- Ye accounts super admin dashboard se create honge
- Inke usernames aur passwords database me save honge

## 6. Agar server start na ho to

Current machine par `npm start` run karne par ye error aayi thi:

```text
MongoServerSelectionError: getaddrinfo EAI_AGAIN ac-rvqhmph-shard-00-01.eg5l3wi.mongodb.net
```

Iska matlab usually ye hota hai:

- MongoDB Atlas hostname resolve nahi ho raha
- Internet / DNS / firewall issue hai
- Ya `.env` me Atlas URI temporarily unreachable hai

## 7. Is error ko kaise fix karein

### Option A: Atlas URI fix karein

1. Internet connection check karein
2. `.env` me `MONGODB_URI` verify karein
3. MongoDB Atlas cluster active ho
4. Atlas Network Access me aapka IP allowed ho
5. DNS issue ho to thori der baad dobara try karein

### Option B: Local MongoDB use karein

Agar aap local testing karna chahte hain, to `.env` me temporary URI ye use kar sakte hain:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/Tuition_Solution
COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Phir local MongoDB service run honi chahiye.

### Option C: Automatic fallback use karein

Agar aap Atlas URI bhi rakhna chahte hain aur local MongoDB fallback bhi, to `.env` me dono values rakh sakte hain:

```env
MONGODB_URI=your-atlas-uri
MONGODB_FALLBACK_URI=mongodb://127.0.0.1:27017/Tuition_Solution
COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Is setup me server pehle Atlas try karega. Agar local machine par temporary DNS/network issue ho, to local MongoDB par start ho jayega.

## 8. Expected successful startup

Jab sab theek ho to terminal me aisa message aana chahiye:

```text
Tuition Solution server running on http://localhost:3000
```

Uske baad browser me pages open ho jayenge.

## 9. Quick test checklist

1. `npm start`
2. Open `http://localhost:3000/`
3. Open `http://localhost:3000/lms.html`
4. Login as super admin from the same LMS form
5. Confirm redirect to `http://localhost:3000/lms-admin.html`
6. Create 1 teacher, 1 student, 1 class
7. Assign both to the class
8. Login again from `http://localhost:3000/lms.html` using teacher and student accounts
