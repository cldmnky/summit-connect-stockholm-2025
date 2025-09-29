package cmd

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	authv1 "k8s.io/api/authentication/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/yaml"
)

// kubeconfigCmd generates a kubeconfig that authenticates using a token
// obtained via the TokenRequest API for a specified ServiceAccount.
var kubeconfigCmd = &cobra.Command{
	Use:   "kubeconfig",
	Short: "kubeconfig utilities",
	Long:  "Utilities for generating kubeconfigs from ServiceAccounts and tokens",
}

// Defaults used when flags are not provided
var (
	defaultSAName        = "sa-summit-connect"
	defaultNamespace     = "summit-connect"
	defaultGeneratedName = "sa-summit-connect"
)

var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate a kubeconfig for a ServiceAccount",
	RunE: func(cmd *cobra.Command, args []string) error {
		outPath, _ := cmd.Flags().GetString("out")
		name, _ := cmd.Flags().GetString("name")
		saName, _ := cmd.Flags().GetString("service-account-name")
		namespace, _ := cmd.Flags().GetString("namespace")
		serverFlag, _ := cmd.Flags().GetString("server")
		caPathFlag, _ := cmd.Flags().GetString("ca-path")

		// Use defaults if not provided
		if saName == "" {
			saName = defaultSAName
		}
		if namespace == "" {
			namespace = defaultNamespace
		}
		if name == "" {
			name = defaultGeneratedName
		}

		// Load user's kubeconfig (respects KUBECONFIG env and defaults to ~/.kube/config)
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		configOverrides := &clientcmd.ConfigOverrides{}
		clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

		rawCfg, err := clientConfig.RawConfig()
		if err != nil {
			return fmt.Errorf("failed to load kubeconfig: %w", err)
		}

		// Determine cluster/server and CA from current context
		current := rawCfg.CurrentContext
		if current == "" {
			return fmt.Errorf("no current context found in kubeconfig")
		}
		ctx, ok := rawCfg.Contexts[current]
		if !ok || ctx == nil {
			return fmt.Errorf("current context %s not found in kubeconfig", current)
		}
		clusterName := ctx.Cluster
		if clusterName == "" {
			return fmt.Errorf("no cluster set for current context %s", current)
		}
		cluster, ok := rawCfg.Clusters[clusterName]
		if !ok || cluster == nil {
			return fmt.Errorf("cluster %s not found in kubeconfig", clusterName)
		}
		server := cluster.Server
		// override server if flag provided
		if serverFlag != "" {
			server = serverFlag
		}
		if server == "" {
			return fmt.Errorf("server not found in kubeconfig cluster %s; you can pass --server to override", clusterName)
		}

		var caData []byte
		caProvided := false
		// If user provided a ca-path, prefer that
		if caPathFlag != "" {
			if b, err := os.ReadFile(caPathFlag); err == nil {
				caData = b
				caProvided = true
			} else {
				return fmt.Errorf("failed to read CA from %s: %w", caPathFlag, err)
			}
		} else {
			if len(cluster.CertificateAuthorityData) > 0 {
				caData = cluster.CertificateAuthorityData
				caProvided = true
			} else if cluster.CertificateAuthority != "" {
				if b, err := os.ReadFile(cluster.CertificateAuthority); err == nil {
					caData = b
					caProvided = true
				}
			}
		}

		// If no CA provided, accept insecure-skip-tls-verify from the cluster entry as a valid fallback
		if !caProvided && !cluster.InsecureSkipTLSVerify {
			return fmt.Errorf("certificate authority data not found for cluster %s in kubeconfig; provide --ca-path or embed certs in kubeconfig, or set insecure-skip-tls-verify: true in the cluster entry", clusterName)
		}

		// Build a client to the target cluster using the user's kubeconfig
		restCfg, err := clientConfig.ClientConfig()
		if err != nil {
			return fmt.Errorf("failed to build rest config from kubeconfig: %w", err)
		}
		clientset, err := kubernetes.NewForConfig(restCfg)
		if err != nil {
			return fmt.Errorf("failed to create kubernetes client: %w", err)
		}

		// Build audiences using the rest config host and common API audience names to avoid
		// token audience mismatches which can cause the API server to reject the token.
		audiences := []string{restCfg.Host, "api", "kubernetes.default.svc", "https://kubernetes.default.svc"}

		// Create a TokenRequest for the service account
		tr := &authv1.TokenRequest{
			Spec: authv1.TokenRequestSpec{
				Audiences: audiences,
				// Set 1 year expiration for long-lived tokens (adjust as needed)
				ExpirationSeconds: func() *int64 { t := int64(31536000); return &t }(),
			},
		}

		ctxTimeout, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		tokenResp, err := clientset.CoreV1().ServiceAccounts(namespace).CreateToken(ctxTimeout, saName, tr, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create token for serviceaccount %s/%s: %w", namespace, saName, err)
		}

		token := tokenResp.Status.Token

		// build kubeconfig data structure
		// user name should be <service-account-name>-<namespace>
		userName := fmt.Sprintf("%s-%s", saName, namespace)
		// cluster entry: include certificate-authority-data if available, otherwise mark insecure-skip-tls-verify
		clusterEntry := map[string]any{
			"server": server,
		}
		if caProvided {
			clusterEntry["certificate-authority-data"] = base64.StdEncoding.EncodeToString(caData)
		} else {
			clusterEntry["insecure-skip-tls-verify"] = true
		}

		outCfg := map[string]any{
			"apiVersion": "v1",
			"kind":       "Config",
			"clusters": []map[string]any{
				{
					"name":    name,
					"cluster": clusterEntry,
				},
			},
			"users": []map[string]any{
				{
					"name": userName,
					"user": map[string]any{
						"token": token,
					},
				},
			},
			"contexts": []map[string]any{
				{
					"name": name + "@" + name,
					"context": map[string]any{
						"cluster":   name,
						"user":      userName,
						"namespace": namespace,
					},
				},
			},
			"current-context": name + "@" + name,
		}

		outBytes, err := yaml.Marshal(outCfg)
		if err != nil {
			return fmt.Errorf("failed to marshal kubeconfig: %w", err)
		}

		if outPath == "" {
			fmt.Print(string(outBytes))
			return nil
		}

		if err := os.MkdirAll(filepath.Dir(outPath), 0o700); err != nil {
			return fmt.Errorf("failed to create directory for %s: %w", outPath, err)
		}
		if err := os.WriteFile(outPath, outBytes, 0o600); err != nil {
			return fmt.Errorf("failed to write kubeconfig to %s: %w", outPath, err)
		}

		fmt.Printf("Wrote kubeconfig to %s\n", outPath)
		return nil
	},
}

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Create namespace and ServiceAccount for kubeconfig generation",
	RunE: func(cmd *cobra.Command, args []string) error {
		saName, _ := cmd.Flags().GetString("service-account-name")
		namespace, _ := cmd.Flags().GetString("namespace")

		// Use defaults if not provided
		if saName == "" {
			saName = defaultSAName
		}
		if namespace == "" {
			namespace = defaultNamespace
		}

		// Load kubeconfig and build client
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		configOverrides := &clientcmd.ConfigOverrides{}
		clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
		restCfg, err := clientConfig.ClientConfig()
		if err != nil {
			return fmt.Errorf("failed to build rest config from kubeconfig: %w", err)
		}
		clientset, err := kubernetes.NewForConfig(restCfg)
		if err != nil {
			return fmt.Errorf("failed to create kubernetes client: %w", err)
		}

		// Ensure namespace exists
		nsClient := clientset.CoreV1().Namespaces()
		if _, err := nsClient.Get(context.Background(), namespace, metav1.GetOptions{}); err != nil {
			// create namespace
			_, err := nsClient.Create(context.Background(), &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: namespace}}, metav1.CreateOptions{})
			if err != nil {
				return fmt.Errorf("failed to create namespace %s: %w", namespace, err)
			}
			fmt.Printf("Created namespace %s\n", namespace)
		} else {
			fmt.Printf("Namespace %s already exists\n", namespace)
		}

		// Ensure ServiceAccount exists
		saClient := clientset.CoreV1().ServiceAccounts(namespace)
		if _, err := saClient.Get(context.Background(), saName, metav1.GetOptions{}); err != nil {
			_, err := saClient.Create(context.Background(), &corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: saName}}, metav1.CreateOptions{})
			if err != nil {
				return fmt.Errorf("failed to create serviceaccount %s/%s: %w", namespace, saName, err)
			}
			fmt.Printf("Created serviceaccount %s/%s\n", namespace, saName)
		} else {
			fmt.Printf("ServiceAccount %s/%s already exists\n", namespace, saName)
		}

		// Create ClusterRole with permissions required by the watcher
		// The watcher needs to list/watch VirtualMachine and VirtualMachineInstanceMigration
		// which are provided by the KubeVirt API group. We'll grant get/list/watch on these
		// resources as well as pods and persistentvolumeclaims for enriching VM info.
		crName := fmt.Sprintf("summit-connect-watcher-%s", saName)
		crClient := clientset.RbacV1().ClusterRoles()
		clusterRole := &rbacv1.ClusterRole{
			ObjectMeta: metav1.ObjectMeta{Name: crName},
			Rules: []rbacv1.PolicyRule{
				// KubeVirt resources (group: kubevirt.io)
				{
					APIGroups: []string{"kubevirt.io"},
					Resources: []string{"virtualmachines", "virtualmachineinstancemigrations", "virtualmachineinstances"},
					Verbs:     []string{"get", "list", "watch"},
				},
				// Core resources used for enrichment
				{
					APIGroups: []string{""},
					Resources: []string{"pods", "persistentvolumeclaims"},
					Verbs:     []string{"get", "list", "watch"},
				},
			},
		}
		if _, err := crClient.Get(context.Background(), crName, metav1.GetOptions{}); err != nil {
			if apierrors.IsNotFound(err) {
				if _, err := crClient.Create(context.Background(), clusterRole, metav1.CreateOptions{}); err != nil {
					return fmt.Errorf("failed to create ClusterRole %s: %w", crName, err)
				}
				fmt.Printf("Created ClusterRole %s\n", crName)
			} else {
				return fmt.Errorf("failed to get ClusterRole %s: %w", crName, err)
			}
		} else {
			fmt.Printf("ClusterRole %s already exists\n", crName)
		}

		// Create ClusterRoleBinding associating the ClusterRole to the ServiceAccount
		crbName := fmt.Sprintf("summit-connect-watcher-bind-%s-%s", saName, namespace)
		crbClient := clientset.RbacV1().ClusterRoleBindings()
		crb := &rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{Name: crbName},
			Subjects: []rbacv1.Subject{{
				Kind:      "ServiceAccount",
				Name:      saName,
				Namespace: namespace,
			}},
			RoleRef: rbacv1.RoleRef{
				APIGroup: "rbac.authorization.k8s.io",
				Kind:     "ClusterRole",
				Name:     crName,
			},
		}
		if _, err := crbClient.Get(context.Background(), crbName, metav1.GetOptions{}); err != nil {
			if apierrors.IsNotFound(err) {
				if _, err := crbClient.Create(context.Background(), crb, metav1.CreateOptions{}); err != nil {
					return fmt.Errorf("failed to create ClusterRoleBinding %s: %w", crbName, err)
				}
				fmt.Printf("Created ClusterRoleBinding %s\n", crbName)
			} else {
				return fmt.Errorf("failed to get ClusterRoleBinding %s: %w", crbName, err)
			}
		} else {
			fmt.Printf("ClusterRoleBinding %s already exists\n", crbName)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(kubeconfigCmd)
	kubeconfigCmd.AddCommand(generateCmd)
	kubeconfigCmd.AddCommand(setupCmd)

	generateCmd.Flags().StringP("out", "o", "", "Output path for generated kubeconfig (defaults to stdout)")
	generateCmd.Flags().StringP("name", "N", defaultGeneratedName, "Name to use for cluster/context/user in the generated kubeconfig")
	generateCmd.Flags().String("service-account-name", defaultSAName, "ServiceAccount name to request a token for")
	generateCmd.Flags().String("namespace", defaultNamespace, "Namespace of the ServiceAccount")

	setupCmd.Flags().String("service-account-name", defaultSAName, "ServiceAccount name to create")
	setupCmd.Flags().String("namespace", defaultNamespace, "Namespace to create the ServiceAccount in")
}
