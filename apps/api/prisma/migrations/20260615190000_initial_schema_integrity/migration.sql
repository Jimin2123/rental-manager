-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "zonecode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "addressDetail" TEXT,
    "jibunAddress" TEXT,
    "roadAddress" TEXT,
    "buildingName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessRegistrationNo" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "businessType" TEXT,
    "businessItem" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPartner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "addressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndividualProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "individualProfileId" TEXT,
    "businessPartnerId" TEXT,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Customer_type_profile_check" CHECK (
        (
            "type" = 'INDIVIDUAL'
            AND "individualProfileId" IS NOT NULL
            AND "businessPartnerId" IS NULL
        )
        OR (
            "type" = 'BUSINESS'
            AND "businessPartnerId" IS NOT NULL
            AND "individualProfileId" IS NULL
        )
    )
);

-- CreateTable
CREATE TABLE "BusinessPartnerContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessPartnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationMemberId" TEXT NOT NULL,
    "customerContactId" TEXT,
    "individualProfileId" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerAssignment_contact_target_check" CHECK (
        (
            "customerContactId" IS NOT NULL
            AND "individualProfileId" IS NULL
        )
        OR (
            "customerContactId" IS NULL
            AND "individualProfileId" IS NOT NULL
        )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_addressId_key" ON "BusinessProfile"("addressId");
CREATE INDEX "BusinessProfile_name_idx" ON "BusinessProfile"("name");
CREATE INDEX "BusinessProfile_businessRegistrationNo_idx" ON "BusinessProfile"("businessRegistrationNo");

CREATE UNIQUE INDEX "Organization_businessProfileId_key" ON "Organization"("businessProfileId");

CREATE UNIQUE INDEX "BusinessPartner_businessProfileId_key" ON "BusinessPartner"("businessProfileId");
CREATE UNIQUE INDEX "BusinessPartner_id_organizationId_key" ON "BusinessPartner"("id", "organizationId");
CREATE INDEX "BusinessPartner_organizationId_idx" ON "BusinessPartner"("organizationId");
CREATE INDEX "BusinessPartner_organizationId_isActive_idx" ON "BusinessPartner"("organizationId", "isActive");

CREATE UNIQUE INDEX "IndividualProfile_addressId_key" ON "IndividualProfile"("addressId");
CREATE INDEX "IndividualProfile_name_idx" ON "IndividualProfile"("name");
CREATE INDEX "IndividualProfile_phone_idx" ON "IndividualProfile"("phone");

CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE INDEX "Customer_organizationId_type_idx" ON "Customer"("organizationId", "type");
CREATE INDEX "Customer_organizationId_deletedAt_idx" ON "Customer"("organizationId", "deletedAt");
CREATE INDEX "Customer_individualProfileId_idx" ON "Customer"("individualProfileId");
CREATE INDEX "Customer_businessPartnerId_idx" ON "Customer"("businessPartnerId");
CREATE UNIQUE INDEX "Customer_id_organizationId_key" ON "Customer"("id", "organizationId");
CREATE UNIQUE INDEX "Customer_active_individual_profile_unique"
    ON "Customer"("individualProfileId")
    WHERE "deletedAt" IS NULL AND "individualProfileId" IS NOT NULL;
CREATE UNIQUE INDEX "Customer_active_business_partner_unique"
    ON "Customer"("businessPartnerId")
    WHERE "deletedAt" IS NULL AND "businessPartnerId" IS NOT NULL;

CREATE INDEX "BusinessPartnerContact_organizationId_idx" ON "BusinessPartnerContact"("organizationId");
CREATE INDEX "BusinessPartnerContact_organizationId_businessPartnerId_idx"
    ON "BusinessPartnerContact"("organizationId", "businessPartnerId");
CREATE INDEX "BusinessPartnerContact_organizationId_name_idx" ON "BusinessPartnerContact"("organizationId", "name");
CREATE INDEX "BusinessPartnerContact_organizationId_phone_idx" ON "BusinessPartnerContact"("organizationId", "phone");
CREATE INDEX "BusinessPartnerContact_organizationId_isPrimary_idx"
    ON "BusinessPartnerContact"("organizationId", "isPrimary");
CREATE UNIQUE INDEX "BusinessPartnerContact_one_primary_per_partner"
    ON "BusinessPartnerContact"("organizationId", "businessPartnerId")
    WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "OrganizationMember_id_organizationId_key" ON "OrganizationMember"("id", "organizationId");
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");
CREATE INDEX "OrganizationMember_organizationId_name_idx" ON "OrganizationMember"("organizationId", "name");
CREATE INDEX "OrganizationMember_organizationId_isActive_idx"
    ON "OrganizationMember"("organizationId", "isActive");

