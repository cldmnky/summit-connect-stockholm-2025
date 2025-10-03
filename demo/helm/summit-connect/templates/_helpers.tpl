{{/*
Expand the name of the chart.
*/}}
{{- define "summit-connect.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "summit-connect.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "summit-connect.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "summit-connect.labels" -}}
helm.sh/chart: {{ include "summit-connect.chart" . }}
{{ include "summit-connect.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "summit-connect.selectorLabels" -}}
app.kubernetes.io/name: {{ include "summit-connect.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}



{{/*
Generate VM name based on values or release name
*/}}
{{- define "summit-connect.vmName" -}}
{{- if empty .Values.vm.name -}}
{{- include "summit-connect.fullname" . -}}
{{- else -}}
{{- .Values.vm.name -}}
{{- end -}}
{{- end -}}

{{/*
Generate a unique MAC address based on release name and namespace
This creates a deterministic but unique MAC address for each deployment
*/}}
{{- define "summit-connect.macAddress" -}}
{{- if .Values.network.macAddress }}
{{- .Values.network.macAddress }}
{{- else }}
{{- $hash := printf "%s-%s" .Release.Name .Release.Namespace | sha256sum }}
{{- printf "02:%s:%s:%s:%s:%s" (substr 0 2 $hash) (substr 2 4 $hash) (substr 4 6 $hash) (substr 6 8 $hash) (substr 8 10 $hash) }}
{{- end }}
{{- end }}
