# Bliss Dermacare - Professional Esthetician Services

A modern, single-page application built with Astro for professional esthetician services and bookings.

## 🚀 Features

- **Modern Single-Page Design**: Smooth scrolling navigation with all content on one page
- **Responsive Layout**: Mobile-first design that looks great on all devices
- **Service Showcase**: Detailed service cards with pricing and descriptions
- **Package Deals**: Pre-built treatment packages with savings
- **Booking Form**: Integrated appointment request form
- **Easy Customization**: All content editable directly in Astro components
- **Professional Aesthetic**: Spa-inspired design with custom brand colors

## 🛠️ Tech Stack

- **[Astro 4.16.17](https://astro.build)** - Static site generator with server-side rendering

- **[Tailwind CSS 3.4.1](https://tailwindcss.com)** - Utility-first CSS framework
- **[TypeScript 5.6.3](https://www.typescriptlang.org)** - Type-safe JavaScript
- **[@astrojs/node](https://docs.astro.build/en/guides/integrations-guide/node/)** - Server adapter


## 📦 Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd blissdermacare-new
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```



## 🏃 Development

Start the development server:

```bash
npm run dev
```

The site will be available at `http://localhost:4321`

## 🏗️ Building for Production

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Preview the production build**:
   ```bash
   npm run preview
   ```

3. **Start the production server**:
   ```bash
   npm start
   ```

## 📁 Project Structure

```
blissdermacare-new/
├── src/
│   ├── layouts/
│   │   └── Layout.astro         # Main layout with navigation & footer
│   └── pages/
│       └── index.astro          # Single-page application content
├── public/                      # Static assets (images, fonts, etc.)
├── astro.config.mjs            # Astro configuration
├── tailwind.config.mjs         # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies and scripts
```

## 🎨 Customization

### Brand Colors

The custom color palette is defined in `tailwind.config.mjs`:

- **Primary** (Orange/Peach tones): Used for CTAs, highlights, and brand elements
- **Neutral** (Grays): Used for text and backgrounds

### Services & Pricing

Edit services and pricing in `src/pages/index.astro`:

- Classic Facial: $95
- Anti-Aging Facial: $145
- Chemical Peel: $125
- Microdermabrasion: $110
- Acne Treatment: $105
- Hydrafacial: $165

### Contact Information

Update contact details in `src/layouts/Layout.astro` (footer) and `src/pages/index.astro` (booking section):

- Phone: (555) 123-4567
- Email: hello@blissdermacare.com
- Address: 123 Beauty Lane, Suite 100, Your City, ST 12345

## 📱 Features Breakdown

### Hero Section
- Compelling headline and subheadline
- Dual CTAs (Book Treatment / View Services)
- Trust indicators (rating, certification, experience)

### Services Section
- 6 detailed service cards
- Icons, descriptions, pricing, and duration
- Hover effects for engagement

### About Section
- Brand story and philosophy
- Stats (experience, clients, satisfaction)
- Image placeholder for professional photo

### Pricing Section
- 3 package tiers (Starter, Glow, Premium)
- Feature comparisons
- Highlighted "Most Popular" package

### Booking Section
- Comprehensive contact form
- Service selection dropdown
- Date picker for appointments
- Direct contact options (phone/email)

### Testimonials Section
- Client reviews with star ratings
- Social proof for credibility

## 🌐 Deployment

This site uses the Node.js adapter in standalone mode. Deploy to any platform that supports Node.js:

### Vercel
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy
```

### Self-Hosted
Build the project and run the production server on your host:
```bash
npm run build
npm start
```

## 📝 Content Management

All content can be easily updated by editing the Astro files:

- **Services & Pricing**: Edit `src/pages/index.astro` (Services Section)
- **About Information**: Edit `src/pages/index.astro` (About Section)
- **Contact Details**: Edit `src/layouts/Layout.astro` (Footer) and `src/pages/index.astro` (Booking Section)
- **Testimonials**: Edit `src/pages/index.astro` (Testimonials Section)

## 🤝 Contributing

This is a custom project for Bliss Dermacare. For updates or modifications, contact the development team.

## 📄 License

Private - All rights reserved.

---

Built with ❤️ using Astro
