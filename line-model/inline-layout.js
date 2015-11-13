'use strict';

var layouts = {};
var configs = {};

var elements = [];

var ctx = document.createElement('canvas').getContext('2d');

function registerInlineLayout(name, layouter, config) {
  layouts[name] = new layouter();
  configs[name] = config;
}

Element.prototype.setInlineLayout = function(name) {
  if (this._inlineLayout === undefined)
    elements.push(this);
  this._inlineLayout = name;
}

function layoutHappened() {
  var processedBlocks = [];
  elements.forEach(function(element) {
    var block = blockAncestor(element);
    if (processedBlocks.indexOf(block) > -1)
      return;
    processedBlocks.push(block);
  });
  processedBlocks.forEach(layoutBlock);
}

var pendingFragments = [];
var currentBlock = undefined;
var custom = undefined;

function layoutBlock(block) {
  ctx.font = getComputedStyle(block).font;
  currentBlock = block;
  var walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {acceptNode: function(node) { return NodeFilter.FILTER_ACCEPT} });
  var node = walker.nextNode();
  var pos = {x: 0, y: block.offsetTop};
  var context = new LineLayoutContext({left: pos.x, top: pos.y, width: block.offsetWidth, height: 18});
  while (node) {
    if (node.nodeType == 3) {
      var text = node.nodeValue;
      context = placeText(context, text);
      pos = context.nextLineBoxPosition;
      node = walker.nextNode();
    } else if (node.nodeType == 1) {
      if (node._inlineLayout) {
        var content = walker.nextNode();
        var contents = [];
        while (content !== node.nextSibling) {
          if (content.nodeType == 3)
            contents.push({data: content.nodeValue, style: {}});
          else if (content.nodeType == 1)
            contents.push({node: content, style: {}});
          content = walker.nextNode();
        }
        custom = layouts[node._inlineLayout];
        context = layouts[node._inlineLayout].layout(context, contents);
        custom = undefined;
        node = content;
      } else {
        node = walker.nextNode();
      }
    }
  }
  context.commit();

  var x_offset = block.offsetLeft;

  console.log("APPLYING PENDING FRAGMENTS");

  block.style.width = block.offsetWidth + 'px';
  block.style.height = block.offsetHeight + 'px';
  block.innerHTML = "";

  for (var i = 0; i < pendingFragments.length; i++) {
    var fragment = pendingFragments[i];
    var bounds = l2g(fragment);
    // console.log(bounds, fragment.range, fragment.bounds)
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(fragment.range));
    div.style.position = 'absolute';
    div.style.left = (bounds.left + x_offset) + 'px';
    div.style.top = bounds.top + 'px';
    for (var key in fragment.style) {
      div.style[key] = fragment.style[key];
    }
    block.appendChild(div);
  }


  pendingFragments = [];
}

function l2g(obj) {
  if (!obj.parent)
    return obj.bounds;
  var parentBounds = l2g(obj.parent);
  return {left: obj.bounds.left + parentBounds.left,
          top: obj.bounds.top + parentBounds.top,
          width: obj.bounds.width, height: obj.bounds.height};
}

class LineBox {
  constructor(bounds, range) {
      if (bounds.left == undefined) {
        adjustContext(range.style);
        this.bounds = {left: bounds.x, top: bounds.y,
          width: ctx.measureText(range.data).width, height: 18};
      } else {
        this.bounds = {left: bounds.left, top: bounds.top,
                       width: bounds.width, height: bounds.height};
      }
      this.range = range.data;
      this.style = range.style;
      this.custom = custom;
  }

  commit(callbackCandidates) {
    if ((this.custom !== undefined) && (callbackCandidates.indexOf(this.custom) == -1))
      callbackCandidates.push(this.custom);
    pendingFragments.push(this);
  }
}

class LineGroup {
  constructor(parent, bounds) {
    this.parent = parent;
    this.bounds = {left: bounds.left, top: bounds.top,
                   width: bounds.width, height: bounds.height};
    this.children = [];
    this.custom = custom;
  }

  appendChild(child) {
    this.children.push(child);
    child.parent = this;
  }

  commit(callbackCandidates) {
    if (this.custom !== undefined && callbackCandidates.indexOf(this.custom) == -1)
      callbackCandidates.push(this.custom);
    this.children.forEach(a => a.commit(callbackCandidates));
  }
}

function adjustContext(indata) {
  var div = document.createElement('div');
  currentBlock.appendChild(div);
  for (var key in indata.style) {
    div.style[key] = indata.style[key];
  }
  var font = getComputedStyle(div).font;
  ctx.font = font;
  div.remove();
}

// TODO: Resolve whether bounds are *local* (within-line) or *global* (within-block).
class LineLayoutContext {
  constructor(bounds) {
    this.bounds = bounds;
    this.originalBounds = {width: bounds.width, height: bounds.height, left: bounds.left, top: bounds.top};
    this.nextLineBoxPosition = {x: 0, y: 0};
    this.placedWordFragments = [];
    this.placedLineFragments = [];
    this.break = true;
  }

  adjustPosition(position) {
    this.nextLineBoxPosition.x += position.x;
    this.nextLineBoxPosition.y += position.y;
    for (var i = 0; i < this.placedLineFragments.length; i++) {
      this.placedLineFragments[i].bounds.left += position.x;
      this.placedLineFragments[i].bounds.top += position.y;
    }
    for (var i = 0; i < this.placedWordFragments.length; i++) {
      this.placedWordFragments[i].bounds.left += position.x;
      this.placedWordFragments[i].bounds.top += position.y;
    }
  }

  adjustSize(size) {
    this.bounds.width += size.width;
    this.bounds.height += size.height;
  }

