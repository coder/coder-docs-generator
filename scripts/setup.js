const { execSync } = require("child_process");
const { existsSync, rmSync } = require("fs");
const { copySync } = require("fs-extra");
const path = require("path");

const CONTENT_FOLDER = "content";

if (existsSync(CONTENT_FOLDER)) {
  rmSync(CONTENT_FOLDER, { recursive: true, force: true });
}

console.log("Clonning repo...");
execSync(`git clone https://github.com/coder/docs.git ${CONTENT_FOLDER}`);

console.log("Copying assets folder to public...");
copySync(path.join(CONTENT_FOLDER, "assets"), path.join("public", "assets"), {
  overwrite: true,
});

console.log("Setup is done.");
