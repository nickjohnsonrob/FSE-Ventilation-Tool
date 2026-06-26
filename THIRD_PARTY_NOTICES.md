# Third-Party Notices

This project bundles third-party software and fonts under their respective open-source licenses. All are used unchanged.

---

## JavaScript libraries (in `vendor/`)

| Library | Version pin | License | Notes |
|---|---|---|---|
| [`react.production.min.js`](vendor/react.production.min.js) | (see file header for exact version string) | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [`react-dom.production.min.js`](vendor/react-dom.production.min.js) | (see file header) | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. |
| [`exceljs.min.js`](vendor/exceljs.min.js) | (see file header) | MIT | Copyright (c) 2014-present Guyon Roche and contributors. |

### MIT License (boilerplate)

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For full license texts see the upstream repositories:
- React / ReactDOM: https://github.com/facebook/react
- ExcelJS: https://github.com/exceljs/exceljs

---

## Fonts (in `fonts/`)

The bundled `.woff2` files are subsets of **IBM Plex Sans** and **Chivo Mono**, both released under the **SIL Open Font License v1.1**.

- IBM Plex Sans: https://github.com/IBM/plex
- Chivo Mono: https://github.com/googlefonts/chivo

### SIL Open Font License v1.1 (summary)

> The fonts in this directory are licensed under the SIL Open Font License, Version 1.1. This license is copied below, and is also available at: https://scripts.sil.org/OFL
>
> This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is copied below, and is also available with a FAQ at: https://scripts.sil.org/OFL
>
> The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that the reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

See `OFL.txt` upstream for the full text.

---

## Framework runtime

This project was authored against the **Dabble / Scrimba "dc" export** runtime (`lib/support.js`). That runtime is bundled directly into this repository rather than loaded from a CDN, which is the only reason no `<script src="https://...">` tags appear in `index.html`.

If you re-host or refactor the app, you may redistribute or replace `lib/support.js` freely — it is part of this repository under the project's MIT license.
