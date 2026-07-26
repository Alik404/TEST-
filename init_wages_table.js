import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL or SUPABASE_KEY missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function initWagesTable() {
  console.log('Checking workers_wages table on Supabase...');

  const { data: existingData, error: checkError } = await supabase
    .from('workers_wages')
    .select('*')
    .limit(5);

  if (checkError) {
    console.log('Table workers_wages does not exist yet. Error message:', checkError.message);
  } else {
    console.log('Table workers_wages exists. Current rows:', existingData?.length);
  }

  const initialRecords = [
    {
      work_date: '2026-07-21',
      work_item: 'تنظيف جوينات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 2,
      shift_price: 30000,
      total_amount: 60000,
      notes: 'تنظيف النزلات لأجل اكمال هناك الشربت'
    },
    {
      work_date: '2026-07-20',
      work_item: 'تنظيف نزلات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 2,
      shift_price: 30000,
      total_amount: 60000,
      notes: ''
    },
    {
      work_date: '2026-07-19',
      work_item: 'تنظيف نزلات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 1,
      shift_price: 30000,
      total_amount: 30000,
      notes: ''
    },
    {
      work_date: '2026-07-18',
      work_item: 'تنظيف نزلات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 2,
      shift_price: 30000,
      total_amount: 60000,
      notes: ''
    },
    {
      work_date: '2026-07-16',
      work_item: 'تنظيف نزلات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 2,
      shift_price: 30000,
      total_amount: 60000,
      notes: ''
    },
    {
      work_date: '2026-07-15',
      work_item: 'تنظيف نزلات',
      worker_name: 'عمال ابو حيدر',
      shifts_count: 1,
      shift_price: 30000,
      total_amount: 30000,
      notes: ''
    }
  ];

  if (!checkError && existingData?.length === 0) {
    console.log('Seeding initial records...');
    const { data: inserted, error: insertError } = await supabase
      .from('workers_wages')
      .insert(initialRecords)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
    } else {
      console.log('Seeded records successfully:', inserted.length);
    }
  }
}

initWagesTable();
