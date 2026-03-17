# Fanek UI Testing Plan

Comprehensive manual UI testing plan covering all features, CRUD operations, and edge cases.

## Prerequisites

- App running locally (`npm run dev`)
- Database seeded via setup wizard (Cloud template)
- Admin account created during setup
- Chrome DevTools MCP connected

## Test Execution Legend

- [ ] Not tested
- [P] Passed
- [F] Failed (with bug description)
- [S] Skipped (with reason)

---

## 1. Setup Wizard (Fresh Install)

> Requires clean database. Skip if already set up.

### 1.1 Step 1: Admin Account
- [ ] Form displays email, password, name fields
- [ ] Submit with empty fields shows validation errors
- [ ] Submit with invalid email shows error
- [ ] Submit with short password (< 8 chars) shows error
- [ ] Valid submission advances to step 2

### 1.2 Step 2: Organization
- [ ] Organization name field is required
- [ ] Logo upload accepts image files
- [ ] Logo upload rejects files > 256 KB
- [ ] Logo preview displays after upload
- [ ] Remove logo button works
- [ ] Can proceed without logo

### 1.3 Step 3: Template Selection
- [ ] Three templates displayed (Cloud, Telecom, MSP)
- [ ] One must be selected to proceed
- [ ] Template descriptions are informative

### 1.4 Step 4: Completion
- [ ] Success message displayed
- [ ] Redirects to dashboard

---

## 2. Authentication

### 2.1 Login
- [ ] Login page shows org name and logo
- [ ] Empty form submission shows validation
- [ ] Wrong email shows error message
- [ ] Wrong password shows error message
- [ ] Correct credentials redirect to dashboard
- [ ] Session persists on page refresh

### 2.2 Logout
- [ ] User dropdown menu shows logout option
- [ ] Clicking logout redirects to login page
- [ ] After logout, accessing /dashboard redirects to login

---

## 3. Dashboard

### 3.1 Stats Display
- [ ] Total Customers count displays correctly
- [ ] Total Services count displays correctly
- [ ] Total Partners count displays correctly
- [ ] Counts match actual data

### 3.2 Charts
- [ ] Customers by Status chart renders
- [ ] Services by Type chart renders
- [ ] Charts reflect actual data distribution

### 3.3 Recent Customers
- [ ] Table shows recently updated customers
- [ ] Columns: Name, Client Code, Status, Last Updated
- [ ] Clicking a row navigates to customer detail

---

## 4. Customer Management (Full CRUD)

### 4.1 Create Customer - Happy Path
- [ ] Navigate to /customers, click "New Customer"
- [ ] Fill all fields: Name="Test Corp", Client Code="TC-001", Status="Active", Vertical="Technology", Website="https://test.com", Address="123 Main St", Notes="Test notes"
- [ ] Submit creates customer successfully
- [ ] Redirected to customer detail page
- [ ] All entered data displays correctly
- [ ] Success toast notification shown

### 4.2 Create Customer - Validation
- [ ] Submit with empty name shows required error
- [ ] Invalid website URL (no http/https) shows error
- [ ] Duplicate client code shows error from API

### 4.3 Create Customer - Minimal Data
- [ ] Create with only name (all other fields empty)
- [ ] Customer created successfully
- [ ] Empty optional fields display gracefully (no "undefined" or errors)

### 4.4 Customer List
- [ ] All customers appear in table
- [ ] Avatar shows first letter of name
- [ ] Status badges display with correct colors
- [ ] Service count column shows number
- [ ] Pagination works (if > 25 records)
- [ ] Sorting by Name works (asc/desc)
- [ ] Sorting by Status works
- [ ] Sorting by Last Updated works

### 4.5 Customer Search & Filter
- [ ] Search by name returns matching results
- [ ] Search by client code returns matching results
- [ ] Search is case-insensitive
- [ ] Empty search returns all customers
- [ ] Status filter shows only matching customers
- [ ] Search + filter combined works correctly
- [ ] No results state displays properly

### 4.6 Customer Detail - View
- [ ] Info tab shows all customer fields
- [ ] Website is clickable link
- [ ] Services tab shows "No services" initially (for new customer)
- [ ] Contacts tab shows contact editor
- [ ] Notes tab shows notes text

### 4.7 Edit Customer
- [ ] Click Edit button opens edit modal
- [ ] Modal pre-fills with current values
- [ ] Change name and save - updates successfully
- [ ] Change status and save - badge updates
- [ ] Change all fields and save - all update correctly
- [ ] Cancel edit discards changes

### 4.8 Delete Customer
- [ ] Click Delete button shows confirmation dialog
- [ ] Confirmation mentions service cascade warning
- [ ] Cancel does not delete
- [ ] Confirm deletes customer
- [ ] Redirected to customer list
- [ ] Customer no longer in list

