// Financial assumptions, extra costs, loans and exchange rates.
import { useEffect, useEffectEvent, useState } from "react";
import {
  fetchExchangeRates,
  isMissingExchangeRatesTableError,
  loadLatestExchangeRatesFromSupabase,
  saveExchangeRatesToSupabase,
} from "../lib/exchangeRates";
import {
  defaultExchangeRates,
  getFinancialLoanRows,
  getTodayDateInputValue,
  hasUsableExchangeRates,
} from "../lib/feasibilityModel";
import {
  createDemoFinancialLoanRows,
  defaultFinancialSettings,
  deleteFinancialExtraCost,
  emptyFinancialExtraCostForm,
  emptyFinancialModel,
  loadFinancialModel,
  saveFinancialExtraCost,
  saveFinancialModelSettings,
} from "../lib/financialService";
import { supabase } from "../lib/supabaseClient";

export function useFinancialModel({ copy, currentProfile, labels, markWorkspaceSnapshotClean }) {
  const [financialExtraCostForm, setFinancialExtraCostForm] = useState(emptyFinancialExtraCostForm);
  const [financialHorizon, setFinancialHorizon] = useState("5y");
  const [financialStatementPeriod, setFinancialStatementPeriod] = useState("quarterly");
  const [financialModel, setFinancialModel] = useState(emptyFinancialModel);
  const [financialSettingsForm, setFinancialSettingsForm] = useState(defaultFinancialSettings);
  const [financialStatus, setFinancialStatus] = useState("");
  const [financialLoading, setFinancialLoading] = useState(false);
  const [exchangeRates, setExchangeRates] = useState(defaultExchangeRates);

  // In the language selected when the save fails, not when the fetch started.
  const describeRateSaveError = useEffectEvent(
    (rates, error) => `${rates.source}, ${copy("could not be saved", "kaydedilemedi")}: ${error.message}`,
  );

  useEffect(() => {
    if (!supabase || !currentProfile?.company_id) return;

    let isCurrent = true;
    const controller = new AbortController();

    async function loadExchangeRates() {
      try {
        const latestRates = await loadLatestExchangeRatesFromSupabase(supabase, currentProfile.company_id);

        if (!isCurrent) return;

        if (hasUsableExchangeRates(latestRates)) {
          setExchangeRates(latestRates);
          return;
        }

        setExchangeRates((current) => ({ ...current, error: "", status: "loading" }));

        const nextRates = await fetchExchangeRates(controller.signal);

        if (!isCurrent) return;

        let sourceDetail = "";
        try {
          await saveExchangeRatesToSupabase(supabase, currentProfile.company_id, nextRates);
        } catch (saveError) {
          sourceDetail = isMissingExchangeRatesTableError(saveError) ? "" : describeRateSaveError(nextRates, saveError);
        }

        setExchangeRates({
          ...nextRates,
          sourceDetail,
        });
      } catch (error) {
        if (!isCurrent || error.name === "AbortError") return;
        setExchangeRates((current) => ({
          ...current,
          error: error.message,
          status: current.status === "idle" ? "error" : current.status,
        }));
      }
    }

    loadExchangeRates();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [currentProfile?.company_id]);

  function addFinancialLoanRow() {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: [
        ...(Array.isArray(current.loanRows) ? current.loanRows : []),
        {
          amount: "",
          annualInterestRate: "",
          currency: "TRY",
          gracePeriodMonths: 0,
          id: `loan-${Date.now()}`,
          loanTermMonths: "",
          name: "",
          receivedDate: getTodayDateInputValue(),
        },
      ],
    }));
  }

  function updateFinancialLoanRow(index, field, value) {
    setFinancialSettingsForm((current) => {
      const loanRows = Array.isArray(current.loanRows) ? [...current.loanRows] : [];
      loanRows[index] = { ...loanRows[index], [field]: value };

      return { ...current, loanRows };
    });
  }

  function removeFinancialLoanRow(index) {
    setFinancialSettingsForm((current) => ({
      ...current,
      loanRows: (Array.isArray(current.loanRows) ? current.loanRows : []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  async function handleFetchExchangeRates() {
    setExchangeRates((current) => ({ ...current, error: "", status: "loading" }));

    try {
      const nextRates = await fetchExchangeRates();
      let sourceDetail = "";
      if (supabase && currentProfile?.company_id) {
        try {
          await saveExchangeRatesToSupabase(supabase, currentProfile.company_id, nextRates);
        } catch (saveError) {
          sourceDetail = isMissingExchangeRatesTableError(saveError)
            ? ""
            : `${nextRates.source}, ${copy("could not be saved", "kaydedilemedi")}: ${saveError.message}`;
        }
      }
      setExchangeRates({
        ...nextRates,
        sourceDetail,
      });
    } catch (error) {
      setExchangeRates((current) => ({
        ...current,
        error: error.message,
        status: "error",
      }));
    }
  }

  async function loadFinancialData(nextHorizon = financialHorizon) {
    if (!supabase) return;

    setFinancialHorizon(nextHorizon);
    setFinancialLoading(true);
    setFinancialStatus("");

    try {
      const nextModel = await loadFinancialModel(supabase, nextHorizon);
      const nextSettings = {
        ...defaultFinancialSettings,
        ...(nextModel.settings || {}),
      };
      const loadedLoanRows =
        Array.isArray(nextSettings.loanRows) && nextSettings.loanRows.length
          ? nextSettings.loanRows
          : getFinancialLoanRows(nextSettings);
      const loanRowsForForm = loadedLoanRows.length ? loadedLoanRows : createDemoFinancialLoanRows();

      setFinancialModel(nextModel);
      setFinancialSettingsForm({
        ...nextSettings,
        loanRows: loanRowsForForm,
      });
      markWorkspaceSnapshotClean("financial");
    } catch (error) {
      setFinancialStatus(
        `${copy("Financial model could not be loaded:", "Finansal model yüklenemedi:")} ${error.message}`,
      );
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialSettings(event) {
    event?.preventDefault?.();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return false;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialModelSettings(supabase, financialSettingsForm);
      await loadFinancialData();
      // After the reload, which clears the status line.
      setFinancialStatus(copy("Financial assumptions were saved.", "Finansal varsayımlar kaydedildi."));
      markWorkspaceSnapshotClean("financial");
      return true;
    } catch (error) {
      setFinancialStatus(error.message);
      return false;
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleDeleteFinancialExtraCost(cost) {
    if (!supabase || !window.confirm(copy(`Delete "${cost.name}"?`, `"${cost.name}" silinsin mi?`))) return;

    setFinancialLoading(true);
    try {
      await deleteFinancialExtraCost(supabase, cost.id);
      await loadFinancialData();
      setFinancialStatus(copy(`"${cost.name}" was deleted.`, `"${cost.name}" silindi.`));
    } catch (error) {
      setFinancialStatus(error.message);
    } finally {
      setFinancialLoading(false);
    }
  }

  async function handleSaveFinancialExtraCost(event) {
    event?.preventDefault?.();
    setFinancialStatus("");

    if (!supabase) {
      setFinancialStatus(labels.configure);
      return false;
    }

    setFinancialLoading(true);

    try {
      await saveFinancialExtraCost(supabase, financialExtraCostForm);
      setFinancialExtraCostForm(emptyFinancialExtraCostForm);
      await loadFinancialData();
      setFinancialStatus(copy("Extra financial cost was saved.", "Ek finansal gider kaydedildi."));
      markWorkspaceSnapshotClean("financial");
      return true;
    } catch (error) {
      setFinancialStatus(error.message);
      return false;
    } finally {
      setFinancialLoading(false);
    }
  }

  return {
    addFinancialLoanRow,
    exchangeRates,
    financialExtraCostForm,
    financialHorizon,
    financialLoading,
    financialModel,
    financialSettingsForm,
    financialStatementPeriod,
    financialStatus,
    handleDeleteFinancialExtraCost,
    handleFetchExchangeRates,
    handleSaveFinancialExtraCost,
    handleSaveFinancialSettings,
    loadFinancialData,
    removeFinancialLoanRow,
    setExchangeRates,
    setFinancialExtraCostForm,
    setFinancialHorizon,
    setFinancialModel,
    setFinancialSettingsForm,
    setFinancialStatementPeriod,
    setFinancialStatus,
    updateFinancialLoanRow,
  };
}
