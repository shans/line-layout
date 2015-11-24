# line-model

A line layout API that provides a line model. Text is flowed into the line, which returns any remainders that won't fit.

## registering for layout

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
  void onCommit(Line line);
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
  
  onCommit(line) {
    // perform post-flow line position and size
    // fixups. This is optional!
  }
}, { inputProperties: [ /* list of properties that you need to read in order to
                           correctly compute inline layout */ ] }
);
```

  
