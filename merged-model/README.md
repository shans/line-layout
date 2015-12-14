# merged-model

The merged-model takes the best of both models;
the [line-model][] and the [phase-model][],
and add some improvements.

* To build a line box from multiple, possibly different custom layouts,
a line context should be separated from custom layout objects.
The line-model has such context object in its core.
* For elements that have rather complex descendant DOM tree structure such as Ruby,
access to the original descendants DOM tree is desired.
The optional `segment` phase in the phase-model provides this capability.

Further improvements are:
1. Similar to the line context mentioned above,
break opportunity analysis needs to be separated from custom layout objects
so that it can analyze across multiple different custom layouts.

## Open Issues

* Is it better to pass `element` rather than `element.childNodes1` to `segment`?
* The `segment` phase needs to support nested custom layouts.
* Do out-of-flow items need to be handled differently?

[line-model]: ../line-model/
[phase-model]: ../segment-measure-flow-adjust/
