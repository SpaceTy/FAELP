# Branch: feature/user-pages

## Tasks
1. Remove Profil page and create Hilfe page with fill-out guide
2. Add a 404 "Page Not Found" page

These must be sequential because both modify `frontend/user/src/App.tsx`.

---

## Task 1: Remove Profil page, create Hilfe page

### Context
- The ProfilePage (`frontend/user/src/pages/ProfilePage.tsx`) is a placeholder ("Demnächst verfügbar...") and should be removed
- The Header (`frontend/user/src/components/Layout/Header.tsx`) has a "Profil" nav link and a "Hilfe" button that currently does nothing
- The Hilfe (Help) page should contain a fill-out guide explaining how to use the platform

### Steps

1. **Delete** `frontend/user/src/pages/ProfilePage.tsx`

2. **Create** `frontend/user/src/pages/HilfePage.tsx`
   - Build a help/guide page that explains the platform workflow:
     - How to browse materials (categories, search)
     - How to add items to cart
     - How to submit a request (delivery date, return date, students, shipping address)
     - What happens after submission (approval process, packaging, shipping)
     - How to track request status in "Meine Anfragen"
     - How to cancel a request
   - Use the existing page layout pattern: `<main className="flex-1 flex overflow-hidden">`
   - Style with Tailwind, matching existing design tokens (text-secondary, text-text-secondary, bg-white, etc.)
   - Use German language for all content, consistent with the rest of the user frontend

3. **Edit** `frontend/user/src/App.tsx`
   - Remove the `ProfilePage` import
   - Remove `ProtectedProfileWrapper` component
   - Remove the `/profile` route
   - Add `HilfePage` import
   - Add a `HilfePageWrapper` (does NOT need ProtectedRoute - help should be accessible to everyone)
   - Add route: `<HilfePageWrapper path="/hilfe" />`

4. **Edit** `frontend/user/src/components/Layout/Header.tsx`
   - Remove the "Profil" nav link (`<a href="/profile">`)
   - Change the "Hilfe" button from a non-functional `<button>` to an `<a href="/hilfe">` link, keeping the same styling

---

## Task 2: Add 404 Page Not Found page

### Context
- Currently navigating to an undefined route shows a blank page
- preact-router supports a `default` prop for catch-all routes

### Steps

1. **Create** `frontend/user/src/pages/NotFoundPage.tsx`
   - Simple centered page with:
     - "404" large heading
     - "Seite nicht gefunden" subtitle
     - "Die angeforderte Seite existiert nicht." description
     - A link back to `/materials` ("Zurück zu Materialien")
   - Use the existing centered layout pattern (like the empty cart state)
   - Style with existing design tokens

2. **Edit** `frontend/user/src/App.tsx`
   - Import `NotFoundPage`
   - Add a `NotFoundPageWrapper` component
   - Add `<NotFoundPageWrapper default />` as the LAST route in the Router (the `default` prop makes it catch-all)
