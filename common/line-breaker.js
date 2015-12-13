'use strict';

// Minimal line breaker for the test purpose.
(function (exports) {
  var ULineBreak = {
    BEGINNING_OF_LINE: 0,
    ALPHABETIC: 2,
    CLOSE_PUNCTUATION: 8,
    IDEOGRAPHIC: 14,
    OPEN_PUNCTUATION: 20,
    SPACE: 26,
  }

  var lineBreakMap = {};

  [
    // http://unicode.org/reports/tr14/#ID
    [ULineBreak.IDEOGRAPHIC, 0x2E80, 0x2FFF],
    [ULineBreak.IDEOGRAPHIC, 0x3040, 0x30FF],
    [ULineBreak.IDEOGRAPHIC, 0x3400, 0x9FFF],
    [ULineBreak.IDEOGRAPHIC, 0xFF01, 0xFF5A],
  ].forEach(arg => {
    for (let i = arg[1]; i <= arg[2]; i++)
      lineBreakMap[i] = arg[0];
  });

  [
    // <http://unicode.org/cldr/utility/list-unicodeset.jsp?a=[:lb=AL:]>
    [ULineBreak.SPACE, ' '],
    [ULineBreak.ALPHABETIC, '_@*\&#`\^<->~'],
    [ULineBreak.OPEN_PUNCTUATION, '([{'],
    [ULineBreak.CLOSE_PUNCTUATION, '})]'],
    // CJK symbols and punctuation
    [ULineBreak.OPEN_PUNCTUATION, '〝〈《「『【〔〖〘〚'],
    [ULineBreak.CLOSE_PUNCTUATION, '、。〞〟〉》」』】〕〗〙〛'],
    [ULineBreak.OPEN_PUNCTUATION, '（［｛｟｢'],
    [ULineBreak.CLOSE_PUNCTUATION, '，､．｡）］｝｠｣'],
  ].forEach(arg => {
    for (var i = 0; i < arg[1].length; i++)
      lineBreakMap[arg[1].charCodeAt(i)] = arg[0];
  });

  function lineBreakValue(ch) {
    var value = lineBreakMap[ch];
    if (value)
      return value;
    return ULineBreak.ALPHABETIC;
  }

  function breakBetweenLineBreakValues(value1, value2) {
    switch (value1) {
      case ULineBreak.BEGINNING_OF_LINE:
        return null;
      case ULineBreak.SPACE:
        return value2 != ULineBreak.SPACE ? "space" : null;
      case ULineBreak.OPEN_PUNCTUATION:
        return null;
      case ULineBreak.IDEOGRAPHIC:
        return value2 != ULineBreak.CLOSE_PUNCTUATION ? "nospace" : null;
      default:
        return value2 == ULineBreak.IDEOGRAPHIC ? "nospace" : null;
    }
  }

  exports.LineBreaker = class LineBreaker {
    constructor() {
      this._lastLineBreakValue = ULineBreak.BEGINNING_OF_LINE;
    }

    // Add `ch` to the current line breaking context, and returns whether a
    // break opportunity exists before `ch`.
    breakBefore(ch) {
      var value = lineBreakValue(ch.charCodeAt(0));
      var breakBefore = breakBetweenLineBreakValues(this._lastLineBreakValue, value);
      this._lastLineBreakValue = value;
      return breakBefore;
    }

    canBreakBefore(ch) {
      return this.breakBefore(ch) != null;
    }

    // Returns whether a break opportunity exists between `ch1` and `ch2`. This
    // function is convenient, but please keep in mind that ICU often requires
    // more context than two characters that relying on this function too much
    // may make the architecture harder to implement.
    static canBreakBetween(ch1, ch2) {
      return breakBetweenLineBreakValues(lineBreakValue(ch1.charCodeAt(0)), lineBreakValue(ch2.charCodeAt(0))) != null;
    }
  }
})(this);
