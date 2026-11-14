// Adds the app-level polish stylesheet and the cloud-engine shim to the built UI.
// No file under frontend/ is modified.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = process.argv[2] || "android/app/src/main/assets/www/index.html";
let html = readFileSync(file, "utf8");

if (!html.includes("polish.css")) {
  const link = '<link rel="stylesheet" href="./polish.css">';
  html = html.includes("</head>")
    ? html.replace("</head>", link + "</head>")
    : link + html;
}

if (!html.includes("shim.js")) {
  const tag = '<script src="./shim.js"></script>';
  const i = html.search(/<script\b/i);
  html = i >= 0 ? html.slice(0, i) + tag + html.slice(i) : html.replace("</head>", tag + "</head>");
}

writeFileSync(file, html);
console.log("injected:", html.includes("polish.css"), html.includes("shim.js"), existsSync(file));
