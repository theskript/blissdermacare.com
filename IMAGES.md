# Stock Images for Bliss Dermacare

## Image Placeholders

The current website uses CSS gradient placeholders for images. To add professional stock images:

### Recommended Stock Image Sources

1. **Unsplash** (https://unsplash.com)
   - Free high-quality images
   - Search terms: "spa", "skincare", "facial treatment", "esthetician"

2. **Pexels** (https://pexels.com)
   - Free stock photos and videos
   - Search terms: "beauty treatment", "skin care", "spa therapy"

3. **Pixabay** (https://pixabay.com)
   - Free images and videos
   - Search terms: "facial", "beauty spa", "dermatology"

### Images Needed

1. **Hero Section** (1920x1080 recommended)
   - Professional spa environment or facial treatment
   - Add to: `public/images/hero-bg.jpg`
   - Update in: `src/pages/index.astro` line ~11 (hero section)

2. **About Section** (800x1000 recommended)
   - Esthetician portrait or spa interior
   - Add to: `public/images/about-image.jpg`
   - Update in: `src/pages/index.astro` line ~178 (about section)

3. **Service Images** (Optional - 600x400 each)
   - Individual service photos
   - Can be added to each service card for more visual appeal

### How to Add Images

1. Download images and place in `/public/images/` folder
2. Update the placeholder divs in the code:

```astro
<!-- Replace this: -->
<div class="aspect-[4/5] bg-gradient-to-br from-primary-200 to-primary-300 rounded-2xl overflow-hidden">
  <div class="w-full h-full flex items-center justify-center text-white/20">
    <!-- SVG placeholder -->
  </div>
</div>

<!-- With this: -->
<div class="aspect-[4/5] rounded-2xl overflow-hidden">
  <img src="/images/about-image.jpg" alt="Bliss Dermacare Spa" class="w-full h-full object-cover" />
</div>
```

### Image Optimization

For production, consider using Astro's Image component for automatic optimization:

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero-bg.jpg';
---

<Image src={heroImage} alt="..." />
```

This provides automatic image optimization, lazy loading, and responsive images.

## License Considerations

Always check the license of stock images:
- ✅ Free for commercial use
- ✅ No attribution required (preferred)
- ⚠️ Some may require attribution
- ❌ Avoid images with restrictive licenses
