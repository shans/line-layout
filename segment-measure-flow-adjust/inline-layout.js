'use strict';

(function (exports) {
  exports.InlineLayout = class InlineLayout {
    constructor(lineBreaker) {
      this.lineBreaker = lineBreaker || new LineBreaker;
    }

    segment(nodes, segments) {
      segments = segments || [];
      for (var node of nodes) {
        switch (node.nodeType) {
        case Node.TEXT:
          this.segmentString(node.nodeValue, segments);
          break;
        case Node.ELEMENT_NODE:
          this.segment(node.childNodes, segments);
          break;
        }
      }
      return segments;
    }

    segmentString(str, segments) {
      segments = segments || [];
      if (!str)
        return segments;
      for (var i = 0; i < str.length; i++) {
        if (str[i] != ' ')
          break;
        this.lineBreaker.breakBefore(str[i]);
      }
      if (i >= str.length)
        return segments;

      var breakType = this.lineBreaker.breakBefore(str[i]);
      if (breakType && segments.length > 0)
        segments[segments.length - 1].breakAfter = breakType;

      var lastSpacePosition = -1;
      for (var begin = i++; i < str.length; i++) {
        breakType = this.lineBreaker.breakBefore(str[i]);
        if (!breakType) {
          if (str[i] != ' ')
            lastSpacePosition = -1;
          else if (lastSpacePosition < 0)
            lastSpacePosition = i;
          continue;
        }
        if (lastSpacePosition > 0) {
          console.assert(lastSpacePosition > begin);
          segments.push({
            text: str.substring(begin, lastSpacePosition),
            breakAfter: breakType,
          });
        } else {
          console.assert(i > begin);
          segments.push({
            text: str.substring(begin, i),
            breakAfter: breakType,
          });
        }
        begin = i;
        lastSpacePosition = -1;
      }

      if (i > begin) {
        if (lastSpacePosition > 0) {
          i = lastSpacePosition;
          console.assert(i > begin);
        }
        segments.push({
          text: str.substring(begin, i),
          breakAfter: null,
        });
      }
      return segments;
    }

    measure(segments) {
      for (var s of segments) {
        var rects = measureText(s.text, s.fontSize);
        console.assert(rects.length == 1);
        s.width = rects[0].width;
        s.height = rects[0].height;
      }
    }
  }
})(this);
