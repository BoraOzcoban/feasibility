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
          <th>{copy("Net present value", "Net bugünkü değer")}</th>
          <th>{copy("Change", "Fark")}</th>
          <th>{copy("5-year net profit", "5 yıllık net kâr")}</th>
          <th>{copy("Payback", "Geri dönüş")}</th>
          <th>{copy("Lowest cash", "En düşük nakit")}</th>
          <th>{copy("Decision", "Karar")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className={row.lever === "base" ? "sensitivity-base" : ""} key={`${row.lever}-${row.change}`}>
            <th scope="row">{getSensitivityCaseLabel(row)}</th>
            <td>{formatLira(row.netPresentValue)}</td>
            <td>{row.lever === "base" ? "-" : formatLira(row.netPresentValueChange)}</td>
            <td>{formatLira(row.netIncome)}</td>
            <td>
              {row.paybackMonth
                ? `${formatNumber(row.paybackMonth)} ${copy("mo", "ay")}`
                : copy("Over 5 years", "5 yıldan uzun")}
            </td>
            <td>{formatLira(row.lowestCashBalance)}</td>
            <td>
              <span className={`decision-badge ${row.decision}`}>{decisionLabels[row.decision]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
