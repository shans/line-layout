'use strict';

(function (exports) {
  var tagToInlineLayout = {};

  class LineContext {
    constructor(maxWidth) {
      this.segments = [];
      this.x = 0;
      this.maxWidth = maxWidth;
      this.lastBreakAfterIndex = -1;
    }

    add(segment) {
      // TODO: NYI: overflow not supported
      if (this.x + segment.width > this.maxWidth)
        return false;

      if (segment.breakAfter)
        this.lastBreakAfterIndex = this.segments.length;
      this.segments.push(segment);
      this.advance(segment);
      return true;
    }

    commitAll() {
      var segments = this.segments;
      this.segments = [];
      this.x = 0;
      this.lastBreakAfterIndex = -1;
      return segments;
    }

    commit() {
      if (this.lastBreakAfterIndex == this.segments.length - 1)
        return this.commitAll();

      var segments = this.segments.splice(0, this.lastBreakAfterIndex + 1);
      this.x = 0;
      this.lastBreakAfterIndex = -1;
      for (var segment of this.segments)
        this.advance(segment);
      return segments;
    }

    advance(segment) {
      segment.left = this.x;
      segment.top = 0;
      this.x += segment.width;
      if (segment.breakAfter === "space")
        this.x += 10;//this.wordSpace; // TODO: NYI
    }
  }
  exports.LineContext = LineContext;

  class InlineLayout {
    constructor(lineBreaker) {
      this.lineBreaker = lineBreaker || new LineBreaker;
    }

    layout(source, target) {
      var content = source.childNodes;
      var segments = this.segment(content);

      this.measure(segments);

      var targetStyle = getComputedStyle(target);
      var maxWidth = parseFloat(targetStyle.width);
      var context = new LineContext(maxWidth);
      var lines = this.flow(segments, context);
      var lastLine = context.commitAll();
      if (lastLine.length)
        lines.push(lastLine);

      this.adjust(segments);

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

    static register(tagName, layout) {
      tagToInlineLayout[tagName] = layout;
    }

    segment(nodes, segments) {
      segments = segments || [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          this.segmentElement(node, segments);
          break;
        case Node.TEXT_NODE:
          this.segmentString(node.nodeValue, segments);
          break;
        }
      }
      return segments;
    }

    segmentElement(element, segments) {
      var layout = tagToInlineLayout[element.tagName.toLowerCase()];
      if (!layout)
        return this.segment(element.childNodes, segments);
      layout.lineBreaker = this.lineBreaker;
      segments.push({
        layout: layout,
        segments: layout.segment(element.childNodes),
      });
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
  exports.InlineLayout = InlineLayout;
})(this);
