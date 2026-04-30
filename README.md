# 🌐 Goal Digger — Web App (React + Vite)

This is the **interactive web prototype** of Goal Digger, built with React 19, Vite 7, and Tailwind CSS v4. It serves as the primary design and functionality reference for the full mobile app.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
├── index.html               # App entry point — title: "Goal Digger"
├── src/
│   ├── main.tsx             # React root mount
│   ├── App.tsx              # Entire app — all screens, state, logic
│   ├── index.css            # Global styles + custom animations
│   └── utils/cn.ts          # Class name utility
├── flutter_project/         # Flutter mobile source (see flutter_project/README.md)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

> **Note:** The web app is intentionally kept as a single `App.tsx` file for rapid prototyping and easy review. In production, this would be split into `pages/`, `components/`, and `hooks/`.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| Vite | 7.2 | Build tool + dev server |
| Tailwind CSS | 4.1 | Utility-first styling |
| TypeScript | 5.9 | Type safety |
| vite-plugin-singlefile | 2.3 | Bundles into a single `dist/index.html` |
| clsx + tailwind-merge | latest | Class merging utilities |

---

## Architecture

### State Management

All state lives in `App.tsx` via React's `useState` and `useCallback`. The app is deliberately not over-engineered — no Redux, no Zustand. State flows down as props and back up as callbacks.

Key state groups:

| State | Purpose |
|---|---|
| `goals` + `todayTaskIds` | Goals with subtasks; today's ATS-selected task IDs |
| `mood` + `energy` + `adaptiveMessage` | Mood check → energy level → adaptive text |
| `routines` | Reminder-only routines, synced to calendar |
| `myFriends`, `myCommunities` | Live community state (suggestions shrink on add/join) |
| `selectedPet` + `petHunger` + `petCoins` | Pet gamification system |
| `breakdownChat` | Post-deconstruction AI chat overlay state |
| `activeReminder` | Global full-screen reminder overlay |
| `datePicker` | Reusable date picker overlay |

---

### ATS Engine

The **Adaptive Task Suggestions** engine is a pure function that scores every undone subtask across all goals and returns the best `n` tasks for today.

```ts
// Scoring formula:
score = (goal.importance × 2)          // priority weight
      + (10 / daysUntilDeadline)        // urgency
      + dayMatch                         // 5 if today, 3 if overdue, 0–4 if upcoming
      + energyMatch                      // +4 for load that matches energy level
```

**Slot count by energy:**
- `low` → 2 tasks
- `steady` → 4 tasks
- `high` → 5 tasks

**Mood guard (deadline protection):**
```ts
const urgentLoad = goals
  .filter(g => daysBetween(TODAY, g.deadline) <= 1)
  .reduce((sum, g) => sum + undone(g), 0);

const effective = requested === "low" && urgentLoad > 2 ? "steady" : requested;
```
If you say you're tired but a goal is due tomorrow with 3+ tasks remaining, the system stays at "steady" energy instead of reducing to 2 tasks.

---

## Screens

### Home (`activeTab === "planner"`)

- **Goal Deconstructor** (dark hero card): Enter a goal → select category → set interest/priority stars → pick deadline → "Break down & schedule" → AI chat overlay opens for refinement
- **My Goals**: Active goals with gradient progress bars, star-button priority editor, date-picker deadline editor, and kind-mode removal

### Task (`activeTab === "task"`)

- **Adaptive Task Suggestions** card: Shows mood check (3 emoji buttons) and adaptive message
- **Today's progress**: Animated SVG ring — gradient color shifts based on completion percentage
- **Today's tasks**: Each task has a ↻ Swap button (replaces with next best undone task from other days), expandable 💡 guidance drawer, and completion toggle that updates pet hunger + coins
- When all tasks are done and more are available: "Add more" button surfaces

### Calendar (`activeTab === "calendar"`)

- **Month navigation**: Prev/next month, tappable month/year label (opens date picker), Today button
- **Calendar grid**: Each day shows goal tasks (colored gradient chips) and routines (dashed amber chips) differently
- **Day popup (view-only)**: Shows task count + routine count summary, then tasks with goal color accent bars and routines with dashed amber border — no interactive checkboxes
- **Routines section**: Dashed-border add button → expandable form → Daily/Weekly/Monthly/Once/Custom frequency → custom text field for Custom

### Community (`activeTab === "community"`)

Column 1: Leaderboard → Team Challenge
Column 2: My Friends → My Community → Friends Suggestions → Community Finder

- Suggestions automatically disappear when a friend is added or a community is joined
- Community Finder has separate **Join** (green) and **Create** (dark) buttons
- My Friends and My Community each have **Remove** buttons

### Customize Pet (`activeTab === "companion"`)

- **Wallet**: Dark gradient card with amber coin badge (reused in shop item prices)
- **Pet preview**: Renders the live synced pet at large size, skin selector updates immediately
- **Shop grid**: 2-column card grid with item image, type badge, description, and coin-styled price button

---

## Animations

All animations are defined in `src/index.css`:

| Class | Effect |
|---|---|
| `.animate-page-in` | Fade + slide up (page transitions) |
| `.animate-pet-idle` | Gentle float loop (pet character) |
| `.animate-breathe` | Scale pulse (AI orb) |
| `.animate-dock-pop` | Scale snap (active nav tab) |
| `.ambient-blob` | Slow drift (background blobs) |
| `.shimmer-ring` | Rotating conic gradient (progress ring border) |
| `.scrollbar-hide` | Hides scrollbar on overflow containers |

---

## Overlay System

All modals use a shared `OverlayShell` component — a full-screen backdrop with a centered rounded card:

```tsx
function OverlayShell({ children, onClose, mw = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-[200] ..." onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`... ${mw}`}>
        {children}
      </div>
    </div>
  );
}
```

Active overlays (in z-index order):

| Overlay | Trigger |
|---|---|
| Global reminder | Auto after 30s (or test button in planner) |
| Profile | Profile button (top left) |
| Settings | Gear icon (top right) |
| Auth (login/signup) | Sign in button or settings |
| Date picker | Deadline buttons in goals / deconstructor |
| Breakdown chat | After "Break down & schedule" |
| Focus mode | "⏱ Focus" button on Task page |
| Calendar day popup | Tapping any calendar cell |

---

## Building for Production

```bash
npm run build
```

Output: `dist/index.html` — a single self-contained HTML file (all CSS and JS inlined via `vite-plugin-singlefile`). Drop it anywhere to run with no server.

---

## Key Files

| File | What's in it |
|---|---|
| `src/App.tsx` | Everything — all 5 screens, all state, all overlays, all shared components, all icons, the `Pet` SVG component, `PageBuddy`, `OverlayShell`, ATS engine |
| `src/index.css` | Tailwind import + custom keyframe animations + utility classes |
| `index.html` | Single `<div id="root">` + Vite script tag. Title: "Goal Digger — Productivity Companion" |
| `vite.config.ts` | Vite config with `@tailwindcss/vite` and `vite-plugin-singlefile` |

---

## Development Notes

- **Today's date** is hardcoded to `April 15, 2026` for consistent demo data. Change `const TODAY = new Date(2026, 3, 15)` in `App.tsx` to use real-time.
- **No backend / no persistence** — all state resets on page refresh. Data is intended as realistic demo content.
- **Single-file output** — the production build is one HTML file, suitable for embedding in presentations or sharing directly.
- **Pet character** — rendered as an inline SVG `<Pet />` component with role-specific accessories (glasses for Home, headphones for Task, wristwatch for Calendar, bowtie for Community, chef hat for Shop). The `staticMode` prop disables the idle float animation (used in the nav bar).
