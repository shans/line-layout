'use strict';
var assert = require("assert");
var LineBuilder = require("../merged-model/line-builder.js").LineBuilder;

describe("LineBuilder", function () {
  it("All breakable", function () {
    var context = new LineBuilder(500);
    assert.equal(context.add({ width: 100, breakAfter: "nospace" }), true);
    assert.equal(context.add({ width: 300, breakAfter: "nospace" }), true);
    assert.equal(context.add({ width: 150, breakAfter: "nospace" }), false);
    assert.deepEqual(context.commit(), [
      { width: 100, breakAfter: "nospace", left: 0, top: 0 },
      { width: 300, breakAfter: "nospace", left: 100, top: 0 },
    ]);
    assert.deepEqual(context.commit(), []);
    assert.deepEqual(context.commitForcedBreak(), []);
  });

  it("Non-breakable", function () {
    var context = new LineBuilder(500);
    assert.equal(context.add({ width: 100, breakAfter: "nospace" }), true);
    assert.equal(context.add({ width: 300, breakAfter: null }), true);
    assert.equal(context.add({ width: 150, breakAfter: "nospace" }), false);
    assert.deepEqual(context.commit(), [
      { width: 100, breakAfter: "nospace", left: 0, top: 0 },
    ]);
    assert.deepEqual(context.commit(), []);
    assert.deepEqual(context.commitForcedBreak(), [
      { width: 300, breakAfter: null, left: 0, top: 0 },
    ]);
  });
});
