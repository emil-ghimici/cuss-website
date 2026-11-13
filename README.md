# cuss.ie

The website of CuSS Custom Software Solutions. A plain static site (HTML, CSS and JavaScript, no build step) published with GitHub Pages.

## Look at it on your computer

Double-click `index.html`. The page works straight from the folder. The one exception is the "Copy" button: browsers only allow copying on a real web address, so here it selects the email address for you to copy instead.

## What's where

| File | What it is |
|---|---|
| `index.html` | The whole page. All the text is here. |
| `privacy.html`, `404.html` | The privacy notice and the "page not found" page |
| `assets/css/main.css` | Styles. Colours are at the top (`--accent` is the teal). |
| `assets/js/dotfield.js` | The moving dots behind the headline |
| `assets/js/beforeafter.js` | The spreadsheet → app section |
| `assets/js/livestrip.js` | The clock and the numbers under the headline |
| `assets/js/theme.js` | The light/dark switch |
| `assets/js/site.js` | Small shared helpers, the copy button, the footer year |
| `assets/fonts/` | The three fonts, stored here so visitors' browsers don't contact Google |
| `assets/img/` | Favicon, phone icon, social preview image |
| `CNAME` | Tells GitHub Pages the domain is cuss.ie |

## Publishing

Merging a pull request into `main` publishes the site.
