'use strict';

function measureText(str, fontSize, maxWidth)
{
    var container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    if (maxWidth)
        container.style.width = maxWidth + 'px';
    var measureEl = document.createElement('span');
    if (fontSize)
        measureEl.style.fontSize = fontSize + 'px';
    measureEl.appendChild(document.createTextNode(str));
    container.appendChild(measureEl);

    document.body.appendChild(container);
    var rects = measureEl.getClientRects();
    document.body.removeChild(container);

    var lineBoxes = [];
    for (var rect, i = 0; rect = rects[i]; i++) {
        lineBoxes.push({ width: rect.width, height: rect.height });
    }
    return lineBoxes;
}


function segmentToElement(segment)
{
    var el = document.createElement('span');
    el.style.display = 'block';
    el.style.position = 'absolute';
    el.style.left = segment.left + 'px';
    el.style.top = segment.top + 'px';
    el.style.width = segment.width + 'px';
    el.style.height = segment.height + 'px';
    if (segment.fontSize)
        el.style.fontSize = segment.fontSize + 'px';
    if (segment.align)
        el.style.textAlign = segment.align;
    el.appendChild(document.createTextNode(segment.text));
    return el;
}


function customLayout(layoutObject, sourceEl, targetEl)
{
    var content = sourceEl.childNodes;
    var segments = layoutObject.segment(content);
    layoutObject.measure(segments);
    layoutObject.flow(segments);
    layoutObject.adjust(segments);
    
    targetEl.innerHTML = '';
    for (var i = 0; i < segments.length; i++) {
        if (segments[i].type != 'break')
            targetEl.appendChild(segmentToElement(segments[i]));   
    }
}
