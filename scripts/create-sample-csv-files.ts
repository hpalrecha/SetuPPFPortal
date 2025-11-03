import * as fs from 'fs';

/**
 * Create sample CSV files for testing bulk upload scripts
 */

// Sample dealerships CSV
const dealershipsCSV = `username,oem_name
mumbai_dealer,Hyundai India Ltd
delhi_dealer,Hyundai India Ltd
bangalore_dealer,`;

// Sample showrooms CSV
const showroomsCSV = `username,dealership_code
andheri_showroom,DEAL_MUMBAI_DEALER
bandra_showroom,DEAL_MUMBAI_DEALER
vasant_kunj_showroom,DEAL_DELHI_DEALER`;

// Create CSV files
fs.writeFileSync('sample-dealerships.csv', dealershipsCSV);
console.log('✅ Created: sample-dealerships.csv');

fs.writeFileSync('sample-showrooms.csv', showroomsCSV);
console.log('✅ Created: sample-showrooms.csv');

console.log('\n📝 Sample CSV files created successfully!');
console.log('\nTest the scripts with:');
console.log('  npx tsx scripts/bulk-create-dealerships.ts sample-dealerships.csv');
console.log('  npx tsx scripts/bulk-create-showrooms.ts sample-showrooms.csv\n');
