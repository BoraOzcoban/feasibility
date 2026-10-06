import React from "react";
import { useAppContext } from "../app/AppContext";
import DataTable from "../components/DataTable";
import DashboardLayout from "../components/DashboardLayout";

export default function AuthorizationPage() {
  const {
    authorizationAccess,
    authorizationLoading,
    authorizationStatus,
    authorizationTab,
    currentProfile,
    editableAuthorizationRoles,
    handleCreateManagedUser,
    handleCreateRole,
    labels,
    managedUserForm,
    permissionTableColumns,
    permissionTableRows,
    profiles,
    roleForm,
    setAuthorizationTab,
    updateManagedUserForm,
    updateRoleForm,
    userTableColumns,
  } = useAppContext();

  return (
    <DashboardLayout activePage="authorization">
      <section className="page authorization-page">
        <div className="page-header">
          <div>
            <span>{labels.dashboard}</span>
            <h1>{labels.authorizationPage}</h1>
            <p>{authorizationAccess.read ? labels.authorizationCopy : labels.authorizationLockedCopy}</p>
          </div>
        </div>

        {!authorizationAccess.read ? (
          <div className="card">
            <strong>{labels.authorizationLocked}</strong>
            <p>{labels.authorizationLockedCopy}</p>
          </div>
        ) : (
          <>
            <div className="segmented tab-row" role="tablist" aria-label={labels.authorizationPage}>
              <button
                type="button"
                role="tab"
                aria-selected={authorizationTab === "roles"}
                className={authorizationTab === "roles" ? "active" : ""}
                onClick={() => setAuthorizationTab("roles")}
              >
                {labels.roleDefinition}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authorizationTab === "users"}
                className={authorizationTab === "users" ? "active" : ""}
                onClick={() => setAuthorizationTab("users")}
              >
                {labels.userDefinition}
              </button>
            </div>

            {authorizationTab === "users" ? (
              <div className="two-up">
                <form className="card" onSubmit={handleCreateManagedUser}>
                  <h2>{labels.userDefinition}</h2>
                  <p>{labels.userDefinitionCopy}</p>
                  <label>
                    <span>{labels.username}</span>
                    <input
                      disabled={!authorizationAccess.write || authorizationLoading}
                      required
                      value={managedUserForm.username}
                      onChange={(event) => updateManagedUserForm("username", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{labels.email}</span>
                    <input
                      disabled={!authorizationAccess.write || authorizationLoading}
                      required
                      type="email"
                      value={managedUserForm.email}
                      onChange={(event) => updateManagedUserForm("email", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{labels.password}</span>
                    <input
                      disabled={!authorizationAccess.write || authorizationLoading}
                      minLength="8"
                      required
                      type="password"
                      value={managedUserForm.password}
                      onChange={(event) => updateManagedUserForm("password", event.target.value)}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      <span>{labels.phoneNumber}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={managedUserForm.phoneNumber}
                        onChange={(event) => updateManagedUserForm("phoneNumber", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.department}</span>
                      <input
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={managedUserForm.department}
                        onChange={(event) => updateManagedUserForm("department", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>{labels.accessLevel}</span>
                      <select
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={managedUserForm.accessLevel}
                        onChange={(event) => updateManagedUserForm("accessLevel", event.target.value)}
                      >
                        {editableAuthorizationRoles.map((role) => (
                          <option value={role.name} key={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{labels.language}</span>
                      <select
                        disabled={!authorizationAccess.write || authorizationLoading}
                        value={managedUserForm.language}
                        onChange={(event) => updateManagedUserForm("language", event.target.value)}
                      >
                        <option value="en">EN</option>
                        <option value="tr">TR</option>
                      </select>
                    </label>
                  </div>
                  <button
                    className="primary"
                    disabled={!authorizationAccess.write || authorizationLoading}
                    type="submit"
                  >
                    {authorizationLoading ? "..." : labels.createManagedUser}
                  </button>
                  <p className="planner-empty-state">
                    {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                  </p>
                </form>

                <div className="card">
                  <div className="card-header">
                    <h2>{labels.managedUsers}</h2>
                    {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                  </div>
                  <DataTable columns={userTableColumns} rows={profiles} />
                </div>
              </div>
            ) : (
              <div className="two-up">
                <form className="card" onSubmit={handleCreateRole}>
                  <h2>{labels.newRole}</h2>
                  <label>
                    <span>{labels.roleName}</span>
                    <input
                      disabled={!authorizationAccess.write || authorizationLoading}
                      value={roleForm.name}
                      onChange={(event) => updateRoleForm("name", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{labels.roleDescription}</span>
                    <input
                      disabled={!authorizationAccess.write || authorizationLoading}
                      value={roleForm.description}
                      onChange={(event) => updateRoleForm("description", event.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={!authorizationAccess.write || authorizationLoading}
                    type="submit"
                  >
                    {labels.createRole}
                  </button>
                  <p className="planner-empty-state">
                    {authorizationAccess.write ? labels.writeAccess : labels.readOnlyMode}
                  </p>
                </form>

                <div className="card">
                  <div className="card-header">
                    <h2>{labels.permissions}</h2>
                    {currentProfile?.company?.name && <span>{currentProfile.company.name}</span>}
                  </div>
                  <DataTable columns={permissionTableColumns} rows={permissionTableRows} />
                </div>
              </div>
            )}
          </>
        )}

        {authorizationStatus && <p className="status-message">{authorizationStatus}</p>}
      </section>
    </DashboardLayout>
  );
}
