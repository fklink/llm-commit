"use strict";
const { path, roots, run, must } = require("./lib.cjs");
try {
  must(run(process.execPath, [path.join(__dirname, "host.cjs"), path.join(roots().reports, "package")], "host-console", { timeout: 20 * 60 * 1000 }), "Mandatory installed VS Code host matrix");
} catch (error) { console.error(error.message); process.exitCode = 1; }
