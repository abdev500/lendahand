# Infra-Cluster Helm Chart

Cluster-scoped infrastructure components that should be installed **once per cluster**.

## Components

- **ingress-nginx**: Kubernetes Ingress Controller (cluster-scoped resource)

## Installation

This chart should be installed **once per cluster**, typically in the `kube-system` or `default` namespace:

```bash
# Install in kube-system namespace (recommended for cluster-wide resources)
helm upgrade --install infra-cluster devops/infra-cluster -n kube-system

# Or install in default namespace
helm upgrade --install infra-cluster devops/infra-cluster -n default
```

## Important Notes

- **Install once per cluster**: This chart creates cluster-scoped resources (ClusterRoles, ClusterRoleBindings, ValidatingWebhookConfiguration, etc.)
- **One ingress controller for all namespaces**: The ingress-nginx controller can handle Ingress resources from any namespace in the cluster
- **Namespace doesn't matter**: While you install this in a specific namespace, the ingress controller works across all namespaces

## Usage in Other Namespaces

Other Helm charts (like `infra` or `lendahand`) installed in different namespaces can reference this ingress controller by using the `ingressClassName: nginx` annotation in their Ingress resources.

Example Ingress resource:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
spec:
  ingressClassName: nginx  # Uses the shared ingress controller
  rules:
    - host: my-app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

## Updating Dependencies

To update the ingress-nginx dependency:

```bash
cd devops/infra-cluster
helm dependency update
```

## Configuration

Edit `values.yaml` to customize ingress-nginx settings:

- LoadBalancer IP
- Service annotations
- Controller replicas
- Resource limits
- etc.

## Uninstallation

To remove the cluster infrastructure:

```bash
helm uninstall infra-cluster -n kube-system  # or -n default
```

**Warning**: Uninstalling this will affect all namespaces that use the ingress controller!
