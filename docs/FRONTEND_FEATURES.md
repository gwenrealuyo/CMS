## Frontend Feature Map

### Pages (App Router)

- `src/app/page.tsx`: Landing/dashboard entry
- `src/app/dashboard/page.tsx`: Dashboard widgets (overview)
- `src/app/people/page.tsx`: People & Families management
  - Tabs: People | Families
  - People: search, filter (role, date range), table listing via `PeopleTable`
  - Create person via `PersonForm` (uses `usePeople` hook → backend)
  - Families: cards via `FamilyCard`; local state create/delete (UI stub)
- `src/app/finance/page.tsx`: Finance hub for donations, offerings, and pledges
- `src/app/members/page.tsx`: Members listing placeholder

### Hooks & Components (referenced)

- `hooks/usePeople`: Fetch, create, update, delete people via `/api/people/`
- Forms: `components/people/PersonForm`, `components/families/FamilyForm`
- Tables/Cards: `components/people/PeopleTable`, `components/families/FamilyCard`
- Layout/UI: `components/layout/DashboardLayout`, `components/ui/*`, `SearchBar`, `FilterOptions`

### Styling & Libraries

- Tailwind CSS, Radix UI, Heroicons, React Hook Form, Zod
- Charts/tables libraries are available (Recharts, FullCalendar) for future pages

### Notes

- Families page uses local state; wiring to backend families endpoints can be added later.
- People list filters out the `admin` user and entries without a name on the frontend only (API remains unchanged).
