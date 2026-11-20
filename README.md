# YC & Compliance Management

A full-stack web application demonstrating a customer verification and compliance review workflow. The platform allows customers to submit individual or business onboarding applications, upload supporting documents, track application status, and receive updates. Administrators can review applications, evaluate simulated screening results, request corrections, and maintain an auditable review history.

**Important:** This project uses fictional customer data and simulated risk scoring. It is a demonstration project, not a real identity verification, fraud detection, or regulatory decision-making service.

## Key Features

### 1. Authentication & Authorization
- JWT-based authentication and authorization.
- Secure password hashing using bcrypt.
- Separate customer and administrator dashboards.
- Role-based access control for protected API operations.

### 2. Customer Onboarding
- Create, save, and update draft applications.
- Submit verification applications.
- Individual and India-focused business onboarding workflows.
- Business registration identifiers and business activity information.
- Support for different business entity types, including:
  - Private and public companies
  - LLPs
  - Partnerships
  - Sole proprietorships
  - Trusts and NGOs
  - Other business entities
- Application status tracking and review history.

### 3. Document Management
- Private and authenticated document uploads.
- Document retrieval and deletion through protected endpoints.
- Business-specific document categories.
- File type and size restrictions.
- Owner-scoped document access.

### 4. Risk Assessment
- Transparent and deterministic risk scoring.
- Rule-based completeness and consistency evaluation.
- Risk score explanations.
- Clear indication of simulated assessment results.

### 5. Administrator & Compliance Review
- Administrator dashboard with MongoDB-backed metrics.
- Customer and application search.
- Application review and status management.
- Simulated screening through three providers:
  - **Provider Alpha:** Completed simulated response.
  - **Provider Beta:** Simulated timeout and inconclusive data checks.
  - **Provider Gamma:** Simulated manual-review response.
- Normalized screening outcomes.
- Individual reviewer decisions for each returned check.
- Correction requests and internal review notes.
- Auditable application timeline.

### 6. Notifications
- In-app application status notifications.
- Customer notification list.
- Notification read-state management.

### 7. Embeddable React Verification Widget
- Reusable React verification widget.
- Configurable branding and theme.
- Customizable workflow steps and labels.
- Success and error callbacks.
- Resume editable application drafts.
- Responsive design for mobile and tablet devices.

## Technology Stack

### Frontend
- React.js
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod
- Recharts
- Lucide React

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT
- bcryptjs
- Multer
- Zod
- Helmet
- Express Rate Limit

## Project Structure

```text
YC-Compliance-Management/
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── types/
│       └── utils/
│
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       └── types/
│
├── package.json
└── README.md
```

## Requirements

Make sure the following are installed:

- Node.js 20 or newer
- npm 10 or newer
- MongoDB local installation or MongoDB Atlas account

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/kyc-compliance-management.git
cd kyc-compliance-management
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Configure the following variables:

| Variable | Description |
|---|---|
| PORT | Backend server port (default: 5000) |
| MONGO_URI | MongoDB connection string |
| JWT_SECRET | Unique JWT signing secret (minimum 32 characters) |
| CLIENT_URL | Frontend origin for CORS |
| ADMIN_EMAIL | Administrator email |
| ADMIN_PASSWORD | Administrator password (minimum 12 characters) |
| UPLOAD_DIR | Private document upload directory |

Create the frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

Configure:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Update the MongoDB connection string and other environment variables according to your local setup.

### 4. Start the Application

Start the backend API:

```bash
npm run dev:server
```

Start the frontend in a separate terminal:

```bash
npm run dev:client
```

Open the application:

**Frontend:** http://localhost:5173

**Backend:** http://localhost:5000

The frontend uses port 5173 by default to match the backend's default CLIENT_URL. If you change the frontend origin, update CLIENT_URL in backend/.env and restart the API.

## Demo Administrator & Customer Accounts

Run the database seeder to create fictional demonstration accounts:

```bash
npm run seed --workspace=backend
```

Configure ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before running the seeder.

### Administrator Login

| Field | Demo Value |
|---|---|
| Email | admin@example.com |
| Password | change_this_password |

These are example development values. Replace them with your own credentials before seeding.

### Customer Login

| Field | Demo Value |
|---|---|
| Email | customer01@example.com |
| Password | DemoCustomer!2026 |

The seeder creates 12 fictional customer accounts:

- customer01@example.com
- customer02@example.com
- ...
- customer12@example.com

All seeded customer accounts share the same demonstration password:

`DemoCustomer!2026`

**Note:** These credentials are for local demonstration purposes only. Never use default credentials in a deployed environment.

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
