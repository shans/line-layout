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
        context = layouts[node._inlineLayout].layout(context, contents);
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
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(fragment.range));
    div.style.position = 'absolute';
    div.style.left = (fragment.bounds.left + x_offset) + 'px';
    div.style.top = fragment.bounds.top + 'px';
    for (var key in fragment.style) {
      div.style[key] = fragment.style[key];
    }
    block.appendChild(div);
  }


  pendingFragments = [];
}

class LineBox {
  constructor(bounds, range) {
      this.bounds = bounds;
      this.range = range;
  }
}

class LineLayoutContext {
  constructor(bounds) {
    this.lineBounds = bounds;
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
    this.lineBounds.width += size.width;
    this.lineBounds.height += size.height;
  }

  consumeLine(indata, break_after) {
    break_after |= (/\s$/.exec(indata.data) !== null);
    var break_before = (/^\s/.exec(indata.data) !== null) || this.placedWordFragments.length == 0;
    var text = indata.data.trim();

    // adjust context font so we're measuring the right thing.
    var div = document.createElement('div');
    currentBlock.appendChild(div);
    for (var key in indata.style) {
      div.style[key] = indata.style[key];
    }
    var font = getComputedStyle(div).font;
    ctx.font = font;
    div.remove();

    // insert a space if we haven't at the end of the previous run.
    if (break_before && !this.break) {
      this.nextLineBoxPosition.x += ctx.measureText(' ').width;
    }

    var pos = this.nextLineBoxPosition;
    var globalLeft = this.lineBounds.left + pos.x;
    var globalTop = this.lineBounds.top + pos.y;

    var data = nextLine(text, pos, this.lineBounds.width,
      this.placedLineFragments.length == 0, !break_after);

    // TODO: proper references
    var wordBox = null;
    // TODO: move word/line splitting into nextLine, based on break_after
    if (data.words.length > 0) {
      var text = text.substring(0, text.length - (data.remainder ? data.remainder.length : 0));
      if (/\s/.exec(text[text.length - 1]) == null && !((data.remainder == null) && break_after)) {
        var match = /\s[^\s]*$/.exec(text);
        if (match == null) {
          pos = 0;
        } else {
          pos = text.length - match[0].length;
        }
        var word = text.substring(pos).trim();
        text = text.substring(0, pos);
        wordBox = new LineBox({left: globalLeft + ctx.measureText(text).width,
                                   top: globalTop, width: ctx.measureText(word).width,
                                   height: data.bounds.height},
            word);
        wordBox.style = indata.style;
      }
      if (text.trim() !== "") {
        if (wordBox)
          wordBox.bounds.left += ctx.measureText(' ').width;
        var linebox = new LineBox({left: globalLeft,
                                top: globalTop,
                                width: data.bounds.width, height: data.bounds.height},
            text);
        linebox.style = indata.style;
        this.placedLineFragments = this.placedLineFragments.concat(this.placedWordFragments);
        this.placedWordFragments = [];
        this.placedLineFragments.push(linebox);
      }
      if (wordBox) {
        this.placedWordFragments.push(wordBox);
      }
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
    pendingFragments = pendingFragments.concat(this.placedLineFragments);
    var newBounds = {left: this.originalBounds.left, top: this.lineBounds.top + this.lineBounds.height,
                     width: this.originalBounds.width, height: this.originalBounds.height};
    var newContext = new LineLayoutContext(newBounds);
    if (this.placedWordFragments.length > 0) {
      var offset = this.placedWordFragments[0].bounds.left;
      for (var i = 0; i < this.placedWordFragments.length; i++) {
        this.placedWordFragments[i].bounds.left -= offset;
        this.placedWordFragments[i].bounds.top += newContext.lineBounds.height;
        newContext.placedWordFragments.push(this.placedWordFragments[i]);
      }
      var lastFragment = this.placedWordFragments[this.placedWordFragments.length - 1];
      newContext.nextLineBoxPosition.x += lastFragment.bounds.left + lastFragment.bounds.width;
    }
    return newContext;
  }
}

function nextLine(text, pos, width, force, nobreak) {
  var words = text.split(/\s+/).filter(function(word) { return word.trim() !== ""; });
  var wordData = [];
  var spaceSize = ctx.measureText(' ').width;
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var wordWidth = ctx.measureText(word).width;
    var newpos = pos.x + wordWidth;
    if (newpos > width && !force) {
      var lastPosX = pos.x;
      var lastPosY = pos.y;
      pos.x = 0;
      pos.y += 18; // how to get this?
      var width = lastPosX;
      if (i < words.length - 1 || !nobreak)
        width += spaceSize;
      return {bounds: {left: 0, top: lastPosY, width: width, height: 18},
              pos: pos, words: wordData, remainder: words.slice(i).join(' ')};
    } else {
      force = false;
    }
    var wordItem = {left: pos.x, top: pos.y, word: word};
    pos.x += wordWidth;
    if (i < words.length - 1 || !nobreak)
      pos.x += spaceSize;

    wordData.push(wordItem);
  }
  return {
    bounds: {left: 0, top: pos.y, width: pos.x, height: 18},
    pos: pos, words: wordData, remainder: null};
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
