const { execFileSync } = require("node:child_process");

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
    ["@semantic-release/git", {
      assets: ["CHANGELOG.md"],
      message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}\n\nSigned-off-by: " + committer
    }],
    ["@semantic-release/github", {}]
  ]
};