### 4.9 Customer CSV Export
- [ ] Click Export CSV on customer list
- [ ] File downloads with .csv extension
- [ ] CSV contains correct headers and data

---

## 5. Service Management (Full CRUD)

### 5.1 Add Service to Customer
- [ ] Navigate to customer detail, Services tab
- [ ] Click "Add Service"
- [ ] Service type dropdown shows all active types from catalog
- [ ] Selecting a type shows dynamic form fields matching the schema
- [ ] Fill all required fields
- [ ] Submit creates service successfully
- [ ] Service appears under the correct type group

### 5.2 Dynamic Form Field Types
- [ ] Text field renders as TextInput
- [ ] Number field renders as NumberInput
- [ ] Date field renders as date picker
- [ ] Select field renders as dropdown with defined options
- [ ] Currency field renders with $ prefix and 2 decimals
- [ ] Boolean field renders as checkbox
- [ ] Required fields show validation on empty submit

### 5.3 Add Multiple Services
- [ ] Add a second service of the same type
- [ ] Both appear grouped under that type
- [ ] Add a service of a different type
- [ ] Services grouped separately by type

### 5.4 Edit Service
- [ ] Click edit on existing service (if available)
- [ ] Form pre-fills with current values
- [ ] Change values and save
- [ ] Updated values display correctly

### 5.5 Delete Service
- [ ] Click delete on a service
- [ ] Confirmation dialog appears
- [ ] Confirm deletes the service
- [ ] Service removed from list
- [ ] Customer service count decreases

### 5.6 Service Edge Cases
- [ ] Submit service with only required fields (leave optional empty)
- [ ] Service displays correctly with partial data
- [ ] Number fields accept 0 as valid value
- [ ] Currency field accepts 0.00
- [ ] Boolean field defaults correctly
- [ ] Very long text in text fields handled properly

---

## 6. Contacts Editor (Shared Component)

### 6.1 Add Contact to Customer
- [ ] Navigate to customer detail, Contacts tab
- [ ] Click "Add Contact"
- [ ] Contact form appears with Name and Title fields
- [ ] Enter Name="John Doe", Title="CTO"
- [ ] Add email: john@test.com, Category=Work
- [ ] Add phone: +965-1234-5678, Category=Mobile
- [ ] Save contacts
- [ ] Refresh page - contacts persist

### 6.2 Multiple Contacts
- [ ] Add a second contact
- [ ] Both contacts display
- [ ] Each has independent email/phone lists

### 6.3 Multiple Emails/Phones per Contact
- [ ] Add 2 emails to same contact (Work + Personal)
- [ ] Add 2 phones to same contact (Mobile + Direct)
- [ ] All display correctly after save

### 6.4 Remove Contact Details
- [ ] Remove an email from a contact
- [ ] Remove a phone from a contact
- [ ] Remove entire contact
- [ ] Save and verify changes persist

### 6.5 Partner Contacts
- [ ] Repeat contact tests on a partner detail page
- [ ] Contacts save and persist for partners too

---

## 7. Partner Management (Full CRUD)

### 7.1 Create Partner - Happy Path
- [ ] Navigate to /partners, click "New Partner"
- [ ] Fill: Name="Cloud Vendor Inc", Type="Technology", Website="https://vendor.com", Address="456 Cloud Ave", Notes="Preferred vendor"
- [ ] Submit creates partner
- [ ] Redirected to detail page
- [ ] All data displays correctly

### 7.2 Create Partner - Validation
- [ ] Submit with empty name shows error
- [ ] Invalid website URL shows error
- [ ] Duplicate partner name shows API error

### 7.3 Create Partner - Minimal Data
- [ ] Create with only name
- [ ] Partner created successfully
- [ ] Empty fields display gracefully

### 7.4 Partner List
- [ ] All partners appear in table
- [ ] Type badges display correctly
- [ ] Search by name works
- [ ] Type filter works
- [ ] Search + filter combined works
- [ ] Sorting works (Name, Last Updated)
- [ ] Click row navigates to detail

### 7.5 Edit Partner
- [ ] Edit button opens modal
- [ ] Pre-fills current values
- [ ] Update name, type, website, notes
- [ ] Save reflects changes

### 7.6 Delete Partner
- [ ] Delete button shows confirmation
- [ ] Cancel keeps partner
- [ ] Confirm deletes partner
- [ ] Redirected to list, partner gone

### 7.7 Partner CSV Export
- [ ] Export CSV downloads file
- [ ] CSV contains correct data

---

## 8. Admin - User Management

