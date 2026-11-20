# KYC & Compliance Management

A full-stack demonstration of a customer verification and compliance review
workflow. It uses fictional customer data and simulated risk scoring; it is not
an identity verification, fraud detection, or regulatory decision service.

## Features

- React + TypeScript dashboard with separate customer and administrator views.
- JWT authentication, bcrypt password hashing, role-protected API operations.
- Draft and submitted verification applications with review history.
- Individual and India-focused business onboarding profiles, including registration identifier and activity fields.
- Business document categories tailored to companies, LLPs, partnerships, sole proprietorships, trusts/NGOs, and other entities.
- Private, authenticated demo document upload and retrieval.
- Transparent deterministic risk scoring with explanations and disclaimer.
- Canned Alpha, Beta, and Gamma provider simulations with normalized check outcomes.
- Per-check reviewer decisions, correction requests, notes, and an auditable case timeline.
- MongoDB-backed dashboard metrics, customer/application search and reviews.
- In-app application status notifications.
- Embeddable React verification widget with configurable branding and callbacks.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, Axios,
  React Hook Form, Zod, Recharts, Lucide React.
- Backend: Node.js, Express, TypeScript, Mongoose, MongoDB, JWT, bcryptjs,
  Multer, Zod, Helmet, and Express Rate Limit.

## Project layout

```text
frontend/
  src/
    components/  context/  hooks/  pages/  services/  types/  utils/
backend/
  src/
    config/  controllers/  middleware/  models/  routes/
    services/  validators/  types/
```

## Requirements and setup

- Node.js 20 or newer and npm 10 or newer.
- MongoDB running locally or a MongoDB Atlas connection string.

1. Copy `backend/.env.example` to `backend/.env` and set a unique JWT secret,
   MongoDB URI, and administrator password.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Install dependencies from the project root:

   ```sh
   npm install
   ```

4. Start the API and frontend in separate terminals:

   ```sh
   npm run dev:server
   npm run dev:client
   ```

5. Open `http://localhost:5173`. The API uses `http://localhost:5000` by default.
   The frontend uses port `5173` to match the backend's default `CLIENT_URL`.
   If you choose a different frontend origin, set `CLIENT_URL` in
   `backend/.env` to that exact origin and restart the API. Vite will report an
   error rather than silently switching ports if `5173` is already occupied.

Build and type-check both workspaces:

```sh
npm run build
npm run typecheck
```

## Demo administrator and seed data

Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before seeding.
The example values (`admin@example.com` / `change_this_password`) are local
development placeholders only; replace them before running the seeder and never
use them in a deployed environment.

Run the seed command after the backend workspace exposes it:

```sh
npm run seed --workspace=backend
```

The seeder creates an administrator and fictional customers, applications, and
reviews. It does not create real identity records.

## Admin Login

Use the administrator account created by the seeder. Configure these in
`backend/.env` before running the seed command:

- Email: `admin@example.com`
- Password: `change_this_password`

These values come from the `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment
variables. Change them in `.env` before seeding if you want different admin
credentials. Never commit real secrets to this repository.

## API overview

All API routes are under `/api`.

| Area | Routes |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Applications | `POST /applications`, `GET /applications/my`, `GET /applications/:id`, `PUT /applications/:id`, `POST /applications/:id/submit` |
| Documents | `POST /documents/upload`, `GET /documents/my`, `GET /documents/:id`, `DELETE /documents/:id` |
| Risk | `GET /risk/my`, `GET /risk/:applicationId` |
| Administration | `GET /admin/dashboard`, `/admin/users`, `/admin/applications`, `/admin/reviews`, `/admin/risk`; application detail and status/review endpoints are also provided |
| Simulated provider review | `POST /admin/applications/:id/screening`, `PATCH /admin/applications/:id/screening/:runId/:checkCode` |
| Notifications | Customer notification list and read-state endpoints |

Protected endpoints require `Authorization: Bearer <token>`. Application and
document access is owner-scoped; administrators use role-protected routes.
Documents are stored under a private backend directory and served only after
authorization, not from a public static URL.

## Embeddable React widget

Build the widget bundle and TypeScript declarations:

```sh
npm run build:widget --workspace=frontend
```

Import the widget and its stylesheet into a React application:

```tsx
import { VeriTrustWidget } from "@kyc-compliance/frontend/widget";
import "@kyc-compliance/frontend/widget.css";

<VeriTrustWidget
  workflow="individual"
  theme="light"
  apiBaseUrl="https://api.example.com/api"
  accessToken={sessionToken}
  branding={{ name: "Example Company", primaryColor: "#3157a4" }}
  steps={["personal", "identity", "documents", "review"]}
  stepLabels={{ personal: "Your details", identity: "Identity document" }}
  onSuccess={({ applicationId, status }) => {
    console.log("Submitted", applicationId, status);
  }}
  onError={(error) => console.error(error.message)}
