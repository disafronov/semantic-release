const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

// Only opt in when both the manifest and its lockfile are present.
const hasPython = fs.existsSync("pyproject.toml") && fs.existsSync("uv.lock");
const hasNpm = fs.existsSync("package.json") && fs.existsSync("package-lock.json");
const assets = ["CHANGELOG.md"];
const versionPlugins = [];
if (hasPython) {
  versionPlugins.push(["@semantic-release/exec", {
    prepareCmd: 'uv version --no-sync "${nextRelease.version}"'
  }]);
  assets.push("pyproject.toml", "uv.lock");
}
if (hasNpm) {
  versionPlugins.push(["@semantic-release/npm", { npmPublish: false }]);
  assets.push("package.json", "package-lock.json");
}

const committer = execFileSync("git", ["var", "GIT_COMMITTER_IDENT"], {
  encoding: "utf8"
}).trim().replace(/>.*$/, ">");

module.exports = {
  branches: ["main", { name: "rc", prerelease: "rc" }],
  plugins: [
    ["@semantic-release/commit-analyzer", {
      preset: "conventionalcommits",
      releaseRules: [
        { breaking: true, release: "major" },
        { type: "refactor", release: "patch" },
        { type: "feat", release: "minor" },
        { type: "fix", release: "patch" },
        { type: "perf", release: "patch" },
        { type: "revert", release: "patch" },
        { type: "docs", release: false },
        { type: "style", release: false },
        { type: "test", release: false },
        { type: "build", release: false },
        { type: "ci", release: false },
        { type: "chore", release: false }
      ]
    }],
    ["@semantic-release/release-notes-generator", {
      preset: "conventionalcommits",
      presetConfig: {
        types: [
          { type: "feat", section: "Features" },
          { type: "fix", section: "Bug Fixes" },
          { type: "perf", section: "Performance Improvements" },
          { type: "revert", section: "Reverts" },
          { type: "refactor", section: "Code Refactoring" },
          { type: "docs", section: "Documentation", hidden: true },
          { type: "style", section: "Styles", hidden: true },
          { type: "test", section: "Tests", hidden: true },
          { type: "build", section: "Build System", hidden: true },
          { type: "ci", section: "Continuous Integration", hidden: true },
          { type: "chore", section: "Miscellaneous Chores", hidden: true }
        ]
      }
    }],
    ["@semantic-release/changelog", {}],
    ...versionPlugins,
    ["@semantic-release/git", {
      assets,
      message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}\n\nSigned-off-by: " + committer
    }],
    ["@semantic-release/github", {}]
  ]
};
