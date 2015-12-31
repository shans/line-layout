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
      // TODO: should use a separate LineBreaker
      return layout.segment(this.annotationNode);
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
      for (var i = 0; i < segments.length; i++) {
        var segment = segments[i];
        if (!segment.annotation) {
          super.flow([segment], context, lines);
          continue;
        }
        super.flow(segments.slice(i, segment.annotation.baseEnd), context, lines);
        var x = segment.left;
        for (var annotationSegment of segment.annotation.segments) {
          context.addOutOfFlow(annotationSegment, x, -6);
          x += annotationSegment.width;
        }
        i = segment.annotation.baseEnd - 1;
      }
    }
  }

  InlineLayout.register("ruby", new RubyInlineLayout);
})(this);
