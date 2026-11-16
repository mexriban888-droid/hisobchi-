import { formatLocalizedDate } from './i18n';
import { useTranslation } from 'react-i18next';
import { t, getLocale } from './i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { amountLabel, axisScale, chartCsv, dayValues, type Currency, type DayTotal } from './chart-data';
import './daily-chart.css';

const api = import.meta.env.VITE_API_URL || '';
const H = 300, L = 60, R = 18, T = 22, B = 40;
const gold = '#dfaa2f', purple = '#8d58e6';
const formatDate = (date: string, full = false) => formatLocalizedDate(new Date(date + 'T12:00:00+05:00'), full ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit' });

export default function DailyChart({ revision }: { revision: unknown }) {
  useTranslation();
  const [period, setPeriod] = useState(7);
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [days, setDays] = useState<DayTotal[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [shown, setShown] = useState({ income: true, expense: true });
  const host = useRef<HTMLDivElement>(null);
  const [W, setWidth] = useState(680);
  const titleId = useId();
  useEffect(() => {
    if (status !== 'ready' || !host.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [status, period]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading'); setSelected(null);
    fetch(`${api}/api/analytics/timeline?days=${period}`, { credentials: 'include', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error(t("Не удалось загрузить график"));
        const data: { items: DayTotal[] } = await response.json();
        if (!Array.isArray(data.items) || data.items.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Object.values(dayValues(d, currency)).some(v => !Number.isFinite(v) || v < 0))) throw Error(t("Некорректный ответ"));
        setDays(data.items); setStatus('ready');
      }).catch(error => { if (error.name !== 'AbortError') setStatus('error'); });
    return () => controller.abort();
  }, [period, revision, retry]);
  const values = days.map(d => dayValues(d, currency));
  const scale = axisScale(values.flatMap(v => [shown.income ? v.income : 0, shown.expense ? v.expense : 0]));
  const x = (index: number) => L + index * (W - L - R) / Math.max(1, days.length - 1);
  const y = (value: number) => H - B - value / scale.max * (H - B - T);
  const active = selected === null ? null : days[selected];
  const activeValues = active ? dayValues(active, currency) : null;
  const selectPointer = (clientX: number) => {
    const box = host.current?.getBoundingClientRect();
    if (!box || !days.length) return;
    setSelected(Math.max(0, Math.min(days.length - 1, Math.round(((clientX - box.left) / box.width * W - L) / (W - L - R) * (days.length - 1)))));
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([chartCsv(days, currency)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `hisobchi-${period}-days-${currency}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="daily-chart" aria-labelledby={titleId}>
    <div className="daily-heading"><div><h2 id={titleId}>{t("Динамика по дням")}</h2><p>{t("Каждая точка — итог одного дня")}</p></div><button className="daily-icon" title={t("Скачать CSV")} aria-label={t("Скачать данные графика CSV")} onClick={download} disabled={status !== 'ready'}><Download size={17}/></button></div>
    <div className="daily-controls"><div className="daily-period" aria-label={t("Период")}>{[7, 14, 30].map(n => <button key={n} aria-pressed={period === n} onClick={() => setPeriod(n)}>{t("{{count}} дней",{count:n})}</button>)}</div><select aria-label={t("Валюта графика")} value={currency} onChange={e => setCurrency(e.target.value as Currency)}><option>UZS</option><option>USD</option></select></div>
    {status === 'loading' ? <div className="daily-state" role="status">{t("Загружаем динамику…")}</div> : status === 'error' ? <div className="daily-state" role="alert"><p>{t("Не удалось загрузить данные графика")}</p><button onClick={() => setRetry(n => n + 1)}><RefreshCw size={14}/>{t("Повторить")}</button></div> : <>
      <div className="daily-scroll"><div className="daily-plot" style={{ minWidth: period === 7 ? undefined : period * 48 + L + R }} ref={host} onPointerMove={e => { if (e.pointerType === 'mouse') selectPointer(e.clientX); }} onPointerDown={e => selectPointer(e.clientX)} onPointerLeave={e => { if (e.pointerType === 'mouse') setSelected(null); }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Доходы и расходы за {{count}} дней в {{currency}}',{count:period,currency})}>
          {scale.ticks.map(value => <g key={value}><line x1={L} x2={W - R} y1={y(value)} y2={y(value)} className="daily-grid"/><text x={L - 12} y={y(value)} dy=".35em" textAnchor="end" className="daily-axis">{amountLabel(value, currency, true)}</text></g>)}
          <text x={L - 12} y={10} textAnchor="end" className="daily-unit">{currency}</text>
          <path d={`M${L} ${T}V${H - B}H${W - R}`} className="daily-axis-line" fill="none"/>
          {scale.ticks.map(value => <line key={value} x1={L - 4} x2={L} y1={y(value)} y2={y(value)} className="daily-axis-line"/>)}
          {(['income', 'expense'] as const).filter(key => shown[key]).map(key => <g key={key}>
            <polyline points={values.map((v, i) => `${x(i)},${y(v[key])}`).join(' ')} fill="none" stroke={key === 'income' ? gold : purple} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {days.map((day, i) => <circle key={day.date} cx={x(i)} cy={y(values[i][key])} r={selected === i ? 5 : 3.6} fill={key === 'income' ? gold : purple} stroke="var(--daily-point-stroke)" strokeWidth="2"/>)}</g>)}
          {selected !== null && <line x1={x(selected)} x2={x(selected)} y1={T} y2={H - B} className="daily-crosshair"/>}
          {days.map((day, i) => <g key={day.date}><text x={x(i)} y={H - 19} textAnchor="middle" className={`daily-axis ${selected === i ? 'is-selected' : ''}`}>{formatDate(day.date)}</text><rect x={x(i) - (W - L - R) / days.length / 2} y={T} width={(W - L - R) / days.length} height={H - T} fill="transparent" tabIndex={0} role="button" aria-label={t('{{date}}: доход {{income}} {{currency}}, расход {{expense}} {{currency}}',{date:formatDate(day.date,true),income:amountLabel(values[i].income,currency),expense:amountLabel(values[i].expense,currency),currency})} onFocus={() => setSelected(i)} onKeyDown={e => { if (e.key === 'Escape') setSelected(null); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(i); } }}/></g>)}
        </svg>
        {active && activeValues && selected !== null && <div className="daily-tooltip" role="status" style={{ left: Math.max(8, Math.min(x(selected) + 12, W - 248)), width: 240, minWidth: 0, maxWidth: 'calc(100% - 16px)', top: `${Math.min(53, Math.max(12, y(Math.max(activeValues.income, activeValues.expense)) / H * 100))}%` }}><strong>{formatDate(active.date, true)}</strong><div><i style={{ background: gold }}/>{t("Доход")}<span>{amountLabel(activeValues.income, currency)} {currency}</span></div><div><i style={{ background: purple }}/>{t("Расход")}<span>{amountLabel(activeValues.expense, currency)} {currency}</span></div><div className="daily-net">{t("Результат")}<span>{amountLabel(activeValues.income - activeValues.expense, currency)} {currency}</span></div></div>}
      </div></div>
      <div className="daily-legend">{(['income', 'expense'] as const).map(key => <button key={key} aria-pressed={shown[key]} onClick={() => setShown(s => ({ ...s, [key]: !s[key] }))}><i style={{ background: key === 'income' ? gold : purple }}/>{key === 'income' ? t("Доходы") : t("Расходы")}</button>)}</div>
      {values.every(v => !v.income && !v.expense) && <p className="daily-hint">{t("За этот период операций нет. Добавьте доход или расход.")}</p>}
      <p className="daily-hint">{t("Наведите на точку или нажмите на график · время Ташкента")}</p>
    </>}
  </section>;
}
