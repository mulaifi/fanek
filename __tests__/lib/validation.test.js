import { customerSchema, partnerSchema, serviceTypeFieldSchema } from '@/lib/validation';
describe('validation', () => {
  test('customerSchema accepts valid customer', () => {
    const result = customerSchema.safeParse({
      name: 'Acme Corp',
      clientCode: 'ACME-001',
      status: 'Active',
    });
    expect(result.success).toBe(true);
  });
  test('customerSchema rejects missing name', () => {
    const result = customerSchema.safeParse({ clientCode: 'X' });
    expect(result.success).toBe(false);
  });
  test('partnerSchema accepts valid partner', () => {
    const result = partnerSchema.safeParse({
      name: 'AWS',
      type: 'Vendor',
    });
    expect(result.success).toBe(true);
  });
  test('serviceTypeFieldSchema validates field definitions', () => {
    const result = serviceTypeFieldSchema.safeParse({
      name: 'cpu_count',
      label: 'CPU Count',
      type: 'number',
      required: true,
    });
    expect(result.success).toBe(true);
  });
  test('serviceTypeFieldSchema rejects invalid type', () => {
    const result = serviceTypeFieldSchema.safeParse({
      name: 'x',
      label: 'X',
      type: 'invalid',
      required: false,
    });
    expect(result.success).toBe(false);
  });
});
