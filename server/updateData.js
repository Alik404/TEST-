import { db } from './database.js';

const zoneCData = [
  { code: 'C38', white_date: '10/6/2026', white_applied: 1, white_extra: 2, white_marked: 15, brown_date: '10/6/2026', brown_applied: 3, brown_extra: 2, brown_marked: 20 },
  { code: 'C37', white_date: '10/6/2026', white_applied: 1, white_extra: 2, white_marked: 6, brown_date: '10/6/2026', brown_applied: 1, brown_extra: 2, brown_marked: 23 },
  { code: 'C36', white_date: '10/6/2026', white_applied: 1, white_extra: 2, white_marked: 12, brown_date: '10/6/2026', brown_applied: 2, brown_extra: 4, brown_marked: 33 },
  { code: 'C35', white_date: '10/6/2026', white_applied: 0, white_extra: 0, white_marked: 19, brown_date: '10/6/2026', brown_applied: 5, brown_extra: 2, brown_marked: 30 },
  { code: 'C34', white_date: '10/6/2026', white_applied: 13, white_extra: 2, white_marked: 35, brown_date: '10/6/2026', brown_applied: 22, brown_extra: 1, brown_marked: 43 },
  { code: 'C33', white_date: '10/6/2026', white_applied: 14, white_extra: 2, white_marked: 31, brown_date: '10/6/2026', brown_applied: 18, brown_extra: 1, brown_marked: 43 },
  { code: 'C32', white_date: '10/6/2026', white_applied: 11, white_extra: 12, white_marked: 48, brown_date: '10/6/2026', brown_applied: 27, brown_extra: 11, brown_marked: 59 },
  { code: 'C31', white_date: '10/6/2026', white_applied: 13, white_extra: 1, white_marked: 36, brown_date: '10/6/2026', brown_applied: 32, brown_extra: 5, brown_marked: 64 },
  { code: 'C30', white_date: '10/6/2026', white_applied: 26, white_extra: 3, white_marked: 31, brown_date: '10/6/2026', brown_applied: 31, brown_extra: 4, brown_marked: 39 },
  { code: 'C29', white_date: '10/6/2026', white_applied: 23, white_extra: 1, white_marked: 66, brown_date: '10/6/2026', brown_applied: 29, brown_extra: 4, brown_marked: 69 },
  { code: 'C28', white_date: '10/6/2026', white_applied: 15, white_extra: 0, white_marked: 47, brown_date: '10/6/2026', brown_applied: 10, brown_extra: 0, brown_marked: 56 },
  { code: 'C27', white_date: '10/6/2026', white_applied: 13, white_extra: 2, white_marked: 49, brown_date: '10/6/2026', brown_applied: 25, brown_extra: 0, brown_marked: 58 },
  { code: 'C26', white_date: '10/6/2026', white_applied: 16, white_extra: 0, white_marked: 41, brown_date: '10/6/2026', brown_applied: 8, brown_extra: 0, brown_marked: 31 },
  { code: 'C25', white_date: '10/6/2026', white_applied: 12, white_extra: 0, white_marked: 43, brown_date: '10/6/2026', brown_applied: 26, brown_extra: 1, brown_marked: 38 },
  { code: 'C24', white_date: '10/6/2026', white_applied: 19, white_extra: 0, white_marked: 33, brown_date: '10/6/2026', brown_applied: 53, brown_extra: 0, brown_marked: 45 },
  { code: 'C23', white_date: '10/6/2026', white_applied: 94, white_extra: 0, white_marked: 63, brown_date: '10/6/2026', brown_applied: 152, brown_extra: 0, brown_marked: 114 },
  { code: 'C22', white_date: '10/6/2026', white_applied: 135, white_extra: 0, white_marked: 75, brown_date: '10/6/2026', brown_applied: 173, brown_extra: 0, brown_marked: 105 },
  { code: 'C21', white_date: '10/6/2026', white_applied: 145, white_extra: 0, white_marked: 91, brown_date: '10/6/2026', brown_applied: 182, brown_extra: 0, brown_marked: 112 },
  { code: 'C20', white_date: '10/6/2026', white_applied: 101, white_extra: 0, white_marked: 67, brown_date: '10/6/2026', brown_applied: 147, brown_extra: 0, brown_marked: 116 },
  { code: 'C19', white_date: '10/6/2026', white_applied: 45, white_extra: 0, white_marked: 0, brown_date: '10/6/2026', brown_applied: 58, brown_extra: 0, brown_marked: 0 }
];

