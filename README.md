# Kaan Baha Sever — Portfolio

A simple static portfolio site.

## Structure
- `assets/css/main.css` — Styles
- `assets/js/main.js` — JS interactions
- `assets/images/` — Images
- `templates/` — Optional header/footer partials
- `index.html` — Main page
- `sitemap.xml` and `robots.txt` — SEO files
 - `assets/files/kaan-cv.pdf` — Your CV (linked in Nav, Hero, Contact)

## Preview locally (Windows PowerShell)
You can open `index.html` directly, or run a lightweight server:

```powershell
# Using Python (if installed)
python -m http.server 8080 ; Start-Process http://localhost:8080

# Or using Node (if installed)
npx serve . -p 8080 ; Start-Process http://localhost:8080
```

## Customize
- Update text in `index.html` (About, Projects, Contact)
- Replace placeholder links and add images to `assets/images/`
- Set your real domain in `sitemap.xml` and `robots.txt`
 - Replace `assets/files/kaan-cv.pdf` with your latest CV
