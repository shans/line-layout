'use strict';

// Minimal line breaker for the test purpose.
(function (exports) {
  var ULineBreak = {
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

  function canBreakBetweenLineBreakValues(value1, value2) {
    switch (value1) {
      case ULineBreak.SPACE:
        return value2 != ULineBreak.SPACE;
      case ULineBreak.OPEN_PUNCTUATION:
        return false;
      case ULineBreak.IDEOGRAPHIC:
        return value2 != ULineBreak.CLOSE_PUNCTUATION;
      default:
        return value2 == ULineBreak.IDEOGRAPHIC;
    }
  }

  exports.LineBreaker = class LineBreaker {
    static canBreakBetween(ch1, ch2) {
      return canBreakBetweenLineBreakValues(lineBreakValue(ch1.charCodeAt(0)), lineBreakValue(ch2.charCodeAt(0)));
    }
  }
})(this);
