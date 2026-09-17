import { PlatformShell } from '@/features/platform/PlatformShell';
import { PlatformOverview } from '@/features/platform/PlatformOverview';
import { PlatformOrganisations } from '@/features/platform/PlatformOrganisations';
import { PlatformReports } from '@/features/platform/PlatformReports';
import { PlatformKnowledge } from '@/features/platform/PlatformKnowledge';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { SignInPage } from '@/features/auth/SignInPage';
import { EngineRoute } from './EngineRoute';
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
} from '@/permissions/permissions';
import { InvitationPage } from '@/features/auth/InvitationPage';
import { ManagerOverview } from '@/features/manager/ManagerOverview';
import { ManagerLive, ManagerIncidents, ManagerShifts } from '@/features/manager/ManagerOperations';
import { ManagerOrg } from '@/features/manager/ManagerOrg';
import { ManagerTeam } from '@/features/manager/ManagerTeam';
import { ManagerSettings } from '@/features/manager/ManagerSettings';
import { ManagerReports } from '@/features/manager/ManagerReports';
import {
  ManagerActivity,
  ManagerCustomerDetail,
  ManagerCustomers,
  ManagerPayments,
  ManagerRentalDetail,
  ManagerRentals,
} from '@/features/manager/ManagerRecords';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PosPage } from '@/features/pos/PosPage';
import { ShopDropPage } from '@/features/shopdrop/ShopDropPage';
import { EngineWorkspace } from '@/features/engine/EngineWorkspace';
import { MyGatePage } from '@/features/gate/MyGatePage';
import { OperationsPage } from '@/features/operations/OperationsPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { BookingsPage } from '@/features/bookings/BookingsPage';
import { BookingDetailPage } from '@/features/bookings/BookingDetailPage';
import { ShiftPage } from '@/features/shift/ShiftPage';
import { IncidentsPage } from '@/features/incidents/IncidentsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { TrackingPage } from '@/features/tracking/TrackingPage';
import { VersionsPage } from '@/features/versions/VersionsPage';
import { VersionDetailPage } from '@/features/versions/VersionDetailPage';
import { CourierBoardPage, CourierHistoryPage } from '@/features/delivery/CourierBoardPage';
import { CourierTaskPage } from '@/features/delivery/CourierTaskPage';
import { KioskDeliveriesPage } from '@/features/delivery/KioskDeliveriesPage';
import { TillPage } from '@/features/till/TillPage';
import { TillQueue } from '@/features/till/TillQueue';
import { TillTransactions } from '@/features/till/TillTransactions';
import { TillDrawer } from '@/features/till/TillDrawer';
import { AdminOverview } from '@/features/admin/AdminOverview';
import { AdminCompany } from '@/features/admin/AdminCompany';
import { AdminAudit, AdminIsolation } from '@/features/admin/AdminPeople';
import { AdminRules } from '@/features/admin/AdminRules';
import { AdminActivities } from '@/features/admin/AdminActivities';
import { AdminRoles } from '@/features/admin/AdminRoles';
import { AdminVouchers } from '@/features/admin/AdminVouchers';
import { AdminStationMap } from '@/features/admin/AdminStationMap';
import { ManagerShiftDetail } from '@/features/manager/ManagerShiftDetail';
import { LagoonTripsPage } from '@/features/lagoon/LagoonTripsPage';
import { HrShifts } from '@/features/hr/HrShifts';
import { CaptainBoardPage } from '@/features/lagoon/CaptainBoardPage';
import { CaptainVoyagePage } from '@/features/lagoon/CaptainVoyagePage';
import { CaptainHistoryPage } from '@/features/lagoon/CaptainHistoryPage';
import { ManualSalesPage } from '@/features/finance/ManualSalesPage';
import { RefundRequestsPage } from '@/features/finance/RefundRequestsPage';
import { AssetsPage } from '@/features/assets/AssetsPage';
import { AssetTypeDetailPage } from '@/features/assets/AssetTypeDetailPage';
import { AssetUnitPage } from '@/features/assets/AssetUnitPage';
import { AccountingDashboard } from '@/features/accounting/AccountingDashboard';
import { HrCosts, HrSeasons } from '@/features/hr/HrCosts';
import { SeasonDetail } from '@/features/hr/SeasonDetail';
import { CommissionRates } from '@/features/accounting/CommissionRates';
import { ReconciliationPage } from '@/features/accounting/ReconciliationPage';
import { CardTransactionsPage } from '@/features/accounting/CardTransactionsPage';
import { PaymentsPage } from '@/features/accounting/PaymentsPage';
import { PaymentDetailPage, TransactionDetailPage } from '@/features/accounting/SettlementDetail';
import { ManualPage } from '@/features/help/ManualPage';
import { ArchitecturePage } from '@/features/help/ArchitecturePage';
import { TrainingPage } from '@/features/help/TrainingPage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';
import { NoWorkspacePage } from '@/features/misc/NoWorkspacePage';
import { TenantChrome } from './TenantChrome';

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
       * One neutral door.
       *
       * It belongs to no organisation and wears no organisation's colours. Which company a person
       * works for is decided by their account, and the branding follows the session rather than
       * the address — see features/auth/SignInPage.tsx.
       */
      { path: '/login', element: <SignInPage /> },

      /*
       * Where a bookmark from the per-organisation era lands.
       *
       * Those addresses existed for months, so people have them saved and links to them have been
       * sent. Sending them to the one door is better than a dead page, and the door works out who
       * they are from the account anyway — which is exactly why the address stopped mattering.
       */
      /*
       * The platform console.
       *
       * Outside the tenant shell entirely, because it belongs to no tenant: no branding to apply,
       * no station to name, no adopted-activity narrowing to do. `PlatformShell` turns away
       * anybody without a platform session.
       */
      {
        path: '/platform',
        element: <PlatformShell />,
        children: [
          { index: true, element: <PlatformOverview /> },
          { path: 'organisations', element: <PlatformOrganisations /> },
          { path: 'reports', element: <PlatformReports /> },
          { path: 'knowledge', element: <PlatformKnowledge /> },
        ],
      },

      { path: '/t/:slug/login', element: <Navigate to="/login" replace /> },
      { path: '/t/:slug/*', element: <Navigate to="/login" replace /> },

      { path: '/manager/estate', element: <Navigate to="/assets" replace /> },
      // Products moved onto the kind that sells them; an old bookmark lands on the estate rather than
      // on nothing.
      { path: '/manager/pricing', element: <Navigate to="/assets" replace /> },
      { path: '/admin/pricing', element: <Navigate to="/assets" replace /> },
      { path: '/cashier', element: <Navigate to="/till" replace /> },
      { path: '/admin/people', element: <Navigate to="/manager/team" replace /> },
      { path: '/notifications', element: <Navigate to="/dashboard" replace /> },
      { path: '/admin/assets', element: <Navigate to="/assets" replace /> },
      { path: '/invitation/:token', element: <InvitationPage /> },

      {
        path: '/manager',
        element: (
          <ProtectedRoute allow={MANAGER_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <ManagerOverview /> },
          { path: 'live', element: <ManagerLive /> },
          { path: 'rentals', element: <ManagerRentals /> },
          { path: 'rentals/:id', element: <ManagerRentalDetail /> },
          { path: 'customers', element: <ManagerCustomers /> },
          { path: 'customers/:id', element: <ManagerCustomerDetail /> },
          { path: 'payments', element: <ManagerPayments /> },
          { path: 'incidents', element: <ManagerIncidents /> },
          { path: 'shifts', element: <ManagerShifts /> },
          { path: 'shifts/:id', element: <ManagerShiftDetail /> },
          { path: 'organisation', element: <ManagerOrg /> },
          { path: 'team', element: <ManagerTeam /> },
          { path: 'settings', element: <ManagerSettings /> },
          { path: 'reports', element: <ManagerReports /> },
          { path: 'activity', element: <ManagerActivity /> },
        ],
      },
      {
        path: '/assets',
        element: (
          <ProtectedRoute allow={ASSET_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AssetsPage /> },
          { path: 'unit/:id', element: <AssetUnitPage /> },
          { path: ':id', element: <AssetTypeDetailPage /> },
        ],
      },
      {
        path: '/accounting',
        element: (
          <ProtectedRoute allow={[...ACCOUNTANT_ROLES, ...TENANT_ADMIN_ROLES]}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AccountingDashboard /> },
          { path: 'commissions', element: <CommissionRates /> },
          { path: 'settlement', element: <ReconciliationPage /> },
          { path: 'settlement/transactions', element: <CardTransactionsPage /> },
          {
            path: 'settlement/transactions/:id',
            element: <TransactionDetailPage />,
          },
          { path: 'settlement/payments', element: <PaymentsPage /> },
          { path: 'settlement/payments/:id', element: <PaymentDetailPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      {
        path: '/hr',
        element: (
          <ProtectedRoute allow={[...HR_ROLES, ...TENANT_ADMIN_ROLES]}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <HrCosts /> },
          { path: 'seasons', element: <HrSeasons /> },
          { path: 'shifts', element: <HrShifts /> },
          { path: 'seasons/:id', element: <SeasonDetail /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      {
        path: '/admin/rules',
        element: (
          <ProtectedRoute allow={BACK_OFFICE_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminRules /> }],
      },
      /*
       * What this company runs.
       *
       * Addressed `/manager/activities` because that is where both sidebars have always pointed —
       * the page behind it was the dynamic activity builder, which the client rejected, and the
       * links were left aimed at nothing. Readable by the back office, because the employee form
       * and the estate pages both need to know; changing it is the administrator's, enforced on
       * the server and reflected in what the page offers.
       */
      /*
       * Who can do what. Read-only: a role is the platform's, not a company's — see AdminRoles.
       * The page behind this link was the role builder the client rejected, and removing it left
       * the sidebar pointing at nothing.
       */
      {
        path: '/manager/roles',
        element: (
          <ProtectedRoute allow={BACK_OFFICE_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminRoles /> }],
      },
      {
        path: '/manager/activities',
        element: (
          <ProtectedRoute allow={BACK_OFFICE_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminActivities /> }],
      },
      {
        path: '/admin',
        element: (
          <ProtectedRoute allow={TENANT_ADMIN_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AdminOverview /> },
          { path: 'company', element: <AdminCompany /> },
          { path: 'vouchers', element: <AdminVouchers /> },
          { path: 'audit', element: <AdminAudit /> },
          { path: 'isolation', element: <AdminIsolation /> },
          { path: 'stations', element: <AdminStationMap /> },
        ],
      },
      {
        path: '/till',
        element: (
          <ProtectedRoute allow={TILL_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <TillPage /> },
          { path: 'queue', element: <TillQueue /> },
          { path: 'transactions', element: <TillTransactions /> },
          { path: 'drawer', element: <TillDrawer /> },
          { path: 'shift', element: <ShiftPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      {
        path: '/courier',
        element: (
          <ProtectedRoute allow={COURIER_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <CourierBoardPage /> },
          { path: 'history', element: <CourierHistoryPage /> },
          { path: 'task/:id', element: <CourierTaskPage /> },
          { path: 'shift', element: <ShiftPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      {
        path: '/refund-requests',
        element: (
          <ProtectedRoute allow={REFUND_QUEUE_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <RefundRequestsPage /> }],
      },
      {
        path: '/manual-sales',
        element: (
          <ProtectedRoute allow={MANUAL_SALES_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <ManualSalesPage /> }],
      },
      { path: '/track/:id', element: <TrackingPage /> },
      { path: '/versions', element: <VersionsPage /> },
      { path: '/versions/:id', element: <VersionDetailPage /> },
      {
        path: '/help',
        element: (
          <ProtectedRoute allow={DOCS_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { path: 'manual', element: <ManualPage /> },
          { path: 'training', element: <TrainingPage /> },
          { path: 'architecture', element: <ArchitecturePage /> },
        ],
      },
      {
        path: '/',
        element: (
          <ProtectedRoute allow={AGENT_ROLES}>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'pos', element: <PosPage /> },
          {
            path: 'shop-drop',
            element: (
              <EngineRoute engineKind="SHOP_AND_DROP">
                <ShopDropPage />
              </EngineRoute>
            ),
          },
          {
            path: 'mobility',
            element: (
              <EngineRoute engineKind="MOBILITY">
                <EngineWorkspace engineKind="MOBILITY" />
              </EngineRoute>
            ),
          },
          {
            path: 'my-gate',
            element: <MyGatePage />,
          },
          {
            path: 'lagoon',
            element: (
              <EngineRoute engineKind="LAGOON">
                <EngineWorkspace engineKind="LAGOON" />
              </EngineRoute>
            ),
          },
          /*
           * WIQAR's seven experiences.
           *
           * Each is a coded activity with its own workflow, and each reaches the counter through
           * the *same* `EngineWorkspace` that Mobility and Lagoon use — one screen driven by the
           * activity it is given. Where an experience genuinely differs, that difference lives in
           * its workflow and in the `FULFILMENT` map, not in a page of its own.
           *
           * `EngineRoute` keeps them out of reach of an organisation that has not adopted them,
           * exactly as it does for the three above.
           */
          {
            path: 'horse-riding',
            element: (
              <EngineRoute engineKind="HORSE_RIDING">
                <EngineWorkspace engineKind="HORSE_RIDING" />
              </EngineRoute>
            ),
          },
          {
            path: 'equestrian-lessons',
            element: (
              <EngineRoute engineKind="EQUESTRIAN_LESSON">
                <EngineWorkspace engineKind="EQUESTRIAN_LESSON" />
              </EngineRoute>
            ),
          },
          {
            path: 'camel-tours',
            element: (
              <EngineRoute engineKind="CAMEL_TOUR">
                <EngineWorkspace engineKind="CAMEL_TOUR" />
              </EngineRoute>
            ),
          },
          {
            path: 'animal-care',
            element: (
              <EngineRoute engineKind="ANIMAL_CARE">
                <EngineWorkspace engineKind="ANIMAL_CARE" />
              </EngineRoute>
            ),
          },
          {
            path: 'animal-feeding',
            element: (
              <EngineRoute engineKind="ANIMAL_FEEDING">
                <EngineWorkspace engineKind="ANIMAL_FEEDING" />
              </EngineRoute>
            ),
          },
          {
            path: 'photography',
            element: (
              <EngineRoute engineKind="PHOTOGRAPHY">
                <EngineWorkspace engineKind="PHOTOGRAPHY" />
              </EngineRoute>
            ),
          },
          {
            path: 'group-package',
            element: (
              <EngineRoute engineKind="GROUP_PACKAGE">
                <EngineWorkspace engineKind="GROUP_PACKAGE" />
              </EngineRoute>
            ),
          },
          { path: 'operations', element: <OperationsPage /> },
          { path: 'lagoon/trips', element: <LagoonTripsPage /> },
          { path: 'lagoon/captain', element: <CaptainBoardPage /> },
          { path: 'lagoon/voyage', element: <CaptainVoyagePage /> },
          { path: 'lagoon/captain/history', element: <CaptainHistoryPage /> },
          { path: 'deliveries', element: <KioskDeliveriesPage /> },
          { path: 'assets', element: <AssetsPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'bookings', element: <BookingsPage /> },
          { path: 'bookings/:id', element: <BookingDetailPage /> },
          { path: 'shift', element: <ShiftPage /> },
          { path: 'incidents', element: <IncidentsPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      { path: '/no-workspace', element: <NoWorkspacePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
