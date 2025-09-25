# VM Migration Tracking Enhancement

This document describes the enhanced migration tracking capabilities added to the Summit Connect Stockholm 2025 application.

## Overview

The application now tracks VirtualMachineInstanceMigration custom resources from KubeVirt clusters and provides detailed migration information through both the backend API and frontend interface.

## Backend Features

### New Migration Watcher
- **VirtualMachineInstanceMigration Watcher**: Watches for VMIM CRs across all configured clusters
- **Real-time Updates**: Migration status is updated in real-time as phases change
- **Persistent Storage**: Migration data is stored in BoltDB for historical tracking

### Migration Data Model
The `Migration` struct captures comprehensive migration information:
- Migration ID and VM details
- Phase transitions with timestamps
- Source and target node information
- Duration tracking
- Labels and metadata from Kubernetes

### API Endpoints
New REST endpoints for migration data:
- `GET /api/v1/migrations` - Get all migrations
- `GET /api/v1/migrations/active` - Get only active migrations
- `GET /api/v1/migrations/:id` - Get specific migration by ID
- `GET /api/v1/migrations/datacenter/:dcId` - Get migrations for a datacenter
- `GET /api/v1/migrations/vm/:vmName` - Get migrations for a specific VM

## Frontend Features

### Migration Panel
A new migration panel in the right sidebar displays:
- **Active migrations** with real-time status
- **Migration history** with filtering options
- **Phase transitions** and timing information
- **Source/target node** information

### Enhanced VM Status
VM entries now show:
- Migration status indicators
- Source and target information during migrations
- Enhanced migration state detection

### Auto-refresh
The migration data is automatically refreshed every 5 seconds along with VM data.

## Migration Phases Tracked

The system tracks all KubeVirt migration phases:
- **WaitingForSync** - Initial preparation
- **Pending** - Migration queued
- **Scheduling** - Finding target node
- **Scheduled** - Target node selected
- **PreparingTarget** - Setting up target
- **TargetReady** - Target prepared
- **Running** - Migration in progress
- **Succeeded** - Migration completed successfully
- **Failed** - Migration failed

## Usage Example

1. **View Active Migrations**: Check the "Active Migrations" panel in the frontend
2. **Filter Migrations**: Use the dropdown to show active, completed, or all migrations
3. **Migration Details**: Click on a migration to see detailed information
4. **API Access**: Query migration data programmatically via REST endpoints

## Technical Details

### Database Schema
Migrations are stored in a separate BoltDB bucket (`migrations`) with the migration ID as the key.

### Watcher Implementation
- Separate goroutines for VM and migration watching
- Resilient to network interruptions with automatic restart
- Efficient initial sync and incremental updates

### Frontend Integration
- Migration data is loaded asynchronously
- UI updates happen automatically with data refreshes
- Responsive design with proper error handling

## Migration Detection Example

When a VMIM CR like this is created:
```yaml
apiVersion: kubevirt.io/v1
kind: VirtualMachineInstanceMigration
metadata:
  name: forklift-6xkww
  namespace: 00-test
spec:
  vmiName: leech-johan
status:
  phase: Running
  migrationState:
    sourceNode: planet-01
    targetNode: c-node-01.codell.io
    startTimestamp: '2025-09-25T18:35:48Z'
```

The system will:
1. Detect the migration CR
2. Parse migration details
3. Store in database
4. Update frontend display
5. Track phase transitions
6. Show completion when phase becomes "Succeeded"

## Future Enhancements

Potential improvements:
- Migration progress indicators
- Migration performance metrics
- Visual migration flows on the map
- Migration scheduling and planning
- Integration with migration policies