CREATE INDEX "CustomerAssignment_organizationId_idx" ON "CustomerAssignment"("organizationId");
CREATE INDEX "CustomerAssignment_organizationId_customerId_idx"
    ON "CustomerAssignment"("organizationId", "customerId");
CREATE INDEX "CustomerAssignment_organizationMemberId_idx" ON "CustomerAssignment"("organizationMemberId");
CREATE INDEX "CustomerAssignment_customerContactId_idx" ON "CustomerAssignment"("customerContactId");
CREATE INDEX "CustomerAssignment_individualProfileId_idx" ON "CustomerAssignment"("individualProfileId");
CREATE INDEX "CustomerAssignment_endedAt_idx" ON "CustomerAssignment"("endedAt");
CREATE UNIQUE INDEX "CustomerAssignment_one_primary_active_assignee"
    ON "CustomerAssignment"("organizationId", "customerId")
    WHERE "isPrimary" = true AND "endedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "BusinessProfile"
    ADD CONSTRAINT "BusinessProfile_addressId_fkey"
    FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessPartner"
    ADD CONSTRAINT "BusinessPartner_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessPartner"
    ADD CONSTRAINT "BusinessPartner_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IndividualProfile"
    ADD CONSTRAINT "IndividualProfile_addressId_fkey"
    FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_individualProfileId_fkey"
    FOREIGN KEY ("individualProfileId") REFERENCES "IndividualProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_businessPartnerId_organizationId_fkey"
    FOREIGN KEY ("businessPartnerId", "organizationId")
    REFERENCES "BusinessPartner"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessPartnerContact"
    ADD CONSTRAINT "BusinessPartnerContact_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessPartnerContact"
    ADD CONSTRAINT "BusinessPartnerContact_businessPartnerId_organizationId_fkey"
    FOREIGN KEY ("businessPartnerId", "organizationId")
    REFERENCES "BusinessPartner"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerAssignment"
    ADD CONSTRAINT "CustomerAssignment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerAssignment"
    ADD CONSTRAINT "CustomerAssignment_customerId_organizationId_fkey"
    FOREIGN KEY ("customerId", "organizationId")
    REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerAssignment"
    ADD CONSTRAINT "CustomerAssignment_organizationMemberId_organizationId_fkey"
    FOREIGN KEY ("organizationMemberId", "organizationId")
    REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerAssignment"
    ADD CONSTRAINT "CustomerAssignment_customerContactId_fkey"
    FOREIGN KEY ("customerContactId") REFERENCES "BusinessPartnerContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerAssignment"
    ADD CONSTRAINT "CustomerAssignment_individualProfileId_fkey"
    FOREIGN KEY ("individualProfileId") REFERENCES "IndividualProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-table integrity guards.
CREATE OR REPLACE FUNCTION "assert_business_profile_single_owner"()
RETURNS trigger AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'Organization' THEN
        SELECT COUNT(*)
        INTO conflict_count
        FROM "BusinessPartner"
        WHERE "businessProfileId" = NEW."businessProfileId";
    ELSE
        SELECT COUNT(*)
        INTO conflict_count
        FROM "Organization"
        WHERE "businessProfileId" = NEW."businessProfileId";
    END IF;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'BusinessProfile % already belongs to another owner', NEW."businessProfileId";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Organization_business_profile_single_owner"
BEFORE INSERT OR UPDATE OF "businessProfileId" ON "Organization"
FOR EACH ROW EXECUTE FUNCTION "assert_business_profile_single_owner"();

CREATE TRIGGER "BusinessPartner_business_profile_single_owner"
BEFORE INSERT OR UPDATE OF "businessProfileId" ON "BusinessPartner"
FOR EACH ROW EXECUTE FUNCTION "assert_business_profile_single_owner"();

CREATE OR REPLACE FUNCTION "assert_address_single_owner"()
RETURNS trigger AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'BusinessProfile' THEN
        SELECT COUNT(*)
        INTO conflict_count
        FROM "IndividualProfile"
        WHERE "addressId" = NEW."addressId";
    ELSE
        SELECT COUNT(*)
        INTO conflict_count
        FROM "BusinessProfile"
        WHERE "addressId" = NEW."addressId";
    END IF;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Address % already belongs to another owner', NEW."addressId";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BusinessProfile_address_single_owner"
