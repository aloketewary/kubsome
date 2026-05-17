class Kubsome < Formula
  include Language::Python::Virtualenv

  desc "AI-native Kubernetes Operational Workspace"
  homepage "https://github.com/aloketewary/kubsome"
  url "https://files.pythonhosted.org/packages/source/k/kubsome/kubsome-1.12.1.tar.gz"
  sha256 "1dde3b0433f0327a15a30b64ab436eb3f1fa9631c1389e270159ca84c381798f"
  license "MIT"

  depends_on "python@3.12"

  def install
    venv = virtualenv_create(libexec, "python3.12")
    venv.pip_install resource("kubsome") if resources.any?
    venv.pip_install buildpath
    bin.install_symlink Dir[libexec/"bin/kubsome"]
  end

  test do
    assert_match "kubsome", shell_output("#{bin}/kubsome --help", 1)
  end
end