### 8.1 Invite User
- [ ] Click "Invite User" button
- [ ] Fill: Name="Editor User", Email="editor@test.com", Role=EDITOR
- [ ] Submit creates user
- [ ] New user appears in list
- [ ] Temp password shown or emailed

### 8.2 Edit User Role
- [ ] Click actions menu on a user
- [ ] Select "Edit Role"
- [ ] Change from EDITOR to VIEWER
- [ ] Save updates role badge

### 8.3 Reset User Password
- [ ] Click "Reset Password" on a user
- [ ] Confirmation dialog appears
- [ ] Confirm shows temporary password
- [ ] Temp password is copyable

### 8.4 Revoke Sessions
- [ ] Click "Revoke Sessions" on a user
- [ ] Confirmation dialog appears
- [ ] Confirm succeeds with toast

### 8.5 Delete User
- [ ] Cannot delete own account (button disabled or error)
- [ ] Delete another user shows confirmation
- [ ] Confirm deletes user
- [ ] User removed from list

### 8.6 Invite User - Edge Cases
- [ ] Duplicate email shows error
- [ ] Invalid email format shows error
- [ ] Empty name shows error

---

## 9. Admin - Service Catalog

### 9.1 View Service Types
- [ ] All seeded service types displayed
- [ ] Columns: Name, Description, Fields count, Services count, Status, Actions
- [ ] Active/Inactive badges show correctly

### 9.2 Create Service Type
- [ ] Click "New Service Type"
- [ ] Fill: Name="Custom Service", Icon="🔧", Description="A custom test service"
- [ ] Add field: name="region", label="Region", type=text, required=yes
- [ ] Add field: name="capacity", label="Capacity (GB)", type=number, required=no
- [ ] Add field: name="tier", label="Tier", type=select, options="Basic,Standard,Premium"
- [ ] Add field: name="start_date", label="Start Date", type=date
- [ ] Add field: name="monthly_cost", label="Monthly Cost", type=currency
- [ ] Add field: name="ha_enabled", label="HA Enabled", type=boolean
- [ ] Save creates service type
- [ ] Appears in list with 6 fields badge

### 9.3 Verify Dynamic Form from New Type
- [ ] Go to a customer, Add Service
- [ ] Select "Custom Service" type
- [ ] Verify all 6 fields render with correct types
- [ ] Fill fields and create service
- [ ] Service displays with correct values

### 9.4 Edit Service Type
- [ ] Click edit on existing type
- [ ] Pre-fills all fields including schema
- [ ] Add a new field to schema
- [ ] Remove a field from schema
- [ ] Reorder fields (move up/down)
- [ ] Save updates type

### 9.5 Delete Service Type
- [ ] Type with 0 services: delete button enabled
- [ ] Confirm delete removes type
- [ ] Type with services: delete disabled or shows error

### 9.6 Toggle Service Type Active/Inactive
- [ ] Set a type to inactive
- [ ] Inactive type does not appear in "Add Service" dropdown
- [ ] Set back to active, appears again

### 9.7 Service Catalog Edge Cases
- [ ] Duplicate service type name shows error
- [ ] Service type with no fields (empty schema) can be created
- [ ] Field name with spaces shows validation error (alphanumeric + underscore only)
- [ ] Select type field with no options shows validation/warning

---

## 10. Admin - Settings

### 10.1 Organization Tab
- [ ] Current org name pre-fills
- [ ] Update org name and save
- [ ] Org name updates in sidebar/header
- [ ] Upload new logo
- [ ] Logo appears in login page and sidebar
- [ ] Remove logo works

### 10.2 Authentication Tab
- [ ] Google OAuth config form displays
- [ ] Can enter client ID and secret
- [ ] Save and verify settings persist

### 10.3 Customer Statuses Tab
- [ ] Default statuses listed (Active, Inactive, Prospect, Suspended, Churned)
- [ ] Add new status (e.g., "On Hold")
- [ ] New status appears in customer create/edit dropdowns
- [ ] Edit existing status label
- [ ] Delete a status (if no customers use it)
- [ ] Reorder statuses

### 10.4 Data Export Tab
- [ ] Click Export JSON
- [ ] JSON file downloads
- [ ] File contains customers, services, partners, settings data

---

## 11. Admin - Audit Log

### 11.1 View Audit Entries
- [ ] Recent actions appear (from CRUD operations during testing)
- [ ] Columns: Timestamp, User, Action, Resource, Resource ID
- [ ] Action badges colored correctly (CREATE=green, UPDATE=blue, DELETE=red)

### 11.2 Filter Audit Log
- [ ] Filter by Action (e.g., CREATE only)
- [ ] Filter by Resource (e.g., customer only)
- [ ] Filter by date range
- [ ] Combined filters work
- [ ] Clear filters shows all

