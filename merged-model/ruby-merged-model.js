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
        var baseBeginIndex = segments.length;
        Array.prototype.push.apply(segments, baseSegments);
        var baseEndIndex = segments.length;
        var baseCount = baseEndIndex - baseBeginIndex;
        segments[baseBeginIndex].rubyData = new RubyData(baseCount, annotationSegments);
        segments[baseEndIndex - 1].isLastRubyBase = true;
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
        var overhang = (annotationWidth - baseWidth) / 2;
        var lineCountBeforeFlow = lines.length;

        var firstSegmentIndex = context.segments.length;
        for (var i = 0; i < baseSegments.length; i++) {
          var base = baseSegments[i];
          var x = 0;
          if (overhang > 0) {
            if (i == 0) {
              // Ruby can overhang to the last segment if the last segment is not ruby.
              // TODO: Computing the max overhang NYI.
              var last = context.lastSegment;
              if (!last || last.isLastRubyBase)
                x = overhang;
            }
            if (i == baseSegments.length - 1) {
              // Ruby can overhang to the next segment if the next segment is not ruby,
              // but it's known only after the next segment is available.
              // TODO: Computing the max overhang NYI.
              base.width += overhang;
              base.onNextSegment = function (next) {
                if (next && !next.rubyData)
                  base.width -= overhang;
              };
            }
          }

          if (context.add(base, x))
            continue;
          lines.push(context.commit());
          context.add(base, x);
        }

        // Flow annotations as out-of-flow.
        // TODO: This code needs more cleanup.
        var lineCount = lines.length;
        if (lineCountBeforeFlow === lineCount
          || firstSegmentIndex >= lines[lineCountBeforeFlow].length) {
          // No breaks within the ruby segment.
          var firstBase = baseSegments[0];
          var x = 0;
          x -= overhang;
          for (var annotationSegment of annotationSegments) {
            firstBase.addOutOfFlow(annotationSegment, x, -6);
            x += annotationSegment.width;
          }
        } else {
          // There are breaks within the ruby segment.
          var flowedLines = [];
          flowedLines.push({ segments: lines[lineCountBeforeFlow], index: firstSegmentIndex });
          for (var i = lineCountBeforeFlow + 1; i < lineCount; i++)
            flowedLines.push({ segments: lines[i], index: 0 });
          if (context.segments.length > 0)
            flowedLines.push({ segments: context.segments, index: 0 });

          // Compute the total width of ruby in each line.
          flowedLines = flowedLines.map(l => {
            var width = 0;
            for (var i = l.index; i < l.segments.length; i++)
              width += l.segments[i].width;
            l.width = width;
            return l;
          });

          // TODO: better to distribute rubies among lines according to width
          // than fit as much as possible and flow to the next line.

          // Flow ruby annotation segments into each line.
          for (var l = 0; l < flowedLines.length; l++) {
            var line = flowedLines[l];
            var firstBase = line.segments[line.index];
            var x = 0;
            if (l == 0)
              x -= overhang; // TODO: need review, not sure how right this is.
            var annotationWidth = 0;
            for (var i = 0; ; i++) {
              if (i >= annotationSegments.length) {
                annotationSegments = [];
                break;
              }
              var s = annotationSegments[i];
              if (l + 1 < flowedLines.length && x + s.width > line.width) {
                annotationSegments = annotationSegments.slice(i);
                break;
              }
              firstBase.addOutOfFlow(s, x, -6);
              x += s.width;
              annotationWidth += s.width;
            }
            if (!annotationSegments.length)
              break;
          }
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
