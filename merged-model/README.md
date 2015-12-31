# merged-model

The merged-model takes the best of both models;
the [line-model][] and the [phase-model][],
and add some changes.

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

## Multiple Custom Layouts

To handle multiple custom layouts,
following data needed to be split out
from custom layout instances.

1. Break opportunities need to be determined across elements.
2. A line box needs to include multiple elements.

For the latter, the line context in the [line-model][]
already gives a good model.
This model steals the line box context as `LineBuilder` class,
and add `LineBreaker` class to the [phase-model][].
These classes live in
[line-breaker.js](line-breaker.js) and
[line-builder.js](line-builder.js).

A separate line breaker also helps to handle out-of-flow items
that require independent line breaking context from the main flow.

## Out-of-flow Segments

Ruby annotations are out-of-flow.
To handle this, `addOutOfFlow()` is added to `LineBuilder`.
This function does not advance the current width.

Open questions:
* Should out-of-flow segment be associated with an in-flow segment
* Should custom layout create a separate LineBuilder for out-of-flow segments, create lines, and
add them to the in-flow lines?

## Other Open Issues

* Experiment overhang more accurately,
  it might affect the API design.
  Overhang requires changing width depends on
  whether actual line break occurred or not.
* How to handle breaks within a ruby element needs further experiments.
  The current prototype is incomplete.
  This might also affect the API design.
* Should the `flow` phase return a list of lines,
  and it should be the input to the `adjust` phase?
  rather than a line?
  The complexity is when next segment can pull in
  uncommitted segments to the next line.

[line-model]: ../line-model/
[phase-model]: ../segment-measure-flow-adjust/
