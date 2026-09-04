from api.routes.terminal import _is_allowed


def test_terminal_rejects_prefix_collision():
    assert not _is_allowed("kubectlevil get pods")
    assert not _is_allowed("helpful")


def test_terminal_allows_read_only_kubectl():
    assert _is_allowed("kubectl get pods")
    assert _is_allowed("k describe deployment/api")


def test_terminal_rejects_direct_kubectl_mutations():
    assert not _is_allowed("kubectl delete pod/api")
    assert not _is_allowed("kubectl exec pod/api -- sh")
    assert not _is_allowed("kubectl config use-context production")
    assert not _is_allowed("kubectl auth reconcile -f policy.yaml")
