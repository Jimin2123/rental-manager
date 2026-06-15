import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Prisma customer schema', () => {
  const prismaModelsPath = join(__dirname, '../../prisma/models');
  const prismaMigrationsPath = join(__dirname, '../../prisma/migrations');
  const prismaConfigPath = join(__dirname, '../../prisma.config.ts');

  it('loads the schema folder so split model files share one Prisma context', () => {
    const prismaConfig = readFileSync(prismaConfigPath, 'utf8');

    expect(prismaConfig).toContain("schema: 'prisma'");
  });

  it('models individual and business customers through distinct profile relations', () => {
    const individualProfilePath = join(prismaModelsPath, 'customers/individual-profile.prisma');

    const customerSchema = readFileSync(join(prismaModelsPath, 'customers/customer.prisma'), 'utf8');
    const businessPartnerSchema = readFileSync(join(prismaModelsPath, 'customers/business-partner.prisma'), 'utf8');
    const businessPartnerContactSchema = readFileSync(
      join(prismaModelsPath, 'business/business-partner-contact.prisma'),
      'utf8',
    );
    const addressSchema = readFileSync(join(prismaModelsPath, 'common/address.prisma'), 'utf8');

    expect(existsSync(individualProfilePath)).toBe(true);

    const individualProfileSchema = readFileSync(individualProfilePath, 'utf8');

    expect(customerSchema).toContain('individualProfileId String?');
    expect(customerSchema).toContain(
      'individualProfile   IndividualProfile? @relation(fields: [individualProfileId], references: [id], onDelete: Restrict)',
    );
    expect(customerSchema).toContain('businessPartnerId String?');
    expect(customerSchema).toContain(
      'businessPartner   BusinessPartner? @relation(fields: [businessPartnerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(customerSchema).toContain('@@index([individualProfileId])');
    expect(customerSchema).toContain('@@index([businessPartnerId])');

    expect(individualProfileSchema).toContain('model IndividualProfile');
    expect(individualProfileSchema).toContain('addressId String?  @unique');
    expect(individualProfileSchema).toContain('customers           Customer[]');
    expect(businessPartnerSchema).toContain('customers Customer[]');
    expect(businessPartnerSchema).toContain('@@unique([id, organizationId])');
    expect(businessPartnerContactSchema).toContain(
      'businessPartner   BusinessPartner @relation(fields: [businessPartnerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(addressSchema).toContain('individualProfile IndividualProfile?');
  });

  it('models internal staff assignment to customer contacts', () => {
    const organizationMemberPath = join(prismaModelsPath, 'business/organization-member.prisma');
    const customerAssignmentPath = join(prismaModelsPath, 'customers/customer-assignment.prisma');

    expect(existsSync(organizationMemberPath)).toBe(true);
    expect(existsSync(customerAssignmentPath)).toBe(true);

    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const organizationMemberSchema = readFileSync(organizationMemberPath, 'utf8');
    const customerSchema = readFileSync(join(prismaModelsPath, 'customers/customer.prisma'), 'utf8');
    const customerAssignmentSchema = readFileSync(customerAssignmentPath, 'utf8');
    const businessPartnerContactSchema = readFileSync(
      join(prismaModelsPath, 'business/business-partner-contact.prisma'),
      'utf8',
    );
    const individualProfileSchema = readFileSync(join(prismaModelsPath, 'customers/individual-profile.prisma'), 'utf8');

    expect(organizationSchema).toContain('members                 OrganizationMember[]');
    expect(organizationSchema).toContain('customerAssignments     CustomerAssignment[]');

    expect(organizationMemberSchema).toContain('model OrganizationMember');
    expect(organizationMemberSchema).toContain('customerAssignments CustomerAssignment[]');
    expect(organizationMemberSchema).toContain('@@unique([id, organizationId])');

    expect(customerSchema).toContain('assignments CustomerAssignment[]');
    expect(businessPartnerContactSchema).toContain('customerAssignments CustomerAssignment[]');
    expect(individualProfileSchema).toContain('customerAssignments CustomerAssignment[]');

    expect(customerAssignmentSchema).toContain('model CustomerAssignment');
    expect(customerAssignmentSchema).toContain(
      'organizationMember   OrganizationMember @relation(fields: [organizationMemberId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(customerAssignmentSchema).toContain('customerContactId String?');
    expect(customerAssignmentSchema).toContain('individualProfileId String?');
    expect(customerAssignmentSchema).toContain('endedAt   DateTime?');
  });

  it('adds database integrity guards for cross-model rules Prisma cannot express', () => {
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260615190000_initial_schema_integrity/migration.sql'),
      'utf8',
    );

    expect(migration).toContain('Customer_type_profile_check');
    expect(migration).toContain('Customer_active_individual_profile_unique');
    expect(migration).toContain('Customer_active_business_partner_unique');
    expect(migration).toContain('BusinessPartnerContact_one_primary_per_partner');
    expect(migration).toContain('assert_business_profile_single_owner');
    expect(migration).toContain('assert_address_single_owner');
    expect(migration).toContain('assert_business_partner_registration_unique');
    expect(migration).toContain('CustomerAssignment_contact_target_check');
    expect(migration).toContain('CustomerAssignment_one_primary_active_assignee');
    expect(migration).toContain('assert_customer_assignment_scope');
  });
});