const zoneBData = [
  { code: 'B19', white_date: '24/6/2026', white_applied: 25, white_extra: 0, white_marked: 26, brown_date: '24/6/2026', brown_applied: 36, brown_extra: 0, brown_marked: 65 },
  { code: 'B20', white_date: '24/6/2026', white_applied: 15, white_extra: 0, white_marked: 23, brown_date: '24/6/2026', brown_applied: 31, brown_extra: 0, brown_marked: 56 },
  { code: 'B21', white_date: '24/6/2026', white_applied: 34, white_extra: 0, white_marked: 25, brown_date: '24/6/2026', brown_applied: 51, brown_extra: 0, brown_marked: 65 },
  { code: 'B22', white_date: '24/6/2026', white_applied: 30, white_extra: 0, white_marked: 37, brown_date: '24/6/2026', brown_applied: 43, brown_extra: 0, brown_marked: 61 },
  { code: 'B23', white_date: '24/6/2026', white_applied: 16, white_extra: 0, white_marked: 16, brown_date: '24/6/2026', brown_applied: 29, brown_extra: 0, brown_marked: 65 },
  { code: 'B24', white_date: '24/6/2026', white_applied: 25, white_extra: 0, white_marked: 26, brown_date: '24/6/2026', brown_applied: 31, brown_extra: 0, brown_marked: 61 },
  { code: 'B25', white_date: '17/6/2026', white_applied: 29, white_extra: 0, white_marked: 24, brown_date: '17/6/2026', brown_applied: 33, brown_extra: 0, brown_marked: 50 },
  { code: 'B26', white_date: '17/6/2026', white_applied: 33, white_extra: 0, white_marked: 36, brown_date: '17/6/2026', brown_applied: 52, brown_extra: 0, brown_marked: 64 },
  { code: 'B27', white_date: '17/6/2026', white_applied: 13, white_extra: 0, white_marked: 21, brown_date: '17/6/2026', brown_applied: 31, brown_extra: 0, brown_marked: 60 },
  { code: 'B28', white_date: '17/6/2026', white_applied: 9, white_extra: 0, white_marked: 13, brown_date: '17/6/2026', brown_applied: 36, brown_extra: 0, brown_marked: 70 },
  { code: 'B29', white_date: '17/6/2026', white_applied: 23, white_extra: 0, white_marked: 39, brown_date: '17/6/2026', brown_applied: 33, brown_extra: 0, brown_marked: 76 },
  { code: 'B30', white_date: '17/6/2026', white_applied: 18, white_extra: 0, white_marked: 17, brown_date: '17/6/2026', brown_applied: 31, brown_extra: 0, brown_marked: 52 },
  { code: 'B31', white_date: '17/6/2026', white_applied: 13, white_extra: 0, white_marked: 21, brown_date: '17/6/2026', brown_applied: 34, brown_extra: 0, brown_marked: 63 },
  { code: 'B32', white_date: '17/6/2026', white_applied: 4, white_extra: 0, white_marked: 12, brown_date: '17/6/2026', brown_applied: 16, brown_extra: 0, brown_marked: 46 },
  { code: 'B33', white_date: '17/6/2026', white_applied: 13, white_extra: 0, white_marked: 13, brown_date: '17/6/2026', brown_applied: 24, brown_extra: 0, brown_marked: 48 },
  { code: 'B34', white_date: '17/6/2026', white_applied: 22, white_extra: 0, white_marked: 24, brown_date: '17/6/2026', brown_applied: 31, brown_extra: 0, brown_marked: 43 },
  { code: 'B35', white_date: '17/6/2026', white_applied: 19, white_extra: 0, white_marked: 28, brown_date: '17/6/2026', brown_applied: 31, brown_extra: 0, brown_marked: 68 },
  { code: 'B36', white_date: '17/6/2026', white_applied: 14, white_extra: 0, white_marked: 17, brown_date: '17/6/2026', brown_applied: 33, brown_extra: 0, brown_marked: 51 },
  { code: 'B37', white_date: '17/6/2026', white_applied: 9, white_extra: 0, white_marked: 19, brown_date: '17/6/2026', brown_applied: 30, brown_extra: 0, brown_marked: 67 },
];

const allData = [...zoneCData, ...zoneBData];

async function runUpdates() {
  console.log('Starting DB updates...');
  let updatedCount = 0;
  for (const item of allData) {
    const { code, ...updates } = item;
    // We update the row in sub_units where code matches
    const { error } = await db
      .from('sub_units')
      .update(updates)
      .eq('code', code);
    
    if (error) {
      console.error(`Error updating ${code}:`, error);
    } else {
      updatedCount++;
    }
  }
  console.log(`Successfully updated ${updatedCount} rows.`);
  process.exit(0);
}

runUpdates();
