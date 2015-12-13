'use strict';
var assert = require("assert");
var LineBreaker = require("../common/line-breaker.js").LineBreaker;

describe("LineBreaker", function () {

  function testBetweenTwoCharacters(func) {
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
      var ch1 = arg[0];
      var ch2 = arg[1];
      var expected = arg[2];
      var actual = func(ch1, ch2);
      it(ch1 + " + " + ch2
        + " (U+" + ch1.charCodeAt(0).toString(16)
        + " + U+" + ch2.charCodeAt(0).toString(16)
        + ") => " + arg[2], function () {
          assert.equal(actual, expected);
        });
    });
  }

  describe("canBreakBetween", function () {
    testBetweenTwoCharacters(LineBreaker.canBreakBetween);
  });

  describe("canBreakBefore", function () {
    testBetweenTwoCharacters((ch1, ch2) => {
      var lineBreaker = new LineBreaker;
      lineBreaker.canBreakBefore(ch1);
      return lineBreaker.canBreakBefore(ch2);
    });
  });
});
