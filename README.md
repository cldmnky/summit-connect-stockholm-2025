# Stockholm Datacenters Map

A modern single-page application that visualizes Stockholm County with interactive datacenter locations and VM distribution using **Leaflet.js** for real map rendering. The application features a Go-based backend API server using Fiber framework and Cobra CLI.

## Features

- 🗺️ **Real Stockholm County map** using OpenStreetMap and satellite imagery
- 🔄 **Switchable map layers** (Street view / Satellite view)
- 🏢 Two fictive datacenter locations with real-time data
- 💾 VM activity visualization with pulsing circles
- 📊 Live statistics panel with real-time updates
- 📱 Responsive design for desktop and mobile
- ⚡ Real-time VM migration simulation
- 🎨 Modern gradient design with smooth animations
- 🔍 Interactive popups with detailed datacenter information
- 🚀 **Go backend API** with automatic VM migration and data persistence
- 🔍 **KubeVirt VM Watcher** - Monitor real VMs across multiple Kubernetes clusters
- ☸️ **Multi-cluster support** - Watch VMs across different Kubernetes/OpenShift clusters

## Technology Stack

### Frontend
- **Leaflet.js v1.9.4** - Interactive maps with real tile layers
- **OpenStreetMap** - Default street map tiles
- **Esri Satellite** - High-quality satellite imagery
- **Vanilla JavaScript** - No framework dependencies
- **CSS3** - Modern styling with animations and grid layout
- **HTML5** - Semantic markup

### Backend
- **Go** - High-performance backend server
- **Fiber v2** - Fast HTTP web framework
- **Cobra** - Modern CLI framework
- **JSON** - Data persistence and API responses

## Getting Started

### Prerequisites

- **Go 1.21+** - for building and running the backend server
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd summit-connect-stockholm-2025
```

2. Build the Go application:
```bash
make build
```

### Running the Application

#### Development Mode (Recommended)
Start the server with hot reloading for development:
```bash
make dev
```
This will:
- Install air for hot reloading if not present
- Watch for code changes and automatically restart the server
- Serve both frontend and API from http://localhost:3001

#### Production Mode
Start the server in background:
```bash
make start
```

#### Other Commands
```bash
# Stop the server
make stop

# Check server status
make status

# View server logs
make logs

# Clean up logs and temporary files
make clean

# Show all available commands
make help
```

### Manual Server Start
You can also start the server directly:
```bash
# Build the application
go build -o summit-connect

# Start the backend server (serves both API and frontend)
./summit-connect serve backend --port 3001

# Start with KubeVirt VM watcher enabled
./summit-connect serve backend --watch-vms
```

## VM Watcher (KubeVirt Integration)

The application includes a powerful VM watcher that can monitor real KubeVirt Virtual Machines across multiple Kubernetes clusters. This feature bridges the gap between the simulation and real infrastructure.

### Features
- **Multi-cluster monitoring**: Watch VMs across multiple Kubernetes/OpenShift clusters
- **Real-time synchronization**: Automatic database updates when VMs change
- **Resource extraction**: CPU, memory, disk, and network information
- **Graceful error handling**: Continues running even if some clusters are unavailable

### Setup
1. Configure clusters in `config/datacenters.yaml`
2. Place kubeconfig files in `config/.kubeconfigs/`
3. Start server with `--watch-vms` flag

For detailed setup instructions, see [WATCHER.md](./WATCHER.md).

## API Endpoints

The Go backend provides the following REST API endpoints:

- `GET /` - Frontend application
- `GET /api/v1/datacenters` - List all datacenters and VMs
- `POST /api/v1/migrate` - Migrate a specific VM between datacenters
- `GET /api/v1/migrate[?dry-run=1]` - Auto-migrate a random VM (supports dry-run)
- `GET /api/v1/status` - Get system status and statistics
- `GET /health` - Health check endpoint

### Example API Usage

```bash
# Get all datacenters
curl http://localhost:3001/api/v1/datacenters

# Auto-migrate a VM (dry-run)
curl "http://localhost:3001/api/v1/migrate?dry-run=1"

# Auto-migrate a VM (actual migration)
curl http://localhost:3001/api/v1/migrate

# Migrate a specific VM
curl -X POST http://localhost:3001/api/v1/migrate \
  -H "Content-Type: application/json" \
  -d '{"vmId":"vm-001","fromDC":"dc1","toDC":"dc2"}'

# Get system status
curl http://localhost:3001/api/v1/status
```

## Application URLs

When running:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3001/api/v1
- **Health Check**: http://localhost:3001/health

## Datacenters

The application displays two fictive datacenters with sample VMs:

### Stockholm North DC
- **Location**: Kista, Stockholm
- **ID**: dc-stockholm-north
- **Coordinates**: 59.4036°N, 17.9441°E

### Stockholm South DC
- **Location**: Södermalm, Stockholm
- **ID**: dc-stockholm-south
- **Coordinates**: 59.3181°N, 18.0755°E

## Data Persistence

- VM and datacenter data is stored in `frontend/datacenters.json`
- Data is automatically saved after each migration
- Sample data is initialized on first startup
- Data persists across server restarts

## Development

### Project Structure
```
├── cmd/                    # Cobra CLI commands
│   ├── root.go            # Root command
│   └── serve.go           # Serve command
├── internal/              # Internal Go packages
│   ├── data/              # Data layer
│   ├── models/            # Data models
│   └── server/            # HTTP server
├── frontend/              # Frontend static files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styles
│   ├── app.js             # JavaScript application
│   └── datacenters.json   # Data file
├── main.go                # Application entry point
├── Makefile               # Build and development commands
└── README.md              # This file
```

### Hot Reloading
The `make dev` command provides hot reloading using [air](https://github.com/air-verse/air):
- Automatically rebuilds on Go code changes
- Restarts the server when files change
- Watches Go files, HTML, CSS, and JavaScript
- Perfect for development workflow

### Building
```bash
# Build for current OS
make build

# Build for different OS (manual)
GOOS=linux GOARCH=amd64 go build -o summit-connect-linux
GOOS=windows GOARCH=amd64 go build -o summit-connect.exe
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Performance Notes

- Go backend provides high-performance API responses
- Efficient JSON serialization for data transfer
- Frontend uses optimized D3.js rendering
- Animations are CSS-based for optimal performance
- Real-time updates are throttled to prevent excessive rendering

## License

This project is open source and available under the MIT License.