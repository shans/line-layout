'use strict';

(function (exports) {
  class RubyInlineLayout extends InlineLayout {
    segment(nodes, segments) {
      segments = segments || [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeType != Node.ELEMENT_NODE) {
          super.segment([node], segments);
          continue;
        }
        switch (node.tagName.toLowerCase()) {
          case "rt":
          case "rtc":
          case "rp":
            break;
          default:
            super.segment([node], segments);
            break;
        }
      }
      return segments;
    }
  }

  InlineLayout.register("ruby", new RubyInlineLayout);
})(this);
