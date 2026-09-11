// @vitest-environment node
import {expect,it} from "vitest";
import {localOrigin,liveTestConfig} from "../e2e/helpers";
it("allows only explicit loopback origins",()=>{
  expect(localOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  expect(()=>localOrigin("https://app.example.com")).toThrow();
  expect(()=>localOrigin("http://localhost.evil.test:3000")).toThrow();
});
it("gates live mutations on explicit consent, local backend, and dedicated accounts",()=>{
  expect(liveTestConfig({})).toBeNull();
  const env={E2E_LOCAL_SUPABASE:"1",E2E_ALLOW_MUTATIONS:"I_UNDERSTAND_LOCAL_TEST_DATA",E2E_SUPABASE_URL:"http://127.0.0.1:54321",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",E2E_OWNER_EMAIL:"owner@example.test",E2E_OWNER_PASSWORD:"private",E2E_MEMBER_EMAIL:"member@example.test",E2E_MEMBER_PASSWORD:"private",E2E_TEST_MONTH:"2099-02"};
  expect(liveTestConfig(env)).not.toBeNull();
  expect(liveTestConfig({...env,E2E_ALLOW_MUTATIONS:""})).toBeNull();
  expect(liveTestConfig({...env,E2E_SUPABASE_URL:"https://example.supabase.co"})).toBeNull();
  expect(liveTestConfig({...env,E2E_MEMBER_PASSWORD:""})).toBeNull();
});
