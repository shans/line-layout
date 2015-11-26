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
}

interface InlineLayoutGlobalContext : WorkletGlobalContext {
  void registerInlineLayout(DOMString name, VoidFunction 
    inlineLayoutCtor, InlineLayoutDescriptor config);
  void unregisterInlineLayout(DOMString name);
}

MinMaxWidth {
  attribute number minWidth;
  attribute number preferredWidth;
  attribute number maxWidth;
}

// non-normative: this is what the VoidFunction should look like (ES6 classes haven't
// reached IDL yet, so this is the best we can do for now).
callback interface InlineLayoutClass {
  Geometry layout(Line line, sequence<InlineReference> content);
  MinMaxWidth? minMaxWidth(sequence<InlineReference> content);
  void onTerminate(Line line);
}
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

  
