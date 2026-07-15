class Feuilleton < Formula
  desc "Inline Bash visualizations for Codex and Claude Code"
  homepage "https://github.com/toxyduck/feuilleton"
  version "VERSION"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/toxyduck/feuilleton/releases/download/vVERSION/feuilleton-bun-darwin-arm64.tar.gz"
      sha256 "DARWIN_ARM64_SHA256"
    else
      url "https://github.com/toxyduck/feuilleton/releases/download/vVERSION/feuilleton-bun-darwin-x64.tar.gz"
      sha256 "DARWIN_X64_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/toxyduck/feuilleton/releases/download/vVERSION/feuilleton-bun-linux-arm64.tar.gz"
      sha256 "LINUX_ARM64_SHA256"
    else
      url "https://github.com/toxyduck/feuilleton/releases/download/vVERSION/feuilleton-bun-linux-x64-baseline.tar.gz"
      sha256 "LINUX_X64_SHA256"
    end
  end

  def install
    bin.install "bin/ftn", "bin/ftn-codex", "bin/ftn-plot", "bin/ftn-tree", "bin/ftn-graph"
    (share/"feuilleton").install "share/feuilleton/integrations"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/ftn --version")
  end
end
