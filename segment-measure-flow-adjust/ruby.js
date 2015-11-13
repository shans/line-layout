'use strict';

class RubyLayout {
    constructor(lineHeight, wordSpace, adjustA, adjustB) {

        this.lineHeight = lineHeight;
        this.wordSpace = wordSpace;
        this.adjustA = adjustA;
        this.adjustB = adjustB;
    }

    segment(nodes)
    {
        var segments = [];
        for (var node, i = 0; node = nodes[i]; i++) {
            if (node.nodeType == 1 && node.tagName == 'RUBY') {
                var rubySegments = this.segment(node.childNodes);
                for (var j = 0; j < rubySegments.length; j++) {
                    var s = rubySegments[j];
                    if (s.type != 'ruby-text') {
                        s.type = 'ruby-base';
                    }
                    segments.push(s);
                }
            }
            else if (node.nodeType == 1 && node.tagName == 'RT') {
                segments.push({
                    text: node.firstChild.nodeValue,
                    type: 'ruby-text',
                    fontSize: 12,
                });
            }
            else if (node.nodeType == 1 && node.tagName == 'RP') {
                // Ignore
            }
            else if (node.nodeType == 1 && node.tagName == 'BR') {
                segments.push({
                    type: 'break',
                });
            }
            else if (node.nodeType == 3) {
                var str = node.nodeValue;
                while (true) {
                    var pos = str.indexOf(' ');
                    if (pos == -1)
                        pos = str.length;
                    if (pos > 0) {
                        segments.push({
                            text: str.substr(0, pos),
                            fontSize: 20
                        });
                    }
                    str = str.substr(pos + 1);
                    if (str == '')
                        break;
                }
            }
        }

        return segments;
    } 

    measure(segments)
    {
        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            var rects = measureText(s.text, s.fontSize);
            if (s.type == 'ruby-text') {
                var prev = segments[i - 1];
                prev.width = s.width = Math.max(prev.width, rects[0].width);
            } else {
                s.width = rects[0].width;
            }
            s.height = rects[0].height;
        }
    }

    flow(segments)
    {
        var maxWidth = 500;
    
        var x = 0;
        var y = 0;
        for (var i = 0; i < segments.length; i++) {
            var s = segments[i];
            if (s.type == 'ruby-text') {
                s.left = segments[i - 1].left;
                s.top = segments[i - 1].top - 10;
                continue;
            }
            if ((x + s.width > maxWidth) || s.type == 'break') {
                x = 0;
                y += this.lineHeight;
            }
            if (s.type == 'break')
                continue;

            s.left = x;
            s.top = y;
            x += s.width + this.wordSpace;
        }
    }

    adjust(segments) {
        if (this.adjustA)
            adjust1(segments);
        if (this.adjustB)
            adjust2(segments);
    }
};


function adjust1(segments)
{
    for (var i = 0; i <= segments.length; i++) {
        var s = segments[i];
        if (!s)
            continue;
        if (s.type == 'ruby-text')
            s.top -= 3;
        if (s.type == 'ruby-base')
            s.top += 3;
    }
}

function adjust2(segments)
{
    for (var i = 0; i <= segments.length; i++) {
        var s = segments[i];
        if (!s)
            continue;
        if (s.type == 'ruby-text' || s.type == 'ruby-base')
            s.align = 'center';
    }    
}