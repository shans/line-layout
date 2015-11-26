# line-model

A line layout API that provides a line model. Text is flowed into the line, which returns any remainders that won't fit.
The line model attempts to hide most of the complexity of segmentation, measurement, word fragmentation, word wrap and overflow
from implementors of custom layouts.

## registering for layout

Layout is controlled via InlineLayout classes, which provide layout, minMaxWidth, and onTerminate methods. You need to 
create one of these classes in order to provide custom layout behaviour.

As a Houdini API, these would be defined, registered and run in a Worklet (i.e. a synchronous isolated scope), however
the polyfill provides registerInlineLayout directly on the window object.

At a high level, this API allows custom layouts to be tightly registered on just the spans of content that require custom
behavior. For example, a custom <inline-quote> element (or alternatively --inline-quote custom property - though this
requires CSS Properties & Values apply hooks) would do:

```
<style>
inline-quote {
  line-layout: inline-quote-class;
}
</style>
```

A brief overview of the methods on InlineLayout classes:
*   minMaxWidth() is used to determine the minimum, preferred and maximum widths for the content container's block layout.
*   layout() is given a line and the content, and flows the content onto the line. It's able to break and adjust lines as
    well as synthesize content.
*   onTerminate() allows lines to be fixed up as they're being laid out. This is important because end-of-line word fragments 
    might be overflowed to the next line after layout() has finished, and custom layouters need to be able to adjust lines that
    custom content is actually on.

IDL:
```
callback VoidFunction = void ();

dictionary InlineLayoutDescriptor {
  sequence<DOMString> inputProperties;
};

interface InlineLayoutGlobalContext : WorkletGlobalContext {
  void registerInlineLayout(DOMString name, VoidFunction 
    inlineLayoutCtor, InlineLayoutDescriptor config);
  void unregisterInlineLayout(DOMString name);
};

interface MinMaxWidth {
  attribute number minWidth;
  attribute number preferredWidth;
  attribute number maxWidth;
};

// non-normative: this is what the VoidFunction should look like (ES6 classes haven't
// reached IDL yet, so this is the best we can do for now).
callback interface InlineLayoutClass {
  Geometry layout(Line line, sequence<InlineReference> content);
  MinMaxWidth? minMaxWidth(sequence<InlineReference> content);
  void onTerminate(Line line);
};
```

typical usage:
```
registerInlineLayout("name-of-layouter", class {
  layout(line, content) {
    // flow content into lines
  }
  
  minMaxWidth(content) {
    // override default measure. This is optional!
  }
  
  onTerminate(line) {
    // perform post-flow line position and size
    // fixups. This is optional!
  }
}, { inputProperties: [ /* list of properties that you need to read in order to
                           correctly compute inline layout */ ] }
);
```
## InlineReference objects

IDL:
```
interface InlineReference {
  attribute StylePropertyMap style;
};

[Constructor(Node)]
interface NodeReference : InlineReference {
  readonly attribute Node node;
};

[Constructor(DOMString)]
interface TextReference : InlineReference {
  readonly attribute DOMString data;
};
```

InlineReferences provide a view on content that is in the DOM. Because InlineLayout classes will run in Worklets,
direct DOM access is not possible. Instead, InlineReferences attempt to provide a useful abstraction of DOM 
information.

The most important feature of InlineReferences is the style attribute on each one. This allows inline layouters to 
override the style of components of text - for example:

```
// bold second half of contained text
registerInlineLayout("bold-some", class {
  layout(line, content) {
    if (content.length !== 1 || content[0].data == undefined)
      return;
    var newContent = [];
    newContent.push(new TextReference(content[0].data.substring(0, content[0].data.length / 2)));
    newContent.push(new TextReference(content[0].data.substring(content[0].data.length / 2)));
    newContent[1].style.fontWeight = 'bold';
    function consumeData(line, data) {
      while (true) {
        newContent = line.consume(newContent);
        if (newContent == null)
          break;
        line = line.terminate();
      }
      return line;
    }
    line = consumeData(line, newContent[0]);
    line = consumeData(line, newContent[1]);
    return line;
  }
});
```

## Lines

IDL:
```
interface Line {
  readonly attribute ClientRect bounds;
  InlineReference consume((InlineReference or Segment or SegmentGroup) data);
  Line terminate();
  void adjustSize(ClientRect delta);
  void afjustPosition(Position delta);
};
```
TODO: Describe word fragments in some detail here. Recover details about how to flag the beginning and 
end of custom ranges as fragments.

## Segments and SegmentGroups

IDL:
```
[Constructor(Position, InlineReference),
 Constructor(ClientRect, InlineReference)]
interface Segment {
  attribute ClientRect bounds;
};

interface SegmentGroup {
  attribute ClientRect bounds;
  void appendChild((Segment or SegmentGroup) child);
};
```

Segments represent indivisible line fragments that will flow and wrap as a unit. SegmentGroups represent indivisible groups of placed
Segments and SegmentGroups. For example, a ruby annotation and its base text would be two Segments placed within a SegmentGroup.

If initialized with a Position, Segments will select bounds that tightly fit around the provided text.

## Required extensions to this API

* No facility is yet provided to perform non-standard segmentation. It's possible to implement this manually, but .. ugh.
* There's no mechanism provided to assess the result of standard segmentation, nor to look at bidi decisions.
* Nesting of custom tags (e.g. ruby inside ruby) needs to be more carefully considered.
* We need to work out the full set of baselines, etc. that should be provided by Line, Segment, and SegmentGroup.
* Utility methods to work with InlineReferences will make a lot of things easier.
* some sort of flow-into-lines method on line would make sense (returns the final line)
* should allow sequences of InlineReferences to be provided to line.consume.
* need to define (and implement) minMaxWidth properly
* need to define a way to communicate container size changes
* need to deal with logical units. Perhaps two types of bounds objects?
