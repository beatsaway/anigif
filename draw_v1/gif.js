// gif.js
// This is a simplified version of the GIF encoder to be used locally
// Based on gif.worker.js

(function(window) {
    'use strict';

    // ByteArray for output data
    function ByteArray() {
        this.page = -1;
        this.pages = [];
        this.newPage();
    }

    ByteArray.pageSize = 4096;
    ByteArray.charMap = {};
    for (var i = 0; i < 256; i++) {
        ByteArray.charMap[i] = String.fromCharCode(i);
    }

    ByteArray.prototype.newPage = function() {
        this.pages[++this.page] = new Uint8Array(ByteArray.pageSize);
        this.cursor = 0;
    };

    ByteArray.prototype.getData = function() {
        var rv = '';
        for (var p = 0; p < this.pages.length; p++) {
            for (var i = 0; i < ByteArray.pageSize; i++) {
                rv += ByteArray.charMap[this.pages[p][i]];
            }
        }
        return rv;
    };

    ByteArray.prototype.writeByte = function(val) {
        if (this.cursor >= ByteArray.pageSize) this.newPage();
        this.pages[this.page][this.cursor++] = val;
    };

    ByteArray.prototype.writeUTFBytes = function(string) {
        for (var l = string.length, i = 0; i < l; i++)
            this.writeByte(string.charCodeAt(i));
    };

    ByteArray.prototype.writeBytes = function(array, offset, length) {
        for (var l = length || array.length, i = offset || 0; i < l; i++)
            this.writeByte(array[i]);
    };

    // NeuQuant color quantizer by Anthony Dekker (MIT License)
    function NeuQuant(pixels, samplefac) {
        var network;
        var netindex;
        var bias;
        var freq;
        var radpower;

        var netsize = 256; // Number of colors to use
        var maxnetpos = netsize - 1;
        var netbiasshift = 4; // Bias for color values
        var intbiasshift = 16; // Bias for fractions
        var intbias = 1 << intbiasshift;
        var gammashift = 10;
        var gamma = 1 << gammashift;
        var betashift = 10;
        var beta = intbias >> betashift;
        var betagamma = intbias << (gammashift - betashift);
        var initrad = netsize >> 3;
        var radiusbiasshift = 6;
        var radiusbias = 1 << radiusbiasshift;
        var initradius = initrad * radiusbias;
        var radiusdec = 30;
        var alphabiasshift = 10;
        var initalpha = 1 << alphabiasshift;
        var radbiasshift = 8;
        var radbias = 1 << radbiasshift;
        var alpharadbshift = alphabiasshift + radbiasshift;
        var alpharadbias = 1 << alpharadbshift;
        var prime1 = 499;
        var prime2 = 491;
        var prime3 = 487;
        var prime4 = 503;
        var minpicturebytes = 3 * prime4;
        var ncycles = 100; // Number of learning cycles

        function init() {
            network = [];
            netindex = new Int32Array(256);
            bias = new Int32Array(netsize);
            freq = new Int32Array(netsize);
            radpower = new Int32Array(netsize >> 3);
            var i, v;
            for (i = 0; i < netsize; i++) {
                v = (i << (netbiasshift + 8)) / netsize;
                network[i] = new Float64Array([v, v, v, 0]);
                freq[i] = intbias / netsize;
                bias[i] = 0;
            }
        }

        function unbiasnet() {
            for (var i = 0; i < netsize; i++) {
                network[i][0] >>= netbiasshift;
                network[i][1] >>= netbiasshift;
                network[i][2] >>= netbiasshift;
                network[i][3] = i;
            }
        }

        function altersingle(alpha, i, b, g, r) {
            network[i][0] -= (alpha * (network[i][0] - b)) / initalpha;
            network[i][1] -= (alpha * (network[i][1] - g)) / initalpha;
            network[i][2] -= (alpha * (network[i][2] - r)) / initalpha;
        }

        function alterneigh(radius, i, b, g, r) {
            var lo = Math.abs(i - radius);
            var hi = Math.min(i + radius, netsize);
            var j = i + 1;
            var k = i - 1;
            var m = 1;
            var p, a;
            while (j < hi || k > lo) {
                a = radpower[m++];
                if (j < hi) {
                    p = network[j++];
                    p[0] -= (a * (p[0] - b)) / alpharadbias;
                    p[1] -= (a * (p[1] - g)) / alpharadbias;
                    p[2] -= (a * (p[2] - r)) / alpharadbias;
                }
                if (k > lo) {
                    p = network[k--];
                    p[0] -= (a * (p[0] - b)) / alpharadbias;
                    p[1] -= (a * (p[1] - g)) / alpharadbias;
                    p[2] -= (a * (p[2] - r)) / alpharadbias;
                }
            }
        }

        function contest(b, g, r) {
            var bestd = ~(1 << 31);
            var bestbiasd = bestd;
            var bestpos = -1;
            var bestbiaspos = bestpos;
            var i, n, dist, biasdist, betafreq;
            for (i = 0; i < netsize; i++) {
                n = network[i];
                dist = Math.abs(n[0] - b) + Math.abs(n[1] - g) + Math.abs(n[2] - r);
                if (dist < bestd) {
                    bestd = dist;
                    bestpos = i;
                }
                biasdist = dist - (bias[i] >> (intbiasshift - netbiasshift));
                if (biasdist < bestbiasd) {
                    bestbiasd = biasdist;
                    bestbiaspos = i;
                }
                betafreq = freq[i] >> betashift;
                freq[i] -= betafreq;
                bias[i] += betafreq << gammashift;
            }
            freq[bestpos] += beta;
            bias[bestpos] -= betagamma;
            return bestbiaspos;
        }

        function inxbuild() {
            var i, j, p, q, smallpos, smallval, previouscol = 0, startpos = 0;
            for (i = 0; i < netsize; i++) {
                p = network[i];
                smallpos = i;
                smallval = p[1];
                for (j = i + 1; j < netsize; j++) {
                    q = network[j];
                    if (q[1] < smallval) {
                        smallpos = j;
                        smallval = q[1];
                    }
                }
                q = network[smallpos];
                if (i != smallpos) {
                    j = q[0];
                    q[0] = p[0];
                    p[0] = j;
                    j = q[1];
                    q[1] = p[1];
                    p[1] = j;
                    j = q[2];
                    q[2] = p[2];
                    p[2] = j;
                    j = q[3];
                    q[3] = p[3];
                    p[3] = j;
                }
                if (smallval != previouscol) {
                    netindex[previouscol] = (startpos + i) >> 1;
                    for (j = previouscol + 1; j < smallval; j++)
                        netindex[j] = i;
                    previouscol = smallval;
                    startpos = i;
                }
            }
            netindex[previouscol] = (startpos + maxnetpos) >> 1;
            for (j = previouscol + 1; j < 256; j++)
                netindex[j] = maxnetpos;
        }

        function inxsearch(b, g, r) {
            var a, p, dist;
            var bestd = 1000;
            var best = -1;
            var i = netindex[g];
            var j = i - 1;
            while (i < netsize || j >= 0) {
                if (i < netsize) {
                    p = network[i];
                    dist = p[1] - g;
                    if (dist >= bestd) i = netsize;
                    else {
                        i++;
                        if (dist < 0) dist = -dist;
                        a = p[0] - b;
                        if (a < 0) a = -a;
                        dist += a;
                        if (dist < bestd) {
                            a = p[2] - r;
                            if (a < 0) a = -a;
                            dist += a;
                            if (dist < bestd) {
                                bestd = dist;
                                best = p[3];
                            }
                        }
                    }
                }
                if (j >= 0) {
                    p = network[j];
                    dist = g - p[1];
                    if (dist >= bestd) j = -1;
                    else {
                        j--;
                        if (dist < 0) dist = -dist;
                        a = p[0] - b;
                        if (a < 0) a = -a;
                        dist += a;
                        if (dist < bestd) {
                            a = p[2] - r;
                            if (a < 0) a = -a;
                            dist += a;
                            if (dist < bestd) {
                                bestd = dist;
                                best = p[3];
                            }
                        }
                    }
                }
            }
            return best;
        }

        function learn() {
            var i;
            var lengthcount = pixels.length;
            var alphadec = 30 + ((samplefac - 1) / 3);
            var samplepixels = lengthcount / (3 * samplefac);
            var delta = ~~(samplepixels / ncycles);
            var alpha = initalpha;
            var radius = initradius;
            var rad = radius >> radiusbiasshift;
            if (rad <= 1) rad = 0;
            for (i = 0; i < rad; i++)
                radpower[i] = alpha * (((rad * rad - i * i) * radbias) / (rad * rad));
            var step;
            if (lengthcount < minpicturebytes) {
                samplefac = 1;
                step = 3;
            } else if ((lengthcount % prime1) !== 0) {
                step = 3 * prime1;
            } else if ((lengthcount % prime2) !== 0) {
                step = 3 * prime2;
            } else if ((lengthcount % prime3) !== 0) {
                step = 3 * prime3;
            } else {
                step = 3 * prime4;
            }
            var b, g, r, j;
            var pix = 0;
            i = 0;
            while (i < samplepixels) {
                b = (pixels[pix] & 0xff) << netbiasshift;
                g = (pixels[pix + 1] & 0xff) << netbiasshift;
                r = (pixels[pix + 2] & 0xff) << netbiasshift;
                j = contest(b, g, r);
                altersingle(alpha, j, b, g, r);
                if (rad !== 0) alterneigh(rad, j, b, g, r);
                pix += step;
                if (pix >= lengthcount) pix -= lengthcount;
                i++;
                if (delta === 0) delta = 1;
                if (i % delta === 0) {
                    alpha -= alpha / alphadec;
                    radius -= radius / radiusdec;
                    rad = radius >> radiusbiasshift;
                    if (rad <= 1) rad = 0;
                    for (j = 0; j < rad; j++)
                        radpower[j] = alpha * (((rad * rad - j * j) * radbias) / (rad * rad));
                }
            }
        }

        function buildColormap() {
            init();
            learn();
            unbiasnet();
            inxbuild();
        }

        function getColormap() {
            var map = [];
            var index = [];
            for (var i = 0; i < netsize; i++)
                index[network[i][3]] = i;
            var k = 0;
            for (var l = 0; l < netsize; l++) {
                var j = index[l];
                map[k++] = (network[j][0]);
                map[k++] = (network[j][1]);
                map[k++] = (network[j][2]);
            }
            return map;
        }

        // Public interface
        this.buildColormap = buildColormap;
        this.getColormap = getColormap;
        this.lookupRGB = inxsearch;
    }

    // LZWEncoder adapted from Java version by Kevin Weiner
    function LZWEncoder(width, height, pixels, colorDepth) {
        var EOF = -1;
        var imgW = width;
        var imgH = height;
        var pixelArray = pixels;
        var initCodeSize = Math.max(2, colorDepth);
        var remaining;
        var curPixel;
        
        // GIFCOMPR.C - GIF Image compression routines
        // Lempel-Ziv compression based on 'compress'. GIF modifications by
        // David Rowley (mgardi@watdcsu.waterloo.edu)
        // General DEFINEs
        var BITS = 12;
        var HSIZE = 5003; // 80% occupancy
        
        // GIF Image compression - modified 'compress'
        // Algorithm: use open addressing double hashing (no chaining) on the
        // prefix code / next character combination. We do a variant of Knuth's
        // algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
        // secondary probe. Here, the modular division first probe is gives way
        // to a faster exclusive-or manipulation. Also do block compression with
        // an adaptive reset, whereby the code table is cleared when the compression
        // ratio decreases, but after the table fills. The variable-length output
        // codes are re-sized at this point, and a special CLEAR code is generated
        // for the decompressor. Late addition: construct the table according to
        // file size for noticeable speed improvement on small files. Please direct
        // questions about this implementation to ames!jaw.
        var g_init_bits;
        var ClearCode;
        var EOFCode;
        
        // output
        // Output the given code.
        // Inputs:
        // code: A n_bits-bit integer. If == -1, then EOF. This assumes
        // that n_bits =< wordsize - 1.
        // Outputs:
        // Outputs code to the file.
        // Assumptions:
        // Chars are 8 bits long.
        // Algorithm:
        // Maintain a BITS character long buffer (so that 8 codes will
        // fit in it exactly). Use the VAX insv instruction to insert each
        // code in turn. When the buffer fills up empty it and start over.
        
        var cur_accum = 0;
        var cur_bits = 0;
        var masks = [0x0000, 0x0001, 0x0003, 0x0007, 0x000F, 0x001F, 0x003F, 0x007F, 0x00FF, 0x01FF, 0x03FF, 0x07FF, 0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF];
        
        // Number of characters so far in this 'packet'
        var a_count;
        
        // Define the storage for the packet accumulator
        var accum = [];
        
        var htab = [];
        var codetab = [];
        
        var n_bits; // number of bits/code
        var maxcode; // maximum code, given n_bits
        var free_ent = 0; // first unused entry
        
        // block compression parameters -- after all codes are used up,
        // and compression rate changes, start over.
        var clear_flg = false;
        
        // Algorithm: use open addressing double hashing (no chaining) on the
        // prefix code / next character combination. We do a variant of Knuth's
        // algorithm D (vol. 3, sec. 6.4) along with G. Knott's relatively-prime
        // secondary probe. Here, the modular division first probe is gives way
        // to a faster exclusive-or manipulation. Also do block compression with
        // an adaptive reset, whereby the code table is cleared when the compression
        // ratio decreases, but after the table fills. The variable-length output
        // codes are re-sized at this point, and a special CLEAR code is generated
        // for the decompressor. Late addition: construct the table according to
        // file size for noticeable speed improvement on small files. Please direct
        // questions about this implementation to ames!jaw.
        var n_bits; // number of bits/code
        var maxcode; // maximum code, given n_bits
        var maxmaxcode = 1 << BITS; // should NEVER generate this code
        
        // MAXCODE( n_bits ):
        function MAXCODE(n_bits) {
            return (1 << n_bits) - 1;
        }
        
        // Clear out the hash table
        // table clear for block compress
        function cl_block(outs) {
            cl_hash(HSIZE);
            free_ent = ClearCode + 2;
            clear_flg = true;
            output(ClearCode, outs);
        }
        
        // Reset code table
        function cl_hash(hsize) {
            for (var i = 0; i < hsize; ++i)
                htab[i] = -1;
        }
        
        function char_out(c, outs) {
            accum[a_count++] = c;
            if (a_count >= 254) flush_char(outs);
        }
        
        function flush_char(outs) {
            if (a_count > 0) {
                outs.writeByte(a_count);
                outs.writeBytes(accum, 0, a_count);
                a_count = 0;
            }
        }
        
        function nextPixel() {
            if (remaining === 0) return EOF;
            --remaining;
            var pix = pixelArray[curPixel++];
            return pix & 0xff;
        }
        
        function output(code, outs) {
            cur_accum &= masks[cur_bits];
            if (cur_bits > 0) cur_accum |= (code << cur_bits);
            else cur_accum = code;
            cur_bits += n_bits;
            while (cur_bits >= 8) {
                char_out((cur_accum & 0xff), outs);
                cur_accum >>= 8;
                cur_bits -= 8;
            }
            
            // If the next entry is going to be too big for the code size,
            // then increase it, if possible.
            if (free_ent > maxcode || clear_flg) {
                if (clear_flg) {
                    maxcode = MAXCODE(n_bits = g_init_bits);
                    clear_flg = false;
                } else {
                    ++n_bits;
                    if (n_bits == BITS) maxcode = maxmaxcode;
                    else maxcode = MAXCODE(n_bits);
                }
            }
            
            if (code == EOFCode) {
                // At EOF, write the rest of the buffer.
                while (cur_bits > 0) {
                    char_out((cur_accum & 0xff), outs);
                    cur_accum >>= 8;
                    cur_bits -= 8;
                }
                flush_char(outs);
            }
        }
        
        function compress(init_bits, outs) {
            var fcode, c, i, ent, disp, hsize_reg, hshift;
            
            // Set up the globals: g_init_bits - initial number of bits
            g_init_bits = init_bits;
            
            // Set up the necessary values
            clear_flg = false;
            n_bits = g_init_bits;
            maxcode = MAXCODE(n_bits);
            
            ClearCode = 1 << (init_bits - 1);
            EOFCode = ClearCode + 1;
            free_ent = ClearCode + 2;
            
            a_count = 0; // clear packet
            
            ent = nextPixel();
            
            hshift = 0;
            for (fcode = HSIZE; fcode < 65536; fcode *= 2)
                ++hshift;
            hshift = 8 - hshift; // set hash code range bound
            
            hsize_reg = HSIZE;
            cl_hash(hsize_reg); // clear hash table
            
            output(ClearCode, outs);
            
            outer_loop: while ((c = nextPixel()) != EOF) {
                fcode = (c << BITS) + ent;
                i = (c << hshift) ^ ent; // xor hashing
                
                if (htab[i] === fcode) {
                    ent = codetab[i];
                    continue;
                } else if (htab[i] >= 0) { // non-empty slot
                    disp = hsize_reg - i; // secondary hash (after G. Knott)
                    if (i === 0) disp = 1;
                    do {
                        if ((i -= disp) < 0) i += hsize_reg;
                        
                        if (htab[i] === fcode) {
                            ent = codetab[i];
                            continue outer_loop;
                        }
                    } while (htab[i] >= 0);
                }
                output(ent, outs);
                ent = c;
                if (free_ent < maxmaxcode) {
                    codetab[i] = free_ent++; // code -> hashtable
                    htab[i] = fcode;
                } else cl_block(outs);
            }
            
            // Put out the final code.
            output(ent, outs);
            output(EOFCode, outs);
        }
        
        // Main function
        this.encode = function(outs) {
            outs.writeByte(initCodeSize); // write "initial code size" byte
            remaining = imgW * imgH; // reset navigation variables
            curPixel = 0;
            compress(initCodeSize + 1, outs); // compress and write pixel data
            outs.writeByte(0); // write block terminator
        };
    }

    // GIFEncoder
    function GIFEncoder(width, height) {
        var width = ~~width;
        var height = ~~height;
        
        // Default values
        this.width = width;
        this.height = height;
        this.transparent = null;
        this.transIndex = 0;
        this.repeat = -1; // Default: no repeat
        this.delay = 0; // Frame delay (1/100 seconds)
        this.image = null; // Current frame
        this.pixels = null; // BGR pixels from frame
        this.indexedPixels = null; // Indexed pixels from frame
        this.colorDepth = null; // Number of bit planes
        this.colorTab = null; // RGB palette
        this.neuQuant = null; // NeuQuant instance
        this.usedEntry = new Array(); // Active palette entries
        this.palSize = 7; // Color table size (bits-1)
        this.dispose = -1; // Disposal code
        this.firstFrame = true;
        this.sample = 10; // Default sample interval for quantizer
        this.dither = false; // Whether to dither
        this.globalPalette = false;
        this.out = new ByteArray();
    }

    GIFEncoder.prototype.setDelay = function(milliseconds) {
        this.delay = Math.round(milliseconds / 10);
    };

    GIFEncoder.prototype.setFrameRate = function(fps) {
        this.delay = Math.round(100 / fps);
    };

    GIFEncoder.prototype.setDispose = function(disposalCode) {
        if (disposalCode >= 0) this.dispose = disposalCode;
    };

    GIFEncoder.prototype.setRepeat = function(repeat) {
        this.repeat = repeat;
    };

    GIFEncoder.prototype.setTransparent = function(color) {
        this.transparent = color;
    };

    GIFEncoder.prototype.addFrame = function(imageData) {
        this.image = imageData;
        this.colorTab = this.globalPalette && this.globalPalette.slice ? this.globalPalette : null;
        this.getImagePixels();
        this.analyzePixels();
        if (this.globalPalette === true) this.globalPalette = this.colorTab;
        if (this.firstFrame) {
            this.writeLSD();
            this.writePalette();
            if (this.repeat >= 0) {
                this.writeNetscapeExt();
            }
        }
        this.writeGraphicCtrlExt();
        this.writeImageDesc();
        if (!this.firstFrame && !this.globalPalette) this.writePalette();
        this.writePixels();
        this.firstFrame = false;
    };
    
    GIFEncoder.prototype.finish = function() {
        this.out.writeByte(59); // GIF trailer
    };
    
    GIFEncoder.prototype.setQuality = function(quality) {
        if (quality < 1) quality = 1;
        this.sample = quality;
    };
    
    GIFEncoder.prototype.setDither = function(dither) {
        if (dither === true) dither = 'FloydSteinberg';
        this.dither = dither;
    };
    
    GIFEncoder.prototype.setGlobalPalette = function(palette) {
        this.globalPalette = palette;
    };
    
    GIFEncoder.prototype.getGlobalPalette = function() {
        return (this.globalPalette && this.globalPalette.slice && this.globalPalette.slice(0)) || this.globalPalette;
    };
    
    GIFEncoder.prototype.writeHeader = function() {
        this.out.writeUTFBytes("GIF89a");
    };
    
    GIFEncoder.prototype.analyzePixels = function() {
        if (!this.colorTab) {
            this.neuQuant = new NeuQuant(this.pixels, this.sample);
            this.neuQuant.buildColormap();
            this.colorTab = this.neuQuant.getColormap();
        }
        
        if (this.dither) {
            this.ditherPixels(this.dither.replace('-serpentine', ''),
                              this.dither.match(/-serpentine/) !== null);
        } else {
            this.indexPixels();
        }
        
        this.pixels = null;
        this.colorDepth = 8;
        this.palSize = 7;
        
        if (this.transparent !== null) {
            this.transIndex = this.findClosest(this.transparent, true);
        }
    };
    
    GIFEncoder.prototype.indexPixels = function(imgq) {
        var nPix = this.pixels.length / 3;
        this.indexedPixels = new Uint8Array(nPix);
        var k = 0;
        for (var j = 0; j < nPix; j++) {
            var index = this.findClosestRGB(
                this.pixels[k++] & 0xff,
                this.pixels[k++] & 0xff,
                this.pixels[k++] & 0xff
            );
            this.usedEntry[index] = true;
            this.indexedPixels[j] = index;
        }
    };
    
    GIFEncoder.prototype.ditherPixels = function(kernel, serpentine) {
        var kernels = {
            FalseFloydSteinberg: [
                [3 / 8, 1, 0],
                [3 / 8, 0, 1],
                [2 / 8, 1, 1]
            ],
            FloydSteinberg: [
                [7 / 16, 1, 0],
                [3 / 16, -1, 1],
                [5 / 16, 0, 1],
                [1 / 16, 1, 1]
            ],
            Stucki: [
                [8 / 42, 1, 0],
                [4 / 42, 2, 0],
                [2 / 42, -2, 1],
                [4 / 42, -1, 1],
                [8 / 42, 0, 1],
                [4 / 42, 1, 1],
                [2 / 42, 2, 1],
                [1 / 42, -2, 2],
                [2 / 42, -1, 2],
                [4 / 42, 0, 2],
                [2 / 42, 1, 2],
                [1 / 42, 2, 2]
            ],
            Atkinson: [
                [1 / 8, 1, 0],
                [1 / 8, 2, 0],
                [1 / 8, -1, 1],
                [1 / 8, 0, 1],
                [1 / 8, 1, 1],
                [1 / 8, 0, 2]
            ]
        };
        
        if (!kernel || !kernels[kernel]) {
            throw 'Unknown dithering kernel: ' + kernel;
        }
        
        var ds = kernels[kernel];
        var index = 0,
            height = this.height,
            width = this.width,
            data = this.pixels;
        var direction = serpentine ? -1 : 1;
        
        this.indexedPixels = new Uint8Array(this.pixels.length / 3);
        
        for (var y = 0; y < height; y++) {
            if (serpentine)
                direction = direction * -1;
            
            for (var x = (direction == 1) ? 0 : width - 1,
                    xend = (direction == 1) ? width : 0;
                 x !== xend;
                 x += direction) {
                     
                index = (y * width) + x;
                var idx = index * 3;
                var r1 = data[idx];
                var g1 = data[idx + 1];
                var b1 = data[idx + 2];
                
                idx = this.findClosestRGB(r1, g1, b1);
                this.usedEntry[idx] = true;
                this.indexedPixels[index] = idx;
                
                idx *= 3;
                var r2 = this.colorTab[idx];
                var g2 = this.colorTab[idx + 1];
                var b2 = this.colorTab[idx + 2];
                
                var er = r1 - r2;
                var eg = g1 - g2;
                var eb = b1 - b2;
                
                for (var i = (direction == 1 ? 0 : ds.length - 1),
                        end = (direction == 1 ? ds.length : 0);
                     i !== end;
                     i += direction) {
                    var x1 = ds[i][1];
                    var y1 = ds[i][2];
                    
                    if (x1 + x >= 0 && x1 + x < width &&
                        y1 + y >= 0 && y1 + y < height) {
                        var d = ds[i][0];
                        idx = index + x1 + (y1 * width);
                        idx *= 3;
                        
                        data[idx] = Math.max(0, Math.min(255, data[idx] + er * d));
                        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + eg * d));
                        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + eb * d));
                    }
                }
            }
        }
    };
    
    GIFEncoder.prototype.findClosest = function(c, used) {
        return this.findClosestRGB(
            ((c & 0xFF0000) >> 16),
            ((c & 0x00FF00) >> 8),
            (c & 0x0000FF),
            used
        );
    };
    
    GIFEncoder.prototype.findClosestRGB = function(r, g, b, used) {
        if (this.colorTab === null) return -1;
        
        if (this.neuQuant && !used) {
            return this.neuQuant.lookupRGB(r, g, b);
        }
        
        var c = b | (g << 8) | (r << 16);
        var minpos = 0;
        var dmin = 256 * 256 * 256;
        var len = this.colorTab.length;
        
        for (var i = 0, index = 0; i < len; index++) {
            var dr = r - (this.colorTab[i++] & 0xff);
            var dg = g - (this.colorTab[i++] & 0xff);
            var db = b - (this.colorTab[i++] & 0xff);
            var d = dr * dr + dg * dg + db * db;
            if ((!used || this.usedEntry[index]) && d < dmin) {
                dmin = d;
                minpos = index;
            }
        }
        
        return minpos;
    };
    
    GIFEncoder.prototype.getImagePixels = function() {
        var w = this.width;
        var h = this.height;
        this.pixels = new Uint8Array(w * h * 3);
        
        var data = this.image;
        var srcPos = 0;
        var count = 0;
        
        for (var i = 0; i < h; i++) {
            for (var j = 0; j < w; j++) {
                this.pixels[count++] = data[srcPos++];
                this.pixels[count++] = data[srcPos++];
                this.pixels[count++] = data[srcPos++];
                srcPos++;
            }
        }
    };
    
    GIFEncoder.prototype.writeGraphicCtrlExt = function() {
        this.out.writeByte(0x21); // extension introducer
        this.out.writeByte(0xf9); // GCE label
        this.out.writeByte(4); // data block size
        
        var transp, disp;
        if (this.transparent === null) {
            transp = 0;
            disp = 0; // dispose = no action
        } else {
            transp = 1;
            disp = 2; // force clear if using transparent color
        }
        
        if (this.dispose >= 0) {
            disp = this.dispose & 7; // user override
        }
        disp <<= 2;
        
        // packed fields
        this.out.writeByte(
            0 | // 1:3 reserved
            disp | // 4:6 disposal
            0 | // 7 user input - 0 = none
            transp // 8 transparency flag
        );
        
        this.writeShort(this.delay); // delay x 1/100 sec
        this.out.writeByte(this.transIndex); // transparent color index
        this.out.writeByte(0); // block terminator
    };
    
    GIFEncoder.prototype.writeImageDesc = function() {
        this.out.writeByte(0x2c); // image separator
        this.writeShort(0); // image position x,y = 0,0
        this.writeShort(0);
        this.writeShort(this.width); // image size
        this.writeShort(this.height);
        
        // packed fields
        if (this.firstFrame || this.globalPalette) {
            // no LCT - GCT is used for first (or only) frame
            this.out.writeByte(0);
        } else {
            // specify normal LCT
            this.out.writeByte(
                0x80 | // 1 local color table 1=yes
                0 | // 2 interlace - 0=no
                0 | // 3 sorted - 0=no
                0 | // 4-5 reserved
                this.palSize // 6-8 size of color table
            );
        }
    };
    
    GIFEncoder.prototype.writeLSD = function() {
        // logical screen size
        this.writeShort(this.width);
        this.writeShort(this.height);
        
        // packed fields
        this.out.writeByte(
            0x80 | // 1 : global color table flag = 1 (gct used)
            0x70 | // 2-4 : color resolution = 7
            0x00 | // 5 : gct sort flag = 0
            this.palSize // 6-8 : gct size
        );
        
        this.out.writeByte(0); // background color index
        this.out.writeByte(0); // pixel aspect ratio - assume 1:1
    };
    
    GIFEncoder.prototype.writeNetscapeExt = function() {
        this.out.writeByte(0x21); // extension introducer
        this.out.writeByte(0xff); // app extension label
        this.out.writeByte(11); // block size
        this.out.writeUTFBytes('NETSCAPE2.0'); // app id + auth code
        this.out.writeByte(3); // sub-block size
        this.out.writeByte(1); // loop sub-block id
        this.writeShort(this.repeat); // loop count (extra iterations, 0=repeat forever)
        this.out.writeByte(0); // block terminator
    };
    
    GIFEncoder.prototype.writePalette = function() {
        this.out.writeBytes(this.colorTab);
        var n = (3 * 256) - this.colorTab.length;
        for (var i = 0; i < n; i++)
            this.out.writeByte(0);
    };
    
    GIFEncoder.prototype.writeShort = function(pValue) {
        this.out.writeByte(pValue & 0xFF);
        this.out.writeByte((pValue >> 8) & 0xFF);
    };
    
    GIFEncoder.prototype.writePixels = function() {
        var enc = new LZWEncoder(this.width, this.height, this.indexedPixels, this.colorDepth);
        enc.encode(this.out);
    };
    
    GIFEncoder.prototype.stream = function() {
        return this.out;
    };
    
    // Export the GIF encoder
    window.GIFEncoder = GIFEncoder;
    
})(window);
