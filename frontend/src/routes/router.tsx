import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { EngineRoute } from "./EngineRoute";
import {
  ACCOUNTANT_ROLES,
  AGENT_ROLES,
  ASSET_ROLES,
  TILL_ROLES,
  MANUAL_SALES_ROLES,
  REFUND_QUEUE_ROLES,
  COURIER_ROLES,
  DOCS_ROLES,
  HR_ROLES,
  BACK_OFFICE_ROLES,
  MANAGER_ROLES,
  TENANT_ADMIN_ROLES,
} from "@/permissions/permissions";
import { LoginPage } from "@/features/auth/LoginPage";
import { PlatformShell } from "@/platform/PlatformShell";
import { PlatformLoginPage } from "@/platform/pages/PlatformLoginPage";
import { PlatformTenantsPage } from "@/platform/pages/PlatformTenantsPage";
import { PlatformTenantPage } from "@/platform/pages/PlatformTenantPage";
import { NewTenantPage } from "@/platform/pages/NewTenantPage";
import { PlatformAuditPage } from "@/platform/pages/PlatformAuditPage";
import { PlatformOverviewPage } from "@/platform/pages/PlatformOverviewPage";
import { PlatformReportsPage } from "@/platform/pages/PlatformReportsPage";
import { PlatformHealthPage } from "@/platform/pages/PlatformHealthPage";
import { PlatformAdminsPage } from "@/platform/pages/PlatformAdminsPage";
import { PlatformSettingsPage } from "@/platform/pages/PlatformSettingsPage";
import { PlatformKnowledgePage } from "@/platform/pages/PlatformKnowledgePage";
import { PlatformLearningPage } from "@/platform/pages/PlatformLearningPage";
import { ToastHost } from "@/platform/toast";
import { InvitationPage } from "@/features/auth/InvitationPage";
import { ManagerOverview } from "@/features/manager/ManagerOverview";
import {
  ManagerLive,
  ManagerIncidents,
  ManagerShifts,
} from "@/features/manager/ManagerOperations";
import { ManagerOrg } from "@/features/manager/ManagerOrg";
import { ManagerTeam } from "@/features/manager/ManagerTeam";
import { ManagerSettings } from "@/features/manager/ManagerSettings";
import { ManagerReports } from "@/features/manager/ManagerReports";
import {
  ManagerActivity,
  ManagerCustomerDetail,
  ManagerCustomers,
  ManagerPayments,
  ManagerRentalDetail,
  ManagerRentals,
} from "@/features/manager/ManagerRecords";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PosPage } from "@/features/pos/PosPage";
import { ShopDropPage } from "@/features/shopdrop/ShopDropPage";
import { EngineWorkspace } from "@/features/engine/EngineWorkspace";
import { MyGatePage } from "@/features/gate/MyGatePage";
import { OperationsPage } from "@/features/operations/OperationsPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { CustomerDetailPage } from "@/features/customers/CustomerDetailPage";
import { BookingsPage } from "@/features/bookings/BookingsPage";
import { BookingDetailPage } from "@/features/bookings/BookingDetailPage";
import { ShiftPage } from "@/features/shift/ShiftPage";
import { IncidentsPage } from "@/features/incidents/IncidentsPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { TrackingPage } from "@/features/tracking/TrackingPage";
import { VersionsPage } from "@/features/versions/VersionsPage";
import { VersionDetailPage } from "@/features/versions/VersionDetailPage";
import {
  CourierBoardPage,
  CourierHistoryPage,
} from "@/features/delivery/CourierBoardPage";
import { CourierTaskPage } from "@/features/delivery/CourierTaskPage";
import { KioskDeliveriesPage } from "@/features/delivery/KioskDeliveriesPage";
import { TillPage } from "@/features/till/TillPage";
import { TillQueue } from "@/features/till/TillQueue";
import { TillTransactions } from "@/features/till/TillTransactions";
import { TillDrawer } from "@/features/till/TillDrawer";
import { AdminOverview } from "@/features/admin/AdminOverview";
import { AdminCompany } from "@/features/admin/AdminCompany";
import { AdminAudit, AdminIsolation } from "@/features/admin/AdminPeople";
import { AdminRules } from "@/features/admin/AdminRules";
import { AdminVouchers } from "@/features/admin/AdminVouchers";
import { AdminStationMap } from "@/features/admin/AdminStationMap";
import { ManagerShiftDetail } from "@/features/manager/ManagerShiftDetail";
import { LagoonTripsPage } from "@/features/lagoon/LagoonTripsPage";
import { HrShifts } from "@/features/hr/HrShifts";
import { CaptainBoardPage } from "@/features/lagoon/CaptainBoardPage";
import { CaptainVoyagePage } from "@/features/lagoon/CaptainVoyagePage";
import { CaptainHistoryPage } from "@/features/lagoon/CaptainHistoryPage";
import { ManualSalesPage } from "@/features/finance/ManualSalesPage";
import { RefundRequestsPage } from "@/features/finance/RefundRequestsPage";
import { AssetsPage } from "@/features/assets/AssetsPage";
import { AssetTypeDetailPage } from "@/features/assets/AssetTypeDetailPage";
import { AssetUnitPage } from "@/features/assets/AssetUnitPage";
import { AccountingDashboard } from "@/features/accounting/AccountingDashboard";
import { HrCosts, HrSeasons } from "@/features/hr/HrCosts";
import { SeasonDetail } from "@/features/hr/SeasonDetail";
import { CommissionRates } from "@/features/accounting/CommissionRates";
import { ReconciliationPage } from "@/features/accounting/ReconciliationPage";
import { CardTransactionsPage } from "@/features/accounting/CardTransactionsPage";
import { PaymentsPage } from "@/features/accounting/PaymentsPage";
import {
  PaymentDetailPage,
  TransactionDetailPage,
} from "@/features/accounting/SettlementDetail";
import { ManualPage } from "@/features/help/ManualPage";
import { ArchitecturePage } from "@/features/help/ArchitecturePage";
import { TrainingPage } from "@/features/help/TrainingPage";
import { NotFoundPage } from "@/features/misc/NotFoundPage";
import { NoWorkspacePage } from "@/features/misc/NoWorkspacePage";
import { ActivitiesPage } from "@/features/activities/ActivitiesPage";
import { RolesPage } from "@/features/roles/RolesPage";
import { ActivityBuilderPage } from "@/features/activities/ActivityBuilderPage";
import { ActivityCounterPage } from "@/features/activities/ActivityCounterPage";
import { WorkspaceGatewayPage } from "@/features/auth/WorkspaceGatewayPage";
import { TenantChrome } from "./TenantChrome";

