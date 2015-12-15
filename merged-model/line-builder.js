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

    addOutOfFlow(segment, x, y) {
      this.segments.push(segment);
      segment.left = x;
      segment.top = y;
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
})(this);
