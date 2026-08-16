import assert from "node:assert/strict";
import test from "node:test";
import { handler } from "../netlify/functions/demo-sequence.mjs";

const post = (body) => ({ httpMethod: "POST", body: JSON.stringify(body) });

test("demo sequence endpoint reports inactive mode", async () => {
  const result = await handler({ httpMethod: "GET" });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).mode, "inactive");
});

test("inactive request validates consent without storing or sending", async () => {
  const result = await handler(post({ email: "reader@example.com", firstName: "Avery", consent: true }));
  const body = JSON.parse(result.body);
  assert.equal(result.statusCode, 200);
  assert.equal(body.delivery, "inactive");
  assert.equal(body.email, undefined);
  assert.equal(body.firstName, undefined);
});

test("demo sequence rejects missing consent", async () => {
  const result = await handler(post({ email: "reader@example.com", consent: false }));
  assert.equal(result.statusCode, 400);
});

test("demo sequence rejects invalid email", async () => {
  const result = await handler(post({ email: "not-an-email", consent: true }));
  assert.equal(result.statusCode, 400);
});
