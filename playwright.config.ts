import {defineConfig} from "@playwright/test";
import {localOrigin} from "./tests/e2e/helpers";
export default defineConfig({
  testDir:"./tests/e2e",workers:1,fullyParallel:false,retries:0,timeout:60000,
  expect:{timeout:10000},reporter:"list",
  use:{baseURL:localOrigin(process.env.AUTH_TEST_ORIGIN??"http://localhost:3000"),channel:"msedge",headless:true,trace:"off",screenshot:"off",video:"off"},
  // Reuse the explicitly started local app. Never start a second server or
  // automatically acquire credentials/migrate a database from the test runner.
});
