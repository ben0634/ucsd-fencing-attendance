# DESIGN.md v2.0 — UCSD Fencing Attendance System

> Production-Grade Design System Specification for the UC San Diego NCAA Fencing Team Web Application.
> Built on the DESIGN.md v2.0 Standard.

---

## 1. Visual Theme & Atmosphere

### Philosophy & Visual Identity
The UCSD Fencing Attendance system embodies the precision, speed, and discipline of collegiate fencing combined with the bold athletic identity of UC San Diego Triton Athletics.

The application moves away from generic, washed-out administrative spreadsheets and embraces a high-performance **Collegiate Athletic Command Center** aesthetic. The interface feels:
- **Crisp and Focused**: High-contrast typography, razor-sharp borders (`1px solid var(--border-subtle)`), and intentional whitespace that prevents visual fatigue during fast-paced practice roll-calls.
- **Proudly Triton**: Anchored by deep UCSD Navy (`#182B49`), electric Triton Royal (`#00629B`), and energetic Triton Gold (`#FFCD00` / `#C69214`) accents.
- **Tactile & Responsive**: Touch targets built for mobile on the fencing strip (minimum 44×44px for phone roll calls), with instant visual feedback (spring micro-interactions and distinct state transitions).

### Key Characteristics:
1. **Tailored Athletic Palette**: Deep collegiate navy headers with warm gold badges and clean, high-contrast surfaces.
2. **Instant Scan-ability**: Attendance statuses (On-Time, Late, Excused, Missing, No Practice) are distinguished by shape, high-contrast icon, and WCAG AA-compliant color coding so captains can scan 30 athletes in under 5 seconds.
3. **Layered Card Elevation**: Flat background with elevated frosted cards (`bg-white shadow-sm ring-1 ring-slate-200/70`) creating crisp visual hierarchy without heavy skeuomorphic shadows.
4. **Purpose-Built Mobile Strips**: Captain roll calls are optimized for one-thumb usage with large toggle targets and clear visual confirmation.
5. **Modern Type Hierarchy**: Clean geometric sans-serif typography with high optical clarity for numbers and timestamps.

---

## 2. Color System & Tokens

### Primary Brand Palette

| Token | Name | Hex | Role | Tailwind Class / CSS Var |
|-------|------|-----|------|--------------------------|
| `brand-navy` | UCSD Deep Navy | `#182B49` | Primary headers, active brand accents, primary buttons | `bg-[#182B49]` / `--ucsd-navy` |
| `brand-blue` | Triton Royal | `#00629B` | Interactive links, focus rings, secondary badges | `text-[#00629B]` / `--triton-blue` |
| `brand-gold` | Triton Gold | `#FFCD00` | Accent highlights, captain badges, gold stars | `bg-[#FFCD00]` / `--triton-gold` |
| `brand-gold-dark`| Deep Gold | `#C69214` | High-contrast gold text, borders on light surfaces | `text-[#C69214]` / `--triton-gold-dark` |

### Neutral Surfaces & Text

| Token | Hex | Role | Tailwind Class |
|-------|-----|------|----------------|
| `surface-canvas` | `#F8FAFC` | App background canvas (slate-50) | `bg-slate-50` |
| `surface-card` | `#FFFFFF` | Primary card & table container | `bg-white` |
| `surface-subtle` | `#F1F5F9` | Hover states, table zebra stripes (slate-100) | `bg-slate-100` |
| `surface-muted` | `#E2E8F0` | Unmarked states, skeleton loaders (slate-200) | `bg-slate-200` |
| `text-primary` | `#0F172A` | Page titles, athlete names, primary values (slate-900) | `text-slate-900` |
| `text-secondary` | `#475569` | Squad labels, table headers, descriptions (slate-600) | `text-slate-600` |
| `text-tertiary` | `#94A3B8` | Timestamps, helper hints, breadcrumbs (slate-400) | `text-slate-400` |
| `border-subtle` | `#E2E8F0` | Card borders, table dividers (slate-200) | `border-slate-200` |
| `border-strong` | `#CBD5E1` | Input borders, active tab outlines (slate-300) | `border-slate-300` |

### Attendance Status System (Semantic & Accessible)

Every attendance status has a dedicated background, text, border, and badge token engineered for immediate legibility:

