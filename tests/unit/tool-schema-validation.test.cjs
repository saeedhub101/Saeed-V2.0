"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateToolArguments } = require("../../src/tools/registry");

const schema = {
  type: "object",
  properties: {
    intent: { type: "string", minLength: 1 },
    duration: { type: "number", minimum: 0, maximum: 10 },
    note: { type: ["string", "null"] }
  },
  required: ["intent"],
  additionalProperties: false
};

test("accepts valid arguments within declared schema", () => {
  assert.equal(validateToolArguments({ intent: "wave", duration: 2, note: null }, schema, "motion"), null);
});

test("rejects unexpected fields when additionalProperties is false", () => {
  assert.match(validateToolArguments({ intent: "wave", admin: true }, schema, "motion"), /unexpected field "admin"/);
});

test("rejects null or arrays when the root schema requires an object", () => {
  assert.match(validateToolArguments(null, schema, "motion"), /must be object/);
  assert.match(validateToolArguments([], schema, "motion"), /must be object/);
});

test("enforces required fields while permitting explicit null for a nullable property", () => {
  assert.equal(validateToolArguments({ intent: "wave", note: null }, schema, "motion"), null);
  assert.match(validateToolArguments({ intent: null }, schema, "motion"), /must be string/);
  assert.match(validateToolArguments({ duration: 2 }, schema, "motion"), /missing required field "intent"/);
});

test("enforces numeric bounds and string length", () => {
  assert.match(validateToolArguments({ intent: "wave", duration: -1 }, schema, "motion"), /must be at least 0/);
  assert.match(validateToolArguments({ intent: "wave", duration: 11 }, schema, "motion"), /must be at most 10/);
  assert.match(validateToolArguments({ intent: "" }, schema, "motion"), /is too short/);
});

test("supports allOf, anyOf, oneOf, and not schema composition", () => {
  assert.equal(validateToolArguments({value: 3}, {type:"object",allOf:[{required:["value"]},{properties:{value:{type:"number",minimum:1}}}],properties:{value:{type:"number"}}}, "composed"), null);
  assert.equal(validateToolArguments({value:"ok"}, {type:"object",properties:{value:{anyOf:[{type:"string"},{type:"number"}]}}}, "anyOf"), null);
  assert.match(validateToolArguments({value:true}, {type:"object",properties:{value:{anyOf:[{type:"string"},{type:"number"}]}}}, "anyOf"), /does not match any allowed schema/);
  assert.equal(validateToolArguments({value:"text"}, {type:"object",properties:{value:{oneOf:[{type:"string"},{type:"number"}]}}}, "oneOf"), null);
  assert.match(validateToolArguments({value:1}, {type:"object",properties:{value:{oneOf:[{type:"number"},{minimum:0}]}}}, "oneOf"), /match exactly one/);
  assert.match(validateToolArguments({value:"blocked"}, {type:"object",properties:{value:{not:{type:"string"}}}}, "not"), /forbidden schema/);
});
