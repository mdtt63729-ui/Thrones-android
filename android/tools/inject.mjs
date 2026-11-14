// Injects the cloud-engine shim into the built UI without touching any UI source file.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] || "android/app/src/main/assets/www/index.html";
let html = readFileSync(file, "utf8");

if (!html.includes("shim.js")) {
  const tag = '<script src="./shim.js"></script>';
  const i = html.search(/<script\b/i);
  html = i >= 0 ? html.slice(0, i) + tag + html.slice(i) : html.replace("</head>", tag + "</head>");
  writeFileSync(file, html);
  console.log("shim injected");
} else {
  console.log("shim already present");
}
