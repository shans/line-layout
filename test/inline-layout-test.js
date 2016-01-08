'use strict';
var assert = require("assert");
var LineBreaker = require("../merged-model/line-breaker.js").LineBreaker;
var LineBuilder = require("../merged-model/line-builder.js").LineBuilder;
var InlineLayout = require("../merged-model/inline-layout.js").InlineLayout;
var InlineSegment = require("../merged-model/inline-layout.js").InlineSegment;

describe("MergedInlineLayout", function () {
  describe("segmentString", function () {
    [
      [[""], []],
      [["a"], [
        { text: "a", breakAfter: null }]],
      [["ab"], [
        { text: "ab", breakAfter: null }]],
      [["ab", "c"], [
        { text: "ab", breakAfter: null },
        { text: "c", breakAfter: null }]],
      [["a b"], [
        { text: "a", breakAfter: "space" },
        { text: "b", breakAfter: null }]],
      [["ab "], [
        { text: "ab", breakAfter: null }]],
      [["ab ", "c"], [
        { text: "ab", breakAfter: "space" },
        { text: "c", breakAfter: null }]],
      [["ab", " c"], [
        { text: "ab", breakAfter: "space" },
        { text: "c", breakAfter: null }]],
      [["ab ", " c"], [
        { text: "ab", breakAfter: "space" },
        { text: "c", breakAfter: null }]],
      [["ああ"], [
        { text: "あ", breakAfter: "nospace" },
        { text: "あ", breakAfter: null }]],
      [["あ。あ"], [
        { text: "あ。", breakAfter: "nospace" },
        { text: "あ", breakAfter: null }]],
    ].forEach(function (arg) {
      it(arg[0], function () {
        var layout = new InlineLayout(new LineBreaker);
        var actual = [];
        for (var str of arg[0])
          layout._segmentString(str, actual);
        assert.deepEqual(actual, arg[1]);
      });
    });
  });

  describe("flow", function () {
    [
      [[{ width: 100 }],
        [[{ width: 100, left: 0, top: 0}]]],
      [[{ width: 100, breakAfter: "space" }, { width: 300, breakAfter: "space" }, { width: 100, breakAfter: "space"}],
        [
          [{ width: 100, left: 0, top: 0, breakAfter: "space" }, { width: 300, left: 110, top: 0, breakAfter: "space" }],
          [{ width: 100, left: 0, top: 0, breakAfter: "space" }]]],
      [[{ width: 100, breakAfter: "space" }, { width: 300 }, { width: 100, breakAfter: "space"}],
        [
          [{ width: 100, left: 0, top: 0, breakAfter: "space" }],
          [{ width: 300, left: 0, top: 0 }, { width: 100, left: 300, top: 0, breakAfter: "space" }]]],
      [[{ width: 100, breakAfter: "nospace" }, { width: 300, breakAfter: "nospace" }, { width: 150, breakAfter: "nospace"}],
        [
          [{ width: 100, left: 0, top: 0, breakAfter: "nospace" }, { width: 300, left: 100, top: 0, breakAfter: "nospace" }],
          [{ width: 150, left: 0, top: 0, breakAfter: "nospace" }]]],
    ].forEach(function (arg) {
      it(arg[0].map(a => a.width + "/" + a.breakAfter), function () {
        var layout = new InlineLayout(new LineBreaker);
        var context = new LineBuilder(500);
        var actual = layout.flow(arg[0], context);
        var lastLine = context.commitForcedBreak();
        if (lastLine.length)
          actual.push(lastLine);
        assert.deepEqual(actual, arg[1]);
      });
    });
  });
});
