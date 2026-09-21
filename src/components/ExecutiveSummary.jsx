import { useEffect, useMemo, useState } from 'react';
import { Printer, Receipt, Layers, Users, Banknote, CalendarRange, FileText } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { num, iqd, date as fmtDate } from '../utils/format';
import { buildReport, openReport, h, docCode } from '../utils/report';
import { advanceData, cumTotal, dueAdvance } from '../utils/advance';
import { StatCard, EmptyState, LoadingBlock, Segmented } from './ui';

const ZONES = ['zone_a', 'zone_b', 'zone_c'];

// Each record type keeps its date in a different field.
const dateOf = {
  material: (r) => r.date || r.created_at,
  advance: (r) => r.receipt_date || advanceData(r).receipt_date || r.created_at,
  wage: (r) => r.work_date || r.created_at,
};

function inPeriod(value, period) {
  if (period === 'all') return true;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (period === 'last_month') {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return d.getFullYear() === y && d.getMonth() === m;
}

export default function ExecutiveSummary({ lang = 'ar', user }) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [wages, setWages] = useState([]);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mat, adv, wag] = await Promise.all(
        ['/api/materials-consumption', '/api/weekly-advance', '/api/workers-wages'].map(url =>
          apiFetch(url).then(r => (r.ok ? r.json() : [])).catch(() => []))
      );
      if (cancelled) return;
      setMaterials(Array.isArray(mat) ? mat : []);
      setAdvances(Array.isArray(adv) ? adv : []);
      setWages(Array.isArray(wag) ? wag : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const data = useMemo(() => {
    const mats = materials.filter(r => inPeriod(dateOf.material(r), period));
    const advs = advances.filter(r => inPeriod(dateOf.advance(r), period));
    const wags = wages.filter(r => inPeriod(dateOf.wage(r), period));

    const latest = mats[0] || null;
    let white = 0;
    let brown = 0;
    if (latest?.marble) {
      ZONES.forEach(z => {
        white += parseInt(latest.marble?.[z]?.white?.total, 10) || 0;
        brown += parseInt(latest.marble?.[z]?.brown?.total, 10) || 0;
      });
    }

    const advRows = advs.map(r => {
      const f = advanceData(r);
      return {
        id: r.id,
        date: dateOf.advance(r),
        leader: r.team_leader || f.tech_name || '-',
        work: r.team_number || f.work_type || '-',
        cumulative: cumTotal(f),
        due: dueAdvance(f),
      };
    });

    return {
      latest,
      white,
      brown,
      advRows,
      advanceDue: advRows.reduce((s, r) => s + r.due, 0),
      wagesTotal: wags.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
      wagesShifts: wags.reduce((s, r) => s + (Number(r.shifts_count) || 0), 0),
      wagesCount: wags.length,
      cement: latest?.bulk?.cement || '0',
      sand: latest?.bulk?.sand || '0',
    };
  }, [materials, advances, wages, period]);

  const periodLabel = {
    all: isAr ? 'كل الفترات' : 'All time',
    this_month: isAr ? 'هذا الشهر' : 'This month',
    last_month: isAr ? 'الشهر الماضي' : 'Last month',
  }[period];

  const print = () => openReport(buildExecutiveReport({ data, periodLabel, user, lang }), {
    title: isAr ? 'التقرير التنفيذي الشامل' : 'Executive summary',
  });

  if (loading) return <LoadingBlock label={isAr ? 'جارٍ تجميع التقرير' : 'Compiling summary'} />;

  return (
    <div className="stack">
      <section className="card">
        <div className="card-body toolbar">
          <span className="toolbar-grow text-sm muted"><CalendarRange size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-3px', marginInlineEnd: 'var(--space-2)' }} />
            {isAr ? 'ملخص السلف ورصيد المواد وأجور العمال للفترة المختارة.' : 'Advances, stock and wages for the selected period.'}</span>
          <Segmented
            label={isAr ? 'الفترة' : 'Period'}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'all', label: isAr ? 'الكل' : 'All' },
              { value: 'this_month', label: isAr ? 'هذا الشهر' : 'This month' },
              { value: 'last_month', label: isAr ? 'الشهر الماضي' : 'Last month' },
            ]}
          />
          <button type="button" className="btn btn--primary" onClick={print}>
            <Printer size={18} aria-hidden="true" />
            {isAr ? 'التقرير الشامل PDF' : 'Summary PDF'}
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label={isAr ? 'الأرقام الرئيسية' : 'Key figures'}>
        <StatCard className="stat--span2" label={isAr ? 'إجمالي السلف المستحقة' : 'Advances due'} value={num(data.advanceDue, { decimals: 0 })} unit={isAr ? 'د.ع' : 'IQD'}
          icon={Receipt} tone="accent" meta={isAr ? `من ${data.advRows.length} قائمة سلفة` : `From ${data.advRows.length} advance lists`} />
        <StatCard className="stat--span2" label={isAr ? 'إجمالي أجور العمال' : 'Workers wages'} value={num(data.wagesTotal, { decimals: 0 })} unit={isAr ? 'د.ع' : 'IQD'}
          icon={Banknote} meta={isAr ? `${num(data.wagesShifts)} شفت في ${data.wagesCount} سجل` : `${num(data.wagesShifts)} shifts in ${data.wagesCount} records`} />
        <StatCard label={isAr ? 'رصيد المرمر الأبيض' : 'White marble stock'} value={num(data.white)} unit={isAr ? 'قطعة' : 'pcs'} icon={Layers}
          meta={data.latest ? (isAr ? `آخر جرد ${fmtDate(data.latest.date, lang)}` : `Count of ${fmtDate(data.latest.date, lang)}`) : (isAr ? 'لا يوجد جرد' : 'No count')} />
        <StatCard label={isAr ? 'رصيد المرمر الجوزي' : 'Walnut marble stock'} value={num(data.brown)} unit={isAr ? 'قطعة' : 'pcs'} icon={Layers} tone="warn"
          meta={data.latest ? (isAr ? 'كل الزونات' : 'All zones') : ''} />
      </section>

      <div className="grid-main-side">
        <section className="card" aria-labelledby="ex-adv">
          <div className="card-header card-header--divided">
            <h2 id="ex-adv" className="card-title"><Receipt size={20} aria-hidden="true" />{isAr ? 'السلف المقدمة والاستحقاقات' : 'Advances & amounts due'}</h2>
          </div>
          {data.advRows.length === 0 ? (
            <EmptyState icon={Receipt} title={isAr ? 'لا توجد سلف في هذه الفترة' : 'No advances in this period'} />
          ) : (
            <div className="table-wrap">
              <table className="dt dt--stack">
                <thead>
                  <tr>
                    <th>{isAr ? 'المسؤول / الفني' : 'Technician'}</th>
                    <th>{isAr ? 'التاريخ' : 'Date'}</th>
                    <th>{isAr ? 'نوع العمل' : 'Work'}</th>
                    <th className="c-num">{isAr ? 'الإجمالي التراكمي' : 'Cumulative'}</th>
                    <th className="c-num">{isAr ? 'المستحق' : 'Due'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.advRows.slice(0, 10).map(r => (
                    <tr key={r.id}>
                      <td className="c-title">{r.leader}</td>
                      <td data-label={isAr ? 'التاريخ' : 'Date'}><span className="num">{r.date || '-'}</span></td>
                      <td data-label={isAr ? 'نوع العمل' : 'Work'}>{r.work}</td>
                      <td className="c-num" data-label={isAr ? 'التراكمي' : 'Cumulative'}><span className="num">{num(r.cumulative, { decimals: 0 })}</span></td>
                      <td className="c-num c-strong" data-label={isAr ? 'المستحق' : 'Due'}><span className="num text-accent">{num(r.due, { decimals: 0 })}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="ex-stock">
          <div className="card-header card-header--divided">
            <div>
              <h2 id="ex-stock" className="card-title"><FileText size={20} aria-hidden="true" />{isAr ? 'رصيد المخزن الحالي' : 'Current stock'}</h2>
              {data.latest && <p className="card-subtitle">{isAr ? 'من آخر جرد يومي' : 'From the latest daily count'} · {fmtDate(data.latest.date, lang)}</p>}
            </div>
          </div>
          {data.latest ? (
            <ul className="list">
              <li className="list-item"><span className="list-item-main">{isAr ? 'مرمر أبيض (كل الزونات)' : 'White marble (all zones)'}</span><strong className="num">{num(data.white)}</strong></li>
              <li className="list-item"><span className="list-item-main">{isAr ? 'مرمر جوزي (كل الزونات)' : 'Walnut marble (all zones)'}</span><strong className="num">{num(data.brown)}</strong></li>
              <li className="list-item"><span className="list-item-main">{isAr ? 'الأسمنت (كيس)' : 'Cement (bags)'}</span><strong className="num">{data.cement}</strong></li>
              <li className="list-item"><span className="list-item-main">{isAr ? 'الرمل' : 'Sand'}</span><strong>{data.sand}</strong></li>
              <li className="list-item"><span className="list-item-main">{isAr ? 'معد الجرد' : 'Counted by'}</span><span>{data.latest.prepared_by || '-'}</span></li>
            </ul>
          ) : (
            <EmptyState icon={Users} title={isAr ? 'لا يوجد جرد في هذه الفترة' : 'No count in this period'} />
          )}
        </section>
      </div>
    </div>
  );
}

function buildExecutiveReport({ data, periodLabel, user, lang }) {
  const isAr = lang === 'ar';
  const body = [
    h.kpis([
      { label: isAr ? 'إجمالي السلف المستحقة' : 'Advances due', value: iqd(data.advanceDue, lang), tone: 'success', sub: isAr ? `${data.advRows.length} قائمة` : `${data.advRows.length} lists` },
      { label: isAr ? 'إجمالي أجور العمال' : 'Workers wages', value: iqd(data.wagesTotal, lang), sub: isAr ? `${num(data.wagesShifts)} شفت` : `${num(data.wagesShifts)} shifts` },
      { label: isAr ? 'رصيد المرمر الأبيض' : 'White marble', value: `${num(data.white)}` },
      { label: isAr ? 'رصيد المرمر الجوزي' : 'Walnut marble', value: `${num(data.brown)}` },
    ]),
    h.section(isAr ? 'السلف المقدمة الأخيرة' : 'Recent advances', h.table({
      columns: [
        { label: isAr ? 'التاريخ' : 'Date', align: 'center', width: '24mm' },
        { label: isAr ? 'المسؤول / الفني' : 'Technician' },
        { label: isAr ? 'نوع العمل' : 'Work' },
        { label: isAr ? 'الإجمالي التراكمي' : 'Cumulative', align: 'center', width: '32mm' },
        { label: isAr ? 'المستحق' : 'Due', align: 'center', width: '32mm' },
      ],
      rows: data.advRows.slice(0, 15).map(r => [
        r.date || '-', { v: r.leader, strong: true }, r.work,
        iqd(r.cumulative, lang), { v: iqd(r.due, lang), strong: true, tone: 'success' },
      ]),
      foot: [{ v: isAr ? 'المجموع' : 'Total', colspan: 3, strong: true }, iqd(data.advRows.reduce((s, r) => s + r.cumulative, 0), lang), iqd(data.advanceDue, lang)],
    }), { index: 1 }),
    h.section(isAr ? 'رصيد المخزن والمواد' : 'Stock & materials', h.table({
      columns: [
        { label: isAr ? 'المادة' : 'Item' },
        { label: isAr ? 'الرصيد' : 'Balance', align: 'center', width: '40mm' },
      ],
      rows: [
        [isAr ? 'مرمر أبيض (كل الزونات)' : 'White marble (all zones)', { v: `${num(data.white)} ${isAr ? 'قطعة' : 'pcs'}`, strong: true }],
        [isAr ? 'مرمر جوزي (كل الزونات)' : 'Walnut marble (all zones)', { v: `${num(data.brown)} ${isAr ? 'قطعة' : 'pcs'}`, strong: true }],
        [isAr ? 'الأسمنت' : 'Cement', `${data.cement} ${isAr ? 'كيس' : 'bags'}`],
        [isAr ? 'الرمل' : 'Sand', data.sand],
      ],
    }), { index: 2, note: data.latest ? `${isAr ? 'آخر جرد' : 'Latest count'} ${data.latest.date}` : '' }),
  ].map(String).join('');

  return buildReport({
    lang,
    title: isAr ? 'التقرير التنفيذي والمالي الشامل' : 'Executive & Financial Summary',
    subtitle: periodLabel,
    code: docCode('EXE'),
    meta: [
      { label: isAr ? 'الفترة' : 'Period', value: periodLabel },
      { label: isAr ? 'أعدّه' : 'Prepared by', value: user?.name || '-' },
      { label: isAr ? 'قوائم السلف' : 'Advance lists', value: String(data.advRows.length) },
      { label: isAr ? 'سجلات الأجور' : 'Wage records', value: String(data.wagesCount) },
    ],
    body,
    signatures: [
      { ar: 'مشرف الموقع', en: 'Site Supervisor' },
      { ar: 'المعاون الفني', en: 'Technical Assistant' },
      { ar: 'مدير المشروع', en: 'Project Director' },
    ],
  });
}
