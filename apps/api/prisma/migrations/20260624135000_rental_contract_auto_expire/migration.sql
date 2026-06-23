-- AlterTable: RentalContract에 autoExpire 컬럼 추가
ALTER TABLE "RentalContract" ADD COLUMN "autoExpire" BOOLEAN NOT NULL DEFAULT TRUE;
