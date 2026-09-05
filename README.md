# UCSD Fencing Attendance & Team Management Portal

A full-stack athletic attendance management platform built for tracking team practice sessions, squad compliance, and athlete participation statistics.

[Live Demo](https://ucsdfencing.vercel.app/) · [Report Issue](https://github.com/your-username/ucsd-fencing/issues)

---

## Previews

### 1. Coach & Admin Dashboard
> *Team-wide attendance monitoring, roster compliance, and practice session tracking.*
<img width="667" height="674" alt="Screenshot 2026-09-05 at 1 15 56 AM" src="https://github.com/user-attachments/assets/9696a1e3-ce70-4600-b1bf-ea75a679c06a" />
<img width="600" height="351" alt="Screenshot 2026-09-05 at 1 16 47 AM" src="https://github.com/user-attachments/assets/f17a97be-3586-42ff-8787-935fe43e8235" />

---

### 2. Captain Practice Check-In
> *Squad-level attendance logging (Epee, Foil, Sabre) with real-time sync.*
> 
<img width="637" height="499" alt="Screenshot 2026-09-05 at 1 17 30 AM" src="https://github.com/user-attachments/assets/966ba215-cbd0-4bfd-8f3f-09c2e2cec3ec" />

---

### 3. Athlete Participation Portal
> *Individual athlete session history, participation rates, and personal statistics.*

<img width="319" height="587" alt="Screenshot 2026-09-05 at 1 18 34 AM" src="https://github.com/user-attachments/assets/0fe36599-85f0-4225-8def-d3ece016e5c9" />

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
