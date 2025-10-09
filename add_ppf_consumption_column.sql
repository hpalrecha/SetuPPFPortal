-- Add PPF Quantity Consumption field to vehicle_variants table
ALTER TABLE vehicle_variants 
ADD COLUMN IF NOT EXISTS ppf_qty_consumption NUMERIC(10, 2) DEFAULT 0.00;

-- Add comment for documentation
COMMENT ON COLUMN vehicle_variants.ppf_qty_consumption IS 'PPF material consumption in square feet - used for inventory planning and pricing benchmarks';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'vehicle_variants' 
AND column_name = 'ppf_qty_consumption';