  consumeLine(indata, break_after) {
    if (indata.children !== undefined) {
      var break_before = this.placedWordFragments.length == 0;
      var text = indata;
    } else {
      break_after |= (/\s$/.exec(indata.data) !== null);
      var break_before = (/^\s/.exec(indata.data) !== null) || this.placedWordFragments.length == 0;
      var text = indata.data.trim();
    }
    // adjust context font so we're measuring the right thing.
    adjustContext(indata);

    // insert a space if we haven't at the end of the previous run.
    if (break_before && !this.break) {
      this.nextLineBoxPosition.x += ctx.measureText(' ').width;
    }

    var pos = this.nextLineBoxPosition;
    var globalLeft = this.bounds.left + pos.x;
    var globalTop = this.bounds.top + pos.y;

    var data = nextLine(text, pos, this.bounds.width,
      this.placedLineFragments.length == 0, break_after);

    if (text.children)
      console.log(data);

    // TODO: proper references
    if (data.words.length > 0) {
      var linebox = new LineBox({left: pos.x,
                              top: pos.y,
                              width: data.bounds.width, height: data.bounds.height},
          {data: data.words.map(function(a) { return a.word; }).join(' '), style: indata.style});
      linebox.parent = this;
      this.placedLineFragments = this.placedLineFragments.concat(this.placedWordFragments);
      this.placedWordFragments = [];
      this.placedLineFragments.push(linebox);
      // console.log(linebox.bounds, linebox.range, linebox.parent.bounds);
    }
    if (data.fragment) {
      data.fragment.bounds.top = pos.y;
      if (data.fragment.word.word.children !== undefined) {
        var wordBox = data.fragment.word.word;
        wordBox.bounds.left = data.fragment.bounds.left;
        wordBox.bounds.top = data.fragment.bounds.top;
      }
      else
        var wordBox = new LineBox(data.fragment.bounds, {data: data.fragment.word.word, style: indata.style});
      wordBox.parent = this;
      // console.log(wordBox.bounds, wordBox.range, wordBox.parent.bounds);
      this.placedWordFragments.push(wordBox);
    }

    // console.log("in: ", indata.data, break_before, break_after);
    // console.log("out: ", JSON.stringify(this.placedLineFragments), JSON.stringify(this.placedWordFragments));
    this.nextLineBoxPosition = {x: data.bounds.left + data.bounds.width, y: data.bounds.top}

    // record break status so we don't double-up on breaks.
    if (data.remainder == null && !break_after) {
      this.break = false;
    } else {
      this.break = true;
    }

    // preserve break-after if there's remaining data.
    if (data.remainder) {
      if (break_after && (/\s$/.exec(data.remainder) == null)) {
        data.remainder += ' ';
      }
      return {data: data.remainder, style: indata.style};
    }
    return null;
  }

  commit() {
    var callbackCandidates = []
    this.placedLineFragments.forEach(a => a.commit(callbackCandidates));
    callbackCandidates.forEach(a => a.onCommit && a.onCommit(this));

    var newBounds = {left: this.originalBounds.left, top: this.bounds.top + this.bounds.height,
                     width: this.originalBounds.width, height: this.originalBounds.height};
    var newContext = new LineLayoutContext(newBounds);
    if (this.placedWordFragments.length > 0) {
      var offset = this.placedWordFragments[0].bounds.left;
      for (var i = 0; i < this.placedWordFragments.length; i++) {
        this.placedWordFragments[i].bounds.left -= offset;
        this.placedWordFragments[i].bounds.top = 0;
        newContext.placedWordFragments.push(this.placedWordFragments[i]);

        this.placedWordFragments[i].parent = newContext;
      }
      var lastFragment = this.placedWordFragments[this.placedWordFragments.length - 1];
      newContext.nextLineBoxPosition.x += lastFragment.bounds.left + lastFragment.bounds.width;
    }
    return newContext;
  }
}

function nextLine(text, pos, width, force, break_after) {
  pos = {x: pos.x, y: pos.y};
  var initialLeft = pos.x;
  if (text.children == undefined)
    var words = text.split(/\s+/).filter(function(word) { return word.trim() !== ""; });
  else
    var words = [text];

  var wordData = [];
  var spaceSize = ctx.measureText(' ').width;
  var fragmentData = null;
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (text.children == undefined)
      var wordWidth = ctx.measureText(word).width;
    else
      var wordWidth = word.bounds.width;

    var newpos = pos.x + wordWidth;
    if (newpos > width && !force) {
      return {bounds: {left: initialLeft, top: pos.y, width: pos.x - initialLeft, height: 18},
              pos: pos, words: wordData, remainder: words.slice(i).join(' ')};
    }
    force = false;
    var wordItem = {left: pos.x, top: pos.y, word: word};
    pos.x += wordWidth;
    if (i < words.length - 1 || break_after) {
      pos.x += spaceSize;
      wordData.push(wordItem);
    } else {
      fragmentData = {
        bounds: {left: wordItem.left, top: wordItem.top,
        width: wordWidth, height: 18},
        word: wordItem};
    }
  }
  return {
    bounds: {left: 0, top: pos.y, width: pos.x, height: 18},
    pos: pos, words: wordData, fragment: fragmentData, remainder: null};
}

function placeText(context, text) {
  var data = {data: text, style: {}};
  while (true) {
    data = context.consumeLine(data);
    if (data == null)
      break;
    context = context.commit();
  }
  return context;
}

  //  measureText(text, getComputedStyle(block))

function blockAncestor(element) {
  while (true) {
    var display = getComputedStyle(element).display;
    if (display == 'block' || display == 'inline-block' || element.parentElement == null)
      return element;
    element = element.parentElement;
  }
}
