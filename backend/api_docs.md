# 3.1.0 API Documentation

# Secrets Manager

**Version:** 1.0.0

Compliance-first internal secrets manager with zero-knowledge encryption

## Endpoints

### POST /api/v1/auth/register

**Register**

Register a new user and organization.

Creates:
- New organization
- Admin user with owner role
- Default roles (owner, admin, member)

#### Request Body

Type: `UserRegisterRequest`

#### Responses

| Code | Description |
|------|-------------|
| 201 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/auth/login

**Login**

Authenticate user with email and password.

Returns JWT tokens if successful.
If MFA is enabled, returns mfa_required=true.

#### Request Body

Type: `UserLoginRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/auth/mfa/verify

**Verify Mfa**

Verify TOTP code after login.

Requires the temporary token from login response.

#### Request Body

Type: `MFAVerifyRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/auth/mfa/setup

**Setup Mfa**

Setup MFA for current user.

Returns QR code URL for authenticator app.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### POST /api/v1/auth/refresh

**Refresh Token**

Refresh access token using refresh token.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### POST /api/v1/auth/logout

**Logout**

Logout current user (invalidate session).

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### GET /api/v1/auth/me

**Get Current User Profile**

Get current authenticated user profile.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### POST /api/v1/auth/password/change

**Change Password**

Change user password.

Client must re-encrypt vault keys with new master key and send them.

#### Request Body

Type: `PasswordChangeRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/vaults

**List Vaults**

List all vaults accessible to current user.

Includes:
- Personal vaults (owner_type='user', owner_id=user.id)
- Team vaults (where user is a member)

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### POST /api/v1/vaults

**Create Vault**

Create a new personal vault.

#### Request Body

Type: `VaultCreateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 201 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/vaults/{vault_id}

**Get Vault**

Get vault details by ID.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### PATCH /api/v1/vaults/{vault_id}

**Update Vault**

Update vault metadata.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |

#### Request Body

Type: `VaultUpdateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### DELETE /api/v1/vaults/{vault_id}

**Delete Vault**

Delete a vault and all its items.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 204 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/vaults/{vault_id}/items

**List Vault Items**

List items in a vault with optional filtering.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |
| item_type | query | No | - | string |
| search | query | No | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/vaults/{vault_id}/items

**Create Vault Item**

Create a new item in a vault.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |

#### Request Body

Type: `VaultItemCreateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 201 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/vaults/{vault_id}/items/{item_id}

**Get Vault Item**

Get a vault item by ID.

This action is logged for audit. Justification is recommended.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |
| item_id | path | Yes | - | string |
| justification | query | No | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### PATCH /api/v1/vaults/{vault_id}/items/{item_id}

**Update Vault Item**

Update a vault item. Creates a new version for audit trail.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |
| item_id | path | Yes | - | string |

#### Request Body

Type: `VaultItemUpdateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### DELETE /api/v1/vaults/{vault_id}/items/{item_id}

**Delete Vault Item**

Delete a vault item.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| vault_id | path | Yes | - | string |
| item_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 204 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/approvals

**List Pending Approvals**

List approval requests pending review.

By default, shows pending approvals for the current user to review.
Admins can see all pending approvals in their organization.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| status_filter | query | No | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/approvals

**Create Approval Request**

Create a new approval request.

Used for sensitive operations like:
- reveal_secret (break-glass)
- share_external
- mass_reset
- delete_vault

#### Request Body

Type: `ApprovalCreateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 201 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/approvals/my-requests

**List My Requests**

List approval requests created by current user.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### GET /api/v1/approvals/{approval_id}

**Get Approval Request**

Get approval request details.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| approval_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/approvals/{approval_id}/approve

**Approve Request**

Approve an approval request.

Requires appropriate permissions. Cannot approve own requests.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| approval_id | path | Yes | - | string |

#### Request Body

Type: `ApprovalActionRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/approvals/{approval_id}/deny

**Deny Request**

Deny an approval request.

Immediately closes the request as denied.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| approval_id | path | Yes | - | string |

#### Request Body

Type: `ApprovalActionRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/audit/logs

