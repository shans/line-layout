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
  }
  class RubyInlineLayout extends InlineLayout {
    segment(nodes, segments) {
      // TODO: This recursive call isn't ideal, needs review.
      if (nodes[0].parentElement.tagName.toLowerCase() != "ruby")
        return super.segment(nodes, segments);
      segments = segments || [];
      var pairs = RubyPair.fromChildNodes(nodes);
      for (var pair of pairs) {
        var start = segments.length;
        super.segment(pair.baseNodes, segments);
        var end = segments.length;

        var annotationSegments = super.segment([pair.annotationNode]);
        for (var annotationSegment of annotationSegments)
          annotationSegment.fontSize = 8;
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