/>;
```

`steps` can reorder the sections and omit the optional documents section; the
personal, identity, and review sections must remain. Provide a short-lived
customer access token from the host application's authentication flow and
configure the API's CORS policy to allow the embedding origin. Never expose a
server secret in browser code. The widget can also use the app's local
`clearcheck_token` when `accessToken` is omitted. `resumeDraft` is available
when the widget should reopen the customer's latest editable application. The
widget adapts to phone and tablet widths; the host page should include a
viewport meta tag (`width=device-width, initial-scale=1`) for mobile browsers.
The embedded widget currently collects individual applications; the main
customer workspace also supports business onboarding.

## Reviewer screening simulation

Administrators can run one of three canned providers on a submitted application:

- **Provider Alpha** returns a completed simulated response. The identity
  consistency and document-category checks compare submitted text/metadata only.
- **Provider Beta** simulates a timeout and returns inconclusive data checks.
- **Provider Gamma** simulates a manual-review response.

Sanctions/PEP, business registry, and legal-activity checks are always shown as
not connected; the demo does not query any live list, registry, adverse-media
source, or verification provider. Reviewers can record a decision and note for
each returned check. Those actions join status changes and internal notes in
the application timeline. The provider selector demonstrates integration
patterns and is not evidence that a person or business is lawful, verified, or
fraud-free.

## Demo-only data and uploads

Use synthetic names, registration details, and sample files created solely for
this demo. Do not upload real Aadhaar, PAN, passport, address-proof, or other
sensitive identity documents. Uploads are private, authenticated demo records
constrained by file type and size. The risk score is generated from documented
deterministic completeness/consistency rules and must not be used to make real
decisions.

## Tests

Run the focused backend tests with:

```sh
npm test --workspace=backend
```

## Deployment

### GitHub Setup

1. Create a new repository on GitHub.
2. From the project root, initialize and push:

```sh
git init
git add .
git commit -m "Initial commit: KYC & Compliance Management"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kyc-compliance-management.git
git push -u origin main
```

> **Important:** `.env` files are gitignored. Never commit real secrets.

### Environment Variables

#### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Signing key (min 32 chars) | `DSTvsrnmFZgfsUIkSYeFgUH2TFMh4H2KJbfiMG8EwuCjiB+pyBbb9bw/WZ6grxkA` |
| `CLIENT_URL` | Frontend origin for CORS | `https://your-app.vercel.app` |
| `ADMIN_EMAIL` | Admin account email | `admin@example.com` |
| `ADMIN_PASSWORD` | Admin account password (min 12 chars) | `change_this_password` |
| `UPLOAD_DIR` | Directory for uploaded files | `./private-uploads` |

#### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `https://your-api.render.com/api` |

### MongoDB Atlas Setup

1. Create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a database user with read/write access.
3. Add your deployment IP (or `0.0.0.0/0` for testing) to the **Network Access** allowlist.
4. Copy the connection string and set it as `MONGO_URI` in your backend environment.

### Deploy Backend (Render / Railway / Heroku)

1. Connect your GitHub repository to the hosting platform.
2. Set the **build command** to: `npm install && npm run build`
3. Set the **start command** to: `cd backend && npm start`
4. Set the **root directory** to the repository root (the `Procfile` handles this).
5. Add all backend environment variables from the table above.
6. Deploy.

### Deploy Frontend (Vercel / Netlify / Render)

1. Connect your GitHub repository.
2. Set the **root directory** to `frontend`.
3. Set the **build command** to: `npm install && npm run build`
4. Set the **publish directory** to: `frontend/dist`
5. Add `VITE_API_BASE_URL` pointing to your deployed backend.
6. Deploy.

### Seed Production Data

After deploying the backend, run the seeder to create the admin account and demo customers:

```sh
npm run seed --workspace=backend
```

Or via your hosting platform's shell/console. The default customer login is:
- Email: `customer01@example.com`
- Password: `DemoCustomer!2026`

### Docker Deployment

```sh
# Build and run with Docker Compose
docker-compose up --build
```

### Security Checklist Before Production

- [ ] Replace all placeholder secrets in `.env`
- [ ] Set `CLIENT_URL` to your actual frontend domain
- [ ] Restrict MongoDB Atlas network access to known IPs
- [ ] Enable HTTPS on all public endpoints
- [ ] Configure persistent storage for `private-uploads/`
- [ ] Set up database backups
- [ ] Review CORS policy in `backend/src/app.ts`

## Screenshots

Add reviewed screenshots of the local demonstration UI here.

## Security limitations

This project is a demonstration foundation, not a production KYC platform.
It does not verify identities, screen sanctions, detect fraud, or provide
regulatory advice. Before production, obtain an independent security review and
add operational hardening, account recovery, email verification, audit retention,
and legally reviewed data-protection controls.
