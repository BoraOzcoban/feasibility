// Products, materials, machines, workforce and the resource plan.
import { useEffect, useState } from "react";
import { buildWorkforceRowsFromOperationRows } from "../lib/appDefaults";
import { asObjectArray, getPlanProductId, toFiniteNumber } from "../lib/feasibilityModel";
import { getCycleTimeMinutes, normalizeCycleTimeUnit } from "../lib/format";
import { getCurrentOperationPlans } from "../lib/operationsCalculations";
import {
  deleteOperationRecord,
  emptyOperationForms,
  emptyOperationPlan,
  emptyPlanRows,
  getRecordInUseCounts,
  loadOperationsWorkspace,
  saveOperationRecord,
  saveOperationResourcePlan,
} from "../lib/operationsService";
import { supabase } from "../lib/supabaseClient";

export function useOperations({ copy, labels, loadFinancialData, markWorkspaceSnapshotClean, routePath }) {
  const [operationForms, setOperationForms] = useState(emptyOperationForms);
  const [operationPlan, setOperationPlan] = useState(emptyOperationPlan);
  const [operationPlanResult, setOperationPlanResult] = useState(null);
  const [processDefinitionOpen, setProcessDefinitionOpen] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsStatus, setOperationsStatus] = useState("");

  const [operationsWorkspace, setOperationsWorkspace] = useState({
    activePlans: [],
    equipment: [],
    latestPlan: null,
    machines: [],
    materials: [],
    notes: [],
    product: null,
    products: [],
    workforce: [],
  });

  useEffect(() => {
    if (routePath === "/operations/data-entry") {
      setProcessDefinitionOpen(false);
    }
  }, [routePath]);

  function handleDashboardProductChange(productId) {
    const nextProduct =
      operationsWorkspace.products.find((product) => product.id === productId) ||
      operationsWorkspace.products[0] ||
      null;
    const nextLatestPlan = nextProduct
      ? operationsWorkspace.activePlans.find((plan) => getPlanProductId(plan) === nextProduct.id) || null
      : null;

    setOperationsWorkspace((current) => ({
      ...current,
      latestPlan: nextLatestPlan || current.latestPlan,
      product: nextProduct,
    }));
    setOperationPlan((plan) => ({
      ...plan,
      ...getProductFlowDefaults(nextProduct),
      operationRows: buildProductOperationRows(nextProduct),
      productId: nextProduct?.id || "",
      productName: nextProduct?.name || "",
    }));
    setOperationPlanResult(nextLatestPlan?.result || null);
  }

  function updateOperationPlan(field, value) {
    setOperationPlan((current) => ({ ...current, [field]: value }));
  }

  function normalizeFlowStrategy(value) {
    if (value === "push" || value === "batch") return "push";
    if (value === "pull" || value === "flow" || value === "parallel") return "pull";
    return "pull";
  }

  function getProductFlowDefaults(product) {
    const minimumTransferQuantity = Math.max(
      1,
      toFiniteNumber(product?.minimum_transfer_quantity ?? product?.minimumTransferQuantity, 1),
    );
    const defaultBatchSize = Math.max(
      minimumTransferQuantity,
      toFiniteNumber(product?.default_batch_size ?? product?.defaultBatchSize, minimumTransferQuantity),
    );
    const defaultSafetyStockQuantity = Math.max(
      0,
      toFiniteNumber(product?.default_safety_stock_quantity ?? product?.defaultSafetyStockQuantity, 0),
    );

    return {
      batchSize: defaultBatchSize,
      flowStrategy: normalizeFlowStrategy(product?.default_flow_strategy ?? product?.defaultFlowStrategy),
      minimumTransferQuantity,
      safetyStockQuantity: defaultSafetyStockQuantity,
    };
  }

  function getOperationMachineDefaults(machineId, sourceMachines = operationsWorkspace.machines) {
    const machine = sourceMachines.find((item) => item.id === machineId);

    return {
      capacity: Math.max(1, toFiniteNumber(machine?.concurrent_capacity, 1)),
      dailyHours: Math.max(0, toFiniteNumber(machine?.availability_hours, 8)),
      failureProbabilityPercent: Math.max(0, toFiniteNumber(machine?.failure_probability_percent, 0)),
    };
  }

  function getRecipeMaterialId(row) {
    return row?.material_id || row?.materialId || row?.material?.id || "";
  }

  function getProductProcessRows(product) {
    return asObjectArray(product?.process_rows ?? product?.processRows)
      .slice()
      .sort((a, b) => toFiniteNumber(a.step_order ?? a.stepOrder) - toFiniteNumber(b.step_order ?? b.stepOrder))
      .map((row, index) => ({
        capacity: Math.max(1, toFiniteNumber(row.capacity, 1)),
        dailyHours: Math.max(0, toFiniteNumber(row.daily_hours ?? row.dailyHours, 8)),
        equipmentId: row.equipment_id ?? row.equipmentId ?? "",
        machineId: row.machine_id ?? row.machineId ?? "",
        materialId: row.material_id ?? row.materialId ?? "",
        materialQuantityPerUnit: Math.max(
          0,
          toFiniteNumber(row.material_quantity_per_unit ?? row.materialQuantityPerUnit, 0),
        ),
        operationId: row.id || row.operationId || `${product?.id || "product"}-process-${index + 1}`,
        operationName: row.operation_name ?? row.operationName ?? "",
        peopleAssigned: Math.max(0, toFiniteNumber(row.people_assigned ?? row.peopleAssigned, 1)),
        processTimeMinutes: Math.max(0.0001, toFiniteNumber(row.process_time_minutes ?? row.processTimeMinutes, 1)),
        setupMinutes: Math.max(0, toFiniteNumber(row.setup_minutes ?? row.setupMinutes, 0)),
        speedMultiplier: Math.max(0.0001, toFiniteNumber(row.speed_multiplier ?? row.speedMultiplier, 1)),
        stepOrder: index + 1,
        workforceDailyHours: Math.max(0, toFiniteNumber(row.workforce_daily_hours ?? row.workforceDailyHours, 8)),
        workforceId: row.workforce_id ?? row.workforceId ?? "",
      }));
  }

  function buildProductOperationRows(product) {
    if (!product) return [];

    return getProductProcessRows(product);
  }

  function updateOperationPlanRow(collection, index, field, value) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...(collection === "operationRows" && field === "machineId" ? getOperationMachineDefaults(value) : {}),
              [field]: value,
            }
          : row,
      ),
    }));
  }

  function updateOperationPlanRowFields(collection, index, fields) {
    setOperationPlan((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...fields } : row,
      ),
    }));
  }

  function updateOperationForm(entity, field, value) {
    setOperationForms((current) => ({
      ...current,
      [entity]: {
        ...current[entity],
        [field]: value,
      },
    }));
  }

  function copyOperationRecordToForm(entity, row) {
    if (!row || row.id === "empty") return;

    const nextForm = {
      machine: {
        ...emptyOperationForms.machine,
        availabilityHours: row.availability_hours ?? emptyOperationForms.machine.availabilityHours,
        concurrentCapacity: row.concurrent_capacity ?? emptyOperationForms.machine.concurrentCapacity,
        failureProbabilityPercent:
          row.failure_probability_percent ?? emptyOperationForms.machine.failureProbabilityPercent,
        hourlyEnergyConsumptionKwh:
          row.hourly_energy_consumption_kwh ?? emptyOperationForms.machine.hourlyEnergyConsumptionKwh,
        name: row.name || "",
        price: row.price ?? emptyOperationForms.machine.price,
        priceCurrency: row.price_currency || emptyOperationForms.machine.priceCurrency,
      },
      equipment: {
        ...emptyOperationForms.equipment,
        name: row.name || "",
        price: row.price ?? emptyOperationForms.equipment.price,
        priceCurrency: row.price_currency || emptyOperationForms.equipment.priceCurrency,
        quantity: row.quantity ?? emptyOperationForms.equipment.quantity,
      },
      material: {
        ...emptyOperationForms.material,
        materialGroup: row.material_group || emptyOperationForms.material.materialGroup,
        name: row.name || "",
        pricePerUnit: row.price_per_unit ?? emptyOperationForms.material.pricePerUnit,
        priceCurrency: row.price_currency || emptyOperationForms.material.priceCurrency,
        unit: row.unit || emptyOperationForms.material.unit,
      },
      workforce: {
        ...emptyOperationForms.workforce,
        hourlyCost: row.hourly_cost ?? emptyOperationForms.workforce.hourlyCost,
        hourlyCostCurrency: row.hourly_cost_currency || emptyOperationForms.workforce.hourlyCostCurrency,
        roleName: row.role_name || "",
      },
    }[entity];

    if (!nextForm) return;

    setOperationForms((current) => ({
      ...current,
      [entity]: nextForm,
    }));
    setOperationsStatus(
      copy(
        "Record values were copied into the form. Edit and save to create a new record.",
        "Kayıt değerleri forma kopyalandı. Yeni kayıt oluşturmak için düzenleyip kaydedin.",
      ),
    );
  }

  function addProductMaterialRow() {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: [
          ...(current.product.materialRows || []),
          {
            materialId: operationsWorkspace.materials[0]?.id || "",
            quantityPerUnit: 0,
          },
        ],
      },
    }));
  }

  function updateProductMaterialRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        materialRows: (current.product.materialRows || []).map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row,
        ),
      },
    }));
  }

  function removeProductMaterialRow(index) {
    setOperationForms((current) => {
      const removedMaterialId = current.product.materialRows?.[index]?.materialId;

      return {
        ...current,
        product: {
          ...current.product,
          materialRows: (current.product.materialRows || []).filter((_, rowIndex) => rowIndex !== index),
          processRows: (current.product.processRows || []).map((row) =>
            row.materialId === removedMaterialId ? { ...row, materialId: "", materialQuantityPerUnit: 0 } : row,
          ),
        },
      };
    });
  }

  function addProductProcessRow() {
    setOperationForms((current) => {
      const processRows = current.product.processRows || [];
      const selectedMachine = operationsWorkspace.machines[processRows.length] || operationsWorkspace.machines[0];
      const machineDefaults = getOperationMachineDefaults(selectedMachine?.id);

      return {
        ...current,
        product: {
          ...current.product,
          processRows: [
            ...processRows,
            {
              ...emptyPlanRows.operation,
              ...machineDefaults,
              equipmentId: "",
              machineId: selectedMachine?.id || "",
              materialId: current.product.materialRows?.[0]?.materialId || "",
              materialQuantityPerUnit: current.product.materialRows?.[0]?.quantityPerUnit || 0,
              operationName: `${copy("Process", "Süreç")} ${processRows.length + 1}`,
              peopleAssigned: 1,
              speedMultiplier: 1,
              workforceDailyHours: 8,
              workforceId: operationsWorkspace.workforce[0]?.id || "",
            },
          ],
        },
      };
    });
  }

  function updateProductProcessRow(index, field, value) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        processRows: (current.product.processRows || []).map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                ...(field === "machineId" ? getOperationMachineDefaults(value) : {}),
                [field]: value,
              }
            : row,
        ),
      },
    }));
  }

  function updateProductProcessRowFields(index, fields) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        processRows: (current.product.processRows || []).map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...fields } : row,
        ),
      },
    }));
  }

  function moveProductProcessRow(index, direction) {
    setOperationForms((current) => {
      const processRows = [...(current.product.processRows || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= processRows.length) return current;
      [processRows[index], processRows[targetIndex]] = [processRows[targetIndex], processRows[index]];

      return {
        ...current,
        product: {
          ...current.product,
          processRows,
        },
      };
    });
  }

  function removeProductProcessRow(index) {
    setOperationForms((current) => ({
      ...current,
      product: {
        ...current.product,
        processRows: (current.product.processRows || []).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  async function loadOperationsData() {
    if (!supabase) return;

    setOperationsLoading(true);
    setOperationsStatus("");

    try {
      const workspace = await loadOperationsWorkspace(supabase);
      const currentPlans = getCurrentOperationPlans(workspace);
      const currentLatestPlan =
        currentPlans.find((plan) => plan.id === workspace.latestPlan?.id) || currentPlans[0] || null;
      setOperationsWorkspace(workspace);

      if (workspace.latestPlan) {
        const productFlowDefaults = getProductFlowDefaults(workspace.product);
        const savedMachineRows = asObjectArray(workspace.latestPlan.input?.machineRows);
        const savedMaterialRows = asObjectArray(workspace.latestPlan.input?.materialRows);
        const savedWorkforceRows = asObjectArray(workspace.latestPlan.input?.workforceRows);
        const hasSimplePlanResult = currentLatestPlan?.result?.energyConsumptionKwh !== undefined;

        setOperationPlan({
          ...emptyOperationPlan,
          ...productFlowDefaults,
          ...workspace.latestPlan.input,
          flowStrategy: normalizeFlowStrategy(
            workspace.latestPlan.input?.flowStrategy ?? productFlowDefaults.flowStrategy,
          ),
          machineRows: savedMachineRows.length
            ? savedMachineRows.map((row) => ({
                dailyHours: row.dailyHours || 0,
                machineId: row.machineId || "",
              }))
            : workspace.machines[0]
              ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }]
              : [],
          materialRows: savedMaterialRows.length
            ? savedMaterialRows.map((row) => ({
                dailyQuantity: row.dailyQuantity ?? row.quantityPerUnit ?? 0,
                materialId: row.materialId || "",
              }))
            : workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              })),
          productId: workspace.latestPlan.input?.productId || workspace.product?.id || "",
          productName: workspace.latestPlan.input?.productName || workspace.product?.name || "",
          safetyStockQuantity: Math.max(
            0,
            toFiniteNumber(workspace.latestPlan.input?.safetyStockQuantity, productFlowDefaults.safetyStockQuantity),
          ),
          operationRows: buildProductOperationRows(workspace.product, workspace),
          workforceRows: savedWorkforceRows.length
            ? savedWorkforceRows
            : workspace.workforce[0]
              ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
              : [],
        });
        setOperationPlanResult(hasSimplePlanResult ? currentLatestPlan.result : null);
      } else if (workspace.product) {
        setOperationPlan((current) => ({
          ...current,
          ...getProductFlowDefaults(workspace.product),
          machineRows: workspace.machines[0] ? [{ ...emptyPlanRows.machine, machineId: workspace.machines[0].id }] : [],
          materialRows: workspace.materials.length
            ? workspace.materials.slice(0, 2).map((material) => ({
                dailyQuantity: 0,
                materialId: material.id,
              }))
            : [],
          productId: workspace.product.id,
          productName: workspace.product.name || "",
          operationRows: buildProductOperationRows(workspace.product, workspace),
          workforceRows: workspace.workforce[0]
            ? [{ ...emptyPlanRows.workforce, workforceId: workspace.workforce[0].id }]
            : [],
        }));
        setOperationPlanResult(null);
      }
      markWorkspaceSnapshotClean();
    } catch (error) {
      setOperationsStatus(
        `${copy("Operations data could not be loaded:", "Operasyon verisi yüklenemedi:")} ${error.message}`,
      );
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationPlan(event) {
    event?.preventDefault?.();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return false;
    }

    const selectedProduct = operationsWorkspace.products.find((product) => product.id === operationPlan.productId);
    const machineRows = asObjectArray(operationPlan.machineRows);
    const operationRows = buildProductOperationRows(selectedProduct);
    const operationWorkforceRows = buildWorkforceRowsFromOperationRows(operationRows);
    const effectiveWorkforceRows = operationWorkforceRows.length
      ? operationWorkforceRows
      : asObjectArray(operationPlan.workforceRows);
    const productRecipeRows = asObjectArray(selectedProduct?.material_rows);
    const hasPositiveMachineHours = machineRows.some((row) => row.machineId && toFiniteNumber(row.dailyHours) > 0);
    const hasSchedulableOperationRows = operationRows.some(
      (row) => row.machineId && toFiniteNumber(row.processTimeMinutes) > 0 && toFiniteNumber(row.capacity, 1) > 0,
    );

    if (!selectedProduct) {
      setOperationsStatus(
        copy(
          "Select a saved product with a recipe before calculating feasibility.",
          "Fizibilite hesaplamadan önce reçetesi olan kayıtlı bir ürün seçin.",
        ),
      );
      return false;
    }

    if (!productRecipeRows.some((row) => toFiniteNumber(row.quantity_per_unit) > 0)) {
      setOperationsStatus(
        copy(
          "Add at least one material with a positive quantity to the selected product recipe before saving a process plan.",
          "Süreç planını kaydetmeden önce seçili ürün reçetesine pozitif miktarlı en az bir malzeme ekleyin.",
        ),
      );
      return false;
    }

    if (!operationRows.length) {
      setOperationsStatus(
        copy(
          "Define and save the product's ordered process template on the Products screen before creating a process plan.",
          "Süreç planı oluşturmadan önce Ürünler ekranında ürünün sıralı süreç şablonunu tanımlayıp kaydedin.",
        ),
      );
      return false;
    }

    if (!hasPositiveMachineHours && !hasSchedulableOperationRows) {
      setOperationsStatus(
        copy(
          "Add at least one machine with daily hours, or define an operation step with a machine and process time.",
          "Günlük saati olan en az bir makine ekleyin ya da makine ve işlem süresi olan bir operasyon adımı tanımlayın.",
        ),
      );
      return false;
    }

    if (hasSchedulableOperationRows && toFiniteNumber(operationPlan.targetQuantity) <= 0) {
      setOperationsStatus(
        copy(
          "Enter a production quantity greater than zero for the operation flow.",
          "Operasyon akışı için sıfırdan büyük üretim miktarı girin.",
        ),
      );
      return false;
    }

    setOperationsLoading(true);

    try {
      const normalizedFlowStrategy = normalizeFlowStrategy(operationPlan.flowStrategy);
      const savedPlan = await saveOperationResourcePlan(supabase, {
        ...operationPlan,
        flowStrategy: normalizedFlowStrategy,
        operationRows,
        safetyStockQuantity:
          normalizedFlowStrategy === "pull" ? Math.max(0, toFiniteNumber(operationPlan.safetyStockQuantity)) : 0,
        workforceRows: effectiveWorkforceRows,
      });

      setOperationPlan({
        ...emptyOperationPlan,
        ...savedPlan.input,
        flowStrategy: normalizeFlowStrategy(savedPlan.input?.flowStrategy),
      });
      setOperationPlanResult(savedPlan.result);
      await loadOperationsData();
      await loadFinancialData();
      setOperationsStatus(copy("Resource plan was saved and calculated.", "Kaynak planı kaydedildi ve hesaplandı."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setOperationsStatus(error.message);
      return false;
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleSaveOperationRecord(entity, event) {
    event?.preventDefault?.();
    setOperationsStatus("");

    if (!supabase) {
      setOperationsStatus(labels.configure);
      return false;
    }

    setOperationsLoading(true);

    try {
      const formInput = operationForms[entity];
      const productProcessRows = entity === "product" ? asObjectArray(formInput.processRows) : [];

      if (entity === "product" && !productProcessRows.length) {
        throw new Error(
          copy(
            "Add at least one ordered process before saving the product.",
            "Ürünü kaydetmeden önce en az bir sıralı süreç ekleyin.",
          ),
        );
      }

      if (
        entity === "product" &&
        productProcessRows.some(
          (row) =>
            !String(row.operationName || "").trim() || !row.machineId || toFiniteNumber(row.processTimeMinutes) <= 0,
        )
      ) {
        throw new Error(
          copy(
            "Every product process needs a name, machine, and positive processing time.",
            "Her ürün sürecinde süreç adı, makine ve pozitif işlem süresi bulunmalıdır.",
          ),
        );
      }

      const recordInput =
        entity === "product"
          ? {
              ...formInput,
              cycleTimeMinutes: getCycleTimeMinutes(formInput.cycleTimeValue, formInput.cycleTimeUnit),
              cycleTimeUnit: normalizeCycleTimeUnit(formInput.cycleTimeUnit),
              defaultFlowStrategy: normalizeFlowStrategy(formInput.defaultFlowStrategy),
              defaultSafetyStockQuantity:
                normalizeFlowStrategy(formInput.defaultFlowStrategy) === "pull"
                  ? Math.max(0, toFiniteNumber(formInput.defaultSafetyStockQuantity))
                  : 0,
              processRows: productProcessRows.map((row, index) => ({
                ...row,
                stepOrder: index + 1,
              })),
              productId: formInput.id || "",
            }
          : formInput;

      await saveOperationRecord(supabase, entity, {
        ...recordInput,
        productId:
          entity === "product" ? recordInput.productId : operationPlan.productId || operationsWorkspace.product?.id,
      });

      setOperationForms((current) => ({ ...current, [entity]: emptyOperationForms[entity] }));
      await loadOperationsData();
      setOperationsStatus(copy("Operations record was saved.", "Operasyon kaydı kaydedildi."));
      markWorkspaceSnapshotClean();
      return true;
    } catch (error) {
      setOperationsStatus(error.message);
      return false;
    } finally {
      setOperationsLoading(false);
    }
  }

  async function handleDeleteOperationRecord(entity, row) {
    const name = row.name || row.role_name || "";
    const question =
      entity === "product"
        ? copy(
            `Delete "${name}"? Its recipe, process steps and saved plans are deleted too.`,
            `"${name}" silinsin mi? Reçetesi, süreç adımları ve kayıtlı planları da silinir.`,
          )
        : copy(`Delete "${name}"?`, `"${name}" silinsin mi?`);
    if (!supabase || !window.confirm(question)) return;

    setOperationsLoading(true);
    try {
      await deleteOperationRecord(supabase, entity, row.id);
      await loadOperationsData();
      await loadFinancialData();
      setOperationsStatus(copy(`"${name}" was deleted.`, `"${name}" silindi.`));
    } catch (error) {
      const inUse = getRecordInUseCounts(error);
      setOperationsStatus(
        inUse
          ? copy(
              `"${name}" is still used (${inUse.recipes} recipes, ${inUse.processes} process steps, ${inUse.plans} saved plans). Remove it there first.`,
              `"${name}" hâlâ kullanılıyor (${inUse.recipes} reçete, ${inUse.processes} süreç adımı, ${inUse.plans} kayıtlı plan). Önce oradan çıkarın.`,
            )
          : error.message,
      );
    } finally {
      setOperationsLoading(false);
    }
  }

  return {
    addProductMaterialRow,
    addProductProcessRow,
    buildProductOperationRows,
    copyOperationRecordToForm,
    getProductFlowDefaults,
    getProductProcessRows,
    getRecipeMaterialId,
    handleDashboardProductChange,
    handleDeleteOperationRecord,
    handleSaveOperationPlan,
    handleSaveOperationRecord,
    loadOperationsData,
    moveProductProcessRow,
    normalizeFlowStrategy,
    operationForms,
    operationPlan,
    operationPlanResult,
    operationsLoading,
    operationsStatus,
    operationsWorkspace,
    processDefinitionOpen,
    removeProductMaterialRow,
    removeProductProcessRow,
    setOperationForms,
    setOperationPlan,
    setOperationPlanResult,
    setOperationsStatus,
    setOperationsWorkspace,
    setProcessDefinitionOpen,
    updateOperationForm,
    updateOperationPlan,
    updateOperationPlanRow,
    updateOperationPlanRowFields,
    updateProductMaterialRow,
    updateProductProcessRow,
    updateProductProcessRowFields,
  };
}
