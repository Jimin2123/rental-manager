-- MaintenanceIntervalUnit enum 추가
CREATE TYPE "MaintenanceIntervalUnit" AS ENUM ('MONTH', 'DAY');

-- MaintenanceSchedule 테이블 생성
CREATE TABLE "MaintenanceSchedule" (
    "id"               TEXT        NOT NULL,
    "organizationId"   TEXT        NOT NULL,
    "rentalContractId" TEXT        NOT NULL,
    "intervalUnit"     "MaintenanceIntervalUnit" NOT NULL,
    "intervalValue"    INTEGER     NOT NULL,
    "nextScheduledAt"  TIMESTAMP(3) NOT NULL,
    "lastInspectedAt"  TIMESTAMP(3),
    "assignedStaffId"  TEXT,
    "isActive"         BOOLEAN     NOT NULL DEFAULT true,
    "memo"             TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- 인덱스
CREATE UNIQUE INDEX "MaintenanceSchedule_id_organizationId_key"
    ON "MaintenanceSchedule"("id", "organizationId");

CREATE INDEX "MaintenanceSchedule_organizationId_idx"
    ON "MaintenanceSchedule"("organizationId");

CREATE INDEX "MaintenanceSchedule_organizationId_rentalContractId_idx"
    ON "MaintenanceSchedule"("organizationId", "rentalContractId");

CREATE INDEX "MaintenanceSchedule_organizationId_nextScheduledAt_idx"
    ON "MaintenanceSchedule"("organizationId", "nextScheduledAt");

CREATE INDEX "MaintenanceSchedule_organizationId_isActive_idx"
    ON "MaintenanceSchedule"("organizationId", "isActive");

CREATE INDEX "MaintenanceSchedule_assignedStaffId_idx"
    ON "MaintenanceSchedule"("assignedStaffId");

-- FK 제약조건
ALTER TABLE "MaintenanceSchedule"
    ADD CONSTRAINT "MaintenanceSchedule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceSchedule"
    ADD CONSTRAINT "MaintenanceSchedule_rentalContractId_organizationId_fkey"
    FOREIGN KEY ("rentalContractId", "organizationId")
    REFERENCES "RentalContract"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceSchedule"
    ADD CONSTRAINT "MaintenanceSchedule_assignedStaffId_organizationId_fkey"
    FOREIGN KEY ("assignedStaffId", "organizationId")
    REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- intervalValue 양수 제약
ALTER TABLE "MaintenanceSchedule"
    ADD CONSTRAINT "MaintenanceSchedule_interval_value_positive_check"
    CHECK ("intervalValue" > 0);

-- ServiceRequest에 maintenanceScheduleId 컬럼 추가
ALTER TABLE "ServiceRequest"
    ADD COLUMN "maintenanceScheduleId" TEXT;

-- FK 제약조건 (nullable composite FK — maintenanceScheduleId가 NULL이면 검사 안 함)
ALTER TABLE "ServiceRequest"
    ADD CONSTRAINT "ServiceRequest_maintenanceScheduleId_organizationId_fkey"
    FOREIGN KEY ("maintenanceScheduleId", "organizationId")
    REFERENCES "MaintenanceSchedule"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 인덱스
CREATE INDEX "ServiceRequest_organizationId_maintenanceScheduleId_idx"
    ON "ServiceRequest"("organizationId", "maintenanceScheduleId");
