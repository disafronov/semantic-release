module.exports = {
  branches: ["main"],
  plugins: [
    ["@semantic-release/commit-analyzer", {
      preset: "conventionalcommits",
      releaseRules: [
        { type: "feat", release: "minor" },
        { type: "fix", release: "patch" },
        { type: "perf", release: "patch" },
        { type: "revert", release: "patch" },
        { type: "refactor", release: "patch" },
        { type: "docs", release: false },
        { type: "style", release: false },
        { type: "test", release: false },
        { type: "build", release: false },
        { type: "ci", release: false },
        { type: "chore", release: false }
      ]
    }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/github", {}]
  ]
};
