'use strict';

(function (exports) {
  var tagToInlineLayout = {};

  exports.InlineLayout =
  class InlineLayout {
    constructor(lineBreaker) {
      this.lineBreaker = lineBreaker || new LineBreaker;
    }

    layout(source, target) {
      var segments = this.segment(source);

      this.measure(segments);

      var targetStyle = getComputedStyle(target);
      var maxWidth = parseFloat(targetStyle.width);
      var context = new LineBuilder(maxWidth);
      var lines = this.flow(segments, context);
      var lastLine = context.commitAll();
      if (lastLine.length)
        lines.push(lastLine);

      this.adjust(segments);

      target.innerHTML = '';
      for (var line of lines) {
        var lineElement = document.createElement("div");
        lineElement.style.position = "relative";
        lineElement.style.height = "29px"; // TODO: line-height NYI
        for (var s of line) {
          lineElement.appendChild(segmentToElement(s));
        }
        target.appendChild(lineElement);
      }
    }

    static register(tagName, layout) {
      tagToInlineLayout[tagName] = layout;
    }

    segment(node, segments) {
      segments = segments || [];
      switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        this.segmentElement(node, segments);
        break;
      case Node.TEXT_NODE:
        this.segmentString(node.nodeValue, segments);
        break;
      }
      return segments;
    }

    segmentElement(element, segments) {
      var layout = tagToInlineLayout[element.tagName.toLowerCase()];
      if (layout) {
        layout.lineBreaker = this.lineBreaker;
        layout.parentLayout = this;
        segments.push({
          layout: layout,
          segments: layout.segment(element),
        });
      } else {
        var childNodes = element.childNodes;
        for (var i = 0; i < childNodes.length; i++)
          this.segment(childNodes[i], segments);
      }
      return segments;
    }

    segmentString(str, segments) {
      segments = segments || [];
      if (!str)
        return segments;
      var lineBreaker = this.lineBreaker;
      for (var i = 0; i < str.length; i++) {
        var breakType = lineBreaker.breakBefore(str[i]);
        if (breakType) {
          if (lineBreaker.lastSegment)
            lineBreaker.lastSegment.breakAfter = breakType;
          else
            console.warn("Break needed without lastSegment");
          break;
        }
        if (!lineBreaker.isAtWordSeparator)
          break;
      }
      if (i >= str.length)
        return segments;

      var lastSpacePosition = -1;
      for (var begin = i++; i < str.length; i++) {
        var breakType = lineBreaker.breakBefore(str[i]);
        if (!breakType) {
          if (!lineBreaker.isAtWordSeparator)
            lastSpacePosition = -1;
          else if (lastSpacePosition < 0)
            lastSpacePosition = i;
          continue;
        }
        if (lastSpacePosition > 0) {
          console.assert(lastSpacePosition > begin);
          this.addTextSegment(str.substring(begin, lastSpacePosition), breakType, segments);
        } else {
          console.assert(i > begin);
          this.addTextSegment(str.substring(begin, i), breakType, segments);
        }
        begin = i;
        lastSpacePosition = -1;
      }

      if (i > begin) {
        if (lastSpacePosition > 0) {
          i = lastSpacePosition;
          console.assert(i > begin);
        }
        this.addTextSegment(str.substring(begin, i), null, segments);
      }
      return segments;
    }

    addTextSegment(text, breakAfter, segments) {
      var segment = {
        text: text,
        breakAfter: breakAfter,
      };
      segments.push(segment);
      this.lineBreaker.lastSegment = segment;
    }

    measure(segments) {
      for (var s of segments) {
        if (s.layout) {
          s.layout.measure(s.segments);
          continue;
        }
        var rects = measureText(s.text, s.fontSize);
        console.assert(rects.length == 1);
        s.width = rects[0].width;
        s.height = rects[0].height;
      }
    }

    flow(segments, context, lines) {
      lines = lines || [];
      for (var i = 0; i < segments.length; i++) {
        var s = segments[i];
        if (s.layout) {
          s.layout.flow(s.segments, context, lines);
          continue;
        }
        if (context.add(s))
          continue;
        lines.push(context.commit());
        context.add(s);
      }
      return lines;
    }

    adjust(segments) {
    }
  }
})(this);
