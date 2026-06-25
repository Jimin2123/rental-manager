-- 소셜 전용 계정은 이메일 없이 생성될 수 있음 (같은 이메일의 다른 프로바이더 계정 분리)
ALTER TABLE "Account" ALTER COLUMN "email" DROP NOT NULL;
