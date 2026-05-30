# InforMEA eLearning Platform Clone

A modern, highly polished, and fully responsive e-learning catalog platform clone inspired by the United Nations Information Portal on Multilateral Environmental Agreements (InforMEA) learning portal. Built using **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **NextAuth.js v5 (Auth.js)**.

---

## 🚀 Key Implemented Features

### 1. Unified Thematic Course Catalog (`/`)
- **Category Tabs**: Seamless horizontal filtering across 6 thematic areas (Biological Diversity, Chemicals and Waste, Climate and Atmosphere, Environmental Governance, Land and Agriculture, Marine and Freshwater).
- **SDG Goals Filter**: Responsive and colorful scrollable SDG Goals row (Goals 1-17) using official Sustainable Development Goal branding hex palettes.
- **Advanced Selectors**: Persistent dropdown controls filtering by specialized topics and specific Multilateral Environmental Conventions (e.g. CBD, UNFCCC, BRS).
- **Specialist Diplomas**: Custom visual styling and layout logic for specialized certification diplomas.

### 2. Comprehensive User Auth System (NextAuth.js v5)
- **Local Credentials Store**: Salted and hashed password verification via local JSON file-based database (`/src/lib/data/users.json`).
- **OAuth Providers**: Fully wired support for Google Sign-In out of the box.
- **Secure Sessions**: Client/Server JWT session propagation via custom JWT mappings.
- **Protected Routing**: Advanced route guard middleware shielding `/dashboard` (and localized variants) from anonymous users.

### 3. Dynamic Course Detail Page (`/courses/[id]`)
- **Dynamic SEO & OG Tags**: Advanced Server-Side `generateMetadata()` exporting customized Open Graph card tags per course.
- **Hex Cards & Badges**: Clean layouts displaying associated category pills, official colored SDG tags, and specific MEA indices.
- **Secure Server Enrolments**: Server Action triggers verifying session validity and validating course IDs to safeguard against race conditions.

### 4. Interactive Learning Dashboard (`/dashboard`)
- **Key Metric Indicators**: Visually sleek statistics metrics measuring enrolled courses, completed paths, and earned specialist certificates.
- **Dynamic Action Triggers**: Seamlessly enroll, unenroll, mark course progress, and download official PDF certificates dynamically generated on the client.

### 5. Seamless Navigation & Design Systems
- **Theme and Branding**: Premium, modern styling utilizing HSL custom tokens (`forest`, `ocean`, `sand`) with a light gray canvas theme (`bg-gray-50`).
- **Pulsing Loading Skeletons**: High-fidelity global page loader (`loading.tsx`) displaying a 3x4 grid structure.
- **Accessibilities**: Visible focus rings for keyboard-focusable controls, dynamic aria-label announcements, form elements with semantic labels, and WCAG AA contrast.
- **Localisation**: Fully wired request-level URL translation mappings powered by `next-intl`.

---

## 🛠️ Local Setup Instructions

Follow these instructions to run the project locally on your machine:

1. **Clone and Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy the example template file to create your local `.env` configuration:
   ```bash
   cp .env.local.example .env.local
   ```
   *Open `.env.local` and fill in your custom `NEXTAUTH_SECRET` and OAuth credentials.*

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   *Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.*

4. **Verify Production Build**:
   To test compiling safety and next-intl static rendering paths, build the production bundle:
   ```bash
   npm run build
   ```

---

## 📝 What's Not Yet Implemented (Future Roadmap)

- **Persistent Production Database**: Replacing the temporary Node.js file-system local registry (`users.json`) with an enterprise-ready production instance (e.g. MongoDB, PostgreSQL).
- **Actual Video/Course Player**: Fully developed course lessons video player, interactive slide components, and real course learning content.
- **Transactional Emails**: Real SMTP / API integrations (e.g. Resend, SendGrid) to dispatch real email verification codes and recovery password reset tokens.
