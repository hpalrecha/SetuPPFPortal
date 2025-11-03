import * as XLSX from 'xlsx';

/**
 * Create sample Excel files for testing bulk upload scripts
 */

// Sample dealerships data
const dealershipsData = [
  { username: 'mumbai_dealer', oem_name: 'Hyundai India Ltd' },
  { username: 'delhi_dealer', oem_name: 'Hyundai India Ltd' },
  { username: 'bangalore_dealer', oem_name: '' }, // Will use default OEM
];

// Sample showrooms data
const showroomsData = [
  { username: 'andheri_showroom', dealership_code: 'DEAL_MUMBAI_DEALER' },
  { username: 'bandra_showroom', dealership_code: 'DEAL_MUMBAI_DEALER' },
  { username: 'vasant_kunj_showroom', dealership_code: 'DEAL_DELHI_DEALER' },
];

// Create dealerships Excel file
const dealershipsWS = XLSX.utils.json_to_sheet(dealershipsData);
const dealershipsWB = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(dealershipsWB, dealershipsWS, 'Dealerships');
XLSX.writeFile(dealershipsWB, 'sample-dealerships.xlsx');
console.log('✅ Created: sample-dealerships.xlsx');

// Create showrooms Excel file
const showroomsWS = XLSX.utils.json_to_sheet(showroomsData);
const showroomsWB = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(showroomsWB, showroomsWS, 'Showrooms');
XLSX.writeFile(showroomsWB, 'sample-showrooms.xlsx');
console.log('✅ Created: sample-showrooms.xlsx');

console.log('\n📝 Sample files created successfully!');
console.log('\nTest the scripts with:');
console.log('  npx tsx scripts/bulk-create-dealerships.ts sample-dealerships.xlsx');
console.log('  npx tsx scripts/bulk-create-showrooms.ts sample-showrooms.xlsx\n');
