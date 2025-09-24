// Migration Detection Enhancement for VM Watcher

/*
MIGRATION DETECTION STRATEGY:

1. **VM Identity Tracking**
   - VMs are uniquely identified by Name (which becomes ID)  
   - Track both Datacenter AND Cluster for each VM
   - Store previous cluster info to detect changes

2. **Detection Mechanisms**
   
   A. **Cross-Cluster Watch Events**
      - VM appears in new cluster (watch.Added)
      - VM disappears from old cluster (watch.Deleted) 
      - Same VM ID across different clusters = MIGRATION

   B. **Cluster Field Changes**
      - When VM.Cluster changes during watch.Modified event
      - Compare previous vs current cluster assignment

   C. **Periodic Cross-Cluster Correlation**
      - Periodically check all VMs across all clusters
      - Find VMs with same ID/Name in different clusters
      - Detect temporal migration patterns

3. **Migration Metadata**
   - Enhance VM model with migration tracking fields:
     - LastMigratedAt (already exists)  
     - PreviousCluster 
     - MigrationId (to correlate delete/add events)
     - MigrationStatus (in-progress, completed, failed)

4. **Implementation Approach**

   A. **VM Watcher Enhancement**
      - Track VM cluster assignments in memory
      - Detect cluster changes on watch events
      - Implement cross-cluster correlation logic

   B. **Migration Event Service** 
      - Dedicated service to detect migrations
      - Correlate delete/add events across clusters
      - Generate migration events for frontend

   C. **Enhanced Data Model**
      - Add migration fields to VM model
      - Store migration history in database
      - API endpoints for migration data

5. **Edge Cases to Handle**
   - VM deletion vs migration (timeout-based detection)
   - Simultaneous VMs with same name in different clusters
   - Network partitions causing false migration detection
   - VM name changes during migration
*/