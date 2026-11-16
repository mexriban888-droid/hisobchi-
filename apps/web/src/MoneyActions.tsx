import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import './money-actions.css';
import { useTranslation } from 'react-i18next';
import { t } from './i18n';

export default function MoneyActions({ onAdd }: { onAdd: (type: 'INCOME' | 'EXPENSE') => void }) {
  useTranslation();
  return <div className="money-actions" aria-label={t("Добавить операцию")}>
    <button type="button" className="money-action money-action-income" aria-label={t("Добавить доход")} onClick={() => onAdd('INCOME')}>
      <span className="money-action-icon"><ArrowDownLeft size={21} strokeWidth={1.8}/></span>
      <span className="money-action-label"><small>{t("Добавить")}</small><strong>{t("Доход")}</strong></span>
    </button>
    <button type="button" className="money-action money-action-expense" aria-label={t("Добавить расход")} onClick={() => onAdd('EXPENSE')}>
      <span className="money-action-icon"><ArrowUpRight size={21} strokeWidth={1.8}/></span>
      <span className="money-action-label"><small>{t("Добавить")}</small><strong>{t("Расход")}</strong></span>
    </button>
  </div>;
}
