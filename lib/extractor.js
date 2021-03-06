// Generated by CoffeeScript 2.0.0-beta7
void function () {
  var _, addSiblings, biggestTitleChunk, calculateBestNode, canonicalLink, cheerio, cleaner, description, extractor, extractTags, favicon, formatter, getObjectTag, getScore, getSiblingsContent, getSiblingsScore, getVideoAttrs, image, isBoostable, isHighlinkDensity, isNodescoreThresholdMet, isTableAndNoParaExist, keywords, lang, postCleanup, stopwords, text, title, updateNodeCount, updateScore, videos;
  cheerio = require('cheerio');
  _ = require('lodash');
  cleaner = require('./cleaner');
  stopwords = require('./stopwords');
  formatter = require('./formatter');
  module.exports = extractor = function (html, language) {
    var doc, lng, pageData, topNode;
    doc = cheerio.load(html);
    lng = language || lang(doc);
    pageData = {
      title: title(doc),
      favicon: favicon(doc),
      description: description(doc),
      keywords: keywords(doc),
      lang: lng,
      canonicalLink: canonicalLink(doc),
      tags: extractTags(doc),
      image: image(doc, topNode)
    };
    cleaner(doc);
    topNode = calculateBestNode(doc, lng);
    pageData.videos = videos(doc, topNode);
    pageData.text = text(doc, topNode, lng);
    return pageData;
  };
  text = function (doc, topNode, lang) {
    if (topNode) {
      topNode = postCleanup(doc, topNode, lang);
      return formatter(doc, topNode, lang);
    } else {
      return '';
    }
  };
  image = function (doc, topNode) {
    var images;
    images = doc("meta[property='og:image'], meta[itemprop=image], meta[name='twitter:image:src'], meta[name='twitter:image'], meta[name='twitter:image0']");
    if (images.length > 0 && images.first().attr('content'))
      return images.first().attr('content');
    return null;
  };
  videos = function (doc, topNode) {
    var candidates, results, urls, videoList;
    videoList = [];
    candidates = doc(topNode).find('iframe, embed, object, video');
    candidates.each(function () {
      var candidate, tag;
      candidate = doc(this);
      tag = candidate[0].name;
      if (tag === 'embed') {
        if (candidate.parent() && candidate.parent()[0].name === 'object') {
          return videoList.push(getObjectTag(doc, candidate));
        } else {
          return videoList.push(getVideoAttrs(doc, candidate));
        }
      } else if (tag === 'object') {
        return videoList.push(getObjectTag(doc, candidate));
      } else if (tag === 'iframe' || tag === 'video') {
        return videoList.push(getVideoAttrs(doc, candidate));
      }
    });
    urls = [];
    results = [];
    _.each(videoList, function (vid) {
      if (vid && vid.height && vid.width && urls.indexOf(vid.src) === -1) {
        results.push(vid);
        return urls.push(vid.src);
      }
    });
    return results;
  };
  getVideoAttrs = function (doc, node) {
    var data, el;
    el = doc(node);
    return data = {
      src: el.attr('src'),
      height: el.attr('height'),
      width: el.attr('width')
    };
  };
  getObjectTag = function (doc, node) {
    var src, srcNode, video;
    srcNode = node.find('param[name=movie]');
    if (!(srcNode.length > 0))
      return null;
    src = srcNode.attr('value');
    video = getVideoAttrs(doc, node);
    video.src = src;
    return video;
  };
  title = function (doc) {
    var titleElement, titleText, usedDelimeter;
    titleElement = doc('title');
    if (!titleElement)
      return null;
    titleText = titleElement.text();
    usedDelimeter = false;
    _.each([
      '|',
      ' - ',
      '\xbb',
      ':'
    ], function (c) {
      if (titleText.indexOf(c) >= 0 && !usedDelimeter) {
        titleText = biggestTitleChunk(titleText, c);
        return usedDelimeter = true;
      }
    });
    return titleText.replace(/�/g, '').trim();
  };
  biggestTitleChunk = function (title, splitter) {
    var largeTextIndex, largeTextLength, titlePieces;
    largeTextLength = 0;
    largeTextIndex = 0;
    titlePieces = title.split(splitter);
    _.each(titlePieces, function (piece, i) {
      if (piece.length > largeTextLength) {
        largeTextLength = piece.length;
        return largeTextIndex = i;
      }
    });
    return titlePieces[largeTextIndex];
  };
  favicon = function (doc) {
    var tag;
    tag = doc('link').filter(function () {
      var cache$;
      return (null != (cache$ = doc(this).attr('rel')) ? cache$.toLowerCase() : void 0) === 'shortcut icon';
    });
    return tag.attr('href');
  };
  lang = function (doc) {
    var cache$, l, tag, value;
    l = null != (cache$ = doc('html')) ? cache$.attr('lang') : void 0;
    if (!l) {
      tag = doc('meta[name=lang]') || doc('meta[http-equiv=content-language]');
      l = null != tag ? tag.attr('content') : void 0;
    }
    if (l) {
      value = l.slice(0, +1 + 1 || 9e9);
      if (/^[A-Za-z]{2}$/.test(value))
        return value.toLowerCase();
    }
    return null;
  };
  description = function (doc) {
    var cache$, tag;
    tag = doc('meta[name=description]');
    if (null != tag && null != (cache$ = tag.attr('content')))
      return cache$.trim();
  };
  keywords = function (doc) {
    var tag;
    tag = doc('meta[name=keywords]');
    if (null != tag)
      return tag.attr('content');
  };
  canonicalLink = function (doc) {
    var tag;
    tag = doc('link[rel=canonical]');
    if (null != tag)
      return tag.attr('href');
  };
  extractTags = function (doc) {
    var elements, tags;
    elements = doc("a[rel='tag']");
    if (elements.length === 0) {
      elements = doc("a[href*='/tag/'], a[href*='/tags/'], a[href*='/topic/'], a[href*='?keyword=']");
      if (elements.length === 0)
        return [];
    }
    tags = [];
    elements.each(function () {
      var el, tag;
      el = doc(this);
      tag = el.text();
      if (tag && tag.length > 0)
        return tags.push(tag);
    });
    return _.uniq(tags);
  };
  calculateBestNode = function (doc, lang) {
    var bottomNegativescoreNodes, cnt, i, negativeScoring, nodesNumber, nodesToCheck, nodesWithText, parentNodes, startingBoost, topNode, topNodeScore;
    topNode = null;
    nodesToCheck = doc('p, pre, td');
    startingBoost = 1;
    cnt = 0;
    i = 0;
    parentNodes = [];
    nodesWithText = [];
    nodesToCheck.each(function () {
      var highLinkDensity, node, textNode, wordStats;
      node = doc(this);
      textNode = node.text();
      wordStats = stopwords(textNode, lang);
      highLinkDensity = isHighlinkDensity(doc, node);
      if (wordStats.stopwordCount > 2 && !highLinkDensity)
        return nodesWithText.push(node);
    });
    nodesNumber = nodesWithText.length;
    negativeScoring = 0;
    bottomNegativescoreNodes = nodesNumber * .25;
    _.each(nodesWithText, function (node) {
      var booster, boostScore, negscore, parentNode, parentParentNode, textNode, upscore, wordStats;
      boostScore = 0;
      if (isBoostable(doc, node, lang) === true)
        if (cnt >= 0) {
          boostScore = 1 / startingBoost * 50;
          startingBoost += 1;
        }
      if (nodesNumber > 15)
        if (nodesNumber - i <= bottomNegativescoreNodes) {
          booster = bottomNegativescoreNodes - (nodesNumber - i);
          boostScore = -1 * Math.pow(booster, 2);
          negscore = Math.abs(boostScore) + negativeScoring;
          if (negscore > 40)
            boostScore = 5;
        }
      textNode = node.text();
      wordStats = stopwords(textNode, lang);
      upscore = Math.floor(wordStats.stopwordCount + boostScore);
      parentNode = node.parent();
      updateScore(parentNode, upscore);
      updateNodeCount(parentNode, 1);
      if (parentNodes.indexOf(parentNode[0]) === -1)
        parentNodes.push(parentNode[0]);
      parentParentNode = parentNode.parent();
      if (parentParentNode) {
        updateNodeCount(parentParentNode, 1);
        updateScore(parentParentNode, upscore / 2);
        if (parentNodes.indexOf(parentParentNode[0]) === -1)
          parentNodes.push(parentParentNode[0]);
      }
      cnt += 1;
      return i += 1;
    });
    topNodeScore = 0;
    _.each(parentNodes, function (e) {
      var score;
      score = getScore(doc(e));
      if (score > topNodeScore) {
        topNode = e;
        topNodeScore = score;
      }
      if (topNode === null)
        return topNode = e;
    });
    return doc(topNode);
  };
  isBoostable = function (doc, node, lang) {
    var boostable, maxStepsawayFromNode, minimumStopwordCount, nodes, stepsAway;
    stepsAway = 0;
    minimumStopwordCount = 5;
    maxStepsawayFromNode = 3;
    nodes = node.prevAll();
    boostable = false;
    nodes.each(function () {
      var currentNode, currentNodeTag, paraText, wordStats;
      currentNode = doc(this);
      currentNodeTag = currentNode[0].name;
      if (currentNodeTag === 'p') {
        if (stepsAway >= maxStepsawayFromNode) {
          boostable = false;
          return false;
        }
        paraText = currentNode.text();
        wordStats = stopwords(paraText, lang);
        if (wordStats.stopwordCount > minimumStopwordCount) {
          boostable = true;
          return false;
        }
        return stepsAway += 1;
      }
    });
    return boostable;
  };
  addSiblings = function (doc, topNode, lang) {
    var baselinescoreSiblingsPara, sibs;
    baselinescoreSiblingsPara = getSiblingsScore(doc, topNode, lang);
    sibs = topNode.prevAll();
    sibs.each(function () {
      var currentNode, ps;
      currentNode = doc(this);
      ps = getSiblingsContent(doc, lang, currentNode, baselinescoreSiblingsPara);
      return _.each(ps, function (p) {
        return topNode.prepend('<p>' + p + '</p>');
      });
    });
    return topNode;
  };
  getSiblingsContent = function (doc, lang, currentSibling, baselinescoreSiblingsPara) {
    var potentialParagraphs, ps;
    if (currentSibling[0].name === 'p' && currentSibling.text().length > 0) {
      return [currentSibling];
    } else {
      potentialParagraphs = currentSibling.find('p');
      if (potentialParagraphs === null) {
        return null;
      } else {
        ps = [];
        potentialParagraphs.each(function () {
          var firstParagraph, highLinkDensity, paragraphScore, score, siblingBaselineScore, txt, wordStats;
          firstParagraph = doc(this);
          txt = firstParagraph.text();
          if (txt.length > 0) {
            wordStats = stopwords(txt, lang);
            paragraphScore = wordStats.stopwordCount;
            siblingBaselineScore = .3;
            highLinkDensity = isHighlinkDensity(doc, firstParagraph);
            score = baselinescoreSiblingsPara * siblingBaselineScore;
            if (score < paragraphScore && !highLinkDensity)
              return ps.push(txt);
          }
        });
        return ps;
      }
    }
  };
  getSiblingsScore = function (doc, topNode, lang) {
    var base, nodesToCheck, paragraphsNumber, paragraphsScore;
    base = 1e5;
    paragraphsNumber = 0;
    paragraphsScore = 0;
    nodesToCheck = topNode.find('p');
    nodesToCheck.each(function () {
      var highLinkDensity, node, textNode, wordStats;
      node = doc(this);
      textNode = node.text();
      wordStats = stopwords(textNode, lang);
      highLinkDensity = isHighlinkDensity(doc, node);
      if (wordStats.stopwordCount > 2 && !highLinkDensity) {
        paragraphsNumber += 1;
        return paragraphsScore += wordStats.stopwordCount;
      }
    });
    if (paragraphsNumber > 0)
      base = paragraphsScore / paragraphsNumber;
    return base;
  };
  updateScore = function (node, addToScore) {
    var currentScore, newScore, scoreString;
    currentScore = 0;
    scoreString = node.attr('gravityScore');
    if (scoreString)
      currentScore = parseInt(scoreString);
    newScore = currentScore + addToScore;
    return node.attr('gravityScore', newScore);
  };
  updateNodeCount = function (node, addToCount) {
    var countString, currentScore, newScore;
    currentScore = 0;
    countString = node.attr('gravityNodes');
    if (countString)
      currentScore = parseInt(countString);
    newScore = currentScore + addToCount;
    return node.attr('gravityNodes', newScore);
  };
  isHighlinkDensity = function (doc, node) {
    var linkDivisor, links, linkText, linkWords, numberOfLinks, numberOfLinkWords, sb, score, txt, words, wordsNumber;
    links = node.find('a');
    if (!(links.length > 0))
      return false;
    txt = node.text();
    words = txt.split(' ');
    wordsNumber = words.length;
    sb = [];
    links.each(function () {
      return sb.push(doc(this).text());
    });
    linkText = sb.join('');
    linkWords = linkText.split(' ');
    numberOfLinkWords = linkWords.length;
    numberOfLinks = links.length;
    linkDivisor = numberOfLinkWords / wordsNumber;
    score = linkDivisor * numberOfLinks;
    return score >= 1;
  };
  getScore = function (node) {
    var grvScoreString;
    grvScoreString = node.attr('gravityScore');
    if (!grvScoreString) {
      return 0;
    } else {
      return parseInt(grvScoreString);
    }
  };
  isTableAndNoParaExist = function (doc, e) {
    var subParagraphs, subParagraphs2;
    subParagraphs = e.find('p');
    subParagraphs.each(function () {
      var p, txt;
      p = doc(this);
      txt = p.text();
      if (txt.length < 25)
        return doc(p).remove();
    });
    subParagraphs2 = e.find('p');
    if (subParagraphs2.length === 0 && e[0].name !== 'td') {
      return true;
    } else {
      return false;
    }
  };
  isNodescoreThresholdMet = function (doc, node, e) {
    var currentNodeScore, thresholdScore, topNodeScore;
    topNodeScore = getScore(node);
    currentNodeScore = getScore(e);
    thresholdScore = topNodeScore * .08;
    if (currentNodeScore < thresholdScore && e[0].name !== 'td') {
      return false;
    } else {
      return true;
    }
  };
  postCleanup = function (doc, targetNode, lang) {
    var node;
    node = addSiblings(doc, targetNode, lang);
    node.children().each(function () {
      var e, eTag;
      e = doc(this);
      eTag = e[0].name;
      if (!(eTag === 'p' || eTag === 'a'))
        if (isHighlinkDensity(doc, e) || isTableAndNoParaExist(doc, e) || !isNodescoreThresholdMet(doc, node, e)) {
          return doc(e).remove();
        }
    });
    return node;
  };
}.call(this);
