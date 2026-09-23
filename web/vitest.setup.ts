import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// With globals: false, RTL's own auto-cleanup (which looks for a global afterEach)
// never registers, so unmounted components would pile up in the DOM between tests.
afterEach(cleanup);
