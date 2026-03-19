# Fanek Admin Guide

This guide covers everything you need to deploy, configure, and manage a Fanek instance. It assumes you are comfortable with a terminal and basic web administration.


## Contents

1. [Installation](#1-installation)
2. [Setup Wizard](#2-setup-wizard)
3. [User Management](#3-user-management)
4. [Service Catalog](#4-service-catalog)
5. [Settings](#5-settings)
6. [Audit Log](#6-audit-log)
7. [CLI Tools](#7-cli-tools)
8. [Roles and Permissions](#8-roles-and-permissions)


## 1. Installation

### Docker Compose (recommended)

The simplest way to run Fanek. Docker handles the database, secrets, and schema automatically.

1. Clone the repository:
   ```bash
   git clone https://github.com/mulaifi/fanek.git
   cd fanek
   ```
2. Start the stack:
   ```bash
   docker compose up -d
   ```
3. Open `http://localhost:3000` and follow the setup wizard.

That's it. The Docker entrypoint automatically:
- Generates a secure `NEXTAUTH_SECRET` on first start (persisted across restarts)
- Waits for PostgreSQL to be ready
- Applies database migrations

**Customization:** To override defaults, create a `.env` file in the project root before starting. Docker Compose picks it up automatically. See the [README](../../README.md) for all environment variables.

**Production notes:**
- Set `NEXTAUTH_URL` to your actual domain (e.g. `https://fanek.example.com`) in `.env`
- Consider using an external PostgreSQL instance with proper backups
- Change the default database credentials in `docker-compose.yml` or via `.env`

### Manual installation

Requirements: Node.js 20 or later, PostgreSQL 16 or later.

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/mulaifi/fanek.git
   cd fanek
   npm install
   ```
2. Create the database:
   ```bash
   createdb fanek
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `DATABASE_URL` -- your PostgreSQL connection string
   - `NEXTAUTH_SECRET` -- generate with `openssl rand -hex 32`
   - `NEXTAUTH_URL` -- the URL where Fanek will be accessed
4. Apply the database schema:
   ```bash
   npx prisma migrate deploy
   ```
5. Start the server:
   ```bash
   npm run build && npm start
   ```
   For development: `npm run dev`

Open `http://localhost:3000` and follow the setup wizard.


## 2. Setup Wizard

The setup wizard runs automatically on first access. If the database has no completed setup record, any visit to the app redirects to `/setup`. Once setup is complete, the wizard is permanently disabled — you cannot run it again.

The wizard has four steps.

### Step 1 — Admin account

Enter your name, email address, and a password for the initial admin account. A password strength meter rates your password across five criteria: minimum length, lowercase letters, uppercase letters, numbers, and special characters. Aim for "Strong" or "Very Strong" before proceeding.

This account will have the Admin role and full access to everything. You can add more admins later.

### Step 2 — Organization info

Enter your organization name. This name appears in the sidebar and in exported data. You can also upload a logo here (PNG, JPEG, GIF, or WebP, maximum 256 KB). Both can be changed later under Settings.

### Step 3 — Starter template

Choose the template that best matches your business. Templates pre-populate the service catalog with service types and field schemas so you are not starting from a blank slate.

| Template | Pre-populates |
|----------|---------------|
| Cloud Provider | VDC, DRaaS, BaaS, and connectivity service types |
| Telecom | Voice, data, internet, and managed service types |
| MSP | Managed IT, security, backup, and helpdesk service types |
| Blank | No service types — build the catalog yourself |

You can edit, add, or remove any service type after setup. The template only sets the starting point.

### Step 4 — Complete

Fanek saves the configuration and redirects you to the dashboard after a short delay. Log in using the admin credentials you created in Step 1.


## 3. User Management

Navigate to **Admin > Users** to manage all user accounts. Only Admins can access this page.

### Inviting a new user

1. Click **Invite User**.
2. Fill in the user's full name, email address, and assign a role (Viewer is the default).
3. Click **Send Invite**.

Fanek creates the account immediately and displays a temporary password in a banner at the top of the page. **Important:** Copy the password immediately before dismissing the banner, as it cannot be retrieved afterwards. Share the password with the user through a secure channel such as an end-to-end encrypted messaging app or a dedicated password-sharing tool. Avoid sending passwords over unencrypted email or chat. The banner is dismissed when you click "Dismiss" and does not persist. There is no email delivery built in.

The default role for new invitations is Viewer. Change the role in the invite form if you need to grant more access.

### Changing a user's role

1. Find the user in the table and click **Edit Role** in the actions column.
2. Select the new role from the dropdown (Viewer, Editor, or Admin).
3. Click **Save**.

The role change takes effect immediately. The user's next action will be governed by the new permissions. For a description of what each role can do, see [Roles and Permissions](#8-roles-and-permissions).

### Resetting a password

If a user is locked out or has forgotten their password, click **Reset Password** in the user's row. Fanek generates a new random temporary password and displays it in a banner. **Important:** Copy the password immediately before dismissing the banner. Share it with the user through a secure channel (end-to-end encrypted messaging or a password-sharing tool). When they log in with the temporary password, they will be required to set a new one before reaching the dashboard.

### Revoking sessions

Click **Revoke Sessions** to immediately invalidate all active sessions for that user. This is useful when a device is lost, an account is compromised, or an employee leaves. The user will be signed out on all devices and must log in again.

### Deleting a user

Click **Delete** in the user's row. The button requires a second click to confirm (a "Confirm?" button appears with a 5-second countdown. If you do not confirm within 5 seconds, the action is cancelled). You cannot delete your own account.

Deleted users lose access immediately. Their historical data (customers, services, audit log entries) is retained.

### First-login flow

When a user logs in with a temporary password (either from an invite or a password reset), Fanek forces a password change before they can access any other page. After they set a new password, they land on the dashboard normally.


## 4. Service Catalog

Navigate to **Admin > Service Catalog** to manage service types. The service catalog is the most powerful configuration feature in Fanek. It defines the structure of the services you track for your customers.

### What is a service type?

A service type is a template. It has a name, an optional description, an optional emoji icon, and a field schema — a list of custom fields that every service of that type will have. When an Editor creates a service for a customer and selects a type, Fanek renders a dynamic form built from that type's field schema.

For example, a "VDC" service type might have fields for "vCPU Count", "RAM (GB)", "Storage (TB)", and "Contract Expiry". A "Leased Line" service type might have "Bandwidth (Mbps)", "CIR", and "Provider Reference".

### Creating a service type

1. Click **New Service Type**.
2. Enter a name (required). The name appears in the service type list and in customer service forms.
3. Optionally add a description to clarify the type's purpose for other editors.
4. Optionally enter an emoji in the Icon field (e.g. `☁️`). The emoji appears next to the name in lists.
5. Leave the **Active** toggle on. Inactive types are hidden from editors when creating new services.
6. Add fields using the field schema builder (see below).
7. Click **Create Service Type**.

### Building the field schema

The field schema defines the data fields that appear on every service of this type. Use the schema builder to add, configure, reorder, and remove fields.

For each field, configure:

- **Field name** — a machine-readable identifier, lowercase with underscores (e.g. `contract_value`). Spaces are automatically converted to underscores.
- **Display label** — the human-readable label shown in the form (e.g. `Contract Value`).
- **Type** — one of the following:
  - **Text** — a single-line text input
  - **Number** — a numeric input
  - **Date** — a date picker
  - **Select (dropdown)** — a dropdown with predefined options you specify
  - **Currency** — a numeric input for monetary amounts
  - **Checkbox (Yes/No)** — a boolean toggle
- **Required** — check this if the field must be filled in before saving a service.

For **Select** fields, enter the allowed options as a comma-separated list (e.g. `Active, Suspended, Cancelled`). Fanek parses the list as you type and previews the option badges below the input.

Use the up and down arrows on each field card to reorder fields. The order here is the order they appear in the service form. Click the trash icon to remove a field.

### Editing an existing service type

Click **Edit** on any row (or click the row itself) to open the inline editor. All properties including the field schema can be changed.

**Impact on existing services:** Fanek stores service field values as a flexible JSON document. Adding new fields to the schema will cause those fields to appear as empty in existing services. Removing a field from the schema hides it from the form, but the stored data is not deleted. Renaming a field's internal name will break the link to stored values for that field in existing services — the old data becomes orphaned. Rename display labels freely; rename field names with care.

### Deactivating a service type

Toggle **Active** off in the service type form and save. Inactive types are removed from the "create service" dropdown for editors, so no new services of that type can be created. Existing services of that type are unaffected and remain visible.

### Deleting a service type

The Delete button is disabled if any services of that type exist. To delete a type, first delete or reassign all services that use it. Deletion is a two-click confirm action with a 5-second countdown.


## 5. Settings

Navigate to **Admin > Settings** to configure application-wide settings. The Settings page has four tabs.

### Organization tab

- **Organization name** — the name displayed throughout the app and in exports. Required.
- **Organization logo** — click the logo square or the Upload button to select an image file (PNG, JPEG, GIF, or WebP, maximum 256 KB). The image is stored in the database as a base64 data URL. Click **Remove** to revert to the initial-letter placeholder.
- **Default language** — sets the default language for new users. Currently supports English and Arabic. Users can switch language from the navigation bar independently of this setting.

Click **Save** to apply changes.

### Authentication tab

Configure OAuth login providers. Currently, Fanek supports Google OAuth.

To enable Google login:

1. Create an OAuth 2.0 client in the [Google Cloud Console](https://console.cloud.google.com/).
2. Set the authorized redirect URI to `https://your-domain/api/auth/callback/google`.
3. Copy the Client ID and Client Secret into the respective fields.
4. Click **Save**.

Google login will appear as an option on the sign-in page immediately. If the Client ID or Secret are empty, the Google option is hidden.

The Client Secret is encrypted before being stored in the database. It is never returned to the browser in plaintext.

### Statuses tab

Customer statuses are the labels used to categorize your customers (e.g. Active, Inactive, Prospect, Churned). The starter template you chose during setup pre-populated an initial list.

From this tab you can:

- **Add a status** — type a new label and press the add button.
- **Edit a status** — click the edit icon next to any status and update the name.
- **Reorder statuses** — drag statuses up and down to control the order they appear in filters and dropdowns.
- **Delete a status** — click the delete icon. Note that deleting a status does not automatically update customers that have that status assigned.

Changes take effect immediately after saving.

### Data tab

Click **Export Data** to download a full JSON export of your Fanek data, including customers, partners, services, and service types. The file is named `fanek-export.json`.

Use this for backups, migrations, or integrations with other systems.


## 6. Audit Log

Navigate to **Admin > Audit Log** to view a chronological record of all data-changing actions in Fanek. This page is only accessible to Admins.

Every CREATE, UPDATE, and DELETE operation on customers, partners, services, users, settings, and service types is logged automatically with a timestamp, the acting user's name and email, the resource type, and the resource ID.

### Filtering

Use the filter controls at the top of the page to narrow results:

- **Action** — filter to CREATE, UPDATE, or DELETE operations only.
- **Resource** — filter to a specific resource type (customer, service, partner, user, settings, serviceType).
- **From / To** — filter to a date range.

Filters are applied immediately as you change them.

### Viewing details

Click any row to expand it. The expanded view shows the full JSON payload of the logged action, formatted for readability. This includes the field values that were written. If no details were recorded for an entry, a "No details" message appears.

The log is paginated at 20 entries per page.


## 7. CLI Tools

Fanek ships two command-line scripts for administrative tasks that are easier to do outside the browser, such as recovering a locked-out admin account.

Both scripts require `DATABASE_URL` to be set in your environment or in a `.env` file in the project root.

### Reset a user's password

```bash
npm run reset-password user@example.com
```

This generates a random 16-character temporary password, updates the user's password hash in the database, and marks the account as `firstLogin = true` so the user must change the password on next login.

To set a specific password instead of a random one:

```bash
npm run reset-password user@example.com -- --password MyNewPassword123!
```

> **Security warning:** Using the `--password` flag has several risks. The password is visible in terminal history and to anyone with access to the admin's screen. It bypasses the `firstLogin` enforcement, meaning the user will not be forced to change the password on next login. This option also makes it easier to set weak or shared passwords. Use it only for emergency recovery situations, and immediately notify the user to change their password after login.

When you provide a specific password, the `firstLogin` flag is not set, and the user is not forced to change it.

The script prints the new password to the terminal. Store it securely or share it with the user through an encrypted channel immediately.

### List all users

```bash
npm run list-users
```

Prints a table of all user accounts with their name, email, role, status (Active or Pending), and creation date. "Pending" means the user has not yet completed their first-login password change.

### When to use CLI tools

Use the CLI tools when:

- The admin account is locked out and you cannot access the browser UI.
- You need to quickly audit who has access before granting a user the Admin role.
- You are scripting a deployment and need to verify setup completed correctly.

For day-to-day password resets and user management, use the browser UI at Admin > Users.


## 8. Roles and Permissions

Fanek has three roles. Assign the least permissive role that meets the user's needs.

| Action | Admin | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| View customers and partners | Yes | Yes | Yes |
| Create and edit customers and partners | Yes | Yes | No |
| Delete customers and partners | Yes | No | No |
| Manage services (create, edit, delete) | Yes | Yes | No |
| Manage users | Yes | No | No |
| Manage settings | Yes | No | No |
| View audit log | Yes | No | No |
| Export data | Yes | No | No |

**Admin** — full access to all features including user management, settings, and the audit log. Assign to people responsible for running and configuring the Fanek instance.

**Editor** — can create and edit customers, partners, and their services, but cannot delete customers or partners, and has no access to administrative pages. Assign to operations staff who manage client data day-to-day.

**Viewer** — read-only access to customers and partners. Cannot create, edit, or delete any records. Assign to stakeholders who need visibility into client data without the ability to change it.
