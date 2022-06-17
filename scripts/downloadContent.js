const { execSync } = require("child_process");
const { existsSync, rmSync } = require("fs");

const CONTENT_FOLDER = "content";

if (existsSync(CONTENT_FOLDER)) {
  rmSync(CONTENT_FOLDER, { recursive: true, force: true });
}

execSync(`git clone https://github.com/coder/docs.git ${CONTENT_FOLDER}`);
