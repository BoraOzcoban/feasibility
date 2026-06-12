export const emptyOperationPlan = {
  machineRows: [],
  materialRows: [],
  planName: "",
  productId: "",
  productName: "",
  workforceRows: [],
};

export const emptyPlanRows = {
  machine: {
    dailyHours: 8,
    machineId: "",
  },
  material: {
    dailyQuantity: 0,
    materialId: "",
  },
  workforce: {
    dailyHours: 8,
    peopleAssigned: 1,
    workforceId: "",
  },
};

export const emptyOperationForms = {
  equipment: {
    name: "",
    price: 0,
    priceCurrency: "TRY",
    quantity: 1,
  },
  machine: {
    hourlyEnergyConsumptionKwh: 0,
    name: "",
    price: 0,
    priceCurrency: "TRY",
  },
  product: {
    cycleTimeUnit: "minute",
    cycleTimeValue: 1,
    id: "",
    materialRows: [],
    name: "",
    price: 0,
    priceCurrency: "TRY",
    unit: "adet",
  },
  material: {
    name: "",
    pricePerUnit: 0,
    priceCurrency: "TRY",
    unit: "kg",
  },
  workforce: {
    hourlyCost: 250,
    hourlyCostCurrency: "TRY",
    roleName: "",
  },
};

export async function loadOperationsWorkspace(supabase) {
  const [
    { data: equipment, error: equipmentError },
    { data: products, error: productError },
    { data: machines, error: machinesError },
    { data: materials, error: materialsError },
    { data: activePlans, error: activePlansError },
    { data: workforce, error: workforceError },
  ] =
    await Promise.all([
      supabase.from("operation_equipment").select("*").order("name", { ascending: true }),
      supabase
        .from("operation_products")
        .select("*, material_rows:operation_product_materials(*, material:operation_materials(*))")
        .order("name", { ascending: true }),
      supabase.from("operation_machines").select("*").order("name", { ascending: true }),
      supabase.from("operation_materials").select("*").order("name", { ascending: true }),
      supabase
        .from("operation_resource_plans")
        .select("*, product:operation_products(id, name, unit, price, price_currency, cycle_time_minutes, cycle_time_unit)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("operation_workforce_resources").select("*").order("role_name", { ascending: true }),
    ]);

  if (equipmentError) throw equipmentError;
  if (productError) throw productError;
  if (machinesError) throw machinesError;
  if (materialsError) throw materialsError;
  if (activePlansError) throw activePlansError;
  if (workforceError) throw workforceError;

  const contextProductId = activePlans?.[0]?.product_id || activePlans?.[0]?.product?.id || products?.[0]?.id || "";
  const product = (products || []).find((item) => item.id === contextProductId) || products?.[0] || null;
  let latestPlan = activePlans?.find((plan) => plan.product_id === product?.id || plan.product?.id === product?.id) || activePlans?.[0] || null;
  let notes = [];

  if (product) {
    const [
      { data: noteRows, error: notesError },
      { data: latestPlans, error: plansError },
    ] = await Promise.all([
      supabase
        .from("operation_notes")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("operation_resource_plans")
        .select("*")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (notesError) throw notesError;
    if (plansError) throw plansError;

    latestPlan = latestPlans?.[0] || latestPlan;
    notes = noteRows || [];
  }

  return {
    activePlans: activePlans || [],
    equipment: equipment || [],
    latestPlan,
    machines: machines || [],
    materials: materials || [],
    notes,
    product,
    products: products || [],
    workforce: workforce || [],
  };
}

export async function saveOperationResourcePlan(supabase, input) {
  const { data, error } = await supabase.rpc("save_operation_resource_plan", { p_input: input });

  if (error) throw error;

  return data;
}

export async function saveOperationRecord(supabase, entity, input) {
  const { data, error } = await supabase.rpc("save_operation_record", {
    p_entity: entity,
    p_input: input,
  });

  if (error) throw error;

  return data;
}
