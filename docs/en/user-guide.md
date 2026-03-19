# Fanek User Guide

This guide is for Editors and Viewers who use Fanek day-to-day to manage customer and partner information. If you need to configure the system, add users, or manage the service catalog, see the Admin Guide instead.


## 1. Getting Started

### First login

When an administrator creates your account, they will give you a temporary password. Use that password along with your email address to log in at your Fanek URL.

On first login, Fanek detects that your password has never been changed and immediately redirects you to a password change screen. You must set a new password before you can access anything else.

**Setting your first password:**

1. Enter the temporary password in the **Current Password** field.
2. Type your new password in the **New Password** field. As you type, a strength meter below the field shows whether your password is Too Short, Weak, Fair, Good, or Strong. Aim for at least "Good," which requires a password of 12 or more characters that includes at least one uppercase letter and one special character.
3. Confirm the new password in the **Confirm New Password** field.
4. Click **Change Password**.

After a brief pause, Fanek redirects you to the Dashboard and your account is fully active.

### Setting up your profile

Your profile controls your display name and the language the interface uses. To reach it, click your avatar or initials at the bottom of the sidebar, then select **Profile** from the dropdown menu that appears.

On the Profile page you can:

- **Update your display name** by editing the Full Name field and clicking **Save Name**. Your name appears in the sidebar and in audit records.
- **Change your language** by choosing English or Arabic from the Language dropdown. The page reloads immediately in the chosen language. Arabic switches the entire layout to right-to-left.
- **Change your password** at any time using the Change Password form at the bottom of the page.

### Navigating the application

On a desktop or laptop, navigation lives in the sidebar on the left side of the screen (or right side in Arabic). The sidebar shows three main sections:

- **Dashboard** -- the home screen with summary statistics
- **Customers** -- your customer list
- **Partners** -- your partner list

If you are an Admin, additional Administration links appear below a separator.

The sidebar starts expanded, showing labels beside each icon. You can collapse it to a narrow icon-only rail by clicking the collapse button at the very bottom of the sidebar. Click it again (or hover over an icon to see its tooltip) to expand. Your preference is saved in the browser so it persists across sessions.

On a mobile phone or small tablet, the sidebar is replaced by a row of tabs fixed to the bottom of the screen. Tap a tab to navigate.

A top bar runs across the top of every page. It shows the current page title on the left, and a search bar, language switcher (AR / EN), and a dark/light theme toggle on the right.


## 2. Dashboard

The Dashboard is the first thing you see after logging in. It gives you a live summary of the data in the system.

The top row shows three stat cards: **Total Customers**, **Total Services**, and **Total Partners**. Each card displays the current count with a loading animation while the data is being fetched.

Below the stat cards are two charts side by side:

- **Customers by Status** -- a list of each customer status (Active, Inactive, and any custom statuses your administrator has configured) with a count badge for each.
- **Services by Type** -- a bar chart showing how many services of each type are active across all customers. The bars are labelled with the service type names defined in the catalog.

At the bottom, a **Recent Customers** table shows the most recently updated customers. Clicking any row opens that customer's detail page.


## 3. Customers

### Browsing the customer list

Go to **Customers** in the sidebar to see all customers. The list loads 25 records at a time, sorted by most recently updated by default.

To find a specific customer, type in the search box and press Enter. The search matches against customer name and client code.

To filter by status, use the status dropdown to the right of the search box. It defaults to "Active." Select **All Statuses** to see every customer regardless of status.

Click any column header that is underlined to sort by that column. Click again to reverse the sort order. The columns you can sort are **Name** and **Last Updated**.

Use the pagination controls at the bottom of the table to move between pages.

### Creating a customer

Editors and Admins see a **New Customer** button at the top right of the customer list. Click it to open the creation form.

The only required field is **Customer Name**. The following fields are optional:

- **Client Code** -- your internal identifier for this customer (displayed in the list alongside the name)
- **Status** -- defaults to Active
- **Vertical** -- the industry or sector the customer operates in
- **Website** -- must begin with `http://` or `https://`
- **Address** -- freeform text

After saving, Fanek opens the new customer's detail page.

### The customer detail page

A customer's detail page is divided into four tabs: **Info**, **Services**, **Contacts**, and **Notes**.

**Info tab** shows the customer's vertical, website (as a clickable link), address, creation date, and last-updated date. To edit any of these fields, click the pencil icon at the top right of the page. An inline edit form replaces the header area. Make your changes and click **Save Changes**, or click **Cancel** to discard them.

**Services tab** shows all services subscribed by this customer, grouped by service type. See Section 4 for a full walkthrough of adding and editing services.

**Contacts tab** lets you manage the people associated with this customer. See Section 5.

**Notes tab** provides a freeform text area for internal notes. Type your notes and click **Save Notes**. Notes are saved per-customer and are visible to all users.

### Exporting customers

The **Export CSV** button at the top right of the customer list downloads all customers (not just the current page or filter) as a comma-separated file you can open in a spreadsheet application.

### Deleting a customer

Only Admins can delete customers. On the customer detail page, Admin users see a trash icon next to the pencil icon. Clicking the trash icon does not immediately delete -- a **Confirm?** button appears in its place. You must click **Confirm?** within 5 seconds to proceed, or click anywhere outside the confirmation area to cancel. If you do nothing, click **Cancel**, or click outside the confirmation area, the delete is aborted. This two-step pattern prevents accidental deletion and provides sufficient time for all users, including those using assistive technologies.


## 4. Services

### What is a service?

In Fanek, a service is not a category or a product type -- it is a specific instance of a service that a customer has subscribed to. For example, if your company provides cloud hosting, and a particular customer has two hosting contracts, that customer would have two separate service records, both of the type "Cloud Hosting."

