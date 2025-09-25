# Stockholm Datacenters API

**Base URL**: `http://localhost:3001`  
**API Version**: `v1`

## Overview

REST API for managing datacenters, virtual machines, and migration operations in the Stockholm Datacenters application.

## Core Endpoints

### Datacenters

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/datacenters` | Get all datacenters with VMs |
| `GET` | `/api/v1/status` | Get system statistics |

### VM Migration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/migrate` | Migrate specific VM |
| `GET` | `/api/v1/migrate` | Auto-migrate random VM |

### Migration Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/migrations` | Get all migrations |
| `GET` | `/api/v1/migrations/active` | Get active migrations only |
| `GET` | `/api/v1/migrations/:id` | Get specific migration |
| `GET` | `/api/v1/migrations/datacenter/:dcId` | Get migrations by datacenter |
| `GET` | `/api/v1/migrations/vm/:vmName` | Get migrations by VM |
| `GET` | `/api/v1/migrations/direction/:direction` | Get migrations by direction |

### Admin Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/datacenters` | Get admin datacenter view |
| `PATCH` | `/api/v1/admin/datacenters/:id` | Update datacenter |
| `PATCH` | `/api/v1/admin/datacenters/:dcId/vms/:vmId` | Update VM |
| `POST` | `/api/v1/admin/datacenters/:dcId/vms` | Add VM |
| `DELETE` | `/api/v1/admin/datacenters/:dcId/vms/:vmId` | Remove VM |

## Data Models

### Datacenter

```json
{
  "id": "dc-solna",
  "name": "Solna Datacenter", 
  "location": "Solna, Sweden",
  "coordinates": [59.3606, 17.9931],
  "clusters": ["vulcan"],
  "vms": []
}
```

### Virtual Machine

```json
{
  "id": "vm-123",
  "name": "test-vm",
  "status": "running",
  "cpu": 2,
  "memory": 4096,
  "disk": 100,
  "migrationStatus": "migrating",
  "cluster": "vulcan",
  "namespace": "default",
  "phase": "Running",
  "ready": true
}
```

### Migration

```json
{
  "id": "migration-123",
  "vmId": "vm-123", 
  "vmName": "test-vm",
  "phase": "Running",
  "direction": "incoming",
  "sourceCluster": "vulcan",
  "targetCluster": "borg",
  "datacenterId": "dc-solna",
  "startTime": "2025-09-25T10:00:00Z",
  "completed": false
}
```

## Common Usage Examples

### Get System Status

```bash
curl http://localhost:3001/api/v1/status
```

### View All Datacenters

```bash
curl http://localhost:3001/api/v1/datacenters
```

### Migrate VM

```bash
curl -X POST http://localhost:3001/api/v1/migrate \
  -H "Content-Type: application/json" \
  -d '{"vmId":"vm-123","fromDC":"dc-solna","toDC":"dc-sollentuna"}'
```

### Auto-Migrate (Dry Run)

```bash
curl http://localhost:3001/api/v1/migrate?dry-run=1
```

### Get Active Migrations

```bash
curl http://localhost:3001/api/v1/migrations/active
```

### Add New VM (Admin)

```bash
curl -X POST http://localhost:3001/api/v1/admin/datacenters/dc-solna/vms \
  -H "Content-Type: application/json" \
  -d '{"id":"vm-new","name":"New VM","status":"running","cpu":2,"memory":4096}'
```

## Migration Status Values

**Phases**: `Pending`, `Running`, `Succeeded`, `Failed`, `Scheduling`, `Preparing`

**Directions**: `incoming`, `outgoing`, `unknown`

**VM Status**: `running`, `stopped`, `migrating`, `waitingforreceiver`, `starting`

## Error Responses

```json
{
  "error": "error description"
}
```

Common HTTP status codes: `200`, `204`, `400`, `404`, `500`

## Health Check

```bash
curl http://localhost:3001/health
```

Returns:

```json
{
  "status": "healthy",
  "service": "backend-api"
}
```