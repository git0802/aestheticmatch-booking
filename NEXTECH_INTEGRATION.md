# Nextech EMR Integration - Implementation Summary

## Overview
Complete Nextech EMR integration has been implemented following the same workflow as Mindbody integration. Appointments created for practices with Nextech EMR credentials will automatically book to the Nextech EMR system.

## Files Created

### Backend (NestJS)

1. **Nextech Service Files**
   - `src/nextech/nextech.service.ts` - Core Nextech API integration
   - `src/nextech/nextech-client.service.ts` - Practice context and patient management
   - `src/nextech/nextech.controller.ts` - API endpoints for credential validation
   - `src/nextech/nextech.module.ts` - Module configuration

2. **DTOs and Interfaces**
   - `src/nextech/dto/check-credentials.dto.ts` - Credential validation DTO
   - `src/nextech/dto/nextech-response.dto.ts` - Response types
   - `src/nextech/interfaces/client.interface.ts` - Client data interfaces

## Key Features Implemented

### 1. Credential Management
- Encrypted credential storage in `emr_credentials` table
- Fields: baseUrl, username, password, practiceId
- Configuration fields: `nextech_provider_id`, `nextech_location_id`, `nextech_appointment_type_id`
- Credential validation endpoint: `POST /nextech/check-credentials`

### 2. Patient Management
- Automatic patient creation/lookup in Nextech by email
- Patient ID storage in database (`nextech_patient_id` field)
- Patient data sync (name, email, phone, DOB)

### 3. Appointment Booking
- Automatic booking to Nextech when appointment is created
- Required parameters: providerId, locationId, appointmentTypeId, patientId
- Auto-resolution of missing parameters from Nextech API
- Enhanced error messages for troubleshooting

### 4. OAuth Authentication
- Token-based authentication with Nextech API
- Automatic token management and refresh
- Supports practice-specific authentication

## Database Changes

### Schema Updates (prisma/schema.prisma)

```prisma
model EmrCredential {
  // ... existing fields ...
  
  // Nextech-specific configuration fields
  nextechProviderId        String?  @map("nextech_provider_id") @db.VarChar(50)
  nextechLocationId        String?  @map("nextech_location_id") @db.VarChar(50)
  nextechAppointmentTypeId String?  @map("nextech_appointment_type_id") @db.VarChar(50)
}

model Patient {
  // ... existing fields ...
  
  // EMR Patient IDs
  nextechPatientId String? @map("nextech_patient_id") @db.VarChar(100)
}
```

### Migration Required
Run the SQL migration to add Nextech fields:
```bash
cd /home/ubuntu/Workspace/aestheticmatch/aestheticmatch-booking
psql $DATABASE_URL -f prisma/migrations/add_nextech_fields.sql
npx prisma generate
```

## Module Integration

### Updated Modules
1. **AppModule** - Added NextechModule import
2. **AppointmentsModule** - Added NextechModule import
3. **AppointmentsService** - Integrated Nextech booking logic

### Booking Workflow
1. Check for Mindbody credentials → attempt Mindbody booking
2. If no Mindbody booking, check for Nextech credentials → attempt Nextech booking
3. Create appointment record with EMR appointment ID

## API Endpoints

### Nextech Credential Validation
```
POST /nextech/check-credentials
Body: {
  baseUrl: string
  username: string
  password: string
  practiceId?: string
}
Response: {
  success: boolean
  token?: string
  expiresAt?: string
  error?: string
}
```

## Frontend Integration (Required Next Steps)

### 1. Add Nextech Config to Practice Forms

Update `v0-aesthetic-match-booking-tool/components/add-practice-dialog.tsx`:

```typescript
// Add state
const [nextechConfig, setNextechConfig] = useState({
  providerId: '',
  locationId: '',
  appointmentTypeId: ''
});

// Add UI fields (similar to mindbodyConfig)
{emrType === 'NEXTECH' && (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="nextech-provider-id">Nextech Provider ID</Label>
      <Input
        id="nextech-provider-id"
        value={nextechConfig.providerId}
        onChange={(e) => setNextechConfig({
          ...nextechConfig,
          providerId: e.target.value
        })}
        placeholder="Enter provider ID"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="nextech-location-id">Nextech Location ID</Label>
      <Input
        id="nextech-location-id"
        value={nextechConfig.locationId}
        onChange={(e) => setNextechConfig({
          ...nextechConfig,
          locationId: e.target.value
        })}
        placeholder="Enter location ID"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="nextech-appointment-type-id">Nextech Appointment Type ID</Label>
      <Input
        id="nextech-appointment-type-id"
        value={nextechConfig.appointmentTypeId}
        onChange={(e) => setNextechConfig({
          ...nextechConfig,
          appointmentTypeId: e.target.value
        })}
        placeholder="Enter appointment type ID"
      />
    </div>
  </div>
)}

// In form submission, include nextechConfig in emrCredentials object
```

### 2. Update Edit Practice Dialog
Apply the same changes to `edit-practice-dialog.tsx`

### 3. Update Types
Add Nextech config to practice types:

```typescript
interface NextechConfig {
  providerId?: string;
  locationId?: string;
  appointmentTypeId?: string;
}

interface CreatePracticeRequest {
  // ... existing fields ...
  nextechConfig?: NextechConfig;
}
```

## Environment Variables (Optional)

Add to `.env` for default Nextech credentials:
```env
NEXTECH_BASE_URL=https://api.nextech.com
NEXTECH_USERNAME=your_username
NEXTECH_PASSWORD=your_password
NEXTECH_PRACTICE_ID=your_practice_id
```

## Testing Checklist

- [ ] Run database migration to add Nextech fields
- [ ] Regenerate Prisma client
- [ ] Restart backend server
- [ ] Add Nextech EMR credentials for a practice
- [ ] Configure providerId, locationId, appointmentTypeId
- [ ] Create appointment for practice with Nextech EMR
- [ ] Verify appointment is created in Nextech
- [ ] Check patient is created/updated in Nextech
- [ ] Verify error messages are helpful

## Error Handling

The integration includes comprehensive error handling:
- Missing credential validation
- Patient creation failures
- Appointment booking failures
- Parameter resolution failures
- Enhanced error messages with troubleshooting steps

## Logging

All Nextech operations are logged:
- Credential decryption
- Patient creation/lookup
- Parameter resolution
- Booking attempts and results
- Error details

## Next Steps

1. **Apply Database Migration**
   ```bash
   cd /home/ubuntu/Workspace/aestheticmatch/aestheticmatch-booking
   psql $DATABASE_URL -f prisma/migrations/add_nextech_fields.sql
   npx prisma generate
   npm run build
   ```

2. **Update Frontend Forms**
   - Add nextechConfig state and UI fields to practice dialogs
   - Update API calls to include Nextech configuration

3. **Test Integration**
   - Add Nextech credentials for a test practice
   - Create test appointments
   - Verify booking in Nextech EMR

4. **Monitor Logs**
   - Check backend logs for Nextech operations
   - Verify patient IDs are being stored
   - Confirm appointment IDs are returned

## Architecture Notes

- Follows same pattern as Mindbody integration for consistency
- Provider-agnostic appointment service
- Encrypted credential storage
- Automatic patient synchronization
- Configurable per-practice EMR settings
