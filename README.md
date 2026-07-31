# Algoreks Skillit CRM (formerly Skillit-fbcrm)

**Frontend:** React.js · Tailwind CSS · React Router · Axios
**Backend:** Node.js · Express · MongoDB (Mongoose) · JWT auth

## 1. Prerequisites

- Node.js LTS (v18+) — https://nodejs.org
- MongoDB running somewhere reachable:
  - **Local**: install MongoDB Community Server and make sure it's running
    (`mongod`), or
  - **Atlas** (free cloud cluster): https://www.mongodb.com/cloud/atlas —
    grab your connection string.

## 2. Backend setup

```bash
cd server
npm install
```

Check `server/.env` — it already has working local defaults:
```
MONGO_URI=mongodb://127.0.0.1:27017/skillit-fbcrm
JWT_SECRET=dev_only_secret_change_before_production
JWT_EXPIRES_IN=7d
PORT=4000
```
If you're using Atlas instead of local MongoDB, replace `MONGO_URI` with
your Atlas connection string.

Seed the database (demo login users + demo students at every pipeline stage):
```bash
npm run seed
```

Start the API:
```bash
npm run dev
```
You should see:
```
MongoDB connected → mongodb://127.0.0.1:27017/skillit-fbcrm
SkillIT CRM API running on http://localhost:4000
```

## 3. Frontend setup (second terminal)

```bash
cd frontend        # from the project root
npm install
npm run dev
```
Open the printed `http://localhost:5174`.

## 4. Log in

All demo accounts use the password **`skillit123`**:

All accounts where created by Admin , default password is "skillit123"

Login now does real JWT authentication: `POST /api/auth/login` returns a
signed token, which is stored in `localStorage` and sent as
`Authorization: Bearer <token>` on every subsequent request
(see `src/api/axios.js`). If a token is missing or expired, the API returns
401 and the frontend automatically clears the session and redirects to
`/login`.

## How the pipeline works

One student document moves through stages in MongoDB, and each module is a
filtered query over the same collection (`buildViewFilter` in
`server/controllers/studentController.js`):

```
Student created
  → Generate Payment Link         (Payment Link module)
  → Add Payment(s)                (Payments module — shows once paid > 0)
  → Punch an Order                (Booked Orders — status defaults to Pending)
  → Enroll or Cancel              (Pending → Enrolled / Cancelled)
  → MIS Approve or Cancel         (MIS Approval shows ALL Enrolled profiles,
                                    restricted to the "mis" role)
  → Approved                      (handed to Customer Support)
```

## Project structure

```
Skillit-fbcrm/
  server/                     Node.js + Express + MongoDB API
    index.js                  Express entry point
    config/db.js               Mongoose connection
    models/
      User.js                  Login users (bcrypt password hash + role)
      Student.js                The pipeline record
      Counter.js                Atomic STU-#### id generator
    middleware/auth.js          JWT verification + role guard
    controllers/
      authController.js         login / me
      studentController.js      All pipeline actions + view filters
    routes/
      auth.js
      students.js
    seed.js                     npm run seed — demo users + demo students
    .env                        Mongo URI / JWT secret / port

  frontend/                   React + Tailwind + React Router + Axios
    src/
      api/
        axios.js               Shared instance, attaches JWT, handles 401
        auth.js                 login / me calls
        students.js             Every student/pipeline API call
      context/AuthContext.jsx   Real JWT login/logout, persisted session
      pages/                    Login, StudentListPage, StudentDetail,
                                 Onboarding, Orientation, Learners, Tokens
    package.json
    vite.config.js
```

## Still to plug in

- **Logo**: drop your real file at `frontend/public/logo.png` — it's already
  wired as a plain `<img>` in the sidebar and login screen, with an inline
  SVG fallback until you add it.
- **Sidebar module icons**: still `lucide-react` components — send your
  icon source and I'll swap them for `<img>` tags the same way.
- **Onboarding / Orientation / Learners / Tokens**: Onboarding, Orientation
  and Learners already read from the real `approved` view; Tokens still
  uses illustrative mock ticket data since no ticket workflow was specified.
