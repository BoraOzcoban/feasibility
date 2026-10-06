import React from "react";
import { formatLira, formatNumber } from "../lib/format";
import { useAppContext } from "../app/AppContext";

export default function SensitivityTable({ rows, className }) {
  const { copy, getSensitivityCaseLabel } = useAppContext();

  const decisionLabels = {
    feasible: copy("Feasible", "Uygun"),
    risky: copy("Risky", "Riskli"),
    wait: copy("Wait", "Beklenmeli"),
  };

  return (
    <table className={className}>
      <thead>
        <tr>
          <th>{copy("Case", "Senaryo")}</th>
          <th className="is-num">{copy("Net present value", "Net bugünkü değer")}</th>
          <th className="is-num">{copy("Change", "Fark")}</th>
          <th className="is-num">{copy("5-year net profit", "5 yıllık net kâr")}</th>
          <th className="is-num">{copy("Payback", "Geri dönüş")}</th>
          <th className="is-num">{copy("Lowest cash", "En düşük nakit")}</th>
          <th>{copy("Decision", "Karar")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className={row.lever === "base" ? "is-emphasis" : undefined} key={`${row.lever}-${row.change}`}>
            <th scope="row">{getSensitivityCaseLabel(row)}</th>
            <td className="is-num">{formatLira(row.netPresentValue)}</td>
            <td className="is-num">{row.lever === "base" ? "-" : formatLira(row.netPresentValueChange)}</td>
            <td className="is-num">{formatLira(row.netIncome)}</td>
            <td className="is-num">
              {row.paybackMonth
                ? `${formatNumber(row.paybackMonth)} ${copy("mo", "ay")}`
                : copy("Over 5 years", "5 yıldan uzun")}
            </td>
            <td className="is-num">{formatLira(row.lowestCashBalance)}</td>
            <td>
              <span className={`badge badge-${row.decision}`}>{decisionLabels[row.decision]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
