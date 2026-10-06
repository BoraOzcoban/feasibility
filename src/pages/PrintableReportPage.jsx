import React from "react";
import { formatCurrencyAmount, formatLira, formatNumber } from "../lib/format";
import { getStatementLayout, reportPackSections } from "../lib/reportExport";
import { useAppContext } from "../app/AppContext";
import SensitivityTable from "../components/SensitivityTable";

export default function PrintableReportPage({ packKey }) {
  const { buildExportReport, copy, goTo, locale, reportTabs } = useAppContext();

  const pack = reportTabs.find((tab) => tab.key === packKey) || reportTabs[0];
  const sections = reportPackSections[pack.key] || reportPackSections.full;
  const report = buildExportReport();
  const layout = getStatementLayout(copy);
  const has = (section) => sections.includes(section);
  const formatKpi = (value, format) => {
    if (format === "month")
      return value ? `${formatNumber(value)}. ${copy("month", "ay")}` : copy("Not reached", "Ulaşılmadı");
    if (format === "percent") return value === null ? "-" : `%${formatNumber(value, 1)}`;
    return formatLira(value, format === "money2" ? 2 : 0);
  };
  const renderStatement = (title, rows) => (
    <section className="print-section">
      <h2>{title}</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>{copy("TRY", "TL")}</th>
            {report.years.map((year) => (
              <th key={year.label}>{copy(`Year ${year.label}`, `Yıl ${year.label}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.emphasis ? "emphasis" : ""} key={row.key}>
              <td>{row.label}</td>
              {report.years.map((year) => (
                <td key={year.label}>
                  {row.format === "percent" ? `${formatNumber(year[row.key], 1)}%` : formatLira(year[row.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <main className="print-report">
      <div className="print-toolbar">
        <button type="button" onClick={() => goTo("/reports", "login")}>
          {copy("Back", "Geri")}
        </button>
        <button type="button" className="primary" onClick={() => window.print()}>
          {copy("Print / Save as PDF", "Yazdır / PDF olarak kaydet")}
        </button>
      </div>

      <header className="print-cover">
        <span>{pack.label}</span>
        <h1>{report.companyName}</h1>
        <p>{report.productName}</p>
        <small>
          {copy("Prepared on", "Hazırlanma tarihi")} {new Date().toLocaleDateString(locale)} ·{" "}
          {copy("5-year projection", "5 yıllık projeksiyon")}
        </small>
      </header>

      {has("summary") && (
        <section className="print-section">
          <h2>{copy("Decision", "Karar")}</h2>
          <p className="print-verdict">
            <strong>{report.verdict.label}</strong> {report.verdict.copy}
          </p>
          <div className="print-kpis">
            {report.kpis.map(([label, value, format]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{formatKpi(value, format)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {has("sensitivity") && report.sensitivity.length > 0 && (
        <section className="print-section">
          <h2>{copy("Sensitivity", "Duyarlılık analizi")}</h2>
          <p className="print-note">
            {copy(
              "Full 5-year model re-run with one assumption changed at a time.",
              "Her seferinde tek bir varsayım değiştirilerek tam 5 yıllık model yeniden çalıştırıldı.",
            )}
          </p>
          {<SensitivityTable rows={report.sensitivity} className="print-table print-table-sensitivity" />}
        </section>
      )}

      {has("assumptions") && (
        <section className="print-section">
          <h2>{copy("Key assumptions", "Temel varsayımlar")}</h2>
          <table className="print-table print-table-compact">
            <tbody>
              {report.assumptions.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{formatNumber(value, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {has("income") && renderStatement(copy("Income statement", "Gelir tablosu"), layout.income)}
      {has("cash") && renderStatement(copy("Cash flow", "Nakit akışı"), layout.cash)}
      {has("balance") && renderStatement(copy("Balance sheet (year end)", "Bilanço (yıl sonu)"), layout.balance)}

      {has("loans") && report.loans.length > 0 && (
        <section className="print-section">
          <h2>{copy("Loans", "Krediler")}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>{copy("Loan", "Kredi")}</th>
                <th>{copy("Amount", "Tutar")}</th>
                <th>{copy("Interest % / year", "Faiz % / yıl")}</th>
                <th>{copy("Term (months)", "Vade (ay)")}</th>
                <th>{copy("Grace (months)", "Ödemesiz (ay)")}</th>
              </tr>
            </thead>
            <tbody>
              {report.loans.map((loan) => (
                <tr key={`${loan.name}-${loan.receivedDate}`}>
                  <td>{loan.name}</td>
                  <td>{formatCurrencyAmount(loan.amount, loan.currency)}</td>
                  <td>{formatNumber(loan.annualInterestRate, 2)}</td>
                  <td>{formatNumber(loan.loanTermMonths)}</td>
                  <td>{formatNumber(loan.gracePeriodMonths)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {has("operations") && (
        <section className="print-section">
          <h2>{copy("Production plans", "Üretim planları")}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>{copy("Plan", "Plan")}</th>
                <th>{copy("Output / day", "Çıktı / gün")}</th>
                <th>{copy("Material / unit", "Malzeme / birim")}</th>
                <th>{copy("Labour / unit", "İşçilik / birim")}</th>
                <th>{copy("Energy / unit", "Enerji / birim")}</th>
                <th>{copy("Daily cost", "Günlük maliyet")}</th>
              </tr>
            </thead>
            <tbody>
              {report.plans.map((plan) => (
                <tr key={plan.name}>
                  <td>
                    {plan.name}
                    <small>{plan.product}</small>
                  </td>
                  <td>
                    {formatNumber(plan.dailyOutput)}
                    {plan.dailyOutput < plan.target ? ` / ${formatNumber(plan.target)}` : ""}
                  </td>
                  <td>{formatLira(plan.unitMaterial, 2)}</td>
                  <td>{formatLira(plan.unitLabor, 2)}</td>
                  <td>{formatLira(plan.unitEnergy, 2)}</td>
                  <td>{formatLira(plan.dailyCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {has("sales") && (
        <section className="print-section">
          <h2>{copy("Sales channels", "Satış kanalları")}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>{copy("Channel", "Kanal")}</th>
                <th>{copy("First month units", "İlk ay adet")}</th>
                <th>{copy("Unit price", "Birim fiyat")}</th>
                <th>{copy("Commission %", "Komisyon %")}</th>
                <th>{copy("Collection days", "Tahsilat günü")}</th>
              </tr>
            </thead>
            <tbody>
              {report.channels.map((channel) => (
                <tr key={channel.name}>
                  <td>
                    {channel.name}
                    <small>{channel.product}</small>
                  </td>
                  <td>{formatNumber(channel.firstMonthUnits)}</td>
                  <td>{formatLira(channel.unitPrice, 2)}</td>
                  <td>{formatNumber(channel.commissionPercent, 1)}</td>
                  <td>{formatNumber(channel.collectionDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="print-table">
            <thead>
              <tr>
                <th>{copy("Units", "Adet")}</th>
                {report.years.map((year) => (
                  <th key={year.label}>{copy(`Year ${year.label}`, `Yıl ${year.label}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{copy("Produced", "Üretilen")}</td>
                {report.years.map((year) => (
                  <td key={year.label}>{formatNumber(year.producedUnits)}</td>
                ))}
              </tr>
              <tr>
                <td>{copy("Sold", "Satılan")}</td>
                {report.years.map((year) => (
                  <td key={year.label}>{formatNumber(year.netSoldUnits)}</td>
                ))}
              </tr>
              <tr>
                <td>{copy("In stock at year end", "Yıl sonu stok")}</td>
                {report.years.map((year) => (
                  <td key={year.label}>{formatNumber(year.inventoryUnits)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {has("risks") && report.risks.length > 0 && (
        <section className="print-section">
          <h2>{copy("Risks to resolve", "Çözülmesi gereken riskler")}</h2>
          <ul className="print-risks">
            {report.risks.map((risk) => (
              <li key={risk.title}>
                <strong>{risk.title}</strong> {risk.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="print-footer">
        {copy(
          "Prices and costs exclude VAT. Projections are estimates based on the assumptions entered in Atera.",
          "Fiyat ve maliyetler KDV hariçtir. Projeksiyonlar Atera'ya girilen varsayımlara dayanan tahminlerdir.",
        )}
      </footer>
    </main>
  );
}
