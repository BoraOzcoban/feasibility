// Data preparation for the income/expense trend chart and the loan calendar.

import { addMonths, getMonthDifference, getMonthKey, getMonthStart, parseDateInput, toFiniteNumber } from "./feasibilityModel";
import { formatCompactMonthLabel, formatMonthLabel, formatTrendAxisAmount } from "./format";

export function getNiceTrendTickStep(maxValue, targetSegments = 6) {
  const rawStep = Math.max(1, toFiniteNumber(maxValue) / targetSegments);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceMultiplier = [1, 2, 5, 10].find((candidate) => normalized <= candidate) || 10;

  return niceMultiplier * magnitude;
}

export function getTrendAxisScale(maxValue) {
  const tickStep = getNiceTrendTickStep(maxValue);
  const axisMax = Math.max(tickStep, Math.ceil(Math.max(1, toFiniteNumber(maxValue)) / tickStep) * tickStep);
  const tickValues = [];

  for (let value = 0; value <= axisMax + (tickStep / 2); value += tickStep) {
    tickValues.push(Math.min(value, axisMax));
  }

  return { axisMax, tickStep, tickValues: Array.from(new Set(tickValues)) };
}

export function getFinancialTrendRowDate(row, index) {
  const parsedPeriodDate = parseDateInput(row?.period);
  if (parsedPeriodDate) return parsedPeriodDate;

  const periodNumber = Math.max(1, Math.round(toFiniteNumber(row?.period, index + 1)));
  return addMonths(getMonthStart(new Date()), periodNumber - 1);
}

export function buildIncomeExpenseTrendChart(rows = []) {
  const plot = {
    bottom: 210,
    left: 82,
    right: 438,
    top: 38,
  };
  const sanitizedRows = rows.map((row, index) => ({
    cost: Math.max(0, toFiniteNumber(row.totalCost)),
    date: getFinancialTrendRowDate(row, index),
    revenue: Math.max(0, toFiniteNumber(row.salesRevenue)),
  }));
  const maxValue = Math.max(
    1,
    ...sanitizedRows.flatMap((row) => [row.revenue, row.cost]),
  );
  const axisScale = getTrendAxisScale(maxValue);
  const yTicks = axisScale.tickValues.map((value) => {
    const ratio = value / axisScale.axisMax;
    const y = plot.bottom - (ratio * (plot.bottom - plot.top));

    return {
      label: formatTrendAxisAmount(value),
      value,
      y,
    };
  });
  const getX = (index) => (
    sanitizedRows.length <= 1
      ? plot.left
      : plot.left + (index * ((plot.right - plot.left) / (sanitizedRows.length - 1)))
  );
  const getY = (value) => plot.bottom - ((Math.max(0, value) / axisScale.axisMax) * (plot.bottom - plot.top));
  const getPoints = (field) => sanitizedRows.map((row, index) => ({
    value: row[field],
    x: getX(index),
    y: getY(row[field]),
  }));
  const buildPath = (points) => {
    if (!points.length) return "";
    if (points.length === 1) return `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    return points.reduce((path, point, index) => {
      if (index === 0) return `M${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

      const previous = points[index - 1];
      const beforePrevious = points[index - 2] || previous;
      const next = points[index + 1] || point;
      const controlOneX = previous.x + ((point.x - beforePrevious.x) / 6);
      const controlTwoX = point.x - ((next.x - previous.x) / 6);

      return `${path} C${controlOneX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlTwoX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }, "");
  };
  const revenuePoints = getPoints("revenue");
  const costPoints = getPoints("cost");
  const revenuePath = buildPath(revenuePoints);
  const costPath = buildPath(costPoints);
  const buildAreaPath = (path, points) => {
    if (!path || !points.length) return "";

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    return `${path} L${lastPoint.x.toFixed(2)} ${plot.bottom} L${firstPoint.x.toFixed(2)} ${plot.bottom} Z`;
  };
  const xTickIndexes = [];

  if (sanitizedRows.length) {
    const maxTicks = Math.min(6, sanitizedRows.length);
    const step = maxTicks <= 1 ? 1 : Math.max(1, Math.ceil((sanitizedRows.length - 1) / (maxTicks - 1)));

    for (let index = 0; index < sanitizedRows.length; index += step) {
      xTickIndexes.push(index);
    }

    if (xTickIndexes[xTickIndexes.length - 1] !== sanitizedRows.length - 1) {
      xTickIndexes.push(sanitizedRows.length - 1);
    }
  }

  return {
    axisPath: `M${plot.left} ${plot.top} V${plot.bottom} H${plot.right}`,
    axisMax: axisScale.axisMax,
    costAreaPath: buildAreaPath(costPath, costPoints),
    costPath,
    costPoints,
    gridPath: yTicks.map((tick) => `M${plot.left} ${tick.y.toFixed(2)} H${plot.right}`).join(" "),
    plot,
    revenueAreaPath: buildAreaPath(revenuePath, revenuePoints),
    revenuePath,
    revenuePoints,
    xTicks: xTickIndexes.map((index) => ({
      label: formatMonthLabel(sanitizedRows[index].date),
      x: getX(index),
    })),
    yTicks,
  };
}

export const loanCalendarTones = ["yellow", "red", "teal", "blue", "green", "clay"];

export function buildFinancialLoanPaymentCalendar(loans = []) {
  const currentMonth = getMonthStart(new Date());
  const latestLoanEndMonth = loans.reduce((latestMonth, loan) => {
    const paymentEndMonth = getMonthStart(parseDateInput(loan.paymentEndDate) || currentMonth);
    return paymentEndMonth > latestMonth ? paymentEndMonth : latestMonth;
  }, currentMonth);
  const monthCount = Math.max(12, getMonthDifference(currentMonth, latestLoanEndMonth) + 1);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = addMonths(currentMonth, index);

    return {
      date,
      key: getMonthKey(date),
      label: formatCompactMonthLabel(date),
      totals: new Map(),
    };
  });
  const rows = loans.map((loan, loanIndex) => {
    const paymentStartMonth = getMonthStart(parseDateInput(loan.paymentStartDate) || currentMonth);
    const paymentEndMonth = getMonthStart(parseDateInput(loan.paymentEndDate) || currentMonth);
    const tone = loanCalendarTones[loanIndex % loanCalendarTones.length];
    const payments = months.map((month) => {
      const isActive = month.date >= paymentStartMonth && month.date <= paymentEndMonth;

      if (isActive) {
        const currentTotal = month.totals.get(loan.currency) || 0;
        month.totals.set(loan.currency, currentTotal + loan.monthlyPayment);
      }

      return {
        amount: isActive ? loan.monthlyPayment : 0,
        isActive,
        monthKey: month.key,
      };
    });

    return {
      loan,
      payments,
      tone,
    };
  });

  return {
    months: months.map((month) => ({
      ...month,
      totals: Array.from(month.totals.entries()).map(([currency, amount]) => ({ amount, currency })),
    })),
    rows,
  };
}
