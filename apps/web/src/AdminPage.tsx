import { formatLocalizedDate } from './i18n';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Ban, Check, ChevronLeft, ChevronRight, Clock3, FileClock, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRound, Users, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { t, getLocale } from './i18n';
import './account-pages.css';
import './admin-page.css';

const api = import.meta.env.VITE_API_URL || '';
type Role = 'OWNER' | 'ADMIN' | 'USER';
type Status = 'ALL' | 'ACTIVE' | 'NONE' | 'EXPIRED' | 'REVOKED' | 'BANNED' | 'PENDING';
type Tab = 'overview' | 'users' | 'requests' | 'audit' | 'admins';
type Subscription = { startsAt: string; endsAt: string; revokedAt: string | null };
type AdminUser = { id: string; telegramId: string; firstName: string | null; lastName: string | null; username: string | null; role: Role; isBanned: boolean; banReason: string | null; createdAt: string; lastActivityAt: string; botStartedAt: string | null; miniAppFirstOpenedAt: string | null; miniAppLastOpenedAt: string | null; accessRequestedAt: string | null; accessRequestStatus: string | null; subscription: Subscription | null };
type Overview = { total: number; users: number; admins: number; botStarted: number; appOpened: number; active7Days: number; activeSubscriptions: number; withoutSubscription: number; expiredSubscriptions: number; revokedSubscriptions: number; banned: number; pendingRequests: number; registeredToday: number; trackingNote: string };
type Audit = { id: string; action: string; createdAt?: string; occurredAt?: string; actorAdminId?: string; targetUserId?: string; reason?: string | null; previousExpiresAt?: string | null; newExpiresAt?: string | null; durationValue?: number | null; durationUnit?: string | null; safeMetadata?: { reason?: string }; actor?: { username?: string | null; telegramId?: string }; target?: { username?: string | null; telegramId?: string } | null };
const filters: [Status, string][] = [['ALL', 'Все пользователи'], ['PENDING', 'Заявки на доступ'], ['ACTIVE', 'Активная подписка'], ['NONE', 'Без подписки'], ['EXPIRED', 'Подписка истекла'], ['REVOKED', 'Доступ отозван'], ['BANNED', 'Заблокированы']];
const actionNames: Record<string, string> = { GRANT: 'Подписка выдана', EXTEND: 'Подписка продлена', REVOKE: 'Подписка отозвана', EXPIRE: 'Подписка истекла', GRANT_SUBSCRIPTION: 'Выдача подписки', EXTEND_SUBSCRIPTION: 'Продление подписки', REVOKE_SUBSCRIPTION: 'Отзыв подписки', BAN_USER: 'Блокировка', UNBAN_USER: 'Разблокировка', ASSIGN_ADMIN: 'Назначение администратора', REMOVE_ADMIN: 'Снятие администратора', REJECT_ACCESS_REQUEST: 'Заявка отклонена', REJECT_REQUEST: 'Заявка отклонена', ACCESS_REQUEST_REJECTED: 'Заявка отклонена' };
function displayName(user: AdminUser) { return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || t("Пользователь Telegram"); }
function dateTime(value: string | null | undefined, time = true) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return t("Не зафиксировано");
  return formatLocalizedDate(new Date(value), { timeZone: 'Asia/Tashkent', day: '2-digit', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
function userStatus(user: AdminUser) {
  if (user.isBanned) return { text: t("Заблокирован"), color: 'red' };
  if (user.role !== 'USER') return { text: user.role === 'OWNER' ? t("Владелец") : t("Администратор"), color: 'purple' };
  if (user.subscription?.revokedAt) return { text: t("Доступ отозван"), color: 'red' };
  if (user.subscription && new Date(user.subscription.endsAt) > new Date() && new Date(user.subscription.startsAt) <= new Date()) return { text: t("Подписка активна"), color: 'green' };
  if (user.accessRequestStatus === 'PENDING') return { text: t("Ожидает доступа"), color: 'gold' };
  if (user.subscription) return { text: t("Подписка истекла"), color: 'muted' };
  return { text: t("Без подписки"), color: 'muted' };
}
const errorText: Record<string, string> = { USER_PROTECTED: 'Эта учётная запись защищена от изменений.', UNBAN_FIRST: 'Сначала разблокируйте пользователя, затем выдайте подписку.', CONCURRENT_CHANGE_RETRY: 'Данные изменились. Обновите карточку и повторите действие.', DURATION_TOO_LONG: 'Допустимый срок: до 3650 дней или 120 календарных месяцев.', INVALID_REQUEST_KEY: 'Не удалось подтвердить запрос. Откройте карточку заново.', BANNED: 'Доступ администратора заблокирован.', ADMIN_REQUIRED: 'Этот раздел доступен только администраторам.', OWNER_REQUIRED: 'Это действие доступно только владельцу.', OWNER_PROTECTED: 'Учётная запись владельца защищена.', USER_NOT_FOUND: 'Пользователь не найден. Обновите список.', SUBSCRIPTION_NOT_FOUND: 'Действующей подписки нет.', NOT_ADMIN: 'У пользователя уже нет роли администратора.', REQUEST_NOT_FOUND: 'Заявка уже обработана или не найдена.', NO_PENDING_REQUEST: 'Заявка уже обработана.', VALIDATION_ERROR: 'Проверьте заполненные поля.', CONFLICT: 'Данные изменились. Обновите карточку и повторите действие.', RETRY_REQUIRED: 'Данные изменились. Повторите действие.', CANNOT_MANAGE_ADMIN: 'Управлять администраторами может только владелец.' };
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${api}/api/admin${path}`, { credentials: 'include', ...options }); }
  catch { throw Error(t("Нет соединения с сервером. Данные формы сохранены, попробуйте ещё раз.")); }
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error((errorText[data.error] && t(errorText[data.error])) || (response.status === 401 ? t("Сессия завершилась. Откройте Mini App заново.") : response.status === 403 ? t("Недостаточно прав для этого действия.") : t("Не удалось выполнить запрос. Проверьте соединение и повторите."))); }
  return response.status === 204 ? undefined as T : response.json();
}
function post(path: string, body: object = {}) { return request<void>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

export default function AdminPage({ role, onPersonal }: { role: 'OWNER' | 'ADMIN'; onPersonal: () => void }) {
  useTranslation();
  const [tab, setTab] = useState<Tab>('overview'), [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState<Status>('ALL'), [search, setSearch] = useState(''), [appliedSearch, setAppliedSearch] = useState(''), [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]), [total, setTotal] = useState(0), [selected, setSelected] = useState<AdminUser | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
  const [telegramId, setTelegramId] = useState(''), [assigning, setAssigning] = useState(false); const assignmentLock = useRef(false);
  useEffect(() => { let active = true; request<Overview>('/overview').then(data => { if (active) setOverview(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [revision]);
  useEffect(() => {
    if (tab === 'overview') { setLoading(false); return; }
    let active = true; setLoading(true); setError('');
    const query = new URLSearchParams({ search: appliedSearch, status: tab === 'requests' ? 'PENDING' : status, limit: '20', offset: String(offset), ...(tab === 'admins' ? { role: 'ADMIN' } : {}) });
    (tab === 'audit' ? request<Audit[]>('/audit').then(data => { if (active) setAudit(data); }) : request<{ items: AdminUser[]; total: number }>(`/users?${query}`).then(data => { if (active) { setUsers(data.items); setTotal(data.total); } })).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, status, appliedSearch, offset, revision]);
  const changeTab = (next: Tab) => { setTab(next); setOffset(0); setSearch(''); setAppliedSearch(''); setStatus('ALL'); setError(''); setNotice(''); };
  const openFilter = (filter: Status) => { setTab(filter === 'PENDING' ? 'requests' : 'users'); setStatus(filter); setOffset(0); setSearch(''); setAppliedSearch(''); };
  const refresh = () => setRevision(n => n + 1);
  const tabs: [Tab, string, LucideIcon][] = [['overview', t("Обзор"), ShieldCheck], ['users', t("Пользователи"), Users], ['requests', t("Заявки"), Clock3], ['audit', t("Журнал"), FileClock], ...(role === 'OWNER' ? [['admins', t("Администраторы"), UserRound] as [Tab, string, LucideIcon]] : [])];
  const metrics: { key: keyof Overview; label: string; description: string; filter?: Status }[] = [
    { key: 'total', label: t("Зарегистрировано"), description: t("Все учётные записи"), filter: 'ALL' },
    { key: 'activeSubscriptions', label: t("Активные подписки"), description: t("Пользователи с доступом"), filter: 'ACTIVE' },
    { key: 'pendingRequests', label: t("Ожидают доступа"), description: t("Подали заявку"), filter: 'PENDING' },
    { key: 'withoutSubscription', label: t("Без подписки"), description: t("Доступ ещё не выдавался"), filter: 'NONE' },
    { key: 'expiredSubscriptions', label: t("Истёкшие подписки"), description: t("Нужно продление"), filter: 'EXPIRED' },
    { key: 'revokedSubscriptions', label: t("Доступ отозван"), description: t("Подписка отключена"), filter: 'REVOKED' },
    { key: 'banned', label: t("Заблокированы"), description: t("Вход ограничен"), filter: 'BANNED' },
    { key: 'registeredToday', label: t("Новые сегодня"), description: t("По времени Ташкента") },
  ];
  return <section className="account-page admin-page">
    <div className="admin-top"><div><span className="admin-role"><ShieldCheck size={13}/>{role === 'OWNER' ? t("Владелец · OWNER") : t("Администратор · ADMIN")}</span><h1>{t("Управление Hisobchi")}</h1><p>{t("Пользователи, доступ и подписки")}</p></div><button className="admin-personal" onClick={onPersonal}><ArrowLeft size={15}/><span>{t("Мой кабинет")}</span></button></div>
    <div className="admin-tabs" role="tablist" aria-label={t("Разделы управления")}>{tabs.map(([key, text, Icon]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => changeTab(key)}><Icon size={15}/>{text}{key === 'requests' && !!overview?.pendingRequests && <b>{overview.pendingRequests}</b>}</button>)}</div>
    {notice && <div className="admin-notice" role="status"><Check size={15}/><span>{notice}</span><button aria-label={t("Скрыть уведомление")} onClick={() => setNotice('')}><X size={14}/></button></div>}
    {error && <div className="admin-error" role="alert"><p>{error}</p><button onClick={refresh}><RefreshCw size={14}/>{t("Повторить")}</button></div>}
    {tab === 'overview' && <>
      <div className="admin-section-title"><h2>{t("Состояние сервиса")}</h2><button aria-label={t("Обновить статистику")} className="admin-icon" onClick={refresh}><RefreshCw size={16}/></button></div>
      <div className="admin-metrics">{metrics.map(metric => <button key={metric.key} className="admin-metric" disabled={!metric.filter} onClick={() => metric.filter && openFilter(metric.filter)}><span>{metric.label}</span><strong>{overview ? String(overview[metric.key]) : '—'}</strong><small>{metric.description}</small>{metric.filter && <ChevronRight size={14}/>}</button>)}</div>
      <h2 className="admin-subtitle">{t("Как пользователи приходят в приложение")}</h2><div className="admin-funnel">{([['botStarted', t("Запустили бота"), t("Отправили /start")], ['appOpened', t("Открыли Mini App"), t("Авторизовались в приложении")], ['active7Days', t("Активны за 7 дней"), t("Открывали Mini App")], ['pendingRequests', t("Хотят получить доступ"), t("Отправили заявку")]] as const).map(([key, label, description], i) => <div key={key}><span className="admin-step">{i + 1}</span><div><b>{label}</b><small>{description}</small></div><strong>{overview?.[key] ?? '—'}</strong></div>)}</div>
      <p className="admin-note">{t(overview?.trackingNote || "Данные о запусках и заявках отражают зафиксированные события. Просмотр страницы бота без /start не считается регистрацией.")}</p>
      <div className="admin-privacy"><ShieldCheck size={18}/><p>{t("Администратор управляет доступом. Личные доходы, расходы и категории пользователей здесь не отображаются.")}</p></div>
    </>}
    {(tab === 'users' || tab === 'requests' || tab === 'admins') && <>
      <div className="admin-section-title"><h2>{tab === 'requests' ? t("Заявки на доступ") : tab === 'admins' ? t("Администраторы") : t("Пользователи")}</h2><span className="admin-total">{total}</span></div>
      {tab === 'admins' && role === 'OWNER' && <form className="admin-assign" onSubmit={async e => { e.preventDefault(); if (assignmentLock.current) return; if (!/^\d+$/.test(telegramId.trim())) { setError(t("Введите числовой Telegram ID зарегистрированного пользователя.")); return; } assignmentLock.current = true; setAssigning(true); setError(''); try { await post('/admins', { telegramId: telegramId.trim() }); setNotice(t("Администратор назначен")); setTelegramId(''); refresh(); } catch (e) { setError(e instanceof Error ? e.message : t("Не удалось назначить администратора")); } finally { assignmentLock.current = false; setAssigning(false); } }}><label htmlFor="admin-telegram-id">{t("Назначить администратора по Telegram ID")}</label><div><input id="admin-telegram-id" inputMode="numeric" value={telegramId} onChange={e => setTelegramId(e.target.value)} placeholder="Telegram ID" disabled={assigning}/><button disabled={assigning}>{assigning ? t("Назначаем…") : t("Назначить")}</button></div><small>{t("Пользователь должен сначала запустить бота или открыть Mini App.")}</small></form>}
      <form className="admin-search" onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); setOffset(0); }}><Search size={16}/><input aria-label={t("Поиск пользователей")} placeholder={t("Имя, username или Telegram ID")} value={search} onChange={e => setSearch(e.target.value)}/><button type="submit">{t("Найти")}</button></form>
      {tab === 'users' && <select className="admin-filter" aria-label={t("Статус пользователя")} value={status} onChange={e => { setStatus(e.target.value as Status); setOffset(0); }}>{filters.map(([key, text]) => <option key={key} value={key}>{t(text)}</option>)}</select>}
      {tab === 'requests' && <p className="admin-note">{t("Здесь только пользователи, которые явно запросили доступ. Заявка не подтверждает оплату — её нужно проверить самостоятельно.")}</p>}
      {loading ? <div className="admin-loading" role="status"><LoaderCircle size={20}/>{t("Загружаем пользователей…")}</div> : !error && <><div className="admin-user-list">{users.map(user => { const status = userStatus(user); return <button className="admin-user" key={user.id} onClick={() => setSelected(user)} aria-label={t('Открыть пользователя {{name}}', { name: displayName(user) })}><span className="admin-avatar">{displayName(user).slice(0, 1).toUpperCase()}</span><div className="admin-user-main"><strong>{displayName(user)}</strong><small>{user.username ? `@${user.username} · ` : ''}ID {user.telegramId}</small><span className={`admin-status is-${status.color}`}>{status.text}</span></div><ChevronRight size={16}/></button>; })}</div>{!users.length && <div className="admin-empty"><Users size={28}/><h3>{tab === 'requests' ? t("Ожидающих заявок нет") : t("Пользователи не найдены")}</h3><p>{t("Попробуйте другой поиск или обновите список.")}</p><button onClick={refresh}>{t("Обновить")}</button></div>}{total > 20 && <div className="admin-pagination"><button aria-label={t("Предыдущая страница пользователей")} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}><ChevronLeft size={17}/></button><span>{offset + 1}–{Math.min(offset + 20, total)} {t("из")} {total}</span><button aria-label={t("Следующая страница пользователей")} disabled={offset + 20 >= total} onClick={() => setOffset(offset + 20)}><ChevronRight size={17}/></button></div>}</>}
    </>}
    {tab === 'audit' && <><div className="admin-section-title"><h2>{t("Журнал действий")}</h2><button className="admin-icon" aria-label={t("Обновить журнал")} onClick={refresh}><RefreshCw size={16}/></button></div><p className="admin-note">{t("Последние административные действия. Время — Ташкент, UTC+5.")}</p>{loading ? <div className="admin-loading" role="status">{t("Загружаем журнал…")}</div> : !error && <AuditList items={audit}/>}</>}
    {selected && <UserDetails key={selected.id} initialUser={selected} role={role} onClose={() => setSelected(null)} onUpdated={refresh}/>}
  </section>;
}

function AdminDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { dialog?.close(); document.body.style.overflow = old; }; }, []);
  return <dialog className="admin-dialog" ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => { if (e.target === ref.current && !busy) onClose(); }}><div className="admin-dialog-inner"><div className="admin-dialog-heading"><h2>{title}</h2><button type="button" aria-label={t("Закрыть карточку пользователя")} className="admin-icon" disabled={busy} onClick={onClose}><X size={19}/></button></div>{children}</div></dialog>;
}
type Confirmation = 'revoke' | 'ban' | 'unban' | 'reject' | 'removeAdmin' | null;
function UserDetails({ initialUser, role, onClose, onUpdated }: { initialUser: AdminUser; role: 'OWNER' | 'ADMIN'; onClose: () => void; onUpdated: () => void }) {
  useTranslation();
  const [user, setUser] = useState(initialUser), [events, setEvents] = useState<Audit[]>([]), [audit, setAudit] = useState<Audit[]>([]);
  const [value, setValue] = useState('30'), [unit, setUnit] = useState<'DAYS' | 'MONTHS'>('DAYS'), [confirm, setConfirm] = useState<Confirmation>(null), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [historyError, setHistoryError] = useState(false), [historyLoading, setHistoryLoading] = useState(true);
  const lock = useRef(false), grantKey = useRef<string | null>(null);
  const readHistory = useCallback(async () => { setHistoryLoading(true); setHistoryError(false); try { const data = await request<{ subscriptionEvents: Audit[]; audit: Audit[] }>(`/users/${initialUser.id}/audit`); setEvents(data.subscriptionEvents); setAudit(data.audit); } catch { setHistoryError(true); } finally { setHistoryLoading(false); } }, [initialUser.id]);
  useEffect(() => { readHistory(); }, [readHistory]);
  const canManage = user.role !== 'OWNER' && (role === 'OWNER' || user.role === 'USER');
  const status = userStatus(user);
  const mutate = async (path: string, body: object, message: string, grant = false) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await post(path, body); if (grant) grantKey.current = null; setConfirm(null); setReason(''); setNotice(message); onUpdated();
      try { const data = await request<{ items: AdminUser[] }>(`/users?search=${encodeURIComponent(user.telegramId)}&limit=100`); const updated = data.items.find(u => u.id === user.id); if (updated) setUser(updated); await readHistory(); } catch { setNotice(t('{{message}}. Обновите карточку для актуального статуса.', { message })); }
    } catch (e) { setError(e instanceof Error ? e.message : t("Не удалось выполнить действие.")); } finally { lock.current = false; setBusy(false); }
  };
  const choose = (action: Confirmation) => { setConfirm(action); setReason(''); setError(''); };
  return <AdminDialog title={displayName(user)} busy={busy} onClose={onClose}>
    <div className="admin-detail-identity"><span className="admin-avatar">{displayName(user).slice(0, 1).toUpperCase()}</span><div><p>{user.username ? `@${user.username}` : t("Username не указан")}</p><small>Telegram ID: {user.telegramId}</small><span className={`admin-status is-${status.color}`}>{status.text}</span></div></div>
    {notice && <p className="admin-notice" role="status">{notice}</p>}{error && <p className="admin-error" role="alert">{error}</p>}
    <dl className="admin-user-facts"><div><dt>{t("Роль")}</dt><dd>{user.role === 'OWNER' ? t("Владелец") : user.role === 'ADMIN' ? t("Администратор") : t("Пользователь")}</dd></div><div><dt>{t("Регистрация")}</dt><dd>{dateTime(user.createdAt)}</dd></div><div><dt>{t("Первый /start")}</dt><dd>{dateTime(user.botStartedAt)}</dd></div><div><dt>{t("Первый вход в Mini App")}</dt><dd>{dateTime(user.miniAppFirstOpenedAt)}</dd></div><div><dt>{t("Последний вход в Mini App")}</dt><dd>{dateTime(user.miniAppLastOpenedAt)}</dd></div><div><dt>{t("Заявка на доступ")}</dt><dd>{dateTime(user.accessRequestedAt)}</dd></div><div><dt>{t("Подписка до")}</dt><dd>{user.subscription ? dateTime(user.subscription.endsAt) : t("Не выдавалась")}</dd></div>{user.subscription?.revokedAt && <div><dt>{t("Отозвана")}</dt><dd>{dateTime(user.subscription.revokedAt)}</dd></div>}{user.isBanned && user.banReason && <div><dt>{t("Причина блокировки")}</dt><dd>{user.banReason}</dd></div>}</dl>
    {canManage ? <>
      <h3 className="admin-detail-heading">{t("Выдать или продлить подписку")}</h3><form className="admin-grant" onSubmit={e => { e.preventDefault(); if (user.isBanned) { setError(t("Сначала разблокируйте пользователя.")); return; } const max = unit === 'DAYS' ? 3650 : 120; const n = Number(value); if (!Number.isInteger(n) || n < 1 || n > max) { setError(t('Укажите целое число от 1 до {{max}}.', { max })); return; } const requestId = grantKey.current || crypto.randomUUID(); grantKey.current = requestId; mutate(`/users/${user.id}/subscription`, { value: n, unit, requestId }, t("Подписка обновлена"), true); }}><label>{t("Срок")}<input aria-label={t("Срок подписки")} inputMode="numeric" type="number" min={1} max={unit === 'DAYS' ? 3650 : 120} step={1} value={value} disabled={busy || user.isBanned} onChange={e => { setValue(e.target.value); grantKey.current = null; }}/></label><label>{t("Единица")}<select aria-label={t("Единица срока подписки")} value={unit} disabled={busy || user.isBanned} onChange={e => { setUnit(e.target.value as 'DAYS' | 'MONTHS'); grantKey.current = null; }}><option value="DAYS">{t("Дней")}</option><option value="MONTHS">{t("Календарных месяцев")}</option></select></label><button className="admin-primary" disabled={busy || user.isBanned}>{busy ? <LoaderCircle size={16}/> : <Check size={16}/>}{t("Выдать / продлить")}</button></form>
      {user.isBanned && <p className="admin-note">{t("Сначала разблокируйте пользователя кнопкой ниже. После этого можно выдать или продлить подписку.")}</p>}
      <p className="admin-note">{t("Активная подписка продлевается от срока окончания. Истёкшая или отозванная — от текущей даты. Блокировка снимается отдельно.")}</p>
      <div className="admin-user-actions">{user.subscription && !user.subscription.revokedAt && <button disabled={busy} onClick={() => choose('revoke')}>{t("Отозвать подписку")}</button>}<button disabled={busy} onClick={() => choose(user.isBanned ? 'unban' : 'ban')}><Ban size={14}/>{user.isBanned ? t("Разблокировать") : t("Заблокировать")}</button>{user.accessRequestStatus === 'PENDING' && <button disabled={busy} onClick={() => choose('reject')}>{t("Отклонить заявку")}</button>}{role === 'OWNER' && user.role === 'ADMIN' && <button disabled={busy} onClick={() => choose('removeAdmin')}>{t("Снять администратора")}</button>}</div>
      {confirm && <form className="admin-confirm" onSubmit={e => { e.preventDefault(); if ((confirm === 'ban' || confirm === 'reject') && !reason.trim()) { setError(t("Укажите причину действия.")); return; } const path = confirm === 'revoke' ? `/users/${user.id}/subscription/revoke` : confirm === 'reject' ? `/users/${user.id}/access-request/reject` : confirm === 'removeAdmin' ? `/admins/${user.id}/remove` : `/users/${user.id}/${confirm}`; const messages = { revoke: t("Подписка отозвана"), ban: t("Пользователь заблокирован"), unban: t("Пользователь разблокирован"), reject: t("Заявка отклонена"), removeAdmin: t("Роль администратора снята") }; mutate(path, { reason: reason.trim() || undefined }, messages[confirm]); }}><h4>{confirm === 'revoke' ? t("Отозвать действующую подписку?") : confirm === 'ban' ? t("Заблокировать пользователя?") : confirm === 'unban' ? t("Разблокировать пользователя?") : confirm === 'reject' ? t("Отклонить заявку на доступ?") : t("Снять права администратора?")}</h4><p>{t("Изменение будет записано в журнал. Финансовые данные сохранятся.")}</p>{confirm !== 'unban' && confirm !== 'removeAdmin' && <label>{t("Причина")}{(confirm === 'ban' || confirm === 'reject') ? t(" (обязательно)") : t(" (необязательно)")}<textarea aria-label={t("Причина административного действия")} maxLength={300} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} rows={2}/></label>}<div><button type="button" disabled={busy} onClick={() => setConfirm(null)}>{t("Отмена")}</button><button className="admin-danger" disabled={busy}>{busy ? t("Выполняем…") : t("Подтвердить")}</button></div></form>}
    </> : <p className="admin-note">{user.role === 'OWNER' ? t("Учётная запись владельца защищена от административных изменений.") : t("Управлять этим администратором может только владелец.")}</p>}
    <h3 className="admin-detail-heading">{t("История подписки")}</h3>{historyLoading ? <p className="admin-note" role="status">{t("Загружаем историю…")}</p> : historyError ? <div className="admin-error" role="alert">{t("Не удалось загрузить историю.")}<button onClick={readHistory}>{t("Повторить")}</button></div> : <AuditList items={events}/>}
    {!historyError && !historyLoading && <><h3 className="admin-detail-heading">{t("Действия с пользователем")}</h3><AuditList items={audit}/></>}
  </AdminDialog>;
}
function AuditList({ items }: { items: Audit[] }) {
  useTranslation();
  if (!items.length) return <p className="admin-note">{t("Записей пока нет.")}</p>;
  return <div className="admin-audit-list">{items.map((item, index) => <article key={item.id || `${item.action}-${index}`}><span className="admin-audit-icon"><FileClock size={15}/></span><div><strong>{t(actionNames[item.action] || item.action)}</strong><small>{dateTime(item.createdAt || item.occurredAt)}</small>{item.actor && <p>{t("Администратор:")} {item.actor.username ? `@${item.actor.username}` : item.actor.telegramId}</p>}{item.target && <p>{t("Пользователь:")} {item.target.username ? `@${item.target.username}` : item.target.telegramId}</p>}{item.newExpiresAt && <p>{t("Новый срок:")} {dateTime(item.newExpiresAt)}</p>}{(item.reason || item.safeMetadata?.reason) && <p>{item.reason || item.safeMetadata?.reason}</p>}</div></article>)}</div>;
}
