# segment-measure-flow-adjust

Multi-stage pipeline where each stage can be overridden. If a stage is not overridden the default implementation applies. 

Stages:
- segment: Segments content into fragments or words based on breaking opportunities.
- measure: Provides metrics (width, height, baselines) for each fragment.
- flow: Positions fragments and performs line breaking as needed.
- adjust: Final phase where the position of each fragment may be adjusted.


```
interface InlineReference {
  readonly attribute StylePropertyMapReadOnly style;
}
```

```
[Constructor(Node)]
interface NodeReference : InlineReference {
  readonly attribute Node node;
}
```

```
[Constructor(DOMString)]
interface TextReference : InlineReference {
  readonly attribute DOMString data;
}
```

```
[Constructor(InlineReference, number, InlineReference, number)]
interface OutOfDocumentRange {
  readonly attribute InlineReference startReference;
  readonly attribute number startOffset;
  readonly attribute InlineReference endReference;
  readonly attribute number endOffset;
}
```

```
enum BreakType = {
 	“between-word”,
    “element-boundary”,
    “hard”,
    ...
}
```

```
[Constructor(OutOfDocumentRange, BreakType = “between-word”)]
interface Segment {
readonly attribute OutOfDocumentRange range;
	readonly attribute BreakType breakType; // break *after*
	readonly attribute bool breakWithin;
	attribute StylePropertyMap overrideStyle;
	attribute ClientRect bounds; // Relative to containing object.
	something something baseline; // which baseline(s) need to be mutable?
}
```

```
sequence<Segment> segment(sequence<InlineReference> content);
void measure(sequence<Segment> content);
void flow(sequence<Segment> content);
Geometry adjust(sequence<Segment> content);
```

The following support methods would be available within the relevant worklet:
 
```
interface BreakOpportunity {
    readonly BreakType type
    readonly attribute OutOfDocumentRange range;
    readonly ClientRect boundsToBreak;
}
```

```
sequence<BreakOpportunity> findBreakingOpportunities(
    sequence<InlineReference> text, 
    sequence<BreakType>? = null);
```

```
sequence<Segment> measureText(
    sequence<InlineReference|Segment> text,
    number maxWidth = Infinity);
```
To implement custom-bold using this version of the API one would override the segment method to segment on <b> tags, in addition to regular word breaks. One would then override the measure method to inflate the widths for bold words (by setting the overrideStyle).

