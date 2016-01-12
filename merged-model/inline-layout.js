'use strict';

(function (exports) {
  var tagToInlineLayout = {};

  exports.InlineLayout =
  class InlineLayout {
    constructor(lineBreaker) {
      this.lineBreaker = lineBreaker || new LineBreaker;
    }

    static get default() {
      if (!InlineLayout._default)
        InlineLayout._default = new InlineLayout;
      return InlineLayout._default;
    }

    layout(source, target) {
      var segments = this.segment(source);

      this.measure(segments);

      var targetStyle = getComputedStyle(target);
      var maxWidth = parseFloat(targetStyle.width);
      var context = new LineBuilder(maxWidth);
      var lines = this.flow(segments, context);
      var lastLine = context.commitForcedBreak();
      if (lastLine.segments.length)
        lines.push(lastLine);

      this.adjust(segments);

      this._appendLines(target, lines);
    }

    static register(tagName, layout) {
      tagToInlineLayout[tagName] = layout;
    }

    segment(node, segments) {
      segments = segments || [];
      switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        this._segmentElement(node, segments);
        break;
      case Node.TEXT_NODE:
        var i = segments.length;
        this._segmentString(node.nodeValue, segments);
        var parentElement = node.parentElement;
        for (; i < segments.length; i++)
          segments[i].element = parentElement;
        break;
      }
      return segments;
    }

    _segmentElement(element, segments) {
      var layout = tagToInlineLayout[element.tagName.toLowerCase()];
      if (layout) {
        layout.lineBreaker = this.lineBreaker;
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

    _segmentString(str, segments) {
      if (!str)
        return segments;

      // If break before the first character,
      // add the break opportunity to the last segment.
      var lineBreaker = this.lineBreaker;
      for (var i = 0; i < str.length; i++) {
        var breakType = lineBreaker.breakBefore(str[i]);
        if (breakType) {
          console.assert(lineBreaker.lastSegment, "Break needed without lastSegment", i, str);
          lineBreaker.lastSegment.breakAfter = breakType;
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

        var end = lastSpacePosition > 0 ? lastSpacePosition : i;
        console.assert(end > begin);
        this._addTextSegment(str.substring(begin, end), breakType, segments);
        begin = i;
        lastSpacePosition = -1;
      }

      if (i > begin) {
        var end = lastSpacePosition > 0 ? lastSpacePosition : i;
        console.assert(end > begin);
        this._addTextSegment(str.substring(begin, end), null, segments);
      }
      return segments;
    }

    _addTextSegment(text, breakAfter, segments) {
      var segment = new LineSegment(text, breakAfter);
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

    _appendLines(target, lines) {
      target.innerHTML = '';
      for (var line of lines) {
        var lineElement = document.createElement("div");
        lineElement.style.position = "relative";
        lineElement.style.height = "29px"; // TODO: line-height NYI
        for (var s of line.segments) {
          var element = segmentToElement(s);
          lineElement.appendChild(element);
          if (s.outOfFlowLines) {
            for (var oofLine of s.outOfFlowLines) {
              for (var oof of oofLine.segments) {
                oof.left += s.left + oofLine.left;
                oof.top += s.top + oofLine.top;
                var oofElement = segmentToElement(oof);
                lineElement.appendChild(oofElement);
              }
            }
          }
        }
        target.appendChild(lineElement);
      }
    }
  }

  // Naming avoids conflict with line-model for now to run both models in a page.
  class LineSegment {
    constructor(text, breakAfter) {
      this.text = text;
      this.breakAfter = breakAfter;
    }

    addOutOfFlow(line, x, y) {
      this.outOfFlowLines = this.outOfFlowLines || [];
      this.outOfFlowLines.push(line);
      line.left = x;
      line.top = y;
    }

    get style() {
      if (this.element)
        return getComputedStyle(this.element);
      return null;
    }

    static totalWidth(segments) {
      var width = 0;
      for (var s of segments)
        width += s.width;
      return width;
    }
  }
  exports.LineSegment = LineSegment;
})(this);
