import fs from 'fs';
import path from 'path';

// Parse CSV manually (simple approach for this specific format)
const csvPath = path.join(process.cwd(), 'attached_assets', 'Item_1759823628771.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const lines = csvContent.split('\n');
const materials: { name: string; brand: string | null }[] = [];

// Skip header (line 0) and process all data lines
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue; // Skip empty lines
  
  // Parse CSV line (handles quoted fields)
  const matches = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
  if (!matches) continue;
  
  const [, , , brand, itemName] = matches;
  
  if (itemName) {
    materials.push({
      name: itemName,
      brand: brand || null
    });
  }
}

console.log(`Found ${materials.length} materials to import`);

// Import materials via API
async function importMaterials() {
  let successCount = 0;
  let errorCount = 0;
  
  for (const material of materials) {
    try {
      const response = await fetch('http://localhost:5000/api/p91/raw_material/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: In production, you'd need to include auth headers
        },
        body: JSON.stringify({
          name: material.name,
          brand: material.brand
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✓ ${material.name} - ${result.message}`);
        successCount++;
      } else {
        const error = await response.text();
        console.error(`✗ ${material.name} - Error: ${error}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`✗ ${material.name} - Error:`, error);
      errorCount++;
    }
  }
  
  console.log(`\nImport complete: ${successCount} successful, ${errorCount} failed`);
}

// Run import
importMaterials().catch(console.error);
