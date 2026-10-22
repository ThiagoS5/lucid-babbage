# Security Specification — Jujutsu Kaisen: Cursed Chronicles VTT

## 1. Data Invariants
1. Every document in `/campaigns/{campaignId}` must have a valid `campaignId` matching `^[a-zA-Z0-9_\-]+$` with length <= 128.
2. Only authenticated users with `request.auth.token.email_verified == true` can create, read, update, or delete their own `/campaigns/{campaignId}` documents.
3. `ownerId` must strictly equal `request.auth.uid` on creation and is immutable (`incoming().ownerId == existing().ownerId`) on update.
4. `createdAt` must equal `request.time` on creation and is immutable (`incoming().createdAt == existing().createdAt`) on update.
5. `updatedAt` must equal `request.time` on both creation and update.
6. All string fields (`title`, `characterName`, `characterGrade`, `arc`, `location`, `campaignPayload`) have strict type and `.size()` limits enforced in `isValidCampaignSave(data)`.
7. `allow list` on `/campaigns/{campaignId}` enforces `resource.data.ownerId == request.auth.uid` so clients cannot scrape other users' campaigns.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/campaigns/camp_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'u1', token: { email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: `auth.uid = 'u1'`, payload `ownerId: 'u2'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Payload includes extra key `isAdmin: true` -> `PERMISSION_DENIED` via `hasOnly`.
5. **ID Poisoning**: Document ID contains spaces or special characters (`camp$123!`) -> `PERMISSION_DENIED` via `isValidId`.
6. **Denial of Wallet String Overflow**: `title` > 160 chars or `campaignPayload` > 900,000 chars -> `PERMISSION_DENIED`.
7. **Timestamp Forgery on Create**: Client passes forged past `createdAt` != `request.time` -> `PERMISSION_DENIED`.
8. **Owner Mutation on Update**: Updating `ownerId` from `'u1'` to `'u2'` -> `PERMISSION_DENIED`.
9. **CreatedAt Mutation on Update**: Updating `createdAt` -> `PERMISSION_DENIED`.
10. **Shadow Field Injection on Update**: Adding `hacked: 1` during update -> `PERMISSION_DENIED` via `affectedKeys().hasOnly(...)`.
11. **Value Poisoning on Update**: Updating `turnCount` with a string `"ten"` instead of number -> `PERMISSION_DENIED` via `isValidCampaignSave(incoming())`.
12. **Cross-User Read / Delete**: User `'u2'` attempting `get` or `delete` on `'u1'`'s campaign -> `PERMISSION_DENIED`.