The fields that appear on each service are defined by your administrator in the Service Catalog. Different service types have completely different fields. A "Leased Line" type might have fields for bandwidth and circuit ID, while a "Software License" type might have fields for license count and expiry date.

### Adding a service to a customer

1. Open the customer's detail page and click the **Services** tab.
2. Click **Add Service** (visible to Editors and Admins).
3. A form appears at the top of the tab. Use the **Service Type** dropdown to select the type of service you are adding. The dropdown lists only the active service types your administrator has configured.
4. As soon as you select a type, the dynamic form below populates with that type's fields. Fill in all required fields (marked with a red asterisk) and any optional fields that are relevant.
5. Click **Add Service** to save.

The new service appears immediately in the services list, grouped under its type heading.

### Field types you will encounter

The fields in a service form can be any of the following types, depending on how the administrator configured that service type:

- **Text** -- a plain text input, for things like account numbers, hostnames, or notes
- **Number** -- accepts numeric values only
- **Date** -- a date picker
- **Select** -- a dropdown with fixed options defined by the administrator
- **Currency** -- a number field prefixed with a currency symbol (such as $); accepts decimal values
- **Boolean** -- a checkbox, used for yes/no questions such as "Managed?" or "Auto-renew?"

Required fields show a red asterisk next to their label. You cannot save the service until all required fields are filled in.

### Editing a service

Each service card in the Services tab has a pencil icon on the right. Click it to open the inline edit form for that service. The form shows the same fields as when you added the service, pre-filled with the current values. Make your changes and click **Save Changes**, or click **Cancel** to discard.

### Deleting a service

Only Admins can delete services. The trash icon appears next to the pencil icon on each service card for Admin users. Like customer deletion, service deletion requires two clicks: first click the trash icon, then click **Confirm?** within 3 seconds. Click **Cancel** or wait 3 seconds to abort.


## 5. Contacts

Contacts are the people you deal with at a customer or partner organisation. Each customer and each partner can have multiple contacts. Contacts are stored directly on the record, not as separate entities.

### Viewing contacts

Open a customer or partner's detail page and click the **Contacts** tab (for customers) or scroll to the Contacts card (for partners). Each contact is shown in a card with their name, title, email addresses, and phone numbers. Each email and phone has a category badge (Work, Personal, Mobile, Direct, etc.) to help distinguish multiple entries.

Viewers can see contacts but cannot edit them.

### Adding and editing contacts

Editors and Admins can manage contacts. Click **Add Contact** to create a new contact entry. A new card opens immediately in edit mode.

In the edit form for a contact you can:

- Enter the contact's **Name** and **Title / Role**.
- Add one or more **email addresses**. Click **Add Email** to add another row. Each email has a category dropdown with options: Work, Personal, Other.
- Add one or more **phone numbers**. Click **Add Phone** to add another row. Each phone has a category dropdown with options: Mobile, Work, Direct, Fax, Other.
- Remove an individual email or phone using its trash icon.

When you are done editing, click **Save & Close**. This saves the entire contact list (all contacts on the record) to the server and collapses the form back to the read-only view. If you close the edit form without clicking Save & Close, your changes to that contact are not saved.

To edit an existing contact, click the pencil icon on its card. To remove a contact entirely, click its trash icon (either in edit mode or in the read-only card view).


## 6. Partners

Partners represent the organisations you work with -- resellers, distributors, technology partners, and similar relationships. They work similarly to customers but have a simpler structure with no services.

### Browsing and filtering the partner list

Go to **Partners** in the sidebar. The list supports the same search and pagination as the customer list. Type a name in the search box and press Enter to search.

To filter by partner type, use the type dropdown. The available types are: Reseller, Distributor, Technology, Service, Referral, and Other. Select **All Types** to remove the filter.

Clicking any row opens the partner's detail page.

### Creating a partner

Click **New Partner** (visible to Editors and Admins). The required field is **Partner Name**. Optional fields:

- **Type** -- one of the six partner types listed above
- **Website** -- must begin with `http://` or `https://`
- **Address** -- freeform text
- **Notes** -- any notes about this partner (visible on the detail page)

### The partner detail page

The partner detail page shows two cards side by side: **Details** (website, address, creation date, last-updated date) and **Notes**. Below those cards, a **Contacts** section uses the same contacts editor described in Section 5.

To edit the partner's details, click the pencil icon at the top right. An inline form replaces the header. Save or cancel as usual.

Admins can delete a partner using the same two-click trash icon pattern described in Section 3.

### Exporting partners

The **Export CSV** button downloads all partners as a CSV file.


## 7. Search

Fanek includes a spotlight-style search that lets you quickly jump to any customer, partner, or service without navigating through lists.

**To open search:**

- Press **Cmd+K** on a Mac, or **Ctrl+K** on Windows and Linux.
- Or click the search bar in the top bar of any page.

A dialog opens with a text input. Type at least 2 characters and results appear automatically, grouped into Customers, Partners, and Services sections. Click any result to navigate directly to that record's detail page. The dialog closes automatically after you select a result.

Press **Escape** to close the search dialog without navigating anywhere.


## 8. Language and Theme

### Switching language

The language switcher in the top bar shows **AR** and **EN** buttons. Click one to switch the interface language. The page reloads in the selected language. Arabic switches the entire layout to right-to-left, including the sidebar, table columns, and form fields.

Your language preference is saved to your profile on the server, so it applies on any device you log in from.

You can also change your language from the Profile page using the Language dropdown in the Language section.

### Switching between dark and light mode

The sun/moon icon in the top bar toggles between light mode and dark mode. Click it to switch. Your preference is saved in the browser.
