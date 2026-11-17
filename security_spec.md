# Security Specification — TeamPulse ERP Firestore Rules

## 1. Data Invariants
1. Every document across `/employees`, `/tasks`, `/attendanceLogs`, `/taskActivities`, and `/workspaceSettings` requires an authenticated Firebase Auth session (`request.auth != null` via silent Anonymous Auth).
2. Every document belongs to the shared workspace (`workspaceKey == 'sserp_team_workspace'`) and enforces strict `keys().hasAll(...)` and `keys().hasOnly(...)` schema validation on create/update, preventing shadow fields and unvalidated payload injection.
3. Every document's `ownerUid` must match `request.auth.uid` on creation and remain immutable alongside `workspaceKey` and `createdAt` on updates.
4. Every `createdAt` and `updatedAt` timestamp must equal `request.time` (server timestamps only), with `createdAt` immutable on updates.
5. `tasks` creation requires an existing assignee in `/employees/$(incoming().assigneeId)`.
6. `taskActivities` cannot be orphaned: `create` must verify `exists(/databases/$(database)/documents/tasks/$(incoming().taskId))`, and updates are blocked (`allow update: if false`).
7. `attendanceLogs` cannot be orphaned: `create` must verify `exists(/databases/$(database)/documents/employees/$(incoming().employeeId))`, `status == 'active'`, `checkInAt == request.time`, and `checkOutAt == null`; checkout updates are locked once `status == 'completed'`.
8. `allow list` rules must never call `get()` or `exists()`; they evaluate `resource.data.workspaceKey == 'sserp_team_workspace'` directly against `resource.data`.
9. Document ID path variables on single-doc operations must pass `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating a task with `request.auth == null`.
2. **Wrong Workspace Key**: Creating or listing documents with `workspaceKey != 'sserp_team_workspace'`.
3. **Shadow Field Injection**: Creating an employee with extra key `isSuperAdmin: true`.
4. **Owner UID Spoofing**: Creating a task with `ownerUid: 'other_user_uid'`.
5. **Immutable Owner Tampering**: Updating a task to change `ownerUid` or `createdAt`.
6. **Client Timestamp Forgery**: Creating an attendanceLog with client-supplied `checkInAt != request.time`.
7. **ID Poisoning**: Writing `/tasks/../../evil..id` or a 1,500-character document ID.
8. **Denial-of-Wallet String Bloat**: Updating `tasks.title` with a 5,000-character string (exceeds `maxLength: 160`).
9. **Unbounded Array Bloat**: Writing `tasks.subtasks` with 50 items (exceeds max 30).
10. **Orphaned Activity Injection**: Creating `/taskActivities/{id}` referencing a non-existent `taskId`.
11. **Terminal Attendance Mutation**: Attempting to alter `checkOutAt` on an already `completed` attendanceLog.
12. **Blanket List Query Scraping**: Listing `/tasks` without filtering by `workspaceKey == 'sserp_team_workspace'`.