### 11.3 Audit Log Details
- [ ] Click/expand a row to see JSON details
- [ ] Details show meaningful change data
- [ ] Pagination works (if > 20 entries)

---

## 12. Global Search (Spotlight)

### 12.1 Search Functionality
- [ ] Keyboard shortcut opens spotlight (Cmd+K or Ctrl+K)
- [ ] Search by customer name returns results
- [ ] Search by partner name returns results
- [ ] Search by client code returns results
- [ ] Clicking a result navigates to correct page
- [ ] Empty query shows no results or placeholder
- [ ] No matches shows appropriate message

---

## 13. Navigation & Layout

### 13.1 Sidebar
- [ ] Sidebar shows icon rail (collapsed by default)
- [ ] Hover expands sidebar with labels
- [ ] Navigation items: Dashboard, Customers, Partners, Admin section
- [ ] Active page highlighted
- [ ] Admin section visible only for ADMIN role

### 13.2 User Menu
- [ ] User dropdown shows name and email
- [ ] Profile link works
- [ ] Logout link works

### 13.3 Color Scheme Toggle
- [ ] Toggle between dark and light mode
- [ ] All page backgrounds update correctly (previous bug was fixed)
- [ ] All text remains readable in both modes
- [ ] Preference persists on page refresh

---

## 14. Profile Page

### 14.1 View Profile
- [ ] Email displays (read-only)
- [ ] Role badge displays
- [ ] Current name displays

### 14.2 Update Display Name
- [ ] Change name and save
- [ ] Success message shown
- [ ] Name updates in user menu/sidebar

### 14.3 Change Password
- [ ] Current password required
- [ ] Wrong current password shows error
- [ ] Password strength indicator updates as you type
- [ ] Passwords must match
- [ ] Successful change shows success message
- [ ] Can log in with new password

---

## 15. Role-Based Access Control

### 15.1 ADMIN Role (default test user)
- [ ] Can access all pages including /admin/*
- [ ] Can create, edit, delete customers
- [ ] Can create, edit, delete partners
- [ ] Can manage users, settings, catalog

### 15.2 EDITOR Role
- [ ] Create an EDITOR user (via admin invite)
- [ ] Log in as EDITOR
- [ ] Can view dashboard, customers, partners
- [ ] Can create and edit customers/partners
- [ ] Cannot delete customers/partners
- [ ] Cannot access /admin/* pages
- [ ] Admin nav items hidden

### 15.3 VIEWER Role
- [ ] Create a VIEWER user (via admin invite)
- [ ] Log in as VIEWER
- [ ] Can view dashboard, customers, partners
- [ ] Cannot create or edit anything
- [ ] New/Edit/Delete buttons hidden
- [ ] Cannot access /admin/* pages

---

## 16. Edge Cases & Error Handling

### 16.1 Empty States
- [ ] Customer list with no customers
- [ ] Partner list with no partners
- [ ] Customer with no services
- [ ] Customer with no contacts
- [ ] Audit log with no entries
- [ ] Search with no results

### 16.2 Long Content
- [ ] Very long customer name (100+ chars)
- [ ] Very long notes (1000+ chars)
- [ ] Many contacts on one customer (5+)
- [ ] Many services on one customer (10+)

### 16.3 Special Characters
- [ ] Customer name with special chars: "O'Brien & Co. (Ltd.)"
- [ ] Notes with HTML: "<script>alert('xss')</script>"
- [ ] Fields with unicode: "日本語テスト"

### 16.4 Concurrent Data
- [ ] After creating data in one tab, refreshing another tab shows updated data
- [ ] Dashboard stats update after CRUD operations

### 16.5 Network/API Errors
- [ ] Navigate to non-existent customer ID (/customers/fake-id)
- [ ] Navigate to non-existent partner ID
- [ ] Graceful error display (not white screen)

---

## Test Data Cleanup Order

After testing, clean up in this order (to respect foreign keys):
1. Delete test services
2. Delete test customers
3. Delete test partners
4. Delete test users (except admin)
5. Delete test service types

---

## Summary

| Section | Test Count |
|---------|-----------|
| 1. Setup Wizard | 13 |
| 2. Authentication | 8 |
| 3. Dashboard | 9 |
| 4. Customer CRUD | 31 |
| 5. Service CRUD | 20 |
| 6. Contacts Editor | 14 |
| 7. Partner CRUD | 21 |
| 8. Admin Users | 14 |
| 9. Admin Service Catalog | 22 |
| 10. Admin Settings | 12 |
| 11. Admin Audit Log | 10 |
| 12. Global Search | 7 |
| 13. Navigation & Layout | 10 |
| 14. Profile Page | 9 |
| 15. RBAC | 14 |
| 16. Edge Cases | 14 |
| **Total** | **228** |
