import { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, ExternalLink, FileText } from 'lucide-react';
import Modal from './Modal';
import { REPORT_EVENT } from '../../utils/report';
import { toast } from '../../utils/toast';

const PAGE_WIDTH = { portrait: 794, landscape: 1123 }; // A4 at 96 dpi

// iOS Safari prints the parent page instead of an iframe, so there the report
// opens in its own tab where Share > Print > Save to Files works reliably.
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Mounted once in App. Listens for openReport() calls and shows a scaled,
 * scrollable preview of the A4 document with a single print action.
 */
export default function ReportHost({ lang }) {
  const isAr = lang === 'ar';
  const [report, setReport] = useState(null);
  const [scale, setScale] = useState(1);
  const [docHeight, setDocHeight] = useState(1123);
  const [ready, setReady] = useState(false);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const ios = isIOS();

  useEffect(() => {
    const onOpen = (event) => {
      setReady(false);
      setReport(event.detail);
    };
    window.addEventListener(REPORT_EVENT, onOpen);
    return () => window.removeEventListener(REPORT_EVENT, onOpen);
  }, []);

  const pageWidth = PAGE_WIDTH[report?.orientation === 'landscape' ? 'landscape' : 'portrait'];

  // Fit the A4 page to the available width.
  useEffect(() => {
    if (!report) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const fit = () => setScale(Math.min(1, stage.clientWidth / pageWidth));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [report, pageWidth]);

  const onFrameLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const measure = () => setDocHeight(doc.documentElement.scrollHeight);
    measure();
    (doc.fonts?.ready || Promise.resolve()).then(() => {
      measure();
      setReady(true);
    });
  }, []);

  const close = () => setReport(null);

  const print = async () => {
    if (!report) return;
    if (ios) {
      const blob = new Blob([report.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        toast.error(isAr ? 'المتصفح منع فتح نافذة التقرير. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.' : 'The browser blocked the report window. Allow pop-ups and try again.');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const frameWin = frameRef.current?.contentWindow;
    if (!frameWin) return;
    try {
      await frameWin.document.fonts?.ready;
      frameWin.focus();
      frameWin.print();
    } catch {
      toast.error(isAr ? 'تعذرت الطباعة من المعاينة. أعد المحاولة.' : 'Could not print the preview. Try again.');
    }
  };

  return (
    <Modal
      open={Boolean(report)}
      onClose={close}
      size="full"
      title={report?.title || (isAr ? 'معاينة التقرير' : 'Report preview')}
      description={isAr
        ? (ios ? 'سيفتح التقرير في صفحة جديدة. اختر مشاركة ثم طباعة، أو احفظه كملف PDF.' : 'اختر "حفظ بصيغة PDF" من نافذة الطباعة لحفظ التقرير كملف.')
        : (ios ? 'The report opens in a new tab. Use Share, then Print, or save it as a PDF.' : 'Choose "Save as PDF" in the print dialog to keep a file.')}
      closeLabel={isAr ? 'إغلاق' : 'Close'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close}>
            {isAr ? 'إغلاق' : 'Close'}
          </button>
          <button type="button" className="btn btn--primary" onClick={print} disabled={!ready && !ios} data-autofocus>
            {ios ? <ExternalLink size={18} aria-hidden="true" /> : <Printer size={18} aria-hidden="true" />}
            {ios ? (isAr ? 'فتح للطباعة والحفظ' : 'Open to print or save') : (isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF')}
          </button>
        </>
      }
    >
      {report && (
        <div ref={stageRef} className="report-stage" style={{ height: `${Math.ceil(docHeight * scale)}px` }}>
          {!ready && (
            <div className="loading-block" style={{ position: 'absolute', inset: 0, minHeight: 0 }}>
              <FileText size={22} aria-hidden="true" />
              <span>{isAr ? 'جارٍ تجهيز التقرير' : 'Preparing report'}</span>
            </div>
          )}
          <iframe
            ref={frameRef}
            title={report.title || 'report'}
            srcDoc={report.html}
            onLoad={onFrameLoad}
            style={{
              width: `${pageWidth}px`,
              height: `${docHeight}px`,
              transform: `scale(${scale})`,
              opacity: ready ? 1 : 0,
            }}
          />
        </div>
      )}
    </Modal>
  );
}
