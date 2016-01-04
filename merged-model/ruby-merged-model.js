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

  class RubyData {
    constructor(baseCount, annotationSegments) {
      console.assert(baseCount > 0);
      console.assert(annotationSegments.length > 0);
      this.baseCount = baseCount;
      this.annotationSegments = annotationSegments;
    }

    static getList(segments) {
      var list = [];
      for (var baseStartIndex = 0; baseStartIndex < segments.length; ) {
        var rubyData = segments[baseStartIndex].rubyData;
        console.assert(rubyData, "Must be ruby segments");
        rubyData.baseSegments = segments.slice(baseStartIndex, baseStartIndex + rubyData.baseCount);
        list.push(rubyData);
        baseStartIndex += rubyData.baseCount;
      }
      return list;
    }
  }

  class RubyInlineLayout extends InlineLayout {
    segment(element, segments) {
      console.assert(element.tagName.toLowerCase() === "ruby");
      segments = segments || [];
      var nodes = element.childNodes;
      var pairs = RubyPair.fromChildNodes(nodes);
      for (var pair of pairs) {
        var baseSegments = this._segmentBase(pair);
        var annotationSegments = this._segmentAnnotation(pair);

        // Store Ruby annotation segments and related information
        // as a property of the first base segment.
        var begin = segments.length;
        Array.prototype.push.apply(segments, baseSegments);
        var baseCount = segments.length - begin;
        segments[begin].rubyData = new RubyData(baseCount, annotationSegments);
      }
      return segments;
    }

    _segmentBase(pair) {
      var layout = InlineLayout.default;
      // Base is in-flow, continue the current line breaking context,
      // and the following element continues after the base.
      var savedLineBreaker = layout.lineBreaker;
      layout.lineBreaker = this.lineBreaker;
      var segments = [];
      for (var baseNode of pair.baseNodes)
        layout.segment(baseNode, segments);
      return segments;
    }

    _segmentAnnotation(pair) {
      var layout = InlineLayout.default;
      // Annotation is out-of-flow,
      // it should use its own line breaking context.
      var savedLineBreaker = layout.lineBreaker;
      layout.lineBreaker = new LineBreaker;
      var segments = layout.segment(pair.annotationNode);
      for (var s of segments)
        s.fontSize = 8; // TODO: real fontSize NYI
      layout.lineBreaker = savedLineBreaker;
      return segments;
    }

    measure(segments) {
      // Measure base.
      super.measure(segments);

      // Measure annotations.
      for (var rubyData of RubyData.getList(segments)) {
        var baseSegments = rubyData.baseSegments;
        var annotationSegments = rubyData.annotationSegments;
        super.measure(annotationSegments);
        // Total width and overhang are done in flow().
        // That means the actual width can change during flow().
      }
    }

    flow(segments, context, lines) {
      lines = lines || [];
      for (var rubyData of RubyData.getList(segments)) {
        var baseSegments = rubyData.baseSegments;
        var annotationSegments = rubyData.annotationSegments;
        var baseWidth = totalWidth(baseSegments);
        var annotationWidth = totalWidth(annotationSegments);
        var overhang = annotationWidth - baseWidth;

        var beginSegmentInCurrentLine = baseSegments[0];
        for (var i = 0; i < baseSegments.length; i++) {
          var base = baseSegments[i];
          var x = 0;
          if (i == 0) {
            if (overhang > 0) {
              x = overhang / 2;
              base.width += x;
            }
          } else if (i == baseSegments.length - 1) {
            if (overhang > 0)
              base.width += overhang / 2;
          }

          if (context.add(base, x))
            continue;

          // Break within a ruby segment.
          if (base !== beginSegmentInCurrentLine) {
            // TODO: flowing some annotation is NYI.
            console.log("Break within a segment before " + base.text);
          }

          // Move to the next line.
          lines.push(context.commit());
          beginSegmentInCurrentLine = base;
          context.add(base, x);
        }

        // Flow annotations as out-of-flow.
        var x = beginSegmentInCurrentLine.left;
        x -= overhang / 2;
        for (var annotationSegment of annotationSegments) {
          context.addOutOfFlow(annotationSegment, x, -6);
          x += annotationSegment.width;
        }
      }
      return lines;
    }
  }

  function totalWidth(segments) {
    var width = 0;
    for (var s of segments)
      width += s.width;
    return width;
  }

  InlineLayout.register("ruby", new RubyInlineLayout);
})(this);
