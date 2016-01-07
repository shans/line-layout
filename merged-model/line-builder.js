'use strict';

(function (exports) {
  exports.LineBuilder =
  class LineBuilder {
    constructor(maxWidth) {
      this.segments = [];
      this.x = 0;
      this.maxWidth = maxWidth;
      this.lastBreakAfterIndex = -1;
    }

    add(segment, x) {
      // TODO: NYI: overflow not supported
      x = x || 0;
      if (this.x + x + segment.width > this.maxWidth)
        return false;

      this.segments.push(segment);
      this.x += x;
      this._advance(segment);
      if (segment.breakAfter)
        this._onBreakAfter();
      return true;
    }

    _onBreakAfter() {
      var nextBreakAfterIndex = this.segments.length - 1;
      // Notify the next segment in the line has determined.
      var widthChanged = 0;
      for (var i = Math.max(this.lastBreakAfterIndex, 0); i < nextBreakAfterIndex; i++) {
        var s = this.segments[i];
        s.left += widthChanged;
        if (s.onNextSegment) {
          var widthBeforeEvent = s.width;
          s.onNextSegment(this.segments[i+1]);
          widthChanged += s.width - widthBeforeEvent;
        }
      }
      if (widthChanged) {
        this.segments[nextBreakAfterIndex].left += widthChanged;
        this.x += widthChanged;
      }
      this.lastBreakAfterIndex = nextBreakAfterIndex;
    }

    _advance(segment) {
      segment.left = this.x;
      segment.top = 0;
      this.x += segment.width;
      if (segment.breakAfter === "space")
        this.x += 10;//this.wordSpace; // TODO: NYI
    }

    // Returns the last in-flow segment.
    get lastSegment() {
      return this.segments.length
        ? this.segments[this.segments.length - 1]
        : null;
    }

    addOutOfFlow(segment, x, y) {
      // Associate out-of-flow segments with the last in-flow segment.
      var parent = this.lastSegment;
      console.assert(parent); // TODO: what to do if no last segment?
      parent.outOfFlowSegments = parent.outOfFlowSegments || [];
      parent.outOfFlowSegments.push(segment);
      segment.left = x;
      segment.top = y;
    }

    commit() {
      if (this.lastBreakAfterIndex == this.segments.length - 1)
        return this.commitForcedBreak();

      var segments = this.segments.splice(0, this.lastBreakAfterIndex + 1);
      this.x = 0;
      this.lastBreakAfterIndex = -1;
      for (var segment of this.segments)
        this._advance(segment);
      return segments;
    }

    commitForcedBreak() {
      var segments = this.segments;
      this.segments = [];
      this.x = 0;
      this.lastBreakAfterIndex = -1;
      return segments;
    }
  }
})(this);