**List Audit Logs**

List audit logs with filtering.

Requires admin permissions to view organization-wide logs.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| actor_id | query | No | - | string |
| action | query | No | - | string |
| resource_type | query | No | - | string |
| resource_id | query | No | - | string |
| start_date | query | No | - | string |
| end_date | query | No | - | string |
| page | query | No | - | integer |
| per_page | query | No | - | integer |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/audit/logs/export

**Export Audit Logs**

Export audit logs for compliance reporting.

Supports JSON and CSV formats.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| format | query | No | - | string |
| start_date | query | No | - | string |
| end_date | query | No | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/audit/actions

**List Audit Actions**

List all available audit action types.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### GET /api/v1/credentials/categories

**List Categories**

Get all available credential categories.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### GET /api/v1/credentials/my-permissions

**Get My Permissions**

Get current user's role and category permissions.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### GET /api/v1/credentials

**List Credentials**

List credentials based on user permissions:
- Admins see all credentials
- Users see their own + credentials in assigned categories

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| category | query | No | Filter by category | string |
| search | query | No | Search by name | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/credentials

**Create Credential**

Create a new credential. Any authenticated user can create credentials.

#### Request Body

Type: `CredentialCreateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 201 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/credentials/{credential_id}

**Get Credential**

Get a specific credential by ID. Checks permissions.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| credential_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### PATCH /api/v1/credentials/{credential_id}

**Update Credential**

Update a credential. Only admin or creator can update.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| credential_id | path | Yes | - | string |

#### Request Body

Type: `CredentialUpdateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### DELETE /api/v1/credentials/{credential_id}

**Delete Credential**

Delete a credential. Only admin or creator can delete.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| credential_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 204 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/credentials/admin/roles

**List User Roles**

List all user roles. Admin only.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### POST /api/v1/credentials/admin/roles

**Set User Role**

Set user role. Admin only.

#### Request Body

Type: `UserRoleRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/credentials/admin/category-permissions

**List Category Permissions**

List all category permissions. Admin only.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### POST /api/v1/credentials/admin/category-permissions

**Grant Category Permission**

Grant category permission to user. Admin only.

#### Request Body

Type: `CategoryPermissionRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### DELETE /api/v1/credentials/admin/category-permissions/{permission_id}

**Revoke Category Permission**

Revoke category permission. Admin only.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| permission_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 204 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/users

**List Users**

List all users in the organization. Admin only.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| search | query | No | - | string |
| status | query | No | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/users

**Create User**

Create a new user. Admin only.

#### Request Body

Type: `UserCreateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 201 | Successful Response |
| 422 | Validation Error |

---

### GET /api/v1/users/{user_id}

**Get User Detail**

Get a specific user. Admin only.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| user_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### PATCH /api/v1/users/{user_id}

**Update User**

Update a user. Admin only.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| user_id | path | Yes | - | string |

#### Request Body

Type: `UserUpdateRequest`

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### DELETE /api/v1/users/{user_id}

**Deactivate User**

Deactivate a user (soft delete). Admin only.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| user_id | path | Yes | - | string |

#### Responses

| Code | Description |
|------|-------------|
| 204 | Successful Response |
| 422 | Validation Error |

---

### POST /api/v1/users/{user_id}/reset-password

**Reset User Password**

Reset a user's password. Admin only.

#### Parameters

| Name | In | Required | Description | Schema |
|------|----|----------|-------------|--------|
| user_id | path | Yes | - | string |

#### Request Body

Type: `PasswordResetRequest`

#### Responses

| Code | Description |
|------|-------------|
| 204 | Successful Response |
| 422 | Validation Error |

---

### GET /health

**Health Check**

Health check endpoint for load balancers and monitoring.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

### GET /

**Root**

Root endpoint with API info.

#### Responses

| Code | Description |
|------|-------------|
| 200 | Successful Response |

---