| Status | Meaning | Background | Text | Border | Symbol |
|--------|---------|------------|------|--------|--------|
| **On-Time** | Present on time | `#DCFCE7` (emerald-100) | `#15803D` (emerald-700) | `#86EFAC` | `✓` |
| **Late (Justified)** | Late with advance notice | `#ECFCCB` (lime-100) | `#4D7C0F` (lime-700) | `#BEF264` | `J` |
| **Late** | Unexcused late arrival | `#FEF3C7` (amber-100) | `#B45309` (amber-700) | `#FDE68A` | `L` |
| **Excused** | Approved academic/medical absence | `#DBEAFE` (blue-100) | `#1D4ED8` (blue-700) | `#93C5FD` | `E` |
| **Missing** | Unexcused absence | `#FEE2E2` (red-100) | `#B91C1C` (red-700) | `#FCA5A5` | `✕` |
| **No Practice** | Off-day or cancelled session | `#F1F5F9` (slate-100) | `#64748B` (slate-500) | `#CBD5E1` | `—` |
| **Not Marked** | Roll call pending | `#FFFFFF` | `#94A3B8` (slate-400) | `#CBD5E1` (dashed) | `?` |

---

## 3. Typography System

- **Font Family**: Inter, Geist Sans, or modern system geometric fallback (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont`).
- **Hierarchy Scale**:
  - `Display / Page Title`: `28px` / `32px` mobile, `36px` desktop (`text-2xl sm:text-3xl font-bold tracking-tight text-slate-900`)
  - `Section Header / H2`: `20px` / `24px` (`text-xl sm:text-2xl font-semibold text-slate-800`)
  - `Card Header / H3`: `16px` / `18px` (`text-base sm:text-lg font-semibold text-slate-900`)
  - `Body Regular`: `14px` / `20px` (`text-sm text-slate-600 font-normal`)
  - `Body Small / Meta`: `12px` / `16px` (`text-xs text-slate-500 font-medium`)
  - `Micro Tag / Badge`: `11px` / `14px` (`text-[11px] font-semibold uppercase tracking-wider`)

---

## 4. Component Catalog & Anatomy

### 1. Navigation Shell (`HeaderNav`)
- **Navy Anchor**: Full-width deep navy background (`bg-[#182B49] text-white`).
- **Team Crest / Identity**: UCSD Fencing trident emblem or clean gold typography tag (`TRITONS FENCING`).
- **Session Switcher**: Sleek segmented pill (`Practice` vs. `Lift`) with active white glow.
- **User Role Badge**: Role indicator (`Coach`, `Captain`, `Athlete`, `Admin`) with easy 1-click logout.

### 2. Metric Stat Cards (`StatCard`)
- Clean white surface with subtle slate border and top accent line.
- Big, crisp metric value (e.g., `94.2% Attendance`, `28 Present`).
- Contextual comparison subtitle (e.g., `+3.1% vs Winter Quarter`).

### 3. Quick-Tap Roll Call Grid (`CaptainRollCallCard`)
- Designed for phone use at the armory/strip.
- Athlete avatar / initials badge with name and weapon squad.
- 5-button segmented status row: `[ ✓ ] [ J ] [ L ] [ E ] [ ✕ ]`.
- Active selection snaps with clear highlight and border; micro-haptic visual feedback on click.

### 4. Practice Schedule Weekday Toggles (`CoachPracticeMatrix`)
- Squad rows: Men's & Women's Foil, Épée, Sabre.
- Day toggles: Mon / Tue / Wed / Thu / Fri / Sat / Sun.
- Active practice days glow in rich navy/gold; off-days are muted slate.

### 5. Attendance Calendar Heatmap (`CalendarMonthView`)
- Clean 7-column grid with clear day headers (Mon-Sun).
- Days outside current month muted.
- Daily cells tinted with semantic attendance color badges and dot indicators.

---

## 5. Component State Matrix

| Component | Default | Hover | Active / Pressed | Focus-Visible | Disabled |
|-----------|---------|-------|------------------|---------------|----------|
| **Primary Button** | `bg-[#182B49] text-white` | `bg-[#1e365d] shadow-sm` | `bg-[#132239] scale-[0.98]` | `ring-2 ring-offset-2 ring-[#00629B]` | `bg-slate-200 text-slate-400 cursor-not-allowed` |
| **Gold Accent Button** | `bg-[#FFCD00] text-slate-900 font-semibold` | `bg-[#e6b800]` | `bg-[#cca300] scale-[0.98]` | `ring-2 ring-offset-2 ring-[#C69214]` | `opacity-50 cursor-not-allowed` |
| **Status Pill (On-Time)**| `bg-emerald-50 text-emerald-700 border-emerald-200` | `bg-emerald-100` | `scale-95` | `ring-2 ring-emerald-400` | `opacity-60` |
| **Status Pill (Missing)**| `bg-red-50 text-red-700 border-red-200` | `bg-red-100` | `scale-95` | `ring-2 ring-red-400` | `opacity-60` |
| **Table Row** | `bg-white` | `bg-slate-50/80` | `bg-slate-100` | `outline-none ring-1 ring-inset ring-[#00629B]` | `opacity-50` |
| **Input / Select** | `bg-white border-slate-300 text-slate-900` | `border-slate-400` | `border-[#182B49]` | `ring-2 ring-[#00629B]/20 border-[#00629B]` | `bg-slate-100 text-slate-400` |

---

## 6. Layout & Spacing System

- **8-Point Base Grid**: Spacing strictly maps to `8px`, `12px`, `16px`, `24px`, `32px`, `48px` (`gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`).
- **Container Max-Widths**:
  - Dashboard Page: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
  - Centered Auth / Login: `max-w-md w-full mx-auto`
  - Full Width Tables: overflow-x scroll container with sticky name column on mobile.
- **Minimum Touch Targets**: All interactive buttons and roll-call toggles must be at least **44×44px** on screens `< 768px`.

---

## 7. Depth & Elevation

| Level | Style | Role |
|-------|-------|------|
| `Level 0` | `bg-slate-50` (flat) | Base application background |
| `Level 1` | `bg-white border border-slate-200/80 shadow-xs rounded-xl` | Standard stat card, roster table container |
| `Level 2` | `bg-white border border-slate-200 shadow-md rounded-xl` | Dropdowns, popovers, active selection card |
| `Level 3` | `bg-white shadow-2xl rounded-2xl ring-1 ring-black/5` | Modals (Password reset, custom practice exceptions) |

---

## 8. Motion & Micro-Interactions

- **Standard Timing**:
  - Quick feedback (button hover, status tap): `150ms ease-out` (`transition-all duration-150 ease-out`)
  - Layout morphs (collapsing squads, expanding weeks): `250ms cubic-bezier(0.4, 0, 0.2, 1)`
  - Modal entrances: `200ms ease-out scale-95 -> scale-100, opacity-0 -> opacity-100`
- **Accessibility**:
  - Respect `prefers-reduced-motion: reduce` by zeroing transition durations for users requesting reduced motion.

---

## 9. Accessibility Contract (WCAG AA)

- **Contrast Rule**: All text elements must achieve a minimum contrast ratio of **4.5:1** against their background (Large text > 18pt min **3:1**).
- **No Color-Only Information**: Every attendance status must accompany its color with a distinct text label or symbol (`✓`, `L`, `J`, `E`, `✕`).
- **Focus Rings**: Interactive elements must retain visible keyboard focus outlines (`focus-visible:ring-2 focus-visible:ring-[#00629B] focus-visible:ring-offset-2`).

---

## 10. Code Snippets (Ready to Implement)

### Attendance Status Badge Component
```tsx
export function AttendanceBadge({ status }: { status: 'on-time' | 'late' | 'late-justified' | 'excused' | 'missing' | 'no-practice' | null }) {
  const configs = {
    'on-time': { label: 'On Time', icon: '✓', styles: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/10' },
    'late-justified': { label: 'Late (J)', icon: 'J', styles: 'bg-lime-50 text-lime-700 border-lime-200 ring-lime-600/10' },
    'late': { label: 'Late', icon: 'L', styles: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/10' },
    'excused': { label: 'Excused', icon: 'E', styles: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/10' },
    'missing': { label: 'Missing', icon: '✕', styles: 'bg-red-50 text-red-700 border-red-200 ring-red-600/10' },
    'no-practice': { label: 'No Practice', icon: '—', styles: 'bg-slate-100 text-slate-500 border-slate-200 ring-slate-500/10' },
  };

  const current = status ? configs[status] : { label: 'Not Marked', icon: '?', styles: 'bg-white text-slate-400 border-dashed border-slate-300 ring-slate-300/10' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ring-1 ring-inset ${current.styles} transition-all duration-150`}>
      <span className="font-bold text-[11px]">{current.icon}</span>
      <span>{current.label}</span>
    </span>
  );
}
```

### Dashboard Metric Card
```tsx
export function StatCard({ label, value, subtext, icon }: { label: string; value: string; subtext?: string; icon?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && <div className="text-slate-400 p-2 bg-slate-50 rounded-xl">{icon}</div>}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#182B49] to-[#00629B]" />
    </div>
  );
}
```

---

## 11. Implementation Checklist

- [ ] Import Google Font (Inter / Geist) into root layout for crisp optical typography.
- [ ] Apply `#182B49` Navy Header across all role views (Athlete, Captain, Coach).
- [ ] Upgrade Login (`/`) to clean split or card with Triton branding and modern inputs.
- [ ] Modernize Athlete Dashboard with AttendanceBadge components and clean StatCards.
- [ ] Streamline Captain Roll-Call view with mobile touch-friendly quick toggles.
- [ ] Refine Coach Practice Day matrix with interactive toggle buttons and clear active states.
