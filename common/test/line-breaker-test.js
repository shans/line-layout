'use strict';
var assert = require("assert");
var target = require("../line-breaker.js");

describe("LineBreaker", function () {
  describe("canBreakBetween", function () {
    var canBreakBetween = target.LineBreaker.canBreakBetween;

    [
      ['A', 'A', false],
      ['A', ' ', false],
      [' ', ' ', false],
      [' ', 'A', true],

      ['A', '.', false],
      ['A', ')', false],
      ['(', 'A', false],

      ['あ', 'あ', true],
      ['A', 'あ', true],
      ['あ', 'A', true],

      ['あ', '、', false],
      ['あ', '。', false],

      ['あ', '(', true],
      ['あ', ')', false],
      ['(', 'あ', false],
      [')', 'あ', true],

      ['あ', '（', true],
      ['あ', '）', false],
      ['（', 'あ', false],
      ['）', 'あ', true],
    ].forEach(function (arg) {
      it(arg[0] + " + " + arg[1]
        + " (U+" + arg[0].charCodeAt(0).toString(16)
        + " + U+" + arg[1].charCodeAt(0).toString(16)
        + ") => " + arg[2], function () {
        assert.equal(canBreakBetween(arg[0], arg[1]), arg[2]);
      });
    });
  });
});
