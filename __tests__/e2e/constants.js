// Shared constants for the E2E suite.
const ADMIN = {
  name: 'E2E Admin',
  email: 'e2e-admin@example.com',
  password: 'E2eStr0ng!Pass',
};

const AUTH_STATE = 'playwright/.auth/admin.json';

module.exports = { ADMIN, AUTH_STATE };
