class Kubsome < Formula
  include Language::Python::Virtualenv

  desc "AI-native Kubernetes Operational Workspace"
  homepage "https://github.com/aloketewary/kubsome"
  url "https://files.pythonhosted.org/packages/source/k/kubsome/kubsome-1.12.1.tar.gz"
  sha256 "1dde3b0433f0327a15a30b64ab436eb3f1fa9631c1389e270159ca84c381798f"
  license "MIT"

  depends_on "python@3.12"
  depends_on "kubernetes-cli" => :recommended

  resource "rich" do
    url "https://files.pythonhosted.org/packages/source/r/rich/rich-13.9.4.tar.gz"
    sha256 "439594978a49a09530cff7ebc4b5c7103ef57baf48d5ea3184f21d9a2befa098"
  end

  resource "prompt-toolkit" do
    url "https://files.pythonhosted.org/packages/source/p/prompt_toolkit/prompt_toolkit-3.0.48.tar.gz"
    sha256 "d6623ab0477a80df74e646bdbc93621143f5caf104206aa29294d53de1a03d90"
  end

  resource "questionary" do
    url "https://files.pythonhosted.org/packages/source/q/questionary/questionary-2.0.1.tar.gz"
    sha256 "bcce898bf3dbb446ff62830c86c5c6fb9a22a54146f0f5597d3da43b10d8fc8b"
  end

  resource "rapidfuzz" do
    url "https://files.pythonhosted.org/packages/source/r/rapidfuzz/rapidfuzz-3.10.1.tar.gz"
    sha256 "5a15546d847a915b3f42dc79ef9b0c78b998b4e2c53b252e7166284066585979"
  end

  resource "humanize" do
    url "https://files.pythonhosted.org/packages/source/h/humanize/humanize-4.11.0.tar.gz"
    sha256 "e66f36020a2d5a974c504bd2555cf770621dbdbb6d82f94a6857c0b1ea2608be"
  end

  resource "pyyaml" do
    url "https://files.pythonhosted.org/packages/source/P/PyYAML/pyyaml-6.0.2.tar.gz"
    sha256 "d584d9ec91ad65861cc08d42e834324ef890a082e591037abe114850ff7bbc3e"
  end

  resource "fastapi" do
    url "https://files.pythonhosted.org/packages/source/f/fastapi/fastapi-0.115.6.tar.gz"
    sha256 "9ec46f7addc14ea472958a96aae5b5de65f39721a46aaf5705c480d9a8b76654"
  end

  resource "uvicorn" do
    url "https://files.pythonhosted.org/packages/source/u/uvicorn/uvicorn-0.32.1.tar.gz"
    sha256 "ee9519c246a72b1c084cea8d3b44ed6026e78a4a309cbedae9c37e4cb9fbb175"
  end

  def install
    virtualenv_install_with_resources
  end

  test do
    assert_match "kubsome", shell_output("#{bin}/kubsome --help")
  end
end
