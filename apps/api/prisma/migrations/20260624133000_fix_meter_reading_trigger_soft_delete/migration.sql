-- Rebuild sequence integrity trigger to exclude soft-deleted readings
CREATE OR REPLACE FUNCTION "assert_meter_reading_sequence_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  previous_reading RECORD;
  next_reading RECORD;
BEGIN
  SELECT "MeterReading"."blackCount", "MeterReading"."colorCount"
  INTO previous_reading
  FROM "MeterReading"
  WHERE "MeterReading"."organizationId" = NEW."organizationId"
    AND "MeterReading"."assetId" = NEW."assetId"
    AND "MeterReading"."readingDate" < NEW."readingDate"
    AND "MeterReading"."deletedAt" IS NULL
  ORDER BY "MeterReading"."readingDate" DESC, "MeterReading"."createdAt" DESC
  LIMIT 1;

  IF FOUND THEN
    IF NEW."blackCount" < previous_reading."blackCount" THEN
      RAISE EXCEPTION 'MeterReading blackCount must be monotonic for asset %', NEW."assetId";
    END IF;

    IF NEW."blackUsage" <> NEW."blackCount" - previous_reading."blackCount" THEN
      RAISE EXCEPTION 'MeterReading blackUsage must equal blackCount delta for asset %', NEW."assetId";
    END IF;

    IF NEW."colorCount" IS NOT NULL AND previous_reading."colorCount" IS NOT NULL THEN
      IF NEW."colorCount" < previous_reading."colorCount" THEN
        RAISE EXCEPTION 'MeterReading colorCount must be monotonic for asset %', NEW."assetId";
      END IF;

      IF NEW."colorUsage" <> NEW."colorCount" - previous_reading."colorCount" THEN
        RAISE EXCEPTION 'MeterReading colorUsage must equal colorCount delta for asset %', NEW."assetId";
      END IF;
    END IF;
  END IF;

  SELECT "MeterReading"."blackCount", "MeterReading"."blackUsage", "MeterReading"."colorCount", "MeterReading"."colorUsage"
  INTO next_reading
  FROM "MeterReading"
  WHERE "MeterReading"."organizationId" = NEW."organizationId"
    AND "MeterReading"."assetId" = NEW."assetId"
    AND "MeterReading"."readingDate" > NEW."readingDate"
    AND "MeterReading"."deletedAt" IS NULL
  ORDER BY "MeterReading"."readingDate" ASC, "MeterReading"."createdAt" ASC
  LIMIT 1;

  IF FOUND THEN
    IF next_reading."blackCount" < NEW."blackCount" THEN
      RAISE EXCEPTION 'MeterReading blackCount cannot exceed next reading for asset %', NEW."assetId";
    END IF;

    IF next_reading."blackUsage" <> next_reading."blackCount" - NEW."blackCount" THEN
      RAISE EXCEPTION 'Next MeterReading blackUsage must equal blackCount delta for asset %', NEW."assetId";
    END IF;

    IF next_reading."colorCount" IS NOT NULL AND NEW."colorCount" IS NOT NULL THEN
      IF next_reading."colorCount" < NEW."colorCount" THEN
        RAISE EXCEPTION 'MeterReading colorCount cannot exceed next reading for asset %', NEW."assetId";
      END IF;

      IF next_reading."colorUsage" <> next_reading."colorCount" - NEW."colorCount" THEN
        RAISE EXCEPTION 'Next MeterReading colorUsage must equal colorCount delta for asset %', NEW."assetId";
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
