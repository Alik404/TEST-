import { initDatabase, dbRun, dbGet } from './database.js';
import { hashPassword } from './auth.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedData = async () => {
  try {
    // 1. Initialize schema
    await initDatabase();

    console.log('Seeding default data...');

    // Clear existing data to avoid duplicates
    await dbRun('DELETE FROM sub_units');
    await dbRun('DELETE FROM tasks');
    await dbRun('DELETE FROM categories');
    await dbRun('DELETE FROM users');
    await dbRun('DELETE FROM marble_distribution');

    // 2. Seed Users
    // Development accounts. Passwords are stored as scrypt hashes, never plaintext.
    // Change these immediately on any deployment reachable from the internet.
    await dbRun(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      ['admin@project.com', await hashPassword('admin123'), 'المدير العام', 'super_admin']
    );
    await dbRun(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      ['engineer@project.com', await hashPassword('admin123'), 'المهندس المقيم', 'admin']
    );
    await dbRun(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
      ['viewer@project.com', await hashPassword('viewer123'), 'الإدارة العليا / الجهة المستفيدة', 'viewer']
    );
    console.log('Users seeded.');

    // 3. Seed Categories
    const categories = [
      'أعمال المرمر',
      'أعمال الجوينات',
      'سقف المتحف',
      'السمكرة والستيل'
    ];

    const catIds = {};
    for (const cat of categories) {
      const result = await dbRun('INSERT INTO categories (name) VALUES (?)', [cat]);
      catIds[cat] = result.id;
    }
    console.log('Categories seeded.');

    // 4. Seed Tasks
    const tasks = [
      {
        category: 'أعمال المرمر',
        name: 'تطبيك النزلات (محدث تلقائياً)',
        total_quantity: 113,
        completed_quantity: 89, // Seed initially, updated dynamically
        progress_percent: 78.76,
        unit: 'نزلة',
        notes: 'مطابق لملف الجرد الكلي الأخير',
        is_manual: 1
      },
      {
        category: 'أعمال المرمر',
        name: 'استبدال رؤوس المثلثات',
        total_quantity: 112,
        completed_quantity: 112,
        progress_percent: 100.0,
        unit: 'قطعة',
        notes: 'مكتمل بالكامل مع استبدال كافة القطع',
        is_manual: 1
      },
      {
        category: 'أعمال المرمر',
        name: 'شربت رؤوس المثلثات',
        total_quantity: 112,
        completed_quantity: 112,
        progress_percent: 100.0,
        unit: 'قطعة',
        notes: 'منجزة ومكتملة بالكامل لكافة الزونات',
        is_manual: 1
      },
      {
        category: 'أعمال المرمر',
        name: 'شربتة النزلات',
        total_quantity: null,
        completed_quantity: null,
        progress_percent: 50.0, // Default progress
        unit: '-',
        notes: 'زون A واصل 96% (باقي مثلثات الجوينات الطولية فقط)، زون C إلى نهاية عمل ديار نزلة رقم 19',
        is_manual: 1
      },
      {
        category: 'أعمال الجوينات',
        name: 'النزلات الأفقية الكبيرة',
        total_quantity: 113,
        completed_quantity: 38,
        progress_percent: 33.63,
        unit: 'نزلة',
        notes: 'الطول المنجز 2204 م',
        is_manual: 1
      },
      {
        category: 'أعمال الجوينات',
        name: 'النزلات الطولية',
        total_quantity: 110,
        completed_quantity: 38,
        progress_percent: 34.55,
        unit: 'نزلة',
        notes: 'الطول المنجز 536 م',
        is_manual: 1
      },
      {
        category: 'أعمال الجوينات',
        name: 'جوينات السكاي لايت',
        total_quantity: 110,
        completed_quantity: 110,
        progress_percent: 100.0,
        unit: 'متر',
        notes: 'مكتملة بطول م3,435.30',
        is_manual: 1
      },
      {
        category: 'سقف المتحف',
        name: 'تنظيف هيكل الستيل',
        total_quantity: 989,
        completed_quantity: 780,
        progress_percent: 78.87,
        unit: 'م2',
        notes: 'الأعمال مستمرة بنسق جيد (م² )',
        is_manual: 1
      },
      {
        category: 'سقف المتحف',
        name: 'تنظيف ألواح النحاس',
        total_quantity: 671,
        completed_quantity: 331,
        progress_percent: 49.33,
        unit: 'م2',
        notes: 'مرحلة قيد العمل المكثف (م² )',
        is_manual: 1
      },
      {
        category: 'سقف المتحف',
        name: 'عزل النحاس',
        total_quantity: 671,
        completed_quantity: 485,
        progress_percent: 72.28,
        unit: 'م2',
        notes: 'مرحلة العزل متقدمة (م² )',
        is_manual: 1
      },
      {
        category: 'السمكرة والستيل',
        name: 'القطع المجهزة (متر)',
        total_quantity: 1981.69,
        completed_quantity: 1471.54,
        progress_percent: 74.26,
        unit: 'متر',
        notes: 'المتبقي يمثل نسبة التالف',
        is_manual: 1
      }
    ];

    const taskIds = {};
    for (const t of tasks) {
      const result = await dbRun(
        'INSERT INTO tasks (category_id, name, total_quantity, completed_quantity, progress_percent, unit, notes, is_manual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          catIds[t.category],
          t.name,
          t.total_quantity,
          t.completed_quantity,
          t.progress_percent,
          t.unit,
          t.notes,
          t.is_manual
        ]
      );
      taskIds[t.name] = result.id;
    }
    console.log('Tasks seeded.');

    // 5. Seed Sub-Units (113 Nazalat)
    const nazalatTaskId = taskIds['تطبيك النزلات (محدث تلقائياً)'];

    // Zone A: 37 completed (A1 - A37)
    for (let i = 1; i <= 37; i++) {
      await dbRun(
        'INSERT INTO sub_units (task_id, serial_number, zone, code, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [
          nazalatTaskId,
          i,
          'Zone A',
          `A${i}`,
          'منجز',
          'مطابق لجرودات الموقع'
        ]
      );
    }

    // Zone B: 38 items (B1 - B38). B25-B38 are completed, others are pending
    for (let i = 1; i <= 38; i++) {
      const isCompleted = i >= 25 && i <= 38;
      const status = isCompleted ? 'منجز' : 'متبقي';
      const notes = isCompleted ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل';
      await dbRun(
        'INSERT INTO sub_units (task_id, serial_number, zone, code, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [
          nazalatTaskId,
          37 + i,
          'Zone B',
          `B${i}`,
          status,
          notes
        ]
      );
    }

    // Zone C: 38 items (C1 - C38). All are completed
    for (let i = 1; i <= 38; i++) {
      await dbRun(
        'INSERT INTO sub_units (task_id, serial_number, zone, code, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [
          nazalatTaskId,
          37 + 38 + i,
          'Zone C',
          `C${i}`,
          'منجز',
          'مطابق لجرودات الموقع'
        ]
      );
    }
    console.log('Sub-units (113 Nazalat) seeded.');

    // 6. Seed Marble Distribution
    const marbleDist = [
      // Zone A
      { zone: 'Zone A', task: 'اعمال السكاي لايت', white: 365, brown: 133, status: 'مكتمل هندسياً (الشربتة مكتملة %100)' },
      { zone: 'Zone A', task: 'تطبيك النزلات', white: 1083, brown: 240, status: 'مكتمل من الكوادر' },
      { zone: 'Zone A', task: 'استبدال رؤوس المثلثات', white: 980, brown: 707, status: 'مكتمل بالكامل مع الاستبدال' },
      { zone: 'Zone A', task: 'شربت رؤوس المثلثات', white: null, brown: null, status: 'مكتمل بالكامل' },
      { zone: 'Zone A', task: 'شربتة النزلات', white: null, brown: null, status: 'واصل %96 (باقي مثلثات الجوينات الطولية فقط)' },
      // Zone B
      { zone: 'Zone B', task: 'أعمال السكاي لايت', white: 500, brown: 224, status: 'مكتمل ومستقر الشربتة مكتملة %100' },
      { zone: 'Zone B', task: 'تطبيك النزلات', white: 219, brown: 415, status: 'مكتمل ومستقر' },
      { zone: 'Zone B', task: 'استبدال رؤوس المثلثات', white: 1073, brown: 222, status: 'مكتمل بالكامل (لا يوجد استبدال مطلوب)' },
      { zone: 'Zone B', task: 'شربت رؤوس المثلثات', white: null, brown: null, status: 'مكتمل بالكامل' },
      { zone: 'Zone B', task: 'شربتة النزلات', white: null, brown: null, status: 'لم تبدأ بعد' },
      // Zone C
      { zone: 'Zone C', task: 'اعمال السكاي لايت', white: 475, brown: 313, status: 'مكتمل ومطابق الشربتة مكتملة %100' },
      { zone: 'Zone C', task: 'تطبيك النزلات', white: 2141, brown: 2592, status: 'مكتمل ومطابق' },
      { zone: 'Zone C', task: 'استبدال رؤوس المثلثات', white: 2105, brown: 1826, status: 'مكتمل بالكامل مع الاستبدال' },
      { zone: 'Zone C', task: 'شربت رؤوس المثلثات', white: null, brown: null, status: 'مكتمل بالكامل' },
      { zone: 'Zone C', task: 'شريتة النزلات', white: null, brown: null, status: 'مشربت لغاية النزلة رقم 21' }
    ];

    for (const item of marbleDist) {
      await dbRun(
        'INSERT INTO marble_distribution (zone, task_name, white_qty, brown_qty, status) VALUES (?, ?, ?, ?, ?)',
        [item.zone, item.task, item.white, item.brown, item.status]
      );
    }
    console.log('Marble distribution seeded.');
    console.log('All seeding operations completed successfully.');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
};

// If run directly or from npm script
const runDirectly = process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed'));
if (runDirectly) {
  seedData().then(() => {
    process.exit(0);
  });
}

export { seedData };
