# BackendFiber Server

Backend server for FiberHomeManage application with MongoDB integration for data flow management.

## Features

- **RESTful API** for managing fiber optic building data
- **MongoDB** database with Mongoose ODM
- **Photo uploads** with Multer (JPEG, PNG, GIF support)
- **Offline synchronization** support
- **Technician assignment** management
- **Data validation** with express-validator

## Tech Stack

- Node.js
- Express.js
- MongoDB & Mongoose
- Multer (file uploads)
- Helmet (security)
- Morgan (logging)
- CORS enabled

## Installation

```bash
cd backendfiber
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fiberhomemanage
JWT_SECRET=your_secret_key
NODE_ENV=development
```

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### Health Check
- `GET /api/health` - Server status and database connection

### Buildings
- `GET /api/buildings` - Get all buildings (with filters)
- `GET /api/buildings/:id` - Get single building
- `GET /api/buildings/service/:serviceId` - Get buildings by service
- `POST /api/buildings` - Create new building
- `PUT /api/buildings/:id` - Update building
- `DELETE /api/buildings/:id` - Archive building
- `POST /api/buildings/bulk-update` - Bulk update buildings

### Technicians
- `GET /api/technicians` - Get all technicians
- `GET /api/technicians/:id` - Get single technician
- `POST /api/technicians` - Create technician
- `PUT /api/technicians/:id` - Update technician
- `DELETE /api/technicians/:id` - Deactivate technician

### Assignments
- `GET /api/assignments` - Get all assignments
- `GET /api/assignments/building/:buildingId` - Get building assignments
- `GET /api/assignments/technician/:technicianId` - Get technician assignments
- `POST /api/assignments` - Create assignment
- `POST /api/assignments/bulk` - Bulk create assignments
- `PUT /api/assignments/:id/cancel` - Cancel assignment

### Photos
- `GET /api/photos/building/:buildingId` - Get building photos
- `GET /api/photos/:id` - Get single photo
- `POST /api/photos/upload` - Upload single photo
- `POST /api/photos/upload-multiple` - Upload multiple photos
- `DELETE /api/photos/:id` - Delete photo

### Sync (Offline Support)
- `POST /api/sync` - Sync offline data
- `GET /api/sync/status` - Check sync status
- `POST /api/sync/resolve` - Resolve conflicts

## Data Models

### Building
- idImmeuble (unique)
- idImmeubleSysteme
- Location data (ville, codePostal, coordinates)
- Building characteristics (étages, sous-sol, typologie)
- Fiber connection details (PBO, solution raccordement)
- Client statistics (B2B, B2C counts)
- Syndic information
- Photos (referenced)

### Photo
- id (unique)
- uri, name, type
- building reference
- file metadata (size, mimeType)
- timestamp

### Technician
- id, name, email, phone
- role (technician/supervisor/manager)
- status
- assigned buildings

### Assignment
- building reference
- technician references
- assigned by user
- status (active/completed/cancelled)

## Query Parameters

### Buildings filtering:
- `serviceId` - Filter by service
- `status` - active, archived, pending, inactive
- `ville` - Filter by city
- `search` - Text search in idImmeuble, rueNomNom, syndic
- `page` & `limit` - Pagination

## Error Handling

All errors return JSON format:
```json
{
  "success": false,
  "message": "Error description"
}
```

## File Upload

Photos are stored in `/uploads/photos/` directory.
Maximum file size: 10MB
Supported formats: JPEG, JPG, PNG, GIF

## Database Connection

The server automatically:
- Connects to MongoDB on startup
- Handles connection errors
- Reconnects on disconnection
- Logs connection status

## Testing

Run tests (when implemented):
```bash
npm test
```

## License

MIT
