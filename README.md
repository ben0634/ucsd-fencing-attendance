# UCSD Fencing Attendance & Team Management Portal

A full-stack athletic attendance management platform built for tracking team practice sessions, squad compliance, and athlete participation statistics.

[Live Demo](https://ucsdfencing.vercel.app/) · [Report Issue](https://github.com/your-username/ucsd-fencing/issues)

---

## Previews

### 1. Coach & Admin Dashboard
> *Team-wide attendance monitoring, roster compliance, and practice session tracking.*
<img width="901" height="824" alt="Screenshot 2026-08-31 at 4 28 28 PM" src="https://github.com/user-attachments/assets/80fd7722-a56c-41a4-969f-5bd86237df00" />
<img width="871" height="596" alt="Screenshot 2026-08-31 at 4 29 22 PM" src="https://github.com/user-attachments/assets/49285b17-ddd5-4d63-bf03-ce3cbd36b6c1" />

---

### 2. Captain Practice Check-In
> *Squad-level attendance logging (Epee, Foil, Sabre) with real-time sync.*
<img width="732" height="623" alt="Screenshot 2026-08-31 at 4 30 50 PM" src="https://github.com/user-attachments/assets/79eec383-be64-412b-a15c-b675e43b1285" />


---

### 3. Athlete Participation Portal
> *Individual athlete session history, participation rates, and personal statistics.*

<img width="383" height="738" alt="Screenshot 2026-08-31 at 4 30 31 PM" src="https://github.com/user-attachments/assets/587db729-7732-4b1c-ad3e-0fdb09ae5a0f" />

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
