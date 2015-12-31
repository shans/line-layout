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
This model takes the line context
and add a line breaker to the [phase-model][].

## Open Issues

* Is it better to pass `element` rather than `element.childNodes` to `segment`?
* Better to experiment overhang more accurately,
  it might affect the design.
* How to handle breaks within a ruby element needs further experiments.
  The current prototype is incomplete.
* Do out-of-flow items need to be handled differently?
* Should the `flow` phase return a list of lines,
  and it should be the input to the `adjust` phase?

[line-model]: ../line-model/
[phase-model]: ../segment-measure-flow-adjust/
