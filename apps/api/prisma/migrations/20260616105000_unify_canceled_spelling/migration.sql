-- CANCELLED → CANCELED 철자 통일
-- PostgreSQL 10+에서 지원하는 enum value rename
ALTER TYPE "OrderStatus" RENAME VALUE 'CANCELLED' TO 'CANCELED';
ALTER TYPE "RentalContractStatus" RENAME VALUE 'CANCELLED' TO 'CANCELED';
