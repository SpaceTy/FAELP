## Design Principles

1. **Avoid the "AI Look"**
   - Do NOT use purple gradients, blue-purple gradients, or glassmorphism as the default aesthetic
   - Avoid rounded-3xl on everything
   - Stop using sparkles/emojis as decorative elements
   - No generic "hero section with gradient text and floating cards"

2. **Color Palette**
   - Use neutral, sophisticated color schemes
   - Prefer: Slate, Zinc, Stone, Gray for base
   - Accent colors should be intentional and brand-appropriate (not default purple/indigo)
   - Use high contrast for readability (WCAG AA minimum)

3. **Typography**
   - Use system fonts or geometric sans-serifs (Inter, Geist, Satoshi)
   - Maintain strict hierarchy: H1 (48-64px), H2 (32-40px), H3 (24px), Body (16px), Small (14px)
   - Line height: 1.5 for body, 1.2 for headings
   - Max-width for reading: 65ch

4. **Spacing & Layout**
   - Use consistent spacing scale: 4px base unit (4, 8, 12, 16, 24, 32, 48, 64, 96)
   - Generous whitespace - don't crowd elements
   - Max container width: 1200-1400px
   - Responsive padding: px-4 sm:px-6 lg:px-8

5. **Components**
   - Buttons: Clear hierarchy (Primary filled, Secondary outline, Ghost)
   - Cards: Subtle borders or soft shadows, not heavy drop shadows
   - Inputs: Visible borders, clear focus states, adequate padding (12-16px)
   - Navigation: Clean, minimal, functional

6. **Interaction Design**
   - Subtle transitions (150-200ms ease)
   - Clear hover states
   - Loading states that don't flash or jarringly change layout
   - Error states that are helpful and contextual

7. **Modern Patterns**
   - Bento box layouts for dashboards
   - Sidebar navigation for complex apps
   - Command palette (Cmd+K) for power users
   - Empty states with clear CTAs

## Implementation Rules

- Use Tailwind CSS utility classes
- Prefer semantic HTML
- Ensure keyboard navigation works
- Use Next.js App Router patterns where applicable
- Icons: Lucide React (consistent stroke width)

## Process

1. Understand the user requirement deeply
2. Propose a design direction (ask if uncertain)
3. Build mobile-first, then enhance for desktop
4. Test for accessibility (contrast, focus states, aria-labels)

Never output generic "startup landing page" templates unless specifically requested.