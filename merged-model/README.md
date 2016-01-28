# merged-model

The merged-model takes the best of both models;
the [line-model][] and the [phase-model][],
and add some changes
as we experiment prototype implementations.

## The `segment` Phase

For elements that have rather complex descendant DOM tree structure such as Ruby,
access to the original descendants DOM tree is desired.
Analyzing the inputs to the [line-model][] is complex
and is likely to cause errors.

The optional `segment` phase in the phase-model provides this capability.

## Inputs to `segment`: nodes or element?

The original `segment` takes `nodes` as the input argument.
It was not easy to support arbitrary list of nodes
in a custom `segment`.

We could simplify this
by restricting all the nodes must have the same parentNode,
but then it looks simpler to pass the element instead.

This model experiments to change to the custom element itself,
and let the custom `segment` to traverse childNodes as needed.

Doing so will require tree traversal methods to worklets,
but experiments indicate that it's necessary anyway.

## GetComputedStyle

Can we give an API for computed values?
Overhang needs the computed value of `fontSize`.

GetComputedStyle during other phases than `segment` is a little tricky,
because what these phases work on are segments, not nodes.
Segments need to know which element it comes from anyway,
it should not be an issue?

## `LineBreaker` and `LineBuilder`

To handle multiple custom layouts,
following data needed to be split out
from custom layout instances.

1. Break opportunities need to be determined across elements.
2. A line box needs to include segments from multiple elements.

For the latter, the line context in the [line-model][]
already gives a good model.
This model steals the line box context as
[`LineBuilder`](line-builder.js) class,
and add [`LineBreaker`](line-breaker.js) class
to the [phase-model][].

A separate line breaker also helps to handle out-of-flow items
that require independent line breaking context from the main flow.

## Calling default `segment` to segment descendants

When a custom layout segments its descendants,
`super.segment()` does not work well because
when the default `InlineLayout` calls its `segment` recursively,
it calls `this.segment` which is the custom `segment`.

Random thoughts:

1. Custom `segment` always check element.tagName and
delegate to `super.segment` if it isn't.
Not very clean, not performant?
1. Custom layout can create an instance of `InlineLayout`
to do the default segmentation.
  * To avoid excessive creations of `InlineLayout`,
`InlineLayout.default` gives a default instance
for custom layouts to use.
  * Is it a default `segment` or parent `segment` we'd like to call?
Using the default may not work if nested;
e.g., ruby inside bold?
1. We could also define that `super.segment` should never
call `this.segment` recursively.
It's a little tricky for the platform developers to implement,
but could be more intuitive and easy to use for
the custom layout developers.

This prototype currently uses `InlineLayout.default`.

## Out-of-flow Segments

Ruby annotations are out-of-flow.
To handle this, `addOutOfFlow()` is added to `Segment`.

* Associate the out-of-flow segments to the in-flow segment.
This helps moving out-of-flow segments along with in-flow segments between lines.
* Originally added to `LineBuilder`, but needed to do this after a line is committed.
* Originally `addOutOfFlow(segment)`
but changed to `addOutOfFlow(line)`
as later processes (e.g., bidi-reordering) require lines rather than segments.
* Offset is defined relative to the parent in-flow segment.

## Width changes by context

There are cases where a segment width changes by context.

Examples:

* Ruby changes the segment width depends on what
elements are before/after.
* Ruby changes the segment width depends on whether
break occurred before/after.
* Justification may want to allow compression
rather than expansion.

Complex scenario:
When each character of "Apple" belong to different
custom layout,
`LineBuilder` receives 5 segments
without break opportunities between them.
When "e" turned out not to fit in a line,
`LineBuilder` sends all 5 segments to the next line.
The custom layout for "A" wants to know
if that happened, and change its width.

Random thoughts:

1. Doing it in `adjust` phase.
Since this process may change where a line breaks,
and thus let all the following lines to reflow,
it's better to adjust when line break occurs,
rather than when all `flow` has completed.
  * Run `adjust` phase on every line,
when a line is to be broken.
With `adjust`, the line width may change,
so it could fit more words, or less words.
This is similar to the [line-model][]'s `onTerminate`.
  * Restricting only to expand (or to shrink) simplifies things?
2. When a line hits the max-width,
the platform can call `segment.adjust` callback if it's set.
1. When a next segment is added to the `LineBuilder`,
`LineBuilder` can make `onNextSegment` callback.
  * The callback must be done after the next break opportunity,
because otherwise the next segment may be pushed to the next line.
  * When the callback changed the width,
`LineBuilder` must recompute positions of following segments.
  * This is simpler than `adjust` or `onTerminate`
because it runs per segment, not per line nor per block,
though it can only handle previous and next.
Good enough for Ruby use cases, but may not cover other use cases?
  * There's a complexity when the callback increased the width,
and the line reach maxWidth because of that.
3. There are some similarities with justification.
Should it be designed together?

The current prototype implements `onNextSegment` callback
without the complex case mentioned above,
because the callback may compress but never expands.

## Breaks within a Ruby

See Out-of-flow Segments above.

## Generator?

Should each phase be a generator rather than arrays?

## Bidi and vertical flows

* Logical v.s. physical:
  * Offsets should be logical for vertical flow.
  * Offsets should be logical for RTL? Probably yes.
  * CSS WG may want different namings if logical.
* Bidi-reordering:
  * Bidi-reordering should run after a line was constructed.
  * This is likely be challenging implementation-wise,
since the current BidiResolver walks through box-tree,
and custom layout may change visual order of segments.
  * Should we prohibit custom layouts to re-order segments?
We can allow hiding (display: none) or
taking out-of-flow,
but re-ordering can complicate bidi-reordering.
  * Overriding `direction` and `unicode-bidi` can be also complicated?

## Editing

* Editing is also challenging when custom layouts reordered segments.
* Best to treat as a replaced element for editing?

## Other Open Questions

* Justification is still TBD.
  It's complex when there are justification opportunities
  both between segments and within a segment.

[line-model]: ../line-model/
[phase-model]: ../segment-measure-flow-adjust/
