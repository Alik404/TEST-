import express from 'express';
import cors from 'cors';
import { dbAll, dbGet, dbRun, db } from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/api/uploads', express.static(uploadsDir));

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 1. Authentication Endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبة.' });
  }

  try {
    const user = await dbGet(
      'SELECT id, email, name, role FROM users WHERE email = ? AND password = ?',
      [email, password]
    );

    if (user) {
      res.json({ user });
    } else {
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
});

// 2. Fetch Dashboard Data (KPIs + Progress Table)
app.get('/api/dashboard', async (req, res) => {
  try {
    // A. Fetch categories and tasks
    const categories = await dbAll('SELECT * FROM categories');
    const tasks = await dbAll(`
      SELECT t.*, c.name as category_name 
      FROM tasks t 
      JOIN categories c ON t.category_id = c.id
    `);

    // B. Calculate dynamic KPIs
    // Count Completed Nazalat
    const nazalatStats = await dbAll(`
      SELECT zone, status, COUNT(*) as count 
      FROM sub_units 
      GROUP BY zone, status
    `);

    let completedA = 0, totalA = 37;
    let completedB = 0, totalB = 38;
    let completedC = 0, totalC = 38;

    nazalatStats.forEach(stat => {
      if (stat.zone === 'Zone A' && stat.status === 'منجز') completedA = stat.count;
      if (stat.zone === 'Zone B' && stat.status === 'منجز') completedB = stat.count;
      if (stat.zone === 'Zone C' && stat.status === 'منجز') completedC = stat.count;
    });

    const totalCompletedNazalat = completedA + completedB + completedC;
    const totalNazalat = 113;
    const nazalatProgressPercent = (totalCompletedNazalat / totalNazalat) * 100;

    // Calculate applied marble pieces dynamically from database (direct sum of recorded applied quantities)
    const marbleRows = await dbAll('SELECT * FROM marble_distribution');
    let computedTotalWhite = 0;
    let computedAppliedWhite = 0;
    let computedTotalBrown = 0;
    let computedAppliedBrown = 0;

    marbleRows.forEach(item => {
      const white = item.white_qty || 0;
      const brown = item.brown_qty || 0;
      computedTotalWhite += white;
      computedTotalBrown += brown;
      computedAppliedWhite += white;
      computedAppliedBrown += brown;
    });

    const totalAppliedMarble = computedAppliedWhite + computedAppliedBrown;
    const totalMarbleCount = computedTotalWhite + computedTotalBrown;

    // C. Calculate average project progress
    // Average of the progress_percent of all tasks
    let sumProgress = 0;
    tasks.forEach(t => {
      // If it's the dynamic task, use the calculated percent only if not manual
      if (t.name === 'تطبيك النزلات (محدث تلقائياً)' && t.is_manual === 0) {
        t.progress_percent = parseFloat(nazalatProgressPercent.toFixed(2));
        t.completed_quantity = totalCompletedNazalat;
      }
      sumProgress += t.progress_percent;
    });
    const overallProgress = sumProgress / tasks.length;

    res.json({
      categories,
      tasks,
      kpis: {
        total_marble_pieces: totalMarbleCount,
        applied_marble_pieces: totalAppliedMarble,
        applied_white_marble: Math.round(computedAppliedWhite),
        applied_brown_marble: Math.round(computedAppliedBrown),
        overall_progress_percent: parseFloat(overallProgress.toFixed(2)),
        skylight_progress_percent: 100.0, // Completed as per sheet details
        nazalat_total: totalNazalat,
        nazalat_completed: totalCompletedNazalat,
        nazalat_progress_percent: parseFloat(nazalatProgressPercent.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Fetch dashboard error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات لوحة التحكم.' });
  }
});

// 3. Fetch Sub-Units / Detailed tracking logs
app.get('/api/nazalat', async (req, res) => {
  const { zone, status } = req.query;

  let query = 'SELECT * FROM sub_units';
  const params = [];
  const conditions = [];

  if (zone) {
    conditions.push('zone = ?');
    params.push(zone);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY serial_number ASC';

  try {
    const rows = await dbAll(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Fetch nazalat error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجلات المتابعة.' });
  }
});

// 4. Toggle Nazala Status (Admin only)
app.post('/api/nazalat/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { userName, userRole } = req.body;

  try {
    // Get current status
    const item = await dbGet('SELECT status, task_id, code, zone FROM sub_units WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'النزلة المطلوبة غير موجودة.' });
    }

    const newStatus = item.status === 'منجز' ? 'متبقي' : 'منجز';
    const notes = newStatus === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل';

    // Update status
    await dbRun('UPDATE sub_units SET status = ?, notes = ? WHERE id = ?', [newStatus, notes, id]);

    // Recalculate parent task progress
    const totalCountRow = await dbGet('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ?', [item.task_id]);
    const completedCountRow = await dbGet('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ? AND status = ?', [item.task_id, 'منجز']);

    const total = totalCountRow.count;
    const completed = completedCountRow.count;
    const progress = (completed / total) * 100;

    await dbRun(
      'UPDATE tasks SET completed_quantity = ?, progress_percent = ? WHERE id = ?',
      [completed, parseFloat(progress.toFixed(2)), item.task_id]
    );

    // Auto-log system message
    if (userName) {
      const actionText = userName === 'المهندس المقيم' || userRole === 'admin'
        ? `قام المهندس المقيم (${userName}) بتحديث حالة النزلة ${item.code} في ${item.zone} إلى: ${newStatus === 'منجز' ? 'منجزة (مكتملة)' : 'متبقية'}`
        : `قام (${userName}) بتحديث حالة النزلة ${item.code} في ${item.zone} إلى: ${newStatus === 'منجز' ? 'منجزة (مكتملة)' : 'متبقية'}`;
      
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json({
      success: true,
      id,
      newStatus,
      completed,
      progress: parseFloat(progress.toFixed(2))
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث حالة النزلة.' });
  }
});

// 4b. Update Nazala Details (Admin only)
app.post('/api/nazalat/:id/details', async (req, res) => {
  const { id } = req.params;
  const { 
    userName, 
    userRole,
    white_marked,
    white_extra,
    white_applied,
    white_date,
    brown_marked,
    brown_extra,
    brown_applied,
    brown_date,
    status
  } = req.body;

  try {
    const item = await dbGet('SELECT status, task_id, code, zone FROM sub_units WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'النزلة المطلوبة غير موجودة.' });
    }

    const notes = status === 'منجز' ? 'مطابق لجرودات الموقع' : 'قيد التجهيز والعمل';

    // Update details
    await dbRun(
      'UPDATE sub_units SET white_marked = ?, white_extra = ?, white_applied = ?, white_date = ?, brown_marked = ?, brown_extra = ?, brown_applied = ?, brown_date = ?, status = ?, notes = ? WHERE id = ?', 
      [
        white_marked || 0,
        white_extra || 0,
        white_applied || 0,
        white_date || '',
        brown_marked || 0,
        brown_extra || 0,
        brown_applied || 0,
        brown_date || '',
        status || item.status, 
        notes, 
        id
      ]
    );

    // Recalculate parent task progress
    const totalCountRow = await dbGet('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ?', [item.task_id]);
    const completedCountRow = await dbGet('SELECT COUNT(*) as count FROM sub_units WHERE task_id = ? AND status = ?', [item.task_id, 'منجز']);

    const total = totalCountRow.count;
    const completed = completedCountRow.count;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    await dbRun(
      'UPDATE tasks SET completed_quantity = ?, progress_percent = ? WHERE id = ?',
      [completed, parseFloat(progress.toFixed(2)), item.task_id]
    );

    // Auto-log system message
    if (userName) {
      const actionText = `قام (${userName}) بتحديث تفاصيل النزلة ${item.code} في ${item.zone}. (الأبيض المطبق: ${white_applied || 0}، الجوزي المطبق: ${brown_applied || 0}، الحالة: ${status || item.status})`;
      
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json({
      success: true,
      id,
      status: status || item.status,
      completed,
      progress: parseFloat(progress.toFixed(2))
    });
  } catch (error) {
    console.error('Update details error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث تفاصيل النزلة.' });
  }
});

// 5. Update Manual Task Progress (Admin only)
app.post('/api/tasks/:id/progress', async (req, res) => {
  const { id } = req.params;
  const { completed_quantity, progress_percent, notes, userName, userRole } = req.body;

  try {
    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'الفقرة المطلوبة غير موجودة.' });
    }

    let progress = 0;
    let completed = null;

    if (task.total_quantity !== null && task.total_quantity > 0) {
      if (completed_quantity !== undefined) {
        completed = parseFloat(completed_quantity);
        if (isNaN(completed) || completed < 0) {
          return res.status(400).json({ error: 'الكمية المنجزة يجب أن تكون رقماً موجباً.' });
        }
        if (completed > task.total_quantity) {
          completed = task.total_quantity;
        }
        progress = parseFloat(((completed / task.total_quantity) * 100).toFixed(2));
      } else if (progress_percent !== undefined) {
        progress = parseFloat(progress_percent);
        if (isNaN(progress) || progress < 0 || progress > 100) {
          return res.status(400).json({ error: 'نسبة الإنجاز يجب أن تكون بين 0 و 100.' });
        }
        completed = parseFloat((task.total_quantity * (progress / 100)).toFixed(2));
      } else {
        progress = task.progress_percent;
        completed = task.completed_quantity;
      }
    } else {
      if (progress_percent !== undefined) {
        progress = parseFloat(progress_percent);
        if (isNaN(progress) || progress < 0 || progress > 100) {
          return res.status(400).json({ error: 'نسبة الإنجاز يجب أن تكون بين 0 و 100.' });
        }
      } else {
        progress = task.progress_percent;
      }
      completed = null;
    }

    // Build update query
    let query = 'UPDATE tasks SET progress_percent = ?, completed_quantity = ?';
    const params = [progress, completed];

    if (notes !== undefined) {
      query += ', notes = ?';
      params.push(notes);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await dbRun(query, params);

    // Auto-log system message
    if (userName) {
      const actionText = `قام المهندس المقيم (${userName}) بتحديث تقدّم الفقرة "${task.name}" إلى: ${progress}% (الكمية المنجزة الحالية: ${completed || 0} من أصل ${task.total_quantity || '-'})` + (notes ? ` | ملاحظات الموقع: "${notes}"` : '');
      
      await dbRun(
        `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
         VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
        ['النظام', 'system', actionText]
      );
    }

    res.json({
      success: true,
      id,
      progress_percent: progress,
      completed_quantity: completed,
      notes
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث البيانات.' });
  }
});

// 6. Update Task Notes (Admin only)
app.post('/api/tasks/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  try {
    await dbRun('UPDATE tasks SET notes = ? WHERE id = ?', [notes, id]);
    res.json({ success: true, id, notes });
  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الملاحظات.' });
  }
});

// 7. Fetch Marble Distribution
app.get('/api/marble', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM marble_distribution');
    res.json(rows);
  } catch (error) {
    console.error('Fetch marble distribution error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات توزيع المرمر.' });
  }
});

// 8. Update Marble Status & Quantities (Admin only)
app.post('/api/marble/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, white_qty, brown_qty, userName, userRole } = req.body;

  try {
    const whiteVal = white_qty === undefined || white_qty === null ? null : parseInt(white_qty, 10);
    const brownVal = brown_qty === undefined || brown_qty === null ? null : parseInt(brown_qty, 10);

    await dbRun(
      'UPDATE marble_distribution SET status = ?, white_qty = ?, brown_qty = ? WHERE id = ?',
      [status, whiteVal, brownVal, id]
    );

    // Auto-log system message
    if (userName) {
      const item = await dbGet('SELECT * FROM marble_distribution WHERE id = ?', [id]);
      if (item) {
        const actionText = `قام المهندس المقيم (${userName}) بتحديث تفاصيل مرمر "${item.task_name}" في "${item.zone}": الأبيض=${whiteVal !== null ? whiteVal : '-'}، الجوزي=${brownVal !== null ? brownVal : '-'} | الحالة: "${status}"`;
        
        await dbRun(
          `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
           VALUES (NULL, ?, ?, ?, NULL, NULL, NULL)`,
          ['النظام', 'system', actionText]
        );
      }
    }

    res.json({ success: true, id, status, white_qty: whiteVal, brown_qty: brownVal });
  } catch (error) {
    console.error('Update marble status error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الموقف الميداني للمرمر.' });
  }
});

// ── Daily Updates / Chat API Endpoints ──

// A. Fetch all daily updates and logs
app.get('/api/daily-updates', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT d.*, u.name as user_name, u.role as user_role,
             r.sender_name as reply_sender_name, r.message_text as reply_message_text, r.media_url as reply_media_url, r.media_type as reply_media_type
      FROM daily_updates d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN daily_updates r ON d.reply_to_id = r.id
      ORDER BY d.created_at ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch daily updates error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل التحديث اليومي.' });
  }
});

// B. Post a new message or upload media
app.post('/api/daily-updates', async (req, res) => {
  const { user_id, sender_name, sender_role, message_text, media_data, media_name, reply_to_id } = req.body;

  if (!message_text && !media_data) {
    return res.status(400).json({ error: 'محتوى الرسالة مطلوب.' });
  }

  try {
    let media_url = null;
    let media_type = null;

    if (media_data) {
      // Decode base64 file
      let buffer;
      let extension = 'bin';

      const parts = media_data.split(';base64,');
      if (parts.length === 2) {
        const mimeType = parts[0].replace('data:', '');
        buffer = Buffer.from(parts[1], 'base64');
        
        // Guess extension from mime type
        if (mimeType.includes('image')) {
          media_type = 'image';
          extension = (mimeType.split('/')[1] || '').split(';')[0] || 'png';
        } else if (mimeType.includes('video')) {
          media_type = 'video';
          extension = (mimeType.split('/')[1] || '').split(';')[0] || 'mp4';
        } else if (mimeType.includes('audio')) {
          media_type = 'audio';
          extension = (mimeType.split('/')[1] || '').split(';')[0] || 'webm';
        }
      } else {
        // Fallback: direct base64 string
        buffer = Buffer.from(media_data, 'base64');
        if (media_name) {
          const ext = media_name.split('.').pop().toLowerCase();
          extension = ext;
          if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) {
            if (media_name.startsWith('voice_')) {
              media_type = 'audio';
            } else {
              media_type = 'video';
            }
          } else if (['mp3', 'wav', 'm4a', 'aac', 'opus', 'caf'].includes(ext)) {
            media_type = 'audio';
          } else {
            media_type = 'image';
          }
        }
      }

      const filename = `upload_${Date.now()}_${Math.round(Math.random() * 1000)}.${extension}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);
      media_url = `/api/uploads/${filename}`;
    }

    // Insert message
    const result = await dbRun(
      `INSERT INTO daily_updates (user_id, sender_name, sender_role, message_text, media_url, media_type, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id || null, sender_name, sender_role, message_text || '', media_url, media_type, reply_to_id || null]
    );

    // Fetch the inserted message to return
    const newMessage = await dbGet(`
      SELECT d.*, u.name as user_name, u.role as user_role,
             r.sender_name as reply_sender_name, r.message_text as reply_message_text, r.media_url as reply_media_url, r.media_type as reply_media_type
      FROM daily_updates d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN daily_updates r ON d.reply_to_id = r.id
      WHERE d.id = ?
    `, [result.id]);

    res.json(newMessage);
  } catch (error) {
    console.error('Post daily update error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرسالة.' });
  }
});

// ── Materials Consumption Tracking API Endpoints ──

const consumptionFilePath = path.join(__dirname, 'data', 'materials_consumption.json');

const readConsumptionData = () => {
  try {
    if (!fs.existsSync(consumptionFilePath)) {
      return [];
    }
    const data = fs.readFileSync(consumptionFilePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading materials consumption file:', err);
    return [];
  }
};

const writeConsumptionData = (data) => {
  try {
    const dataDir = path.dirname(consumptionFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(consumptionFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing materials consumption file:', err);
    return false;
  }
};

// GET all reports
app.get('/api/materials-consumption', async (req, res) => {
  try {
    const { data, error } = await db
      .from('materials_consumption')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.warn('Table "materials_consumption" does not exist in Supabase. Falling back to JSON file.');
        throw new Error('FALLBACK');
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    const data = readConsumptionData();
    data.sort((a, b) => new Date(b.date + 'T' + (b.start_time || '00:00')) - new Date(a.date + 'T' + (a.start_time || '00:00')));
    res.json(data);
  }
});

// POST a new report
app.post('/api/materials-consumption', async (req, res) => {
  const report = req.body;
  if (!report.date || !report.day || !report.prepared_by) {
    return res.status(400).json({ error: 'Missing required report fields' });
  }

  try {
    const newReport = {
      id: Date.now().toString(),
      date: report.date,
      day: report.day,
      start_time: report.start_time,
      end_time: report.end_time,
      prepared_by: report.prepared_by,
      basics: report.basics,
      marble: report.marble,
      sealants: report.sealants,
      bulk: report.bulk,
      notes: report.notes,
      created_at: new Date().toISOString()
    };

    const { data, error } = await db
      .from('materials_consumption')
      .insert([newReport])
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.warn('Table "materials_consumption" does not exist in Supabase. Falling back to JSON file.');
        throw new Error('FALLBACK');
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    const data = readConsumptionData();
    const newReport = {
      ...report,
      id: Date.now().toString(),
      created_at: new Date().toISOString()
    };
    data.push(newReport);
    if (writeConsumptionData(data)) {
      res.status(201).json(newReport);
    } else {
      res.status(500).json({ error: 'Failed to write consumption report data' });
    }
  }
});

// PUT (update) an existing report
app.put('/api/materials-consumption/:id', async (req, res) => {
  const { id } = req.params;
  const updatedReport = req.body;

  try {
    const { data, error } = await db
      .from('materials_consumption')
      .update({
        date: updatedReport.date,
        day: updatedReport.day,
        start_time: updatedReport.start_time,
        end_time: updatedReport.end_time,
        prepared_by: updatedReport.prepared_by,
        basics: updatedReport.basics,
        marble: updatedReport.marble,
        sealants: updatedReport.sealants,
        bulk: updatedReport.bulk,
        notes: updatedReport.notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.warn('Table "materials_consumption" does not exist in Supabase. Falling back to JSON file.');
        throw new Error('FALLBACK');
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    const data = readConsumptionData();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    data[index] = {
      ...data[index],
      ...updatedReport,
      updated_at: new Date().toISOString()
    };
    
    if (writeConsumptionData(data)) {
      res.json(data[index]);
    } else {
      res.status(500).json({ error: 'Failed to update consumption report data' });
    }
  }
});

// DELETE a report
app.delete('/api/materials-consumption/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await db
      .from('materials_consumption')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.warn('Table "materials_consumption" does not exist in Supabase. Falling back to JSON file.');
        throw new Error('FALLBACK');
      }
      throw error;
    }

    // Keep JSON fallback file in sync
    const data = readConsumptionData();
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      data.splice(index, 1);
      writeConsumptionData(data);
    }

    res.json({ success: true });
  } catch (err) {
    const data = readConsumptionData();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    data.splice(index, 1);
    if (writeConsumptionData(data)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete consumption report data' });
    }
  }
});

// ── Workers Wages API Endpoints ──

const wagesFilePath = path.join(__dirname, 'data', 'workers_wages.json');

const readWagesData = () => {
  try {
    if (!fs.existsSync(wagesFilePath)) return [];
    const data = fs.readFileSync(wagesFilePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading workers wages file:', err);
    return [];
  }
};

const writeWagesData = (data) => {
  try {
    const dataDir = path.dirname(wagesFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(wagesFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing workers wages file:', err);
    return false;
  }
};

// GET all wages
app.get('/api/workers-wages', async (req, res) => {
  try {
    const { data, error } = await db
      .from('workers_wages')
      .select('*')
      .order('work_date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    const data = readWagesData();
    data.sort((a, b) => new Date(b.work_date) - new Date(a.work_date));
    res.json(data);
  }
});

// POST a new wage record
app.post('/api/workers-wages', async (req, res) => {
  const record = req.body;
  if (!record.work_date || !record.work_item) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const shiftsCount = Number(record.shifts_count) || 1;
  const shiftPrice = Number(record.shift_price) || 0;
  const totalAmount = shiftsCount * shiftPrice;

  try {
    const newRecord = {
      work_date: record.work_date,
      work_item: record.work_item,
      worker_name: record.worker_name || 'عمال ابو حيدر',
      shifts_count: shiftsCount,
      shift_price: shiftPrice,
      total_amount: totalAmount,
      notes: record.notes || '',
      created_at: new Date().toISOString()
    };

    const { data, error } = await db
      .from('workers_wages')
      .insert([newRecord])
      .select()
      .single();

    if (error) throw error;

    const fallbackData = readWagesData();
    fallbackData.unshift(data);
    writeWagesData(fallbackData);

    res.status(201).json(data);
  } catch (err) {
    const fallbackData = readWagesData();
    const newRecord = {
      id: Date.now().toString(),
      work_date: record.work_date,
      work_item: record.work_item,
      worker_name: record.worker_name || 'عمال ابو حيدر',
      shifts_count: shiftsCount,
      shift_price: shiftPrice,
      total_amount: totalAmount,
      notes: record.notes || '',
      created_at: new Date().toISOString()
    };
    fallbackData.unshift(newRecord);
    if (writeWagesData(fallbackData)) {
      res.status(201).json(newRecord);
    } else {
      res.status(500).json({ error: 'Failed to write wage record' });
    }
  }
});

// PUT (update) a wage record
app.put('/api/workers-wages/:id', async (req, res) => {
  const { id } = req.params;
  const record = req.body;
  const shiftsCount = Number(record.shifts_count) || 1;
  const shiftPrice = Number(record.shift_price) || 0;
  const totalAmount = shiftsCount * shiftPrice;

  try {
    const { data, error } = await db
      .from('workers_wages')
      .update({
        work_date: record.work_date,
        work_item: record.work_item,
        worker_name: record.worker_name,
        shifts_count: shiftsCount,
        shift_price: shiftPrice,
        total_amount: totalAmount,
        notes: record.notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    const data = readWagesData();
    const index = data.findIndex(item => String(item.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }
    data[index] = {
      ...data[index],
      work_date: record.work_date,
      work_item: record.work_item,
      worker_name: record.worker_name,
      shifts_count: shiftsCount,
      shift_price: shiftPrice,
      total_amount: totalAmount,
      notes: record.notes
    };
    if (writeWagesData(data)) {
      res.json(data[index]);
    } else {
      res.status(500).json({ error: 'Failed to update wage record' });
    }
  }
});

// DELETE a wage record
app.delete('/api/workers-wages/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await db
      .from('workers_wages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const data = readWagesData();
    const index = data.findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
      data.splice(index, 1);
      writeWagesData(data);
    }
    res.json({ success: true });
  } catch (err) {
    const data = readWagesData();
    const index = data.findIndex(item => String(item.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }
    data.splice(index, 1);
    if (writeWagesData(data)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete record' });
    }
  }
});

// ── User Management API Endpoints ──

// GET all users
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await db
      .from('users')
      .select('id, email, name, role, password')
      .order('id', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب قائمة المستخدمين.' });
  }
});

// POST a new user
app.post('/api/users', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
  }
  try {
    const { data, error } = await db
      .from('users')
      .insert([{ email, password, name, role }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب.' });
  }
});

// PUT (update) a user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
  }
  try {
    const { data, error } = await db
      .from('users')
      .update({ email, password, name, role })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الحساب.' });
  }
});

// DELETE a user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await db
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الحساب.' });
  }
});

// Serve static assets in production
const clientDistPath = path.join(__dirname, '../dist');
app.use(express.static(clientDistPath));

// Handle SPA routing: send index.html for any request that isn't API
app.get('/*any', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
