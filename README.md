# UCSD Fencing Attendance & Team Management Portal

A full-stack athletic attendance management platform built for tracking team practice sessions, squad compliance, and athlete participation statistics.

[Live Demo](https://your-demo-link.vercel.app) · [Report Issue](https://github.com/your-username/ucsd-fencing/issues)

---

## Previews

### 1. Coach & Admin Dashboard
> *Team-wide attendance monitoring, roster compliance, and practice session tracking.*
![Coach Dashboard](./docs/screenshots/coach-dashboard-preview.png)

---

### 2. Captain Practice Check-In
> *Squad-level attendance logging (Epee, Foil, Sabre) with real-time sync.*
![Captain Check-In](./docs/screenshots/captain-checkin-preview.png)

---

### 3. Athlete Participation Portal
> *Individual athlete session history, participation rates, and personal statistics.*
![Athlete Portal](./docs/screenshots/athlete-portal-preview.png)

---

## Features

- **Role-Based Access Portals:**
  - **Athletes:** View personal attendance percentage, check-in history, and upcoming practice schedules.
  - **Squad Captains:** Quick-mark attendance for weapon squads (Epee, Foil, Sabre) during daily practices.
  - **Coaches:** Team-wide oversight, attendance compliance alerts, and squad-by-squad comparison.
  - **Administrators:** Configure academic quarters, manage practice schedules, and oversee rosters.
- **Real-Time Data Sync:** Instant attendance updates powered by Supabase PostgreSQL backend.
- **Analytics & Data Export:** Visual attendance charts, attendance rate trends, and CSV data exports for compliance reporting.
- **Secure Authentication:** Role-based redirection and user management with Row-Level Security.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend & Database:** Supabase / PostgreSQL (Row-Level Security)
- **Data Parsing:** `csv-parse` for roster and history imports
- **Hosting & CI/CD:** Vercel

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ucsd-fencing.git

# Navigate to the project directory
cd ucsd-fencing

# Install dependencies
npm install

# Run locally
npm run dev
