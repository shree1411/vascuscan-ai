/**
 * App.tsx — TanStack Router setup with Layout wrapper.
 */
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DatasetPage from "./pages/Dataset";
import History from "./pages/History";
import NewPatient from "./pages/NewPatient";
import Registration from "./pages/Registration";

// Root route wraps everything in Layout
const rootRoute = createRootRoute({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const newPatientRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/new-patient",
  component: NewPatient,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: Registration,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: History,
});

const datasetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dataset",
  component: DatasetPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  newPatientRoute,
  registerRoute,
  historyRoute,
  datasetRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
