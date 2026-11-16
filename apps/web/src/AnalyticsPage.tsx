import { formatLocalizedDate } from './i18n';
import { useTranslation } from 'react-i18next';
import { t, getLocale } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BarChart3, Download, LineChart, RefreshCw, TrendingUp } from 'lucide-react';
import { amountLabel, axisScale, type Currency } from './chart-data';
import './account-pages.css';
type Metric = 'income' | 'expense' | 'net';
type Totals = { incomeUzs: string; expenseUzs: string; netUzs: string; incomeUsd: string; expenseUsd: string; netUsd: string; count: number };
type Point = { label: string; currentDate: string | null; previousDate: string | null; current: Totals | null; previous: Totals | null };
type Report = { from: string; to: string; previousFrom: string; previousTo: string; partial: boolean; elapsedDays: number; summary: Totals; previousSummary: Totals; series: Point[]; categories: (Totals & { id: string; name: string })[]; bestDay: (Totals & { date: string }) | null; activeDays: number; topExpenses: { id: string; category: string; comment: string | null; occurredAt: string; amountUzs: string; amountUsd: string }[] };
const api = import.meta.env.VITE_API_URL || '';
const colors = ['#dfaa2f', '#8d58e6', '#4d9bd7', '#e77383', '#52b6a0', '#b6b461'];
const date = (value: string) => formatLocalizedDate(new Date(value + 'T12:00:00+05:00'), { day: '2-digit', month: 'short' });
const money = (v: number, c: Currency) => `${amountLabel(v, c)} ${c}`;
const value = (totals: Totals | null, metric: Metric, currency: Currency) => totals ? Number(totals[`${metric}${currency === 'USD' ? 'Usd' : 'Uzs'}` as keyof Totals]) : null;
export default function AnalyticsPage({ revision }: { revision: unknown }) {
  useTranslation();
  const [period, setPeriod] = useState('MONTH'), [currency, setCurrency] = useState<Currency>('UZS');
  const [metric, setMetric] = useState<Metric>('income'), [chart, setChart] = useState<'line' | 'bar'>('line');
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [applied, setApplied] = useState({ from: '', to: '' });
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (period === 'CUSTOM' && (!applied.from || !applied.to)) { setLoading(false); setReport(null); return; }
    const controller = new AbortController(); setLoading(true); setError(''); setReport(null);
    const query = new URLSearchParams({ period, ...(period === 'CUSTOM' ? applied : {}) });
    fetch(`${api}/api/analytics/report?${query}`, { credentials: 'include', signal: controller.signal }).then(async r => {
      if (!r.ok) throw Error('Не удалось загрузить аналитику. Проверьте выбранный период и подключение.');
      setReport(await r.json()); setLoading(false);
    }).catch(e => { if (e.name !== 'AbortError') { setError('Не удалось загрузить аналитику. Проверьте выбранный период и подключение.'); setLoading(false); } });
    return () => controller.abort();
  }, [period, applied, revision, retry]);
  const exportCsv = () => {
    if (!report) return;
    const rows = [t("Дата;Доход;Расход;Результат;Валюта"), ...report.series.filter(p => p.current).map(p => `${p.currentDate} ${p.label.includes(':') ? p.label : ''};${value(p.current, 'income', currency)};${value(p.current, 'expense', currency)};${value(p.current, 'net', currency)};${currency}`)];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `hisobchi-report-${report.from}-${report.to}-${currency}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="account-page analytics-page"><div className="account-title"><div><p>{t("Личные финансы")}</p><h1>{t("Аналитика")}</h1></div><button className="account-icon" aria-label={t("Скачать отчёт CSV")} disabled={!report} onClick={exportCsv}><Download size={19}/></button></div>
    <div className="report-filters"><label>{t("Период")}<select value={period} onChange={e => setPeriod(e.target.value)} aria-label={t("Период аналитики")}>{[['TODAY',t("Сегодня")],['YESTERDAY',t("Вчера")],['WEEK',t("Эта неделя")],['LAST_WEEK',t("Прошлая неделя")],['MONTH',t("Этот месяц")],['LAST_MONTH',t("Прошлый месяц")],['CUSTOM',t("Свои даты")]].map(([v,t]) => <option key={v} value={v}>{t}</option>)}</select></label><label>{t("Валюта")}<select value={currency} onChange={e => setCurrency(e.target.value as Currency)} aria-label={t("Валюта аналитики")}><option>UZS</option><option>USD</option></select></label></div>
    {period === 'CUSTOM' && <form className="report-dates" onSubmit={e => { e.preventDefault(); if (from > to) { setError('Дата начала должна быть не позже окончания'); return; } setApplied({ from, to }); }}><label>{t("С")}<input required type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>{t("По")}<input required type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label><button>{t("Показать")}</button></form>}
    {loading && <div className="report-state" role="status">{t("Считаем показатели…")}</div>}{error && <div className="report-state" role="alert"><p>{t(error)}</p><button onClick={() => setRetry(n => n + 1)}><RefreshCw size={15}/>{t("Повторить")}</button></div>}
    {report && !loading && <>
      <p className="report-caption">{date(report.from)} — {date(report.to)} {t(" · Ташкент")}{report.partial ? t(" · период ещё идёт") : ''}</p>
      <div className="report-kpis">{(['income','expense','net'] as const).map((m,i) => { const amount = value(report.summary,m,currency)!, previous = value(report.previousSummary,m,currency)!, delta=amount-previous, Icon=[ArrowUpRight,ArrowDownLeft,TrendingUp][i]; return <article key={m}><div><Icon size={16}/><span>{[t("Доходы"),t("Расходы"),t("Результат")][i]}</span></div><strong className={m === 'income' ? 'report-gold' : m === 'expense' ? 'report-purple' : amount < 0 ? 'neg' : ''}>{money(amount,currency)}</strong><small>{delta > 0 ? '+' : ''}{money(delta,currency)} {t(" к прошлому периоду")}</small></article>; })}</div>
      {!report.summary.count && <p className="report-empty">{t("За этот период операций пока нет. Все показатели равны нулю.")}</p>}
      <div className="report-section-title"><h2>{t("Сравнение периодов")}</h2><div className="report-chart-type"><button aria-label={t("Линейный график")} aria-pressed={chart === 'line'} onClick={() => setChart('line')}><LineChart size={16}/></button><button aria-label={t("Столбчатый график")} aria-pressed={chart === 'bar'} onClick={() => setChart('bar')}><BarChart3 size={16}/></button></div></div>
      <div className="report-metrics">{(['income','expense','net'] as const).map((m,i) => <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>{[t("Доходы"),t("Расходы"),t("Результат")][i]}</button>)}</div>
      <ComparisonChart report={report} currency={currency} metric={metric} chart={chart}/>
      <div className="report-legend"><span><i style={{background:colors[0]}}/>{date(report.from)} – {date(report.to)}</span><span><i style={{background:colors[1]}}/>{date(report.previousFrom)} – {date(report.previousTo)}</span></div>
      <p className="report-caption">{report.series[0]?.label.includes(':') ? t("Накопительный итог по реальному времени операций.") : t("Каждая точка — итог дня. Дни сравниваются по порядку внутри периода.")} {t(" Разница показана выше в выбранной валюте.")}</p>
      <div className="report-insights"><div><span>{t("Операций")}</span><strong>{report.summary.count}</strong></div><div><span>{t("Активных дней")}</span><strong>{report.activeDays}</strong></div><div><span>{t("Средний доход в день")}</span><strong>{money(value(report.summary,'income',currency)!/report.elapsedDays,currency)}</strong></div><div><span>{t("Средний расход в день")}</span><strong>{money(value(report.summary,'expense',currency)!/report.elapsedDays,currency)}</strong></div><div><span>{t("Лучший день по доходу")}</span><strong>{report.bestDay ? date(report.bestDay.date) : '—'}</strong></div><div><span>{t("Доля сохранённого дохода")}</span><strong>{Number(report.summary.incomeUzs) > 0 ? `${new Intl.NumberFormat(getLocale(),{maximumFractionDigits:1}).format(Number(report.summary.netUzs)/Number(report.summary.incomeUzs)*100)}%` : '—'}</strong></div></div>
      <h2 className="report-subtitle">{t("На что уходят деньги")}</h2><CategoryBreakdown report={report} currency={currency}/>
      <h2 className="report-subtitle">{t("Крупные расходы")}</h2><div className="report-expenses">{report.topExpenses.map(expense => <article key={expense.id}><div><strong>{expense.category}</strong><small>{expense.comment || t("Без комментария")} · {formatLocalizedDate(new Date(expense.occurredAt), {timeZone:'Asia/Tashkent'})}</small></div><b>{money(Number(currency === 'USD' ? expense.amountUsd : expense.amountUzs),currency)}</b></article>)}{!report.topExpenses.length && <p className="report-caption">{t("Расходов в этом периоде нет.")}</p>}</div>
      {currency === 'USD' && <p className="report-caption">{t("USD рассчитан по сохранённому курсу каждой операции.")}</p>}
    </>}
  </section>;
}

function ComparisonChart({ report, currency, metric, chart }: { report: Report; currency: Currency; metric: Metric; chart: 'line' | 'bar' }) {
  useTranslation();
  const host = useRef<HTMLDivElement>(null), [width,setWidth] = useState(360), [selected,setSelected] = useState<number|null>(null);
  useEffect(() => { const observer=new ResizeObserver(([e])=>setWidth(e.contentRect.width)); if(host.current)observer.observe(host.current);return()=>observer.disconnect(); },[]);
  useEffect(()=>setSelected(null),[report,currency,metric,chart]);
  const height=260, left=62, right=18, bottom=32, top=18;
  const numbers=report.series.flatMap(p=>[value(p.current,metric,currency),value(p.previous,metric,currency)]).filter((n):n is number=>n!==null);
  const minValue=Math.min(0,...numbers), maxValue=Math.max(0,...numbers), scale=axisScale([maxValue-minValue]);
  const step=scale.max/4, min=Math.floor(minValue/step)*step, max=Math.ceil(maxValue/step)*step || step, span=max-min || 1;
  const x=(i:number)=>left+i*(width-left-right)/Math.max(1,report.series.length-1), y=(n:number)=>top+(max-n)/span*(height-top-bottom);
  const ticks=Array.from({length:Math.round(span/step)+1},(_,i)=>min+i*step);
  const point=selected===null?null:report.series[selected];
  const select=(client:number)=>{const box=host.current?.getBoundingClientRect();if(box)setSelected(Math.max(0,Math.min(report.series.length-1,Math.round((client-box.left-left)/(width-left-right)*(report.series.length-1)))));};
  const stride=Math.max(1,Math.ceil(report.series.length/6));
  return <div className="report-comparison" ref={host} onPointerMove={e=>{if(e.pointerType==='mouse')select(e.clientX)}} onPointerDown={e=>select(e.clientX)} onPointerLeave={e=>{if(e.pointerType==='mouse')setSelected(null)}}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("Сравнение выбранного и предыдущего периода")}>
    {ticks.map(n=><g key={n}><line x1={left} x2={width-right} y1={y(n)} y2={y(n)} className={n===0?'report-zero':'report-grid'}/><text x={left-8} y={y(n)} dy=".35em" textAnchor="end">{amountLabel(n,currency,true)}</text></g>)}
    {(['current','previous'] as const).map((key,k)=>{const points=report.series.map((p,i)=>({i,v:value(p[key],metric,currency)})).filter((p):p is {i:number;v:number}=>p.v!==null);return <g key={key}>{chart==='line'?<><polyline fill="none" stroke={colors[k]} strokeWidth={2} points={points.map(p=>`${x(p.i)},${y(p.v)}`).join(' ')}/>{points.map(p=><circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={selected===p.i?4.5:2.7} fill={colors[k]}/>)}</>:points.map(p=><rect key={p.i} x={x(p.i)+(k===0?-5:1)} y={Math.min(y(0),y(p.v))} width={4} height={Math.max(1,Math.abs(y(p.v)-y(0)))} fill={colors[k]}/>)}</g>;})}
    {report.series.map((p,i)=><g key={i}>{(i%stride===0||i===report.series.length-1)&&<text x={x(i)} y={height-9} textAnchor="middle">{p.label.includes(':')?p.label:(p.currentDate||p.previousDate||'').slice(8)}</text>}<rect x={x(i)-6} width={12} y={top} height={height-top} fill="transparent" tabIndex={0} role="button" aria-label={t('Показать {{date}} {{label}}',{date:p.currentDate||p.previousDate,label:p.label})} onFocus={()=>setSelected(i)} onKeyDown={e=>{if(e.key==='Escape')setSelected(null);if(e.key==='Enter')setSelected(i)}}/></g>)}
    {selected!==null&&<line x1={x(selected)} x2={x(selected)} y1={top} y2={height-bottom} className="report-crosshair"/>}
  </svg>{point&&<div className="report-tooltip" role="status"><strong>{point.label.includes(':')?point.label:t('День {{day}}',{day:point.label})}</strong>{(['current','previous'] as const).map((key,k)=><div key={key}><i style={{background:colors[k]}}/><span>{point[key+'Date' as 'currentDate'|'previousDate']?date(point[key+'Date' as 'currentDate'|'previousDate']!):t("Нет даты")}</span><b>{point[key]?money(value(point[key],metric,currency)!,currency):'—'}</b></div>)}</div>}</div>;
}
function CategoryBreakdown({report,currency}:{report:Report;currency:Currency}) {
  useTranslation();
  const total=value(report.summary,'expense',currency)!;
  let offset=0;
  return <div className="report-categories">{total>0?<><div className="report-donut"><svg viewBox="0 0 180 180" role="img" aria-label={t("Доли расходов по категориям")}><circle cx={90} cy={90} r={65} fill="none" className="report-donut-base" strokeWidth={22}/>{report.categories.map((c,i)=>{const share=value(c,'expense',currency)!/total;const start=offset;offset+=share;return <circle key={c.id} cx={90} cy={90} r={65} fill="none" stroke={colors[i%colors.length]} strokeWidth={22} pathLength={1} strokeDasharray={`${share} ${1-share}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"><title>{c.id==='uncategorized'?t('Без категории'):c.name}: {money(value(c,'expense',currency)!,currency)}</title></circle>;})}</svg><div><small>{t("Всего расходов")}</small><b>{money(total,currency)}</b></div></div><div className="report-category-list">{report.categories.map((c,i)=><div key={c.id}><i style={{background:colors[i%colors.length]}}/><span>{c.id==='uncategorized'?t('Без категории'):c.name}<small>{t("Операций: {{count}} · {{share}}%",{count:c.count,share:new Intl.NumberFormat(getLocale(),{maximumFractionDigits:1}).format(value(c,'expense',currency)!/total*100)})}</small></span><strong>{money(value(c,'expense',currency)!,currency)}</strong></div>)}</div></>:<p className="report-caption">{t("Категории появятся после первого расхода.")}</p>}</div>;
}
