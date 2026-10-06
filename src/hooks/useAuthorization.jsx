// Current profile, module permissions and the roles/users admin page.
import React, { useEffect, useState } from "react";
import { emptyManagedUserForm, emptyRoleForm, isAdminRole } from "../lib/appDefaults";
import { supabase } from "../lib/supabaseClient";

export function useAuthorization({ copy, dashboardModules, form, labels, session, setForm, setTheme, theme }) {
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authorizationStatus, setAuthorizationStatus] = useState("");
  const [authorizationTab, setAuthorizationTab] = useState("roles");
  const [authorizationAccess, setAuthorizationAccess] = useState({ read: false, write: false });
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [managedUserForm, setManagedUserForm] = useState(emptyManagedUserForm);

  useEffect(() => {
    if (!session || !supabase) {
      setCurrentProfile(null);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
      return;
    }

    loadAuthorizationData();
  }, [session]);

  function updateRoleForm(field, value) {
    setRoleForm((current) => ({ ...current, [field]: value }));
  }

  function updateManagedUserForm(field, value) {
    setManagedUserForm((current) => ({ ...current, [field]: value }));
  }

  function normalizeRole(role) {
    const permissions = {};

    for (const permission of role.role_permissions || []) {
      const moduleKey = permission.module?.module_key;
      if (!moduleKey) continue;

      permissions[moduleKey] = {
        id: permission.id,
        moduleId: permission.module_id,
        canRead: permission.can_read,
        canWrite: permission.can_write,
      };
    }

    return { ...role, permissions };
  }

  async function loadAuthorizationData() {
    if (!supabase || !session) return;

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*, company:companies(name)")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfile(profile);
      if (profile?.language && ["en", "tr"].includes(profile.language)) {
        setForm((current) => ({ ...current, language: profile.language }));
      }
      if (profile?.theme && ["light", "dark"].includes(profile.theme)) {
        setTheme(profile.theme);
      }

      const [{ data: canRead }, { data: canWrite }] = await Promise.all([
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "read" }),
        supabase.rpc("has_module_permission", { p_module_key: "authorization", p_permission: "write" }),
      ]);

      const nextAccess = { read: Boolean(canRead), write: Boolean(canWrite) };
      setAuthorizationAccess(nextAccess);

      if (!nextAccess.read) {
        setModules([]);
        setRoles([]);
        setProfiles([]);
        return;
      }

      const [
        { data: moduleRows, error: modulesError },
        { data: roleRows, error: rolesError },
        { data: profileRows, error: profilesError },
      ] = await Promise.all([
        supabase.from("app_modules").select("id, module_key, name").order("name"),
        supabase
          .from("company_roles")
          .select(
            "id, name, description, is_system, role_permissions(id, module_id, can_read, can_write, module:app_modules(id, module_key, name))",
          )
          .order("is_system", { ascending: false })
          .order("name"),
        supabase
          .from("profiles")
          .select("id, username, email, phone_number, department, access_level, language, theme, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (modulesError) throw modulesError;
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      setModules(moduleRows || []);
      setRoles((roleRows || []).map(normalizeRole));
      setProfiles(profileRows || []);
    } catch (error) {
      setAuthorizationStatus(`${labels.loadAuthorizationError} ${error.message}`);
      setAuthorizationAccess({ read: false, write: false });
      setModules([]);
      setRoles([]);
      setProfiles([]);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateRole(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    const nextName = roleForm.name.trim().toLowerCase();
    if (!nextName) return;
    if (isAdminRole(nextName)) {
      setAuthorizationStatus(
        copy(
          "Admin role is managed by the system and cannot be recreated or edited here.",
          "Admin rolü sistem tarafından yönetilir; burada yeniden oluşturulamaz veya düzenlenemez.",
        ),
      );
      return;
    }

    setAuthorizationLoading(true);
    try {
      const { data: role, error: roleError } = await supabase
        .from("company_roles")
        .insert({
          company_id: currentProfile.company_id,
          name: nextName,
          description: roleForm.description.trim() || null,
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      if (modules.length) {
        const { error: permissionError } = await supabase.from("role_permissions").insert(
          modules.map((module) => ({
            role_id: role.id,
            module_id: module.id,
            can_read: false,
            can_write: false,
          })),
        );

        if (permissionError) throw permissionError;
      }

      setRoleForm(emptyRoleForm);
      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function updatePermission(role, module, field, checked) {
    if (!supabase || !authorizationAccess.write) return;
    if (isAdminRole(role)) return;

    const existing = role.permissions[module.module_key];
    const nextPermission = {
      can_read: field === "can_read" ? checked : Boolean(existing?.canRead),
      can_write: field === "can_write" ? checked : Boolean(existing?.canWrite),
    };

    setAuthorizationLoading(true);
    setAuthorizationStatus("");

    try {
      const payload = {
        role_id: role.id,
        module_id: module.id,
        ...nextPermission,
      };

      const query = existing?.id
        ? supabase.from("role_permissions").update(nextPermission).eq("id", existing.id)
        : supabase.from("role_permissions").insert(payload);

      const { error } = await query;
      if (error) throw error;

      await loadAuthorizationData();
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  async function handleCreateManagedUser(event) {
    event.preventDefault();
    setAuthorizationStatus("");

    if (!supabase || !currentProfile?.company_id || !authorizationAccess.write) return;

    setAuthorizationLoading(true);
    try {
      // Users are created server-side so the company comes from the caller's
      // profile, never from sign-up metadata the browser controls.
      const { data, error } = await supabase.functions.invoke("create-company-user", {
        body: {
          accessLevel: managedUserForm.accessLevel,
          department: managedUserForm.department.trim(),
          email: managedUserForm.email.trim(),
          language: managedUserForm.language,
          password: managedUserForm.password,
          phoneNumber: managedUserForm.phoneNumber.trim(),
          theme,
          username: managedUserForm.username.trim(),
        },
      });

      if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error || error.message);
      }
      if (!data?.userId) throw new Error(labels.missingUser);

      setManagedUserForm({ ...emptyManagedUserForm, language: form.language });
      await loadAuthorizationData();
      setAuthorizationStatus(labels.userCreated);
    } catch (error) {
      setAuthorizationStatus(error.message);
    } finally {
      setAuthorizationLoading(false);
    }
  }

  const editableAuthorizationRoles = roles.filter((role) => !isAdminRole(role));
  const moduleLabelByKey = Object.fromEntries(dashboardModules.map((module) => [module.key, module.label]));
  const getModuleLabel = (module) => moduleLabelByKey[module.module_key] || module.name;

  const userTableColumns = [
    { header: labels.username, key: "username", render: (row) => row.username, value: (row) => row.username },
    { header: labels.email, key: "email", render: (row) => row.email, value: (row) => row.email },
    {
      header: labels.department,
      key: "department",
      render: (row) => row.department || "-",
      value: (row) => row.department || "",
    },
    {
      header: labels.accessLevel,
      key: "access-level",
      render: (row) => row.access_level,
      value: (row) => row.access_level,
    },
  ];

  const permissionTableRows = editableAuthorizationRoles.flatMap((role) =>
    modules.map((module) => {
      const permission = role.permissions[module.module_key] || {};
      return {
        canRead: Boolean(permission.canRead),
        canWrite: Boolean(permission.canWrite),
        id: `${role.id}-${module.id}`,
        module,
        moduleLabel: getModuleLabel(module),
        role,
        roleName: role.name,
      };
    }),
  );

  const permissionTableColumns = [
    { header: labels.accessLevel, key: "role", render: (row) => row.roleName, value: (row) => row.roleName },
    { header: labels.module, key: "module", render: (row) => row.moduleLabel, value: (row) => row.moduleLabel },
    {
      header: labels.readPermission,
      key: "read",
      render: (row) => (
        <label className="permission-check">
          <input
            checked={row.canRead}
            disabled={!authorizationAccess.write || authorizationLoading}
            type="checkbox"
            onChange={(event) => updatePermission(row.role, row.module, "can_read", event.target.checked)}
          />
          <span>{labels.readPermission}</span>
        </label>
      ),
      sortValue: (row) => (row.canRead ? 1 : 0),
      filterValue: (row) => (row.canRead ? labels.readPermission : copy("No read", "Okuma yok")),
    },
    {
      header: labels.writePermission,
      key: "write",
      render: (row) => (
        <label className="permission-check">
          <input
            checked={row.canWrite}
            disabled={!authorizationAccess.write || authorizationLoading}
            type="checkbox"
            onChange={(event) => updatePermission(row.role, row.module, "can_write", event.target.checked)}
          />
          <span>{labels.writePermission}</span>
        </label>
      ),
      sortValue: (row) => (row.canWrite ? 1 : 0),
      filterValue: (row) => (row.canWrite ? labels.writePermission : copy("No write", "Yazma yok")),
    },
  ];

  return {
    authorizationAccess,
    authorizationLoading,
    authorizationStatus,
    authorizationTab,
    currentProfile,
    editableAuthorizationRoles,
    handleCreateManagedUser,
    handleCreateRole,
    managedUserForm,
    permissionTableColumns,
    permissionTableRows,
    profiles,
    roleForm,
    setAuthorizationTab,
    updateManagedUserForm,
    updateRoleForm,
    userTableColumns,
  };
}
