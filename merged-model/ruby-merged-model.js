'use strict';

(function (exports) {
  // RubyPair analyzes descendants of <ruby> in DOM to pair bases and annotations.
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

  // RubyData manages relationship of base segments and annotation segments.
  class RubyData {
    constructor(baseCount, annotationSegments) {
      console.assert(baseCount > 0);
      console.assert(annotationSegments.length > 0);
      this.baseCount = baseCount;
      this.annotationSegments = annotationSegments;
    }

    static set(segments, baseStartIndex, annotationSegments) {
      // Store Ruby annotation segments and related information
      // as a property of the first base segment.
      var baseEndIndex = segments.length;
      var baseCount = baseEndIndex - baseStartIndex;
      segments[baseStartIndex].rubyData = new RubyData(baseCount, annotationSegments);
      segments[baseEndIndex - 1].isLastRubyBase = true;
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
      for (var pair of RubyPair.fromChildNodes(nodes)) {
        var baseStartIndex = segments.length;
        this._segmentBase(pair, segments);
        var annotationSegments = this._segmentAnnotation(pair);
        RubyData.set(segments, baseStartIndex, annotationSegments);
      }
      return segments;
    }

    _segmentBase(pair, segments) {
      var layout = InlineLayout.default;
      // Base is in-flow, continue the current line breaking context,
      // and the following element continues after the base.
      var savedLineBreaker = layout.lineBreaker;
      layout.lineBreaker = this.lineBreaker;
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
      // Total width and overhang are computed in flow().
      // That means the actual width can change during flow().
      for (var rubyData of RubyData.getList(segments))
        super.measure(rubyData.annotationSegments);
    }

    flow(segments, context, lines) {
      lines = lines || [];
      for (var rubyData of RubyData.getList(segments)) {
        var baseSegments = rubyData.baseSegments;
        var annotationSegments = rubyData.annotationSegments;
        var baseWidth = LineSegment.totalWidth(baseSegments);
        var annotationWidth = LineSegment.totalWidth(annotationSegments);

        // Compute left/right margins and overhang.
        var baseMargin = (annotationWidth - baseWidth) / 2;
        if (baseMargin > 0)
          this._computeBaseMargins(baseSegments, context, baseMargin);

        // Flow bases.
        var lineCountBeforeFlow = lines.length;
        var firstSegmentIndex = context.segments.length;
        for (var base of baseSegments) {
          var x = base._offset;
          if (context.add(base, x))
            continue;
          lines.push(context.commit());
          context.add(base, x);
        }

        // Flow annotations as out-of-flow.
        if (lineCountBeforeFlow === lines.length
          || firstSegmentIndex >= lines[lineCountBeforeFlow].length) {
          // No breaks within the ruby segment.
          // Associate all annotations to the base.
          this._flowAnnotations(baseSegments, annotationSegments, baseMargin);
        } else {
          // There are breaks within the ruby segment.
          // Distribute annotations to multiple base lines.
          var baseLines = lines.slice(lineCountBeforeFlow);
          baseLines[0] = baseLines[0].slice(firstSegmentIndex);
          if (context.segments.length > 0)
            baseLines.push(context.segments);
          this._flowAnnotationsToLines(baseLines, annotationSegments, baseMargin);
        }
      }
      return lines;
    }

    _computeBaseMargins(baseSegments, context, baseMargin) {
      // Ruby can overhang to the last segment if the last segment is not ruby.
      var first = baseSegments[0];
      var last = context.lastSegment;
      if (!last || last.isLastRubyBase)
        first._offset = baseMargin;
      else
        first._offset = Math.max(0, baseMargin - parseFloat(last.style.fontSize) / 3);

      // Ruby can overhang to the next segment if the next segment is not ruby,
      // but it's known only after the next segment is available.
      var last = baseSegments[baseSegments.length - 1];
      last.width += baseMargin;
      last.onNextSegment = function (next) {
        if (next && !next.rubyData)
          last.width -= Math.min(baseMargin, parseFloat(next.style.fontSize) / 3);
      };
    }

    _flowAnnotations(baseSegments, annotationSegments, baseMargin) {
      var annotationLine = new LineBuilder;
      annotationLine.x -= baseMargin;
      for (var annotationSegment of annotationSegments)
        annotationLine.add(annotationSegment);
      this._addAnnotationLine(baseSegments, annotationLine);
    }

    _addAnnotationLine(baseSegments, annotationLine) {
      var firstBase = baseSegments[0];
      for (var s of annotationLine.commitForcedBreak())
        firstBase.addOutOfFlow(s, s.left, -6);
    }

    _flowAnnotationsToLines(baseLines, annotationSegments, baseMargin) {
      // TODO: better to distribute rubies among lines according to width
      // than fit as much as possible and flow to the next line.
      var firstLine = baseLines[0];
      var lastLine = baseLines[baseLines.length - 1];
      for (var line of baseLines) {
        // Flow annotations up to the width of the base.
        var annotationLine = new LineBuilder;
        if (line === firstLine)
          annotationLine.x -= baseMargin;
        if (line !== lastLine)
          annotationLine.maxWidth = LineSegment.totalWidth(line);
          // TODO: should incorporate width up to the right margin.
        for (var i = 0; i < annotationSegments.length; i++) {
          var s = annotationSegments[i];
          if (!annotationLine.add(s)) {
            annotationSegments = annotationSegments.slice(i);
            break;
          }
        }
        this._addAnnotationLine(line, annotationLine);
        if (!annotationSegments.length)
          break;
      }
    }
  }

  InlineLayout.register("ruby", new RubyInlineLayout);
})(this);
