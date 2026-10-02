// pdf.js runs in a Web Worker, and its worker is an ES module that Next 14's
// webpack minifier can't parse when bundled. Serve it as a plain static file
// instead — copied from node_modules at build time so it always matches the
// installed pdf.js version (pdf.js refuses to run against a mismatched worker).
// Saved as .js although it is an ES module: pdf.js starts it as a module
// worker, and browsers reject one served without a JavaScript MIME type —
// .js is guaranteed one on every static host, .mjs is not.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync(
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.js"
);
console.log("copied pdf worker -> public/pdf.worker.min.js");
