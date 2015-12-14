'use strict';

(function (exports) {
  exports.InlineLayout = class InlineLayout {
    constructor(lineBreaker) {
      this.lineBreaker = lineBreaker || new LineBreaker;
    }

    layout(source, target) {
      var content = source.childNodes;
      var segments = this.segment(content);
      this.measure(segments);

      var targetStyle = getComputedStyle(target);
      var maxWidth = parseFloat(targetStyle.width);
      var lines = this.flow(segments, maxWidth);
      this.adjust(segments);

      InlineLayout.linesToElements(lines, target);
    }

    static linesToElements(lines, target) {
      target.innerHTML = '';
      for (var line of lines) {
        var lineElement = document.createElement("div");
        lineElement.style.position = "relative";
        lineElement.style.height = "20px"; // TODO: line-height NYI
        for (var s of line) {
          lineElement.appendChild(segmentToElement(s));
        }
        target.appendChild(lineElement);
      }
    }

    segment(nodes, segments) {
      segments = segments || [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        switch (node.nodeType) {
        case Node.TEXT_NODE:
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
        var breakType = this.lineBreaker.breakBefore(str[i]);
        if (breakType) {
          if (segments.length > 0)
            segments[segments.length - 1].breakAfter = breakType;
          break;
        }
        if (!this.lineBreaker.isAtWordSeparator)
          break;
      }
      if (i >= str.length)
        return segments;

      var lastSpacePosition = -1;
      for (var begin = i++; i < str.length; i++) {
        var breakType = this.lineBreaker.breakBefore(str[i]);
        if (!breakType) {
          if (!this.lineBreaker.isAtWordSeparator)
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

    flow(segments, maxWidth) {
      var lines = [];
      var x = 0;
      var lineStartIndex = 0;
      var lastBreakAfterIndex = -1;
      for (var i = 0; i < segments.length; i++) {
        var s = segments[i];
        if (x + s.width > maxWidth) {
          if (lastBreakAfterIndex < 0) {
            // TODO: NYI: overflow
            lastBreakAfterIndex = i;
          }
          lines.push(segments.slice(lineStartIndex, lastBreakAfterIndex + 1));
          i = lastBreakAfterIndex;
          lineStartIndex = i + 1;
          x = 0;
          continue;
        }
        if (s.breakAfter)
          lastBreakAfterIndex = i;

        s.left = x;
        s.top = 0;
        x += s.width;
        if (s.breakAfter === "space")
          x += 12;//this.wordSpace; // TODO: NYI
      }
      if (i > lineStartIndex)
        lines.push(segments.slice(lineStartIndex, i));
      return lines;
    }

    adjust(segments) {
    }
  }
})(this);