/*
 * Every route sits under one element, so the two questions that used to be answered
 * inconsistently are answered once: whose colours these are, and whether the session on this
 * machine belongs on this address. See `TenantChrome`.
 */
export const router = createBrowserRouter([
{
  element: <TenantChrome />,
  children: [
  /*
   * The platform's own doors. Neither belongs to a tenant.
   *
   * `/login` was WAYZ's — its name, its colours, its staff — which made the root of the
   * product implicitly mean one customer. It is a workspace gateway now: it names nobody and
   * sends you to the tenant you choose.
   *
   * `/` needs no entry here: signed in it is the application, and signed out `ProtectedRoute`
   * sends it to this same gateway.
   */
  { path: "/login", element: <WorkspaceGatewayPage /> },

  // A tenant's own front door: its colours, its name, its own accounts, and a sign-in that
  // resolves to its database from the handle in the address rather than from the email typed.
  { path: "/t/:slug/login", element: <LoginPage /> },

  /*
   * The control plane, above every tenant.
   *
   * Its own login, its own session and its own frame — nothing under /platform enters a
   * tenant's data, and a tenant's session cannot reach it.
   */
  { path: "/platform/login", element: <PlatformLoginPage /> },
  {
    path: "/platform",
    element: (
      <ToastHost>
        <PlatformShell />
      </ToastHost>
    ),
    children: [
      { index: true, element: <PlatformOverviewPage /> },
      { path: "tenants", element: <PlatformTenantsPage /> },
      { path: "tenants/new", element: <NewTenantPage /> },
      { path: "tenants/:id", element: <PlatformTenantPage /> },
      { path: "reports", element: <PlatformReportsPage /> },
      { path: "health", element: <PlatformHealthPage /> },
      { path: "knowledge", element: <PlatformKnowledgePage /> },
      { path: "learning", element: <PlatformLearningPage /> },
      { path: "audit", element: <PlatformAuditPage /> },
      { path: "administrators", element: <PlatformAdminsPage /> },
      { path: "settings", element: <PlatformSettingsPage /> },
    ],
  },
  { path: "/manager/estate", element: <Navigate to="/assets" replace /> },
  // Products moved onto the kind that sells them; an old bookmark lands on the estate rather than
  // on nothing.
  { path: "/manager/pricing", element: <Navigate to="/assets" replace /> },
  { path: "/admin/pricing", element: <Navigate to="/assets" replace /> },
  { path: "/cashier", element: <Navigate to="/till" replace /> },
  { path: "/admin/people", element: <Navigate to="/manager/team" replace /> },
  { path: "/notifications", element: <Navigate to="/dashboard" replace /> },
  { path: "/admin/assets", element: <Navigate to="/assets" replace /> },
  { path: "/invitation/:token", element: <InvitationPage /> },

  {
    path: "/manager",
    element: (
      <ProtectedRoute allow={MANAGER_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <ManagerOverview /> },
      { path: "live", element: <ManagerLive /> },
      { path: "rentals", element: <ManagerRentals /> },
      { path: "rentals/:id", element: <ManagerRentalDetail /> },
      { path: "customers", element: <ManagerCustomers /> },
      { path: "customers/:id", element: <ManagerCustomerDetail /> },
      { path: "payments", element: <ManagerPayments /> },
      { path: "incidents", element: <ManagerIncidents /> },
      { path: "shifts", element: <ManagerShifts /> },
      { path: "shifts/:id", element: <ManagerShiftDetail /> },
      { path: "organisation", element: <ManagerOrg /> },
      { path: "team", element: <ManagerTeam /> },
      { path: "settings", element: <ManagerSettings /> },
      { path: "reports", element: <ManagerReports /> },
      { path: "activity", element: <ManagerActivity /> },
      // Activities this tenant defined for itself. See features/activities.
      { path: "activities", element: <ActivitiesPage /> },
      // Jobs, as this company defines them. See features/roles.
      { path: "roles", element: <RolesPage /> },
      { path: "activities/:id", element: <ActivityBuilderPage /> },
    ],
  },
  {
    path: "/assets",
    element: (
      <ProtectedRoute allow={ASSET_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AssetsPage /> },
      { path: "unit/:id", element: <AssetUnitPage /> },
      { path: ":id", element: <AssetTypeDetailPage /> },
    ],
  },
  {
    path: "/accounting",
    element: (
      <ProtectedRoute allow={[...ACCOUNTANT_ROLES, ...TENANT_ADMIN_ROLES]}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AccountingDashboard /> },
      { path: "commissions", element: <CommissionRates /> },
      { path: "settlement", element: <ReconciliationPage /> },
      { path: "settlement/transactions", element: <CardTransactionsPage /> },
      {
        path: "settlement/transactions/:id",
        element: <TransactionDetailPage />,
      },
      { path: "settlement/payments", element: <PaymentsPage /> },
      { path: "settlement/payments/:id", element: <PaymentDetailPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    path: "/hr",
    element: (
      <ProtectedRoute allow={[...HR_ROLES, ...TENANT_ADMIN_ROLES]}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HrCosts /> },
      { path: "seasons", element: <HrSeasons /> },
      { path: "shifts", element: <HrShifts /> },
      { path: "seasons/:id", element: <SeasonDetail /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    path: "/admin/rules",
    element: (
      <ProtectedRoute allow={BACK_OFFICE_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <AdminRules /> }],
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute allow={TENANT_ADMIN_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: "company", element: <AdminCompany /> },
      { path: "vouchers", element: <AdminVouchers /> },
      { path: "audit", element: <AdminAudit /> },
      { path: "isolation", element: <AdminIsolation /> },
      { path: "stations", element: <AdminStationMap /> },
    ],
  },
  {
    path: "/till",
    element: (
      <ProtectedRoute allow={TILL_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <TillPage /> },
      { path: "queue", element: <TillQueue /> },
      { path: "transactions", element: <TillTransactions /> },
      { path: "drawer", element: <TillDrawer /> },
      { path: "shift", element: <ShiftPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    path: "/courier",
    element: (
      <ProtectedRoute allow={COURIER_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <CourierBoardPage /> },
      { path: "history", element: <CourierHistoryPage /> },
      { path: "task/:id", element: <CourierTaskPage /> },
      { path: "shift", element: <ShiftPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    path: "/refund-requests",
    element: (
      <ProtectedRoute allow={REFUND_QUEUE_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <RefundRequestsPage /> }],
  },
  {
    path: "/manual-sales",
    element: (
      <ProtectedRoute allow={MANUAL_SALES_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <ManualSalesPage /> }],
  },
  { path: "/track/:id", element: <TrackingPage /> },
  { path: "/versions", element: <VersionsPage /> },
  { path: "/versions/:id", element: <VersionDetailPage /> },
  {
    path: "/help",
    element: (
      <ProtectedRoute allow={DOCS_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: "manual", element: <ManualPage /> },
      { path: "training", element: <TrainingPage /> },
      { path: "architecture", element: <ArchitecturePage /> },
    ],
  },
  {
    path: "/",
    element: (
      <ProtectedRoute allow={AGENT_ROLES}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "pos", element: <PosPage /> },
      /*
       * The counter for an activity the tenant defined.
       *
       * No `EngineRoute` guard, deliberately — there is no engine to guard on. Whether this
       * person may sell this activity is decided by the activity's own operator list and by
       * what they were assigned, both of which are checked server-side on every call. A guard
       * here could only duplicate that, and a duplicate is a thing that drifts.
       */
      { path: "activities/:key", element: <ActivityCounterPage /> },
      {
        path: "shop-drop",
        element: (
          <EngineRoute engineKind="SHOP_AND_DROP">
            <ShopDropPage />
          </EngineRoute>
        ),
      },
      {
        path: "mobility",
        element: (
          <EngineRoute engineKind="MOBILITY">
            <EngineWorkspace engineKind="MOBILITY" />
          </EngineRoute>
        ),
      },
      {
        path: "my-gate",
        element: <MyGatePage />,
      },
      {
        path: "lagoon",
        element: (
          <EngineRoute engineKind="LAGOON">
            <EngineWorkspace engineKind="LAGOON" />
          </EngineRoute>
        ),
      },
      { path: "operations", element: <OperationsPage /> },
      { path: "lagoon/trips", element: <LagoonTripsPage /> },
      { path: "lagoon/captain", element: <CaptainBoardPage /> },
      { path: "lagoon/voyage", element: <CaptainVoyagePage /> },
      { path: "lagoon/captain/history", element: <CaptainHistoryPage /> },
      { path: "deliveries", element: <KioskDeliveriesPage /> },
      { path: "assets", element: <AssetsPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "bookings", element: <BookingsPage /> },
      { path: "bookings/:id", element: <BookingDetailPage /> },
      { path: "shift", element: <ShiftPage /> },
      { path: "incidents", element: <IncidentsPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  { path: "/no-workspace", element: <NoWorkspacePage /> },
  { path: "*", element: <NotFoundPage /> },
  ],
},
]);
