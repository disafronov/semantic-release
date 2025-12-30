module.exports = {
  branches: ["main"],
  plugins: [
    ["@semantic-release/commit-analyzer", {
      preset: "conventionalcommits",
      releaseRules: [
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
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/changelog", {}],
    ["@semantic-release/git", {
      assets: ["CHANGELOG.md"],
      message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}\n\nSigned-off-by: " +
        (process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || "Release Bot") +
        " <" +
        (process.env.GIT_AUTHOR_EMAIL || process.env.GIT_COMMITTER_EMAIL || "noreply@github.com") +
        ">"
    }],
    ["@semantic-release/github", {}]
  ]
};
