'use strict';

(function (exports) {
  class RubyLayout {
    layout(line, data) {
      //console.log("layout: ", data);
      var pairs = this.pairsFromData(data);
      //console.log("pairs=", pairs);
      for (let pair of pairs) {
      // TODO: NYI: base can break if its whitespace property is set to breakable values.
      // Need to split data into multiple segments in that case.
      // TODO: Or does API do it? In that case, we need to combine multiple data to form a ruby pair.
        var base = new Segment({ x: 0, y: 0 },
           pair.base.data ? pair.base : { data: pair.base.textContent, style: {} });
        var group = new SegmentGroup(line, base.bounds);
        group.appendChild(base);

        var annotation = { data: pair.annotation.textContent, style: { fontSize: "50%" } };
        group.appendChild(new Segment({ x: 0, y: -9 }, annotation));

        if (line.consume(group) !== null) {
          console.log("terminate after " + base.data);
          line = line.terminate();
          line.consume(group);
        }
      }
      return line;
    }

    pairsFromData(data) {
      var lastNode = null;
      var bases = [];
      var annotations = [];
      for (var i = 0; i < data.length;) {
        // When it starts with a text node, concatenate them to build a base.
        // TODO: NYI to support multiple text nodes in a row.
        if (data[i].data) {
          bases.push(data[i]);
          i++;
          continue;
        }

        var node = data[i].node;
        console.assert(node && node.nodeType == Node.ELEMENT_NODE);
        //console.log(node);
        switch (node.tagName.toLowerCase()) {
          case "rb":
            bases.push(node);
            break;
          case "rt":
            annotations.push(node);
            break;
          case "rp":
            // TODO: NYI non-default (displayable) rp.
            break;
          default:
            // TODO: NYI to support "rtc".
            // TODO: NYI to support other inline elements.
            // TODO: NYI to support block elements -- not sure what to do.
            console.assert(false, "tag=" + node.tagName);
            break;
        }
        i = RubyLayout.skipDescendants(data, i + 1, node);
      }
      var pairs = [];
      for (var i = 0; i < bases.length; i++)
        pairs.push({ base: bases[i], annotation: annotations[i] });
      //console.log(bases, annotations, pairs);
      return pairs;
    }

    // TODO: API should provide node-like or TreeWalker-like. This should not belong to custom classes.
    static skipDescendants(data, i, parentNode) {
      for (; i < data.length;) {
        var node = data[i].node;
        if (!node) {
          // TODO: Should check parent of the text node, but it's not available in the current API.
          i++;
          continue;
        }
        console.assert(node && node.nodeType == Node.ELEMENT_NODE);
        if (node.parentNode != parentNode)
          return i;
        i = skipDescendants(data, i, node);
      }
    }

    onTerminate(line) {
      line.adjustSize({ width: 0, height: 8 });
      line.adjustPosition({ x: 0, y: 8 });
    }
  }

  registerInlineLayout('ruby', RubyLayout, {});
})(this);