BEFORE INSERT OR UPDATE OF "addressId" ON "BusinessProfile"
FOR EACH ROW EXECUTE FUNCTION "assert_address_single_owner"();

CREATE TRIGGER "IndividualProfile_address_single_owner"
BEFORE INSERT OR UPDATE OF "addressId" ON "IndividualProfile"
FOR EACH ROW
WHEN (NEW."addressId" IS NOT NULL)
EXECUTE FUNCTION "assert_address_single_owner"();

CREATE OR REPLACE FUNCTION "assert_business_partner_registration_unique"()
RETURNS trigger AS $$
DECLARE
    registration_no TEXT;
    conflict_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'BusinessPartner' THEN
        IF NEW."deletedAt" IS NOT NULL THEN
            RETURN NEW;
        END IF;

        SELECT "businessRegistrationNo"
        INTO registration_no
        FROM "BusinessProfile"
        WHERE "id" = NEW."businessProfileId";

        SELECT COUNT(*)
        INTO conflict_count
        FROM "BusinessPartner" AS bp
        INNER JOIN "BusinessProfile" AS profile ON profile."id" = bp."businessProfileId"
        WHERE bp."organizationId" = NEW."organizationId"
          AND bp."id" <> NEW."id"
          AND bp."deletedAt" IS NULL
          AND profile."businessRegistrationNo" = registration_no;
    ELSE
        SELECT COUNT(*)
        INTO conflict_count
        FROM "BusinessPartner" AS owner_bp
        INNER JOIN "BusinessPartner" AS other_bp
            ON other_bp."organizationId" = owner_bp."organizationId"
           AND other_bp."id" <> owner_bp."id"
           AND other_bp."deletedAt" IS NULL
        INNER JOIN "BusinessProfile" AS other_profile
            ON other_profile."id" = other_bp."businessProfileId"
        WHERE owner_bp."businessProfileId" = NEW."id"
          AND owner_bp."deletedAt" IS NULL
          AND other_profile."businessRegistrationNo" = NEW."businessRegistrationNo";
    END IF;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Business registration number is duplicated inside the organization';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BusinessPartner_registration_unique"
BEFORE INSERT OR UPDATE OF "organizationId", "businessProfileId", "deletedAt" ON "BusinessPartner"
FOR EACH ROW EXECUTE FUNCTION "assert_business_partner_registration_unique"();

CREATE TRIGGER "BusinessProfile_registration_unique"
BEFORE UPDATE OF "businessRegistrationNo" ON "BusinessProfile"
FOR EACH ROW EXECUTE FUNCTION "assert_business_partner_registration_unique"();

CREATE OR REPLACE FUNCTION "assert_customer_assignment_scope"()
RETURNS trigger AS $$
DECLARE
    customer_type "CustomerType";
    customer_individual_profile_id TEXT;
    customer_business_partner_id TEXT;
    contact_count INTEGER;
BEGIN
    SELECT "type", "individualProfileId", "businessPartnerId"
    INTO customer_type, customer_individual_profile_id, customer_business_partner_id
    FROM "Customer"
    WHERE "id" = NEW."customerId"
      AND "organizationId" = NEW."organizationId"
      AND "deletedAt" IS NULL;

    IF customer_type IS NULL THEN
        RAISE EXCEPTION 'CustomerAssignment customer must be an active customer in the same organization';
    END IF;

    IF customer_type = 'INDIVIDUAL' THEN
        IF NEW."individualProfileId" IS DISTINCT FROM customer_individual_profile_id OR NEW."customerContactId" IS NOT NULL THEN
            RAISE EXCEPTION 'Individual customer assignment must target the customer individual profile';
        END IF;
    ELSE
        IF NEW."customerContactId" IS NULL OR NEW."individualProfileId" IS NOT NULL THEN
            RAISE EXCEPTION 'Business customer assignment must target a business partner contact';
        END IF;

        SELECT COUNT(*)
        INTO contact_count
        FROM "BusinessPartnerContact"
        WHERE "id" = NEW."customerContactId"
          AND "organizationId" = NEW."organizationId"
          AND "businessPartnerId" = customer_business_partner_id;

        IF contact_count = 0 THEN
            RAISE EXCEPTION 'CustomerAssignment contact must belong to the customer business partner';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CustomerAssignment_scope"
BEFORE INSERT OR UPDATE OF "organizationId", "customerId", "customerContactId", "individualProfileId" ON "CustomerAssignment"
FOR EACH ROW EXECUTE FUNCTION "assert_customer_assignment_scope"();
