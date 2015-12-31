'use strict';

(function (exports) {
  class RubyPair {
    constructor(baseNodes) {
      this.baseNodes = baseNodes;
    }

    static fromChildNodes(nodes) {
      var pairs = [];
      var baseNodesWithoutRb = [];
      var annotationIndex = 0;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeType !== Node.ELEMENT_NODE) {
          baseNodesWithoutRb.push(node);
          continue;
        }
        switch (node.tagName.toLowerCase()) {
          case "rb":
            if (baseNodesWithoutRb.length) {
              pairs.push(new RubyPair(baseNodesWithoutRb));
              baseNodesWithoutRb = [];
            }
            pairs.push(new RubyPair([node]));
            break;
          case "rt":
            if (baseNodesWithoutRb.length) {
              pairs.push(new RubyPair(baseNodesWithoutRb));
              baseNodesWithoutRb = [];
            }
            var pair = pairs[annotationIndex++];
            pair.annotationNode = node;
            break;
          case "rtc":
            // TODO: NYI
          case "rp":
            break;
          default:
            baseNodesWithoutRb.push(node);
            break;
        }
      }
      return pairs;
    }

    baseSegments(layout) {
      var segments = [];
      for (var baseNode of this.baseNodes)
        layout.segment(baseNode, segments);
      return segments;
    }

    annotationSegments(layout) {
      // Annotations have its own line breaking context.
      var savedLineBreaker = layout.lineBreaker;
      layout.lineBreaker = new LineBreaker;
      var segments = layout.segment(this.annotationNode);
      layout.lineBreaker = savedLineBreaker;
      return segments;
    }
  }

  class RubyInlineLayout extends InlineLayout {
    segment(element, segments) {
      console.assert(element.tagName.toLowerCase() === "ruby");
      segments = segments || [];
      var nodes = element.childNodes;
      var pairs = RubyPair.fromChildNodes(nodes);
      for (var pair of pairs) {
        var baseSegments = pair.baseSegments(this.parentLayout);
        var annotationSegments = pair.annotationSegments(this.parentLayout);
        for (var annotationSegment of annotationSegments)
          annotationSegment.fontSize = 8;

        // Store Ruby annotation segments and related information
        // as a property of the base segment.
        var start = segments.length;
        Array.prototype.push.apply(segments, baseSegments);
        var end = segments.length;
        segments[start].annotation = {
          baseEnd: end,
          segments: annotationSegments,
        };
      }
      return segments;
    }

    measure(segments) {
      super.measure(segments);
      for (var segment of segments) {
        if (segment.annotation)
          super.measure(segment.annotation.segments);
      }
    }

    flow(segments, context, lines) {
      lines = lines || [];
      for (var i = 0; i < segments.length; ) {
        var segment = segments[i];
        if (!segment.annotation) {
          console.assert(false, "Non-ruby segments passed to RubyInlineLayout.flow");
          super.flow([segment], context, lines);
          i++;
          continue;
        }

        var endIndex = segment.annotation.baseEnd;
        var baseSegments = segments.slice(i, endIndex);
        var annotationSegments = segment.annotation.segments;
        var startSegment = baseSegments[0];
        for (var base of baseSegments) {
          if (context.add(base))
            continue;

          // Break within a ruby segment.
          if (base !== startSegment) {
            // TODO: flowing some annotation is NYI.
            console.log("Break within a segment before " + base.text);
          }

          // Move to the next line.
          lines.push(context.commit());
          startSegment = base;
          context.add(base);
        }

        var x = startSegment.left;
        for (var annotationSegment of annotationSegments) {
          context.addOutOfFlow(annotationSegment, x, -6);
          x += annotationSegment.width;
        }

        i = endIndex;
      }
      return lines;
    }
  }

  InlineLayout.register("ruby", new RubyInlineLayout);
})(this);
