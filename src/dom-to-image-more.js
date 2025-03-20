(function (global) {
    'use strict';

    const util = newUtil();
    const inliner = newInliner();
    const fontFaces = newFontFaces();
    const images = newImages();

    // Default impl options
    const defaultOptions = {
        // Default is to copy default styles of elements
        copyDefaultStyles: true,
        // Default is to fail on error, no placeholder
        imagePlaceholder: undefined,
        // Default cache bust is false, it will use the cache
        cacheBust: false,
        // Use (existing) authentication credentials for external URIs (CORS requests)
        useCredentials: false,
        // Use (existing) authentication credentials for external URIs (CORS requests) on some filtered requests only
        useCredentialsFilters: [],
        // Default resolve timeout
        httpTimeout: 30000,
        // Style computation cache tag rules (options are strict, relaxed)
        styleCaching: 'strict',
        // Default cors config is to request the image address directly
        corsImg: undefined,
        // Callback for adjustClonedNode eventing (to allow adjusting clone's properties)
        adjustClonedNode: undefined,
        // Callback to filter style properties to be included in the output
        filterStyles: undefined,
    };

    const domtoimage = {
        toSvg: toSvg,
        toPng: toPng,
        toJpeg: toJpeg,
        toBlob: toBlob,
        toPixelData: toPixelData,
        toCanvas: toCanvas,
        impl: {
            fontFaces: fontFaces,
            images: images,
            util: util,
            inliner: inliner,
            urlCache: [],
            options: {},
        },
    };

    if (typeof exports === 'object' && typeof module === 'object') {
        module.exports = domtoimage; // eslint-disable-line no-undef
    } else {
        global.domtoimage = domtoimage;
    }

    // support node and browsers
    const ELEMENT_NODE =
        (typeof Node !== 'undefined' ? Node.ELEMENT_NODE : undefined) || 1;
    const getComputedStyle =
        (typeof global !== 'undefined' ? global.getComputedStyle : undefined) ||
        (typeof window !== 'undefined' ? window.getComputedStyle : undefined) ||
        globalThis.getComputedStyle;
    const atob =
        (typeof global !== 'undefined' ? global.atob : undefined) ||
        (typeof window !== 'undefined' ? window.atob : undefined) ||
        globalThis.atob;

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options
     * @param {Function} options.filter - Should return true if passed node should be included in the output
     *          (excluding node means excluding it's children as well). Not called on the root node.
     * @param {Function} options.onclone - Callback function which is called when the Document has been cloned for
     *         rendering, can be used to modify the contents that will be rendered without affecting the original
     *         source document.
     * @param {String} options.bgcolor - color for the background, any valid CSS color value.
     * @param {Number} options.width - width to be applied to node before rendering.
     * @param {Number} options.height - height to be applied to node before rendering.
     * @param {Object} options.style - an object whose properties to be copied to node's style before rendering.
     * @param {Number} options.quality - a Number between 0 and 1 indicating image quality (applicable to JPEG only),
                defaults to 1.0.
     * @param {Number} options.scale - a Number multiplier to scale up the canvas before rendering to reduce fuzzy images, defaults to 1.0.
     * @param {String} options.imagePlaceholder - dataURL to use as a placeholder for failed images, default behaviour is to fail fast on images we can't fetch
     * @param {Boolean} options.cacheBust - set to true to cache bust by appending the time to the request url
     * @param {String} options.styleCaching - set to 'strict', 'relaxed' to select style caching rules
     * @param {Boolean} options.copyDefaultStyles - set to false to disable use of default styles of elements
     * @param {Boolean} options.disableEmbedFonts - set to true to disable font embedding into the SVG output.
     * @param {Object} options.corsImg - When the image is restricted by the server from cross-domain requests, the proxy address is passed in to get the image
     *         - @param {String} url - eg: https://cors-anywhere.herokuapp.com/
     *         - @param {Enumerator} method - get, post
     *         - @param {Object} headers - eg: { "Content-Type", "application/json;charset=UTF-8" }
     *         - @param {Object} data - post payload
     * @param {Function} options.adjustClonedNode - callback for adjustClonedNode eventing (to allow adjusting clone's properties)
     * @param {Function} options.filterStyles - Should return true if passed propertyName should be included in the output
     * @return {Promise} - A promise that is fulfilled with a SVG image data URL
     * */
    function toSvg(node, options) {
        const ownerWindow = domtoimage.impl.util.getWindow(node);
        options = options || {};
        copyOptions(options);
        let restorations = [];

        return Promise.resolve(node)
            .then(ensureElement)
            .then(function (clonee) {
                return cloneNode(clonee, options, null, ownerWindow);
            })
            .then(options.disableEmbedFonts ? Promise.resolve(node) : embedFonts)
            .then(inlineImages)
            .then(applyOptions)
            .then(makeSvgDataUri)
            .then(restoreWrappers)
            .then(clearCache);

        function ensureElement(node) {
            if (node.nodeType === ELEMENT_NODE) return node;

            const originalChild = node;
            const originalParent = node.parentNode;
            const wrappingSpan = document.createElement('span');
            originalParent.replaceChild(wrappingSpan, originalChild);
            wrappingSpan.append(node);
            restorations.push({
                parent: originalParent,
                child: originalChild,
                wrapper: wrappingSpan,
            });
            return wrappingSpan;
        }

        function restoreWrappers(result) {
            // put the original children back where the wrappers were inserted
            while (restorations.length > 0) {
                const restoration = restorations.pop();
                restoration.parent.replaceChild(restoration.child, restoration.wrapper);
            }

            return result;
        }

        function clearCache(result) {
            domtoimage.impl.urlCache = [];
            removeSandbox();
            return result;
        }

        function applyOptions(clone) {
            if (options.bgcolor) {
                clone.style.backgroundColor = options.bgcolor;
            }
            if (options.width) {
                clone.style.width = `${options.width}px`;
            }
            if (options.height) {
                clone.style.height = `${options.height}px`;
            }
            if (options.style) {
                Object.keys(options.style).forEach(function (property) {
                    clone.style[property] = options.style[property];
                });
            }

            let onCloneResult = null;

            if (typeof options.onclone === 'function') {
                onCloneResult = options.onclone(clone);
            }

            return Promise.resolve(onCloneResult).then(function () {
                return clone;
            });
        }

        function makeSvgDataUri(node) {
            let width = options.width || util.width(node);
            let height = options.height || util.height(node);

            return Promise.resolve(node)
                .then(function (svg) {
                    svg.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                    return new XMLSerializer().serializeToString(svg);
                })
                .then(util.escapeXhtml)
                .then(function (xhtml) {
                    const foreignObjectSizing =
                        (util.isDimensionMissing(width)
                            ? ' width="100%"'
                            : ` width="${width}"`) +
                        (util.isDimensionMissing(height)
                            ? ' height="100%"'
                            : ` height="${height}"`);
                    const svgSizing =
                        (util.isDimensionMissing(width) ? '' : ` width="${width}"`) +
                        (util.isDimensionMissing(height) ? '' : ` height="${height}"`);
                    return `<svg xmlns="http://www.w3.org/2000/svg"${svgSizing}><foreignObject${foreignObjectSizing}>${xhtml}</foreignObject></svg>`;
                })
                .then(function (svg) {
                    return `data:image/svg+xml;charset=utf-8,${svg}`;
                });
        }
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a Uint8Array containing RGBA pixel data.
     * */
    function toPixelData(node, options) {
        return draw(node, options).then(function (canvas) {
            return canvas
                .getContext('2d')
                .getImageData(0, 0, util.width(node), util.height(node)).data;
        });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a PNG image data URL
     * */
    function toPng(node, options) {
        return draw(node, options).then(function (canvas) {
            return canvas.toDataURL();
        });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a JPEG image data URL
     * */
    function toJpeg(node, options) {
        return draw(node, options).then(function (canvas) {
            return canvas.toDataURL(
                'image/jpeg',
                (options ? options.quality : undefined) || 1.0
            );
        });
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a PNG image blob
     * */
    function toBlob(node, options) {
        return draw(node, options).then(util.canvasToBlob);
    }

    /**
     * @param {Node} node - The DOM Node object to render
     * @param {Object} options - Rendering options, @see {@link toSvg}
     * @return {Promise} - A promise that is fulfilled with a canvas object
     * */
    function toCanvas(node, options) {
        return draw(node, options);
    }

    function copyOptions(options) {
        // Copy options to impl options for use in impl
        if (typeof options.copyDefaultStyles === 'undefined') {
            domtoimage.impl.options.copyDefaultStyles = defaultOptions.copyDefaultStyles;
        } else {
            domtoimage.impl.options.copyDefaultStyles = options.copyDefaultStyles;
        }

        if (typeof options.imagePlaceholder === 'undefined') {
            domtoimage.impl.options.imagePlaceholder = defaultOptions.imagePlaceholder;
        } else {
            domtoimage.impl.options.imagePlaceholder = options.imagePlaceholder;
        }

        if (typeof options.cacheBust === 'undefined') {
            domtoimage.impl.options.cacheBust = defaultOptions.cacheBust;
        } else {
            domtoimage.impl.options.cacheBust = options.cacheBust;
        }

        if (typeof options.corsImg === 'undefined') {
            domtoimage.impl.options.corsImg = defaultOptions.corsImg;
        } else {
            domtoimage.impl.options.corsImg = options.corsImg;
        }

        if (typeof options.useCredentials === 'undefined') {
            domtoimage.impl.options.useCredentials = defaultOptions.useCredentials;
        } else {
            domtoimage.impl.options.useCredentials = options.useCredentials;
        }

        if (typeof options.useCredentialsFilters === 'undefined') {
            domtoimage.impl.options.useCredentialsFilters =
                defaultOptions.useCredentialsFilters;
        } else {
            domtoimage.impl.options.useCredentialsFilters = options.useCredentialsFilters;
        }

        if (typeof options.httpTimeout === 'undefined') {
            domtoimage.impl.options.httpTimeout = defaultOptions.httpTimeout;
        } else {
            domtoimage.impl.options.httpTimeout = options.httpTimeout;
        }

        if (typeof options.styleCaching === 'undefined') {
            domtoimage.impl.options.styleCaching = defaultOptions.styleCaching;
        } else {
            domtoimage.impl.options.styleCaching = options.styleCaching;
        }
    }

    function draw(domNode, options) {
        options = options || {};
        return toSvg(domNode, options)
            .then(util.makeImage)
            .then(function (image) {
                const scale = typeof options.scale !== 'number' ? 1 : options.scale;
                const canvas = newCanvas(domNode, scale);
                const ctx = canvas.getContext('2d');
                ctx.msImageSmoothingEnabled = false;
                ctx.imageSmoothingEnabled = false;
                if (image) {
                    ctx.scale(scale, scale);
                    ctx.drawImage(image, 0, 0);
                }
                return canvas;
            });

        function newCanvas(node, scale) {
            let width = options.width || util.width(node);
            let height = options.height || util.height(node);

            // per https://www.w3.org/TR/CSS2/visudet.html#inline-replaced-width the default width should be 300px if height
            // not set, otherwise should be 2:1 aspect ratio for whatever height is specified
            if (util.isDimensionMissing(width)) {
                width = util.isDimensionMissing(height) ? 300 : height * 2.0;
            }

            if (util.isDimensionMissing(height)) {
                height = width / 2.0;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;

            if (options.bgcolor) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = options.bgcolor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            return canvas;
        }
    }

    let sandbox = null;

    function cloneNode(node, options, parentComputedStyles, ownerWindow) {
        const filter = options.filter;
        if (
            node === sandbox ||
            util.isHTMLScriptElement(node) ||
            util.isHTMLStyleElement(node) ||
            util.isHTMLLinkElement(node) ||
            (parentComputedStyles !== null && filter && !filter(node))
        ) {
            return Promise.resolve();
        }

        return Promise.resolve(node)
            .then(makeNodeCopy)
            .then(adjustCloneBefore)
            .then(function (clone) {
                return cloneChildren(clone, getParentOfChildren(node));
            })
            .then(adjustCloneAfter)
            .then(function (clone) {
                return processClone(clone, node);
            });

        function makeNodeCopy(original) {
            if (util.isHTMLCanvasElement(original)) {
                return util.makeImage(original.toDataURL());
            }
            return original.cloneNode(false);
        }

        function adjustCloneBefore(clone) {
            if (options.adjustClonedNode) {
                options.adjustClonedNode(node, clone, false);
            }
            return Promise.resolve(clone);
        }

        function adjustCloneAfter(clone) {
            if (options.adjustClonedNode) {
                options.adjustClonedNode(node, clone, true);
            }
            return Promise.resolve(clone);
        }

        function getParentOfChildren(original) {
            if (util.isElementHostForOpenShadowRoot(original)) {
                return original.shadowRoot; // jump "down" to #shadow-root
            }
            return original;
        }

        function cloneChildren(clone, original) {
            const originalChildren = getRenderedChildren(original);
            let done = Promise.resolve();

            if (originalChildren.length !== 0) {
                const originalComputedStyles = getComputedStyle(
                    getRenderedParent(original)
                );

                util.asArray(originalChildren).forEach(function (originalChild) {
                    done = done.then(function () {
                        return cloneNode(
                            originalChild,
                            options,
                            originalComputedStyles,
                            ownerWindow
                        ).then(function (clonedChild) {
                            if (clonedChild) {
                                clone.appendChild(clonedChild);
                            }
                        });
                    });
                });
            }

            return done.then(function () {
                return clone;
            });

            function getRenderedParent(original) {
                if (util.isShadowRoot(original)) {
                    return original.host; // jump up from #shadow-root to its parent <element>
                }
                return original;
            }

            function getRenderedChildren(original) {
                if (util.isShadowSlotElement(original)) {
                    const assignedNodes = original.assignedNodes();

                    if (assignedNodes && assignedNodes.length > 0) return assignedNodes; // shadow DOM <slot> has "assigned nodes" as rendered children
                }
                return original.childNodes;
            }
        }

        function processClone(clone, original) {
            if (!util.isElement(clone) || util.isShadowSlotElement(original)) {
                return Promise.resolve(clone);
            }

            return Promise.resolve()
                .then(cloneStyle)
                .then(clonePseudoElements)
                .then(copyUserInput)
                .then(fixSvg)
                .then(function () {
                    return clone;
                });

            function cloneStyle() {
                copyStyle(original, clone);

                function copyFont(source, target) {
                    target.font = source.font;
                    target.fontFamily = source.fontFamily;
                    target.fontFeatureSettings = source.fontFeatureSettings;
                    target.fontKerning = source.fontKerning;
                    target.fontSize = source.fontSize;
                    target.fontStretch = source.fontStretch;
                    target.fontStyle = source.fontStyle;
                    target.fontVariant = source.fontVariant;
                    target.fontVariantCaps = source.fontVariantCaps;
                    target.fontVariantEastAsian = source.fontVariantEastAsian;
                    target.fontVariantLigatures = source.fontVariantLigatures;
                    target.fontVariantNumeric = source.fontVariantNumeric;
                    target.fontVariationSettings = source.fontVariationSettings;
                    target.fontWeight = source.fontWeight;
                }

                function copyStyle(sourceElement, targetElement) {
                    const sourceComputedStyles = getComputedStyle(sourceElement);
                    if (sourceComputedStyles.cssText) {
                        targetElement.style.cssText = sourceComputedStyles.cssText;
                        copyFont(sourceComputedStyles, targetElement.style); // here we re-assign the font props.
                    } else {
                        copyUserComputedStyleFast(
                            options,
                            sourceElement,
                            sourceComputedStyles,
                            parentComputedStyles,
                            targetElement
                        );

                        // Remove positioning of initial element, which stops them from being captured correctly
                        if (parentComputedStyles === null) {
                            [
                                'inset-block',
                                'inset-block-start',
                                'inset-block-end',
                            ].forEach((prop) => targetElement.style.removeProperty(prop));
                            ['left', 'right', 'top', 'bottom'].forEach((prop) => {
                                if (targetElement.style.getPropertyValue(prop)) {
                                    targetElement.style.setProperty(prop, '0px');
                                }
                            });
                        }
                    }
                }
            }

            function clonePseudoElements() {
                const cloneClassName = util.uid();

                [':before', ':after'].forEach(function (element) {
                    clonePseudoElement(element);
                });

                function clonePseudoElement(element) {
                    const style = getComputedStyle(original, element);
                    const content = style.getPropertyValue('content');

                    if (content === '' || content === 'none') {
                        return;
                    }

                    const currentClass = clone.getAttribute('class') || '';
                    clone.setAttribute('class', `${currentClass} ${cloneClassName}`);

                    const styleElement = document.createElement('style');
                    styleElement.appendChild(formatPseudoElementStyle());
                    clone.appendChild(styleElement);

                    function formatPseudoElementStyle() {
                        const selector = `.${cloneClassName}:${element}`;
                        const cssText = style.cssText
                            ? formatCssText()
                            : formatCssProperties();

                        return document.createTextNode(`${selector}{${cssText}}`);

                        function formatCssText() {
                            return `${style.cssText} content: ${content};`;
                        }

                        function formatCssProperties() {
                            const styleText = util
                                .asArray(style)
                                .map(formatProperty)
                                .join('; ');
                            return `${styleText};`;

                            function formatProperty(name) {
                                const propertyValue = style.getPropertyValue(name);
                                const propertyPriority = style.getPropertyPriority(name)
                                    ? ' !important'
                                    : '';
                                return `${name}: ${propertyValue}${propertyPriority}`;
                            }
                        }
                    }
                }
            }

            function copyUserInput() {
                if (util.isHTMLTextAreaElement(original)) {
                    clone.innerHTML = original.value;
                }
                if (util.isHTMLInputElement(original)) {
                    clone.setAttribute('value', original.value);
                }
            }

            function fixSvg() {
                if (util.isSVGElement(clone)) {
                    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                    if (util.isSVGRectElement(clone)) {
                        ['width', 'height'].forEach(function (attribute) {
                            const value = clone.getAttribute(attribute);
                            if (value) {
                                clone.style.setProperty(attribute, value);
                            }
                        });
                    }
                }
            }
        }
    }

    function embedFonts(node) {
        return fontFaces.resolveAll().then(function (cssText) {
            if (cssText !== '') {
                const styleNode = document.createElement('style');
                node.appendChild(styleNode);
                styleNode.appendChild(document.createTextNode(cssText));
            }
            return node;
        });
    }

    function inlineImages(node) {
        return images.inlineAll(node).then(function () {
            return node;
        });
    }

    function newUtil() {
        let uid_index = 0;

        return {
            escape: escapeRegEx,
            isDataUrl: isDataUrl,
            canvasToBlob: canvasToBlob,
            resolveUrl: resolveUrl,
            getAndEncode: getAndEncode,
            uid: uid,
            delay: delay,
            asArray: asArray,
            escapeXhtml: escapeXhtml,
            makeImage: makeImage,
            width: width,
            height: height,
            getWindow: getWindow,
            isElement: isElement,
            isElementHostForOpenShadowRoot: isElementHostForOpenShadowRoot,
            isShadowRoot: isShadowRoot,
            isInShadowRoot: isInShadowRoot,
            isHTMLElement: isHTMLElement,
            isHTMLCanvasElement: isHTMLCanvasElement,
            isHTMLInputElement: isHTMLInputElement,
            isHTMLImageElement: isHTMLImageElement,
            isHTMLLinkElement: isHTMLLinkElement,
            isHTMLScriptElement: isHTMLScriptElement,
            isHTMLStyleElement: isHTMLStyleElement,
            isHTMLTextAreaElement: isHTMLTextAreaElement,
            isShadowSlotElement: isShadowSlotElement,
            isSVGElement: isSVGElement,
            isSVGRectElement: isSVGRectElement,
            isDimensionMissing: isDimensionMissing,
        };

        function getWindow(node) {
            const ownerDocument = node ? node.ownerDocument : undefined;
            return (
                (ownerDocument ? ownerDocument.defaultView : undefined) ||
                window ||
                global
            );
        }

        function isElementHostForOpenShadowRoot(value) {
            return isElement(value) && value.shadowRoot !== null;
        }

        function isShadowRoot(value) {
            return value instanceof getWindow(value).ShadowRoot;
        }

        function isInShadowRoot(value) {
            // not calling the method, getting the method
            if (value === null || value === undefined || value.getRootNode === undefined)
                return false;
            return isShadowRoot(value.getRootNode());
        }

        function isElement(value) {
            return value instanceof getWindow(value).Element;
        }

        function isHTMLCanvasElement(value) {
            return value instanceof getWindow(value).HTMLCanvasElement;
        }

        function isHTMLElement(value) {
            return value instanceof getWindow(value).HTMLElement;
        }

        function isHTMLImageElement(value) {
            return value instanceof getWindow(value).HTMLImageElement;
        }

        function isHTMLInputElement(value) {
            return value instanceof getWindow(value).HTMLInputElement;
        }

        function isHTMLLinkElement(value) {
            return value instanceof getWindow(value).HTMLLinkElement;
        }

        function isHTMLScriptElement(value) {
            return value instanceof getWindow(value).HTMLScriptElement;
        }

        function isHTMLStyleElement(value) {
            return value instanceof getWindow(value).HTMLStyleElement;
        }

        function isHTMLTextAreaElement(value) {
            return value instanceof getWindow(value).HTMLTextAreaElement;
        }

        function isShadowSlotElement(value) {
            return (
                isInShadowRoot(value) && value instanceof getWindow(value).HTMLSlotElement
            );
        }

        function isSVGElement(value) {
            return value instanceof getWindow(value).SVGElement;
        }

        function isSVGRectElement(value) {
            return value instanceof getWindow(value).SVGRectElement;
        }

        function isDataUrl(url) {
            return url.search(/^(data:)/) !== -1;
        }

        function isDimensionMissing(value) {
            return isNaN(value) || value <= 0;
        }

        function asBlob(canvas) {
            return new Promise(function (resolve) {
                const binaryString = atob(canvas.toDataURL().split(',')[1]);
                const length = binaryString.length;
                const binaryArray = new Uint8Array(length);

                for (let i = 0; i < length; i++) {
                    binaryArray[i] = binaryString.charCodeAt(i);
                }

                resolve(
                    new Blob([binaryArray], {
                        type: 'image/png',
                    })
                );
            });
        }

        function canvasToBlob(canvas) {
            if (canvas.toBlob) {
                return new Promise(function (resolve) {
                    canvas.toBlob(resolve);
                });
            }

            return asBlob(canvas);
        }

        function resolveUrl(url, baseUrl) {
            const doc = document.implementation.createHTMLDocument();
            const base = doc.createElement('base');
            doc.head.appendChild(base);
            const a = doc.createElement('a');
            doc.body.appendChild(a);
            base.href = baseUrl;
            a.href = url;
            return a.href;
        }

        function uid() {
            return `u${fourRandomChars()}${uid_index++}`;

            function fourRandomChars() {
                /* see https://stackoverflow.com/a/6248722/2519373 */
                return `0000${((Math.random() * Math.pow(36, 4)) << 0).toString(
                    36
                )}`.slice(-4);
            }
        }

        function makeImage(uri) {
            if (uri === 'data:,') {
                return Promise.resolve();
            }

            return new Promise(function (resolve, reject) {
                // Create an SVG element to house the image
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                
                // and create the Image element to insert into that wrapper
                const image = new Image();

                if (domtoimage.impl.options.useCredentials) {
                    image.crossOrigin = 'use-credentials';
                }

                image.onload = function () {
                    // Cleanup: remove theimage from the document
                    document.body.removeChild(svg);

                    if (window && window.requestAnimationFrame) {
                        // In order to work around a Firefox bug (webcompat/web-bugs#119834) we
                        // need to wait one extra frame before it's safe to read the image data.
                        window.requestAnimationFrame(function () {
                            resolve(image);
                        });
                    } else {
                        // If we don't have a window or requestAnimationFrame function proceed immediately.
                        resolve(image);
                    }
                };
                
                image.onerror = (error) => {
                    // Cleanup: remove the image from the document
                    document.body.removeChild(svg);

                    reject(error);
                };

                svg.appendChild(image);
                image.src = uri;
                
                // Add the SVG to the document body (invisible)
                document.body.appendChild(svg);
            });
        }

        function getAndEncode(url) {
            let cacheEntry = domtoimage.impl.urlCache.find(function (el) {
                return el.url === url;
            });

            if (!cacheEntry) {
                cacheEntry = {
                    url: url,
                    promise: null,
                };
                domtoimage.impl.urlCache.push(cacheEntry);
            }

            if (cacheEntry.promise === null) {
                if (domtoimage.impl.options.cacheBust) {
                    // Cache bypass so we dont have CORS issues with cached images
                    // Source: https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
                    url += (/\?/.test(url) ? '&' : '?') + new Date().getTime();
                }

                cacheEntry.promise = new Promise(function (resolve) {
                    const httpTimeout = domtoimage.impl.options.httpTimeout;
                    const request = new XMLHttpRequest();

                    request.onreadystatechange = done;
                    request.ontimeout = timeout;
                    request.responseType = 'blob';
                    request.timeout = httpTimeout;

                    if (domtoimage.impl.options.useCredentialsFilters.length > 0) {
                        domtoimage.impl.options.useCredentials =
                            domtoimage.impl.options.useCredentialsFilters.filter(
                                (credentialsFilter) => url.search(credentialsFilter) >= 0
                            ).length > 0;
                    }

                    if (domtoimage.impl.options.useCredentials) {
                        request.withCredentials = true;
                    }

                    if (
                        domtoimage.impl.options.corsImg &&
                        url.indexOf('http') === 0 &&
                        url.indexOf(window.location.origin) === -1
                    ) {
                        const method =
                            (
                                domtoimage.impl.options.corsImg.method || 'GET'
                            ).toUpperCase() === 'POST'
                                ? 'POST'
                                : 'GET';

                        request.open(
                            method,
                            (domtoimage.impl.options.corsImg.url || '').replace(
                                '#{cors}',
                                url
                            ),
                            true
                        );

                        let isJson = false;
                        const headers = domtoimage.impl.options.corsImg.headers || {};
                        Object.keys(headers).forEach(function (key) {
                            if (headers[key].indexOf('application/json') !== -1) {
                                isJson = true;
                            }
                            request.setRequestHeader(key, headers[key]);
                        });

                        const corsData = handleJson(
                            domtoimage.impl.options.corsImg.data || ''
                        );

                        Object.keys(corsData).forEach(function (key) {
                            if (typeof corsData[key] === 'string') {
                                corsData[key] = corsData[key].replace('#{cors}', url);
                            }
                        });

                        request.send(isJson ? JSON.stringify(corsData) : corsData);
                    } else {
                        request.open('GET', url, true);
                        request.send();
                    }

                    let placeholder;
                    if (domtoimage.impl.options.imagePlaceholder) {
                        const split = domtoimage.impl.options.imagePlaceholder.split(/,/);
                        if (split && split[1]) {
                            placeholder = split[1];
                        }
                    }

                    function done() {
                        if (request.readyState !== 4) {
                            return;
                        }

                        if (request.status >= 300) {
                            if (placeholder) {
                                resolve(placeholder);
                            } else {
                                fail(
                                    `cannot fetch resource: ${url}, status: ${request.status}`
                                );
                            }

                            return;
                        }

                        const encoder = new FileReader();
                        encoder.onloadend = function () {
                            resolve(encoder.result);
                        };
                        encoder.readAsDataURL(request.response);
                    }

                    function timeout() {
                        if (placeholder) {
                            resolve(placeholder);
                        } else {
                            fail(
                                `timeout of ${httpTimeout}ms occured while fetching resource: ${url}`
                            );
                        }
                    }

                    function handleJson(data) {
                        try {
                            return JSON.parse(JSON.stringify(data));
                        } catch (e) {
                            fail('corsImg.data is missing or invalid:' + e.toString());
                            return;
                        }
                    }

                    function fail(message) {
                        console.error(message);
                        resolve('');
                    }
                });
            }
            return cacheEntry.promise;
        }

        function escapeRegEx(string) {
            return string.replace(/([.*+?^${}()|[\]/\\])/g, '\\$1');
        }

        function delay(ms) {
            return function (arg) {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve(arg);
                    }, ms);
                });
            };
        }

        function asArray(arrayLike) {
            const array = [];
            const length = arrayLike.length;
            for (let i = 0; i < length; i++) {
                array.push(arrayLike[i]);
            }

            return array;
        }

        function escapeXhtml(string) {
            return string.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\n/g, '%0A');
        }

        function width(node) {
            const width = px(node, 'width');

            if (!isNaN(width)) return width;

            const leftBorder = px(node, 'border-left-width');
            const rightBorder = px(node, 'border-right-width');
            return node.scrollWidth + leftBorder + rightBorder;
        }

        function height(node) {
            const height = px(node, 'height');

            if (!isNaN(height)) return height;

            const topBorder = px(node, 'border-top-width');
            const bottomBorder = px(node, 'border-bottom-width');
            return node.scrollHeight + topBorder + bottomBorder;
        }

        function px(node, styleProperty) {
            if (node.nodeType === ELEMENT_NODE) {
                let value = getComputedStyle(node).getPropertyValue(styleProperty);
                if (value.slice(-2) === 'px') {
                    value = value.slice(0, -2);
                    return parseFloat(value);
                }
            }

            return NaN;
        }
    }

    function newInliner() {
        const URL_REGEX = /url\(['"]?([^'"]+?)['"]?\)/g;

        return {
            inlineAll: inlineAll,
            shouldProcess: shouldProcess,
            impl: {
                readUrls: readUrls,
                inline: inline,
            },
        };

        function shouldProcess(string) {
            return string.search(URL_REGEX) !== -1;
        }

        function readUrls(string) {
            const result = [];
            let match;
            while ((match = URL_REGEX.exec(string)) !== null) {
                result.push(match[1]);
            }
            return result.filter(function (url) {
                return !util.isDataUrl(url);
            });
        }

        function inline(string, url, baseUrl, get) {
            return Promise.resolve(url)
                .then(function (urlValue) {
                    return baseUrl ? util.resolveUrl(urlValue, baseUrl) : urlValue;
                })
                .then(get || util.getAndEncode)
                .then(function (dataUrl) {
                    return string.replace(urlAsRegex(url), `$1${dataUrl}$3`);
                });

            function urlAsRegex(urlValue) {
                return new RegExp(
                    `(url\\(['"]?)(${util.escape(urlValue)})(['"]?\\))`,
                    'g'
                );
            }
        }

        function inlineAll(string, baseUrl, get) {
            if (nothingToInline()) {
                return Promise.resolve(string);
            }

            return Promise.resolve(string)
                .then(readUrls)
                .then(function (urls) {
                    let done = Promise.resolve(string);
                    urls.forEach(function (url) {
                        done = done.then(function (prefix) {
                            return inline(prefix, url, baseUrl, get);
                        });
                    });
                    return done;
                });

            function nothingToInline() {
                return !shouldProcess(string);
            }
        }
    }

    function newFontFaces() {
        return {
            resolveAll: resolveAll,
            impl: {
                readAll: readAll,
            },
        };

        function resolveAll() {
            return readAll()
                .then(function (webFonts) {
                    return Promise.all(
                        webFonts.map(function (webFont) {
                            return webFont.resolve();
                        })
                    );
                })
                .then(function (cssStrings) {
                    return cssStrings.join('\n');
                });
        }

        function readAll() {
            return Promise.resolve(util.asArray(document.styleSheets))
                .then(getCssRules)
                .then(selectWebFontRules)
                .then(function (rules) {
                    return rules.map(newWebFont);
                });

            function selectWebFontRules(cssRules) {
                return cssRules
                    .filter(function (rule) {
                        return rule.type === CSSRule.FONT_FACE_RULE;
                    })
                    .filter(function (rule) {
                        return inliner.shouldProcess(rule.style.getPropertyValue('src'));
                    });
            }

            function getCssRules(styleSheets) {
                const cssRules = [];
                styleSheets.forEach(function (sheet) {
                    const sheetProto = Object.getPrototypeOf(sheet);
                    if (Object.prototype.hasOwnProperty.call(sheetProto, 'cssRules')) {
                        try {
                            util.asArray(sheet.cssRules || []).forEach(
                                cssRules.push.bind(cssRules)
                            );
                        } catch (e) {
                            console.error(
                                `domtoimage: Error while reading CSS rules from ${sheet.href}`,
                                e.toString()
                            );
                        }
                    }
                });
                return cssRules;
            }

            function newWebFont(webFontRule) {
                return {
                    resolve: function resolve() {
                        const baseUrl = (webFontRule.parentStyleSheet || {}).href;
                        return inliner.inlineAll(webFontRule.cssText, baseUrl);
                    },
                    src: function () {
                        return webFontRule.style.getPropertyValue('src');
                    },
                };
            }
        }
    }

    function newImages() {
        return {
            inlineAll: inlineAll,
            impl: {
                newImage: newImage,
            },
        };

        function newImage(element) {
            return {
                inline: inline,
            };

            function inline(get) {
                if (util.isDataUrl(element.src)) {
                    return Promise.resolve();
                }

                return Promise.resolve(element.src)
                    .then(get || util.getAndEncode)
                    .then(function (dataUrl) {
                        return new Promise(function (resolve) {
                            element.onload = resolve;
                            // for any image with invalid src(such as <img src />), just ignore it
                            element.onerror = resolve;
                            element.src = dataUrl;
                        });
                    });
            }
        }

        function inlineAll(node) {
            if (!util.isElement(node)) {
                return Promise.resolve(node);
            }

            return inlineCSSProperty(node).then(function () {
                if (util.isHTMLImageElement(node)) {
                    return newImage(node).inline();
                } else {
                    return Promise.all(
                        util.asArray(node.childNodes).map(function (child) {
                            return inlineAll(child);
                        })
                    );
                }
            });

            function inlineCSSProperty(node) {
                const properties = ['background', 'background-image'];

                const inliningTasks = properties.map(function (propertyName) {
                    const value = node.style.getPropertyValue(propertyName);
                    const priority = node.style.getPropertyPriority(propertyName);

                    if (!value) {
                        return Promise.resolve();
                    }

                    return inliner.inlineAll(value).then(function (inlinedValue) {
                        node.style.setProperty(propertyName, inlinedValue, priority);
                    });
                });

                return Promise.all(inliningTasks).then(function () {
                    return node;
                });
            }
        }
    }

    function setStyleProperty(targetStyle, name, value, priority) {
        const needs_prefixing = ['background-clip'].indexOf(name) >= 0;
        if (priority) {
            targetStyle.setProperty(name, value, priority);
            if (needs_prefixing) {
                targetStyle.setProperty(`-webkit-${name}`, value, priority);
            }
        } else {
            targetStyle.setProperty(name, value);
            if (needs_prefixing) {
                targetStyle.setProperty(`-webkit-${name}`, value);
            }
        }
    }

    function copyUserComputedStyleFast(
        options,
        sourceElement,
        sourceComputedStyles,
        parentComputedStyles,
        targetElement
    ) {
        const defaultStyle = domtoimage.impl.options.copyDefaultStyles
            ? getDefaultStyle(options, sourceElement)
            : {};
        const targetStyle = targetElement.style;

        util.asArray(sourceComputedStyles).forEach(function (name) {
            if (options.filterStyles) {
                if (!options.filterStyles(sourceElement, name)) {
                    return;
                }
            }

            const sourceValue = sourceComputedStyles.getPropertyValue(name);
            const defaultValue = defaultStyle[name];
            const parentValue = parentComputedStyles
                ? parentComputedStyles.getPropertyValue(name)
                : undefined;

            // Ignore setting style property on clone node, if already it has a style (through adjustCloneNode)
            const targetValue = targetStyle.getPropertyValue(name);
            if (targetValue) return;

            // If the style does not match the default, or it does not match the parent's, set it. We don't know which
            // styles are inherited from the parent and which aren't, so we have to always check both.
            if (
                sourceValue !== defaultValue ||
                (parentComputedStyles && sourceValue !== parentValue)
            ) {
                const priority = sourceComputedStyles.getPropertyPriority(name);
                setStyleProperty(targetStyle, name, sourceValue, priority);
            }
        });
    }

    let removeDefaultStylesTimeoutId = null;
    let tagNameDefaultStyles = {};

    const ascentStoppers = [
        // these come from https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
        'ADDRESS',
        'ARTICLE',
        'ASIDE',
        'BLOCKQUOTE',
        'DETAILS',
        'DIALOG',
        'DD',
        'DIV',
        'DL',
        'DT',
        'FIELDSET',
        'FIGCAPTION',
        'FIGURE',
        'FOOTER',
        'FORM',
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'HEADER',
        'HGROUP',
        'HR',
        'LI',
        'MAIN',
        'NAV',
        'OL',
        'P',
        'PRE',
        'SECTION',
        'SVG',
        'TABLE',
        'UL',
        // this is some non-standard ones
        'math', // intentionally lowercase, thanks Safari
        'svg', // in case we have an svg embedded element
        // these are ultimate stoppers in case something drastic changes in how the DOM works
        'BODY',
        'HEAD',
        'HTML',
    ];

    function getDefaultStyle(options, sourceElement) {
        const tagHierarchy = computeTagHierarchy(sourceElement);
        const tagKey = computeTagKey(tagHierarchy);
        if (tagNameDefaultStyles[tagKey]) {
            return tagNameDefaultStyles[tagKey];
        }

        // We haven't cached the answer for that hierachy yet, build a
        // sandbox (if not yet created), fill it with the hierarchy that
        // matters, and grab the default styles associated
        const sandboxWindow = ensureSandboxWindow();
        const defaultElement = constructElementHierachy(
            sandboxWindow.document,
            tagHierarchy
        );
        const defaultStyle = computeStyleForDefaults(sandboxWindow, defaultElement);
        destroyElementHierarchy(defaultElement);

        tagNameDefaultStyles[tagKey] = defaultStyle;
        return defaultStyle;

        function computeTagHierarchy(sourceNode) {
            const tagNames = [];

            do {
                if (sourceNode.nodeType === ELEMENT_NODE) {
                    const tagName = sourceNode.tagName;
                    tagNames.push(tagName);

                    if (ascentStoppers.includes(tagName)) {
                        break;
                    }
                }

                sourceNode = sourceNode.parentNode;
            } while (sourceNode);

            return tagNames;
        }

        function computeTagKey(tagHierarchy) {
            if (options.styleCaching === 'relaxed') {
                // pick up only the ascent-stopping element tag and the element tag itself
                /* jshint unused:true */
                return tagHierarchy
                    .filter((_, i, a) => i === 0 || i === a.length - 1)
                    .join('>');
            }
            // for all other cases, fall back the the entire path
            return tagHierarchy.join('>'); // it's like CSS
        }

        function constructElementHierachy(sandboxDocument, tagHierarchy) {
            let element = sandboxDocument.body;
            do {
                const childTagName = tagHierarchy.pop();
                const childElement = sandboxDocument.createElement(childTagName);
                element.appendChild(childElement);
                element = childElement;
            } while (tagHierarchy.length > 0);

            // Ensure that there is some content, so that properties like margin are applied.
            // we use zero-width space to handle FireFox adding a pixel
            element.textContent = '\u200b';
            return element;
        }

        function computeStyleForDefaults(sandboxWindow, defaultElement) {
            const defaultStyle = {};
            const defaultComputedStyle = sandboxWindow.getComputedStyle(defaultElement);

            // Copy styles to an object, making sure that 'width' and 'height' are given the default value of 'auto', since
            // their initial value is always 'auto' despite that the default computed value is sometimes an absolute length.
            util.asArray(defaultComputedStyle).forEach(function (name) {
                defaultStyle[name] =
                    name === 'width' || name === 'height'
                        ? 'auto'
                        : defaultComputedStyle.getPropertyValue(name);
            });
            return defaultStyle;
        }

        function destroyElementHierarchy(element) {
            do {
                const parentElement = element.parentElement;
                if (parentElement !== null) {
                    parentElement.removeChild(element);
                }
                element = parentElement;
            } while (element && element.tagName !== 'BODY');
        }
    }

    function ensureSandboxWindow() {
        if (sandbox) {
            return sandbox.contentWindow;
        }

        // figure out how this document is defined (doctype and charset)
        const charsetToUse = document.characterSet || 'UTF-8';
        const docType = document.doctype;
        const docTypeDeclaration = docType
            ? `<!DOCTYPE ${escapeHTML(docType.name)} ${escapeHTML(
                  docType.publicId
              )} ${escapeHTML(docType.systemId)}`.trim() + '>'
            : '';

        // Create a hidden sandbox <iframe> element within we can create default HTML elements and query their
        // computed styles. Elements must be rendered in order to query their computed styles. The <iframe> won't
        // render at all with `display: none`, so we have to use `visibility: hidden` with `position: fixed`.
        sandbox = document.createElement('iframe');
        sandbox.id = 'domtoimage-sandbox-' + util.uid();
        sandbox.style.visibility = 'hidden';
        sandbox.style.position = 'fixed';
        document.body.appendChild(sandbox);

        return tryTechniques(
            sandbox,
            docTypeDeclaration,
            charsetToUse,
            'domtoimage-sandbox'
        );

        function escapeHTML(unsafeText) {
            if (unsafeText) {
                const div = document.createElement('div');
                div.innerText = unsafeText;
                return div.innerHTML;
            } else {
                return '';
            }
        }

        function tryTechniques(sandbox, doctype, charset, title) {
            // try the good old-fashioned document write with all the correct attributes set
            try {
                sandbox.contentWindow.document.write(
                    `${doctype}<html><head><meta charset='${charset}'><title>${title}</title></head><body></body></html>`
                );
                return sandbox.contentWindow;
            } catch (_) {
                // swallow exception and fall through to next technique
            }

            const metaCharset = document.createElement('meta');
            metaCharset.setAttribute('charset', charset);

            // let's attempt it using srcdoc, so we can still set the doctype and charset
            try {
                const sandboxDocument = document.implementation.createHTMLDocument(title);
                sandboxDocument.head.appendChild(metaCharset);
                const sandboxHTML = doctype + sandboxDocument.documentElement.outerHTML;
                sandbox.setAttribute('srcdoc', sandboxHTML);
                return sandbox.contentWindow;
            } catch (_) {
                // swallow exception and fall through to the simplest path
            }

            // let's attempt it using contentDocument... here we're not able to set the doctype
            sandbox.contentDocument.head.appendChild(metaCharset);
            sandbox.contentDocument.title = title;
            return sandbox.contentWindow;
        }
    }

    function removeSandbox() {
        if (sandbox) {
            document.body.removeChild(sandbox);
            sandbox = null;
        }

        if (removeDefaultStylesTimeoutId) {
            clearTimeout(removeDefaultStylesTimeoutId);
        }

        removeDefaultStylesTimeoutId = setTimeout(() => {
            removeDefaultStylesTimeoutId = null;
            tagNameDefaultStyles = {};
        }, 20 * 1000);
    }
})(this);
