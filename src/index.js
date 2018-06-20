'use strict';

// import this library in case you don't use the web worker
let GeoTIFF = require("geotiff");

let parse_data = (data, debug) => {

    try {

        if (debug) console.log("starting parse_data with", data);
        if (debug) console.log("\tGeoTIFF:", typeof GeoTIFF);


        //console.log("parser:", parser);

        let result = {};

        let height, no_data_value, width;

        if (data.raster_type === "object") {
            result.values = data.data;
            result.height = height = data.metadata.height || result.values[0].length;
            result.width = width = data.metadata.width || result.values[0][0].length;
            result.pixelHeight = data.metadata.pixelHeight;
            result.pixelWidth = data.metadata.pixelWidth;
            result.projection = data.metadata.projection;
            result.xmin = data.metadata.xmin;
            result.ymax = data.metadata.ymax;
            result.no_data_value = no_data_value = data.metadata.no_data_value;
            result.number_of_rasters = result.values.length;
            result.xmax = result.xmin + result.width * result.pixelWidth;
            result.ymin = result.ymax - result.height * result.pixelHeight;
            result._data = null;
        } else if (data.raster_type === "geotiff") {
            result._data = data.data;
            
            let parser = typeof GeoTIFF !== "undefined" ? GeoTIFF : typeof window !== "undefined" ? window.GeoTIFF : typeof self !== "undefined" ? self.GeoTIFF : null;

            if (debug) console.log("data.raster_type is geotiff");
            let geotiff = parser.parse(data.data);
            if (debug) console.log("geotiff:", geotiff);

            let image = geotiff.getImage();
            if (debug) console.log("image:", image);

            let fileDirectory = image.fileDirectory;

            let geoKeys = image.getGeoKeys();

            if (debug) console.log("geoKeys:", geoKeys);
            result.projection = geoKeys.GeographicTypeGeoKey;
            if (debug) console.log("projection:", result.projection);

            result.height = height = image.getHeight();
            if (debug) console.log("result.height:", result.height);
            result.width = width = image.getWidth();
            if (debug) console.log("result.width:", result.width);            

            let [resolutionX, resolutionY, resolutionZ] = image.getResolution();
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);

            let [originX, originY, originZ ] = image.getOrigin();
            result.xmin = originX;
            result.xmax = result.xmin + width * result.pixelWidth;
            result.ymax = originY;
            result.ymin = result.ymax - height * result.pixelHeight;

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            //console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters().map(values_in_one_dimension => {
                let values_in_two_dimensions = [];
                for (let y = 0; y < height; y++) {
                    let start = y * width;
                    let end = start + width;
                    values_in_two_dimensions.push(values_in_one_dimension.slice(start, end));
                }
                return values_in_two_dimensions;
            });
        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        let max; let min;

        //console.log("starting to get min, max and ranges");
        for (let raster_index = 0; raster_index < result.number_of_rasters; raster_index++) {

            let rows = result.values[raster_index];
            if (debug) console.log("[georaster] rows:", rows);

            for (let row_index = 0; row_index < height; row_index++) {

                let row = rows[row_index];

                for (let column_index = 0; column_index < width; column_index++) {

                    let value = row[column_index];
                    if (value != no_data_value) {
                        if (typeof min === "undefined" || value < min) min = value;
                        else if (typeof max === "undefined" || value > max) max = value;
                    }
                }
            }

            result.maxs.push(max);
            result.mins.push(min);
            result.ranges.push(max - min);
        }

        return result;

    } catch (error) {

        console.error("[georaster] error parsing georaster:", error);

    }

}

let web_worker_script = `

    // this is a bit of a hack to trick geotiff to work with web worker
    let window = self;

    !function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);var j=new Error("Cannot find module '"+g+"'");throw j.code="MODULE_NOT_FOUND",j}var k=c[g]={exports:{}};b[g][0].call(k.exports,function(a){var c=b[g][1][a];return e(c||a)},k,k.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){"use strict";function d(a){if(!(this instanceof d))return new d(a);this.options=h.assign({chunkSize:16384,windowBits:0,to:""},a||{});var b=this.options;b.raw&&b.windowBits>=0&&b.windowBits<16&&(b.windowBits=-b.windowBits,0===b.windowBits&&(b.windowBits=-15)),!(b.windowBits>=0&&b.windowBits<16)||a&&a.windowBits||(b.windowBits+=32),b.windowBits>15&&b.windowBits<48&&0==(15&b.windowBits)&&(b.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new l,this.strm.avail_out=0;var c=g.inflateInit2(this.strm,b.windowBits);if(c!==j.Z_OK)throw new Error(k[c]);this.header=new m,g.inflateGetHeader(this.strm,this.header)}function e(a,b){var c=new d(b);if(c.push(a,!0),c.err)throw c.msg||k[c.err];return c.result}function f(a,b){return b=b||{},b.raw=!0,e(a,b)}var g=a("./zlib/inflate"),h=a("./utils/common"),i=a("./utils/strings"),j=a("./zlib/constants"),k=a("./zlib/messages"),l=a("./zlib/zstream"),m=a("./zlib/gzheader"),n=Object.prototype.toString;d.prototype.push=function(a,b){var c,d,e,f,k,l,m=this.strm,o=this.options.chunkSize,p=this.options.dictionary,q=!1;if(this.ended)return!1;d=b===~~b?b:!0===b?j.Z_FINISH:j.Z_NO_FLUSH,"string"==typeof a?m.input=i.binstring2buf(a):"[object ArrayBuffer]"===n.call(a)?m.input=new Uint8Array(a):m.input=a,m.next_in=0,m.avail_in=m.input.length;do{if(0===m.avail_out&&(m.output=new h.Buf8(o),m.next_out=0,m.avail_out=o),c=g.inflate(m,j.Z_NO_FLUSH),c===j.Z_NEED_DICT&&p&&(l="string"==typeof p?i.string2buf(p):"[object ArrayBuffer]"===n.call(p)?new Uint8Array(p):p,c=g.inflateSetDictionary(this.strm,l)),c===j.Z_BUF_ERROR&&!0===q&&(c=j.Z_OK,q=!1),c!==j.Z_STREAM_END&&c!==j.Z_OK)return this.onEnd(c),this.ended=!0,!1;m.next_out&&(0!==m.avail_out&&c!==j.Z_STREAM_END&&(0!==m.avail_in||d!==j.Z_FINISH&&d!==j.Z_SYNC_FLUSH)||("string"===this.options.to?(e=i.utf8border(m.output,m.next_out),f=m.next_out-e,k=i.buf2string(m.output,e),m.next_out=f,m.avail_out=o-f,f&&h.arraySet(m.output,m.output,e,f,0),this.onData(k)):this.onData(h.shrinkBuf(m.output,m.next_out)))),0===m.avail_in&&0===m.avail_out&&(q=!0)}while((m.avail_in>0||0===m.avail_out)&&c!==j.Z_STREAM_END);return c===j.Z_STREAM_END&&(d=j.Z_FINISH),d===j.Z_FINISH?(c=g.inflateEnd(this.strm),this.onEnd(c),this.ended=!0,c===j.Z_OK):d!==j.Z_SYNC_FLUSH||(this.onEnd(j.Z_OK),m.avail_out=0,!0)},d.prototype.onData=function(a){this.chunks.push(a)},d.prototype.onEnd=function(a){a===j.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=h.flattenChunks(this.chunks)),this.chunks=[],this.err=a,this.msg=this.strm.msg},c.Inflate=d,c.inflate=e,c.inflateRaw=f,c.ungzip=e},{"./utils/common":2,"./utils/strings":3,"./zlib/constants":5,"./zlib/gzheader":7,"./zlib/inflate":9,"./zlib/messages":11,"./zlib/zstream":12}],2:[function(a,b,c){"use strict";function d(a,b){return Object.prototype.hasOwnProperty.call(a,b)}var e="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;c.assign=function(a){for(var b=Array.prototype.slice.call(arguments,1);b.length;){var c=b.shift();if(c){if("object"!=typeof c)throw new TypeError(c+"must be non-object");for(var e in c)d(c,e)&&(a[e]=c[e])}}return a},c.shrinkBuf=function(a,b){return a.length===b?a:a.subarray?a.subarray(0,b):(a.length=b,a)};var f={arraySet:function(a,b,c,d,e){if(b.subarray&&a.subarray)return void a.set(b.subarray(c,c+d),e);for(var f=0;f<d;f++)a[e+f]=b[c+f]},flattenChunks:function(a){var b,c,d,e,f,g;for(d=0,b=0,c=a.length;b<c;b++)d+=a[b].length;for(g=new Uint8Array(d),e=0,b=0,c=a.length;b<c;b++)f=a[b],g.set(f,e),e+=f.length;return g}},g={arraySet:function(a,b,c,d,e){for(var f=0;f<d;f++)a[e+f]=b[c+f]},flattenChunks:function(a){return[].concat.apply([],a)}};c.setTyped=function(a){a?(c.Buf8=Uint8Array,c.Buf16=Uint16Array,c.Buf32=Int32Array,c.assign(c,f)):(c.Buf8=Array,c.Buf16=Array,c.Buf32=Array,c.assign(c,g))},c.setTyped(e)},{}],3:[function(a,b,c){"use strict";function d(a,b){if(b<65537&&(a.subarray&&g||!a.subarray&&f))return String.fromCharCode.apply(null,e.shrinkBuf(a,b));for(var c="",d=0;d<b;d++)c+=String.fromCharCode(a[d]);return c}var e=a("./common"),f=!0,g=!0;try{String.fromCharCode.apply(null,[0])}catch(a){f=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(a){g=!1}for(var h=new e.Buf8(256),i=0;i<256;i++)h[i]=i>=252?6:i>=248?5:i>=240?4:i>=224?3:i>=192?2:1;h[254]=h[254]=1,c.string2buf=function(a){var b,c,d,f,g,h=a.length,i=0;for(f=0;f<h;f++)c=a.charCodeAt(f),55296==(64512&c)&&f+1<h&&56320==(64512&(d=a.charCodeAt(f+1)))&&(c=65536+(c-55296<<10)+(d-56320),f++),i+=c<128?1:c<2048?2:c<65536?3:4;for(b=new e.Buf8(i),g=0,f=0;g<i;f++)c=a.charCodeAt(f),55296==(64512&c)&&f+1<h&&56320==(64512&(d=a.charCodeAt(f+1)))&&(c=65536+(c-55296<<10)+(d-56320),f++),c<128?b[g++]=c:c<2048?(b[g++]=192|c>>>6,b[g++]=128|63&c):c<65536?(b[g++]=224|c>>>12,b[g++]=128|c>>>6&63,b[g++]=128|63&c):(b[g++]=240|c>>>18,b[g++]=128|c>>>12&63,b[g++]=128|c>>>6&63,b[g++]=128|63&c);return b},c.buf2binstring=function(a){return d(a,a.length)},c.binstring2buf=function(a){for(var b=new e.Buf8(a.length),c=0,d=b.length;c<d;c++)b[c]=a.charCodeAt(c);return b},c.buf2string=function(a,b){var c,e,f,g,i=b||a.length,j=new Array(2*i);for(e=0,c=0;c<i;)if((f=a[c++])<128)j[e++]=f;else if((g=h[f])>4)j[e++]=65533,c+=g-1;else{for(f&=2===g?31:3===g?15:7;g>1&&c<i;)f=f<<6|63&a[c++],g--;g>1?j[e++]=65533:f<65536?j[e++]=f:(f-=65536,j[e++]=55296|f>>10&1023,j[e++]=56320|1023&f)}return d(j,e)},c.utf8border=function(a,b){var c;for(b=b||a.length,b>a.length&&(b=a.length),c=b-1;c>=0&&128==(192&a[c]);)c--;return c<0?b:0===c?b:c+h[a[c]]>b?c:b}},{"./common":2}],4:[function(a,b,c){"use strict";function d(a,b,c,d){for(var e=65535&a|0,f=a>>>16&65535|0,g=0;0!==c;){g=c>2e3?2e3:c,c-=g;do{e=e+b[d++]|0,f=f+e|0}while(--g);e%=65521,f%=65521}return e|f<<16|0}b.exports=d},{}],5:[function(a,b,c){"use strict";b.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],6:[function(a,b,c){"use strict";function d(a,b,c,d){var f=e,g=d+c;a^=-1;for(var h=d;h<g;h++)a=a>>>8^f[255&(a^b[h])];return-1^a}var e=function(){for(var a,b=[],c=0;c<256;c++){a=c;for(var d=0;d<8;d++)a=1&a?3988292384^a>>>1:a>>>1;b[c]=a}return b}();b.exports=d},{}],7:[function(a,b,c){"use strict";function d(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}b.exports=d},{}],8:[function(a,b,c){"use strict";b.exports=function(a,b){var c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A;c=a.state,d=a.next_in,z=a.input,e=d+(a.avail_in-5),f=a.next_out,A=a.output,g=f-(b-a.avail_out),h=f+(a.avail_out-257),i=c.dmax,j=c.wsize,k=c.whave,l=c.wnext,m=c.window,n=c.hold,o=c.bits,p=c.lencode,q=c.distcode,r=(1<<c.lenbits)-1,s=(1<<c.distbits)-1;a:do{o<15&&(n+=z[d++]<<o,o+=8,n+=z[d++]<<o,o+=8),t=p[n&r];b:for(;;){if(u=t>>>24,n>>>=u,o-=u,0===(u=t>>>16&255))A[f++]=65535&t;else{if(!(16&u)){if(0==(64&u)){t=p[(65535&t)+(n&(1<<u)-1)];continue b}if(32&u){c.mode=12;break a}a.msg="invalid literal/length code",c.mode=30;break a}v=65535&t,u&=15,u&&(o<u&&(n+=z[d++]<<o,o+=8),v+=n&(1<<u)-1,n>>>=u,o-=u),o<15&&(n+=z[d++]<<o,o+=8,n+=z[d++]<<o,o+=8),t=q[n&s];c:for(;;){if(u=t>>>24,n>>>=u,o-=u,!(16&(u=t>>>16&255))){if(0==(64&u)){t=q[(65535&t)+(n&(1<<u)-1)];continue c}a.msg="invalid distance code",c.mode=30;break a}if(w=65535&t,u&=15,o<u&&(n+=z[d++]<<o,(o+=8)<u&&(n+=z[d++]<<o,o+=8)),(w+=n&(1<<u)-1)>i){a.msg="invalid distance too far back",c.mode=30;break a}if(n>>>=u,o-=u,u=f-g,w>u){if((u=w-u)>k&&c.sane){a.msg="invalid distance too far back",c.mode=30;break a}if(x=0,y=m,0===l){if(x+=j-u,u<v){v-=u;do{A[f++]=m[x++]}while(--u);x=f-w,y=A}}else if(l<u){if(x+=j+l-u,(u-=l)<v){v-=u;do{A[f++]=m[x++]}while(--u);if(x=0,l<v){u=l,v-=u;do{A[f++]=m[x++]}while(--u);x=f-w,y=A}}}else if(x+=l-u,u<v){v-=u;do{A[f++]=m[x++]}while(--u);x=f-w,y=A}for(;v>2;)A[f++]=y[x++],A[f++]=y[x++],A[f++]=y[x++],v-=3;v&&(A[f++]=y[x++],v>1&&(A[f++]=y[x++]))}else{x=f-w;do{A[f++]=A[x++],A[f++]=A[x++],A[f++]=A[x++],v-=3}while(v>2);v&&(A[f++]=A[x++],v>1&&(A[f++]=A[x++]))}break}}break}}while(d<e&&f<h);v=o>>3,d-=v,o-=v<<3,n&=(1<<o)-1,a.next_in=d,a.next_out=f,a.avail_in=d<e?e-d+5:5-(d-e),a.avail_out=f<h?h-f+257:257-(f-h),c.hold=n,c.bits=o}},{}],9:[function(a,b,c){"use strict";function d(a){return(a>>>24&255)+(a>>>8&65280)+((65280&a)<<8)+((255&a)<<24)}function e(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new s.Buf16(320),this.work=new s.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function f(a){var b;return a&&a.state?(b=a.state,a.total_in=a.total_out=b.total=0,a.msg="",b.wrap&&(a.adler=1&b.wrap),b.mode=L,b.last=0,b.havedict=0,b.dmax=32768,b.head=null,b.hold=0,b.bits=0,b.lencode=b.lendyn=new s.Buf32(pa),b.distcode=b.distdyn=new s.Buf32(qa),b.sane=1,b.back=-1,D):G}function g(a){var b;return a&&a.state?(b=a.state,b.wsize=0,b.whave=0,b.wnext=0,f(a)):G}function h(a,b){var c,d;return a&&a.state?(d=a.state,b<0?(c=0,b=-b):(c=1+(b>>4),b<48&&(b&=15)),b&&(b<8||b>15)?G:(null!==d.window&&d.wbits!==b&&(d.window=null),d.wrap=c,d.wbits=b,g(a))):G}function i(a,b){var c,d;return a?(d=new e,a.state=d,d.window=null,c=h(a,b),c!==D&&(a.state=null),c):G}function j(a){return i(a,ra)}function k(a){if(sa){var b;for(q=new s.Buf32(512),r=new s.Buf32(32),b=0;b<144;)a.lens[b++]=8;for(;b<256;)a.lens[b++]=9;for(;b<280;)a.lens[b++]=7;for(;b<288;)a.lens[b++]=8;for(w(y,a.lens,0,288,q,0,a.work,{bits:9}),b=0;b<32;)a.lens[b++]=5;w(z,a.lens,0,32,r,0,a.work,{bits:5}),sa=!1}a.lencode=q,a.lenbits=9,a.distcode=r,a.distbits=5}function l(a,b,c,d){var e,f=a.state;return null===f.window&&(f.wsize=1<<f.wbits,f.wnext=0,f.whave=0,f.window=new s.Buf8(f.wsize)),d>=f.wsize?(s.arraySet(f.window,b,c-f.wsize,f.wsize,0),f.wnext=0,f.whave=f.wsize):(e=f.wsize-f.wnext,e>d&&(e=d),s.arraySet(f.window,b,c-d,e,f.wnext),d-=e,d?(s.arraySet(f.window,b,c-d,d,0),f.wnext=d,f.whave=f.wsize):(f.wnext+=e,f.wnext===f.wsize&&(f.wnext=0),f.whave<f.wsize&&(f.whave+=e))),0}function m(a,b){var c,e,f,g,h,i,j,m,n,o,p,q,r,pa,qa,ra,sa,ta,ua,va,wa,xa,ya,za,Aa=0,Ba=new s.Buf8(4),Ca=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!a||!a.state||!a.output||!a.input&&0!==a.avail_in)return G;c=a.state,c.mode===W&&(c.mode=X),h=a.next_out,f=a.output,j=a.avail_out,g=a.next_in,e=a.input,i=a.avail_in,m=c.hold,n=c.bits,o=i,p=j,xa=D;a:for(;;)switch(c.mode){case L:if(0===c.wrap){c.mode=X;break}for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(2&c.wrap&&35615===m){c.check=0,Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0),m=0,n=0,c.mode=M;break}if(c.flags=0,c.head&&(c.head.done=!1),!(1&c.wrap)||(((255&m)<<8)+(m>>8))%31){a.msg="incorrect header check",c.mode=ma;break}if((15&m)!==K){a.msg="unknown compression method",c.mode=ma;break}if(m>>>=4,n-=4,wa=8+(15&m),0===c.wbits)c.wbits=wa;else if(wa>c.wbits){a.msg="invalid window size",c.mode=ma;break}c.dmax=1<<wa,a.adler=c.check=1,c.mode=512&m?U:W,m=0,n=0;break;case M:for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(c.flags=m,(255&c.flags)!==K){a.msg="unknown compression method",c.mode=ma;break}if(57344&c.flags){a.msg="unknown header flags set",c.mode=ma;break}c.head&&(c.head.text=m>>8&1),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0)),m=0,n=0,c.mode=N;case N:for(;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.head&&(c.head.time=m),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,Ba[2]=m>>>16&255,Ba[3]=m>>>24&255,c.check=u(c.check,Ba,4,0)),m=0,n=0,c.mode=O;case O:for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.head&&(c.head.xflags=255&m,c.head.os=m>>8),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0)),m=0,n=0,c.mode=P;case P:if(1024&c.flags){for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.length=m,c.head&&(c.head.extra_len=m),512&c.flags&&(Ba[0]=255&m,Ba[1]=m>>>8&255,c.check=u(c.check,Ba,2,0)),m=0,n=0}else c.head&&(c.head.extra=null);c.mode=Q;case Q:if(1024&c.flags&&(q=c.length,q>i&&(q=i),q&&(c.head&&(wa=c.head.extra_len-c.length,c.head.extra||(c.head.extra=new Array(c.head.extra_len)),s.arraySet(c.head.extra,e,g,q,wa)),512&c.flags&&(c.check=u(c.check,e,q,g)),i-=q,g+=q,c.length-=q),c.length))break a;c.length=0,c.mode=R;case R:if(2048&c.flags){if(0===i)break a;q=0;do{wa=e[g+q++],c.head&&wa&&c.length<65536&&(c.head.name+=String.fromCharCode(wa))}while(wa&&q<i);if(512&c.flags&&(c.check=u(c.check,e,q,g)),i-=q,g+=q,wa)break a}else c.head&&(c.head.name=null);c.length=0,c.mode=S;case S:if(4096&c.flags){if(0===i)break a;q=0;do{wa=e[g+q++],c.head&&wa&&c.length<65536&&(c.head.comment+=String.fromCharCode(wa))}while(wa&&q<i);if(512&c.flags&&(c.check=u(c.check,e,q,g)),i-=q,g+=q,wa)break a}else c.head&&(c.head.comment=null);c.mode=T;case T:if(512&c.flags){for(;n<16;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(m!==(65535&c.check)){a.msg="header crc mismatch",c.mode=ma;break}m=0,n=0}c.head&&(c.head.hcrc=c.flags>>9&1,c.head.done=!0),a.adler=c.check=0,c.mode=W;break;case U:for(;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}a.adler=c.check=d(m),m=0,n=0,c.mode=V;case V:if(0===c.havedict)return a.next_out=h,a.avail_out=j,a.next_in=g,a.avail_in=i,c.hold=m,c.bits=n,F;a.adler=c.check=1,c.mode=W;case W:if(b===B||b===C)break a;case X:if(c.last){m>>>=7&n,n-=7&n,c.mode=ja;break}for(;n<3;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}switch(c.last=1&m,m>>>=1,n-=1,3&m){case 0:c.mode=Y;break;case 1:if(k(c),c.mode=ca,b===C){m>>>=2,n-=2;break a}break;case 2:c.mode=_;break;case 3:a.msg="invalid block type",c.mode=ma}m>>>=2,n-=2;break;case Y:for(m>>>=7&n,n-=7&n;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if((65535&m)!=(m>>>16^65535)){a.msg="invalid stored block lengths",c.mode=ma;break}if(c.length=65535&m,m=0,n=0,c.mode=Z,b===C)break a;case Z:c.mode=$;case $:if(q=c.length){if(q>i&&(q=i),q>j&&(q=j),0===q)break a;s.arraySet(f,e,g,q,h),i-=q,g+=q,j-=q,h+=q,c.length-=q;break}c.mode=W;break;case _:for(;n<14;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(c.nlen=257+(31&m),m>>>=5,n-=5,c.ndist=1+(31&m),m>>>=5,n-=5,c.ncode=4+(15&m),m>>>=4,n-=4,c.nlen>286||c.ndist>30){a.msg="too many length or distance symbols",c.mode=ma;break}c.have=0,c.mode=aa;case aa:for(;c.have<c.ncode;){for(;n<3;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.lens[Ca[c.have++]]=7&m,m>>>=3,n-=3}for(;c.have<19;)c.lens[Ca[c.have++]]=0;if(c.lencode=c.lendyn,c.lenbits=7,ya={bits:c.lenbits},xa=w(x,c.lens,0,19,c.lencode,0,c.work,ya),c.lenbits=ya.bits,xa){a.msg="invalid code lengths set",c.mode=ma;break}c.have=0,c.mode=ba;case ba:for(;c.have<c.nlen+c.ndist;){for(;Aa=c.lencode[m&(1<<c.lenbits)-1],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(sa<16)m>>>=qa,n-=qa,c.lens[c.have++]=sa;else{if(16===sa){for(za=qa+2;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(m>>>=qa,n-=qa,0===c.have){a.msg="invalid bit length repeat",c.mode=ma;break}wa=c.lens[c.have-1],q=3+(3&m),m>>>=2,n-=2}else if(17===sa){for(za=qa+3;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=qa,n-=qa,wa=0,q=3+(7&m),m>>>=3,n-=3}else{for(za=qa+7;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=qa,n-=qa,wa=0,q=11+(127&m),m>>>=7,n-=7}if(c.have+q>c.nlen+c.ndist){a.msg="invalid bit length repeat",c.mode=ma;break}for(;q--;)c.lens[c.have++]=wa}}if(c.mode===ma)break;if(0===c.lens[256]){a.msg="invalid code -- missing end-of-block",c.mode=ma;break}if(c.lenbits=9,ya={bits:c.lenbits},xa=w(y,c.lens,0,c.nlen,c.lencode,0,c.work,ya),c.lenbits=ya.bits,xa){a.msg="invalid literal/lengths set",c.mode=ma;break}if(c.distbits=6,c.distcode=c.distdyn,ya={bits:c.distbits},xa=w(z,c.lens,c.nlen,c.ndist,c.distcode,0,c.work,ya),c.distbits=ya.bits,xa){a.msg="invalid distances set",c.mode=ma;break}if(c.mode=ca,b===C)break a;case ca:c.mode=da;case da:if(i>=6&&j>=258){a.next_out=h,a.avail_out=j,a.next_in=g,a.avail_in=i,c.hold=m,c.bits=n,v(a,p),h=a.next_out,f=a.output,j=a.avail_out,g=a.next_in,e=a.input,i=a.avail_in,m=c.hold,n=c.bits,c.mode===W&&(c.back=-1);break}for(c.back=0;Aa=c.lencode[m&(1<<c.lenbits)-1],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(ra&&0==(240&ra)){for(ta=qa,ua=ra,va=sa;Aa=c.lencode[va+((m&(1<<ta+ua)-1)>>ta)],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(ta+qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=ta,n-=ta,c.back+=ta}if(m>>>=qa,n-=qa,c.back+=qa,c.length=sa,0===ra){c.mode=ia;break}if(32&ra){c.back=-1,c.mode=W;break}if(64&ra){a.msg="invalid literal/length code",c.mode=ma;break}c.extra=15&ra,c.mode=ea;case ea:if(c.extra){for(za=c.extra;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.length+=m&(1<<c.extra)-1,m>>>=c.extra,n-=c.extra,c.back+=c.extra}c.was=c.length,c.mode=fa;case fa:for(;Aa=c.distcode[m&(1<<c.distbits)-1],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(0==(240&ra)){for(ta=qa,ua=ra,va=sa;Aa=c.distcode[va+((m&(1<<ta+ua)-1)>>ta)],qa=Aa>>>24,ra=Aa>>>16&255,sa=65535&Aa,!(ta+qa<=n);){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}m>>>=ta,n-=ta,c.back+=ta}if(m>>>=qa,n-=qa,c.back+=qa,64&ra){a.msg="invalid distance code",c.mode=ma;break}c.offset=sa,c.extra=15&ra,c.mode=ga;case ga:if(c.extra){for(za=c.extra;n<za;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}c.offset+=m&(1<<c.extra)-1,m>>>=c.extra,n-=c.extra,c.back+=c.extra}if(c.offset>c.dmax){a.msg="invalid distance too far back",c.mode=ma;break}c.mode=ha;case ha:if(0===j)break a;if(q=p-j,c.offset>q){if((q=c.offset-q)>c.whave&&c.sane){a.msg="invalid distance too far back",c.mode=ma;break}q>c.wnext?(q-=c.wnext,r=c.wsize-q):r=c.wnext-q,q>c.length&&(q=c.length),pa=c.window}else pa=f,r=h-c.offset,q=c.length;q>j&&(q=j),j-=q,c.length-=q;do{f[h++]=pa[r++]}while(--q);0===c.length&&(c.mode=da);break;case ia:if(0===j)break a;f[h++]=c.length,j--,c.mode=da;break;case ja:if(c.wrap){for(;n<32;){if(0===i)break a;i--,m|=e[g++]<<n,n+=8}if(p-=j,a.total_out+=p,c.total+=p,p&&(a.adler=c.check=c.flags?u(c.check,f,p,h-p):t(c.check,f,p,h-p)),p=j,(c.flags?m:d(m))!==c.check){a.msg="incorrect data check",c.mode=ma;break}m=0,n=0}c.mode=ka;case ka:if(c.wrap&&c.flags){for(;n<32;){if(0===i)break a;i--,m+=e[g++]<<n,n+=8}if(m!==(4294967295&c.total)){a.msg="incorrect length check",c.mode=ma;break}m=0,n=0}c.mode=la;case la:xa=E;break a;case ma:xa=H;break a;case na:return I;case oa:default:return G}return a.next_out=h,a.avail_out=j,a.next_in=g,a.avail_in=i,c.hold=m,c.bits=n,(c.wsize||p!==a.avail_out&&c.mode<ma&&(c.mode<ja||b!==A))&&l(a,a.output,a.next_out,p-a.avail_out)?(c.mode=na,I):(o-=a.avail_in,p-=a.avail_out,a.total_in+=o,a.total_out+=p,c.total+=p,c.wrap&&p&&(a.adler=c.check=c.flags?u(c.check,f,p,a.next_out-p):t(c.check,f,p,a.next_out-p)),a.data_type=c.bits+(c.last?64:0)+(c.mode===W?128:0)+(c.mode===ca||c.mode===Z?256:0),(0===o&&0===p||b===A)&&xa===D&&(xa=J),xa)}function n(a){if(!a||!a.state)return G;var b=a.state;return b.window&&(b.window=null),a.state=null,D}function o(a,b){var c;return a&&a.state?(c=a.state,0==(2&c.wrap)?G:(c.head=b,b.done=!1,D)):G}function p(a,b){var c,d,e=b.length;return a&&a.state?(c=a.state,0!==c.wrap&&c.mode!==V?G:c.mode===V&&(d=1,(d=t(d,b,e,0))!==c.check)?H:l(a,b,e,e)?(c.mode=na,I):(c.havedict=1,D)):G}var q,r,s=a("../utils/common"),t=a("./adler32"),u=a("./crc32"),v=a("./inffast"),w=a("./inftrees"),x=0,y=1,z=2,A=4,B=5,C=6,D=0,E=1,F=2,G=-2,H=-3,I=-4,J=-5,K=8,L=1,M=2,N=3,O=4,P=5,Q=6,R=7,S=8,T=9,U=10,V=11,W=12,X=13,Y=14,Z=15,$=16,_=17,aa=18,ba=19,ca=20,da=21,ea=22,fa=23,ga=24,ha=25,ia=26,ja=27,ka=28,la=29,ma=30,na=31,oa=32,pa=852,qa=592,ra=15,sa=!0;c.inflateReset=g,c.inflateReset2=h,c.inflateResetKeep=f,c.inflateInit=j,c.inflateInit2=i,c.inflate=m,c.inflateEnd=n,c.inflateGetHeader=o,c.inflateSetDictionary=p,c.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":2,"./adler32":4,"./crc32":6,"./inffast":8,"./inftrees":10}],10:[function(a,b,c){"use strict";var d=a("../utils/common"),e=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],f=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],g=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],h=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];b.exports=function(a,b,c,i,j,k,l,m){var n,o,p,q,r,s,t,u,v,w=m.bits,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=null,I=0,J=new d.Buf16(16),K=new d.Buf16(16),L=null,M=0;for(x=0;x<=15;x++)J[x]=0;for(y=0;y<i;y++)J[b[c+y]]++;for(B=w,A=15;A>=1&&0===J[A];A--);if(B>A&&(B=A),0===A)return j[k++]=20971520,j[k++]=20971520,m.bits=1,0;for(z=1;z<A&&0===J[z];z++);for(B<z&&(B=z),E=1,x=1;x<=15;x++)if(E<<=1,(E-=J[x])<0)return-1;if(E>0&&(0===a||1!==A))return-1;for(K[1]=0,x=1;x<15;x++)K[x+1]=K[x]+J[x];for(y=0;y<i;y++)0!==b[c+y]&&(l[K[b[c+y]]++]=y);if(0===a?(H=L=l,s=19):1===a?(H=e,I-=257,L=f,M-=257,s=256):(H=g,L=h,s=-1),G=0,y=0,x=z,r=k,C=B,D=0,p=-1,F=1<<B,q=F-1,1===a&&F>852||2===a&&F>592)return 1;for(;;){t=x-D,l[y]<s?(u=0,v=l[y]):l[y]>s?(u=L[M+l[y]],v=H[I+l[y]]):(u=96,v=0),n=1<<x-D,o=1<<C,z=o;do{o-=n,j[r+(G>>D)+o]=t<<24|u<<16|v|0}while(0!==o);for(n=1<<x-1;G&n;)n>>=1;if(0!==n?(G&=n-1,G+=n):G=0,y++,0==--J[x]){if(x===A)break;x=b[c+l[y]]}if(x>B&&(G&q)!==p){for(0===D&&(D=B),r+=z,C=x-D,E=1<<C;C+D<A&&!((E-=J[C+D])<=0);)C++,E<<=1;if(F+=1<<C,1===a&&F>852||2===a&&F>592)return 1;p=G&q,j[p]=B<<24|C<<16|r-k|0}}return 0!==G&&(j[r+G]=x-D<<24|64<<16|0),m.bits=B,0}},{"../utils/common":2}],11:[function(a,b,c){"use strict";b.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],12:[function(a,b,c){"use strict";function d(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}b.exports=d},{}],13:[function(a,b,c){"use strict";function d(){}d.prototype={isAsync:function(){return void 0===this.decodeBlock}},b.exports=d},{}],14:[function(a,b,c){"use strict";function d(){}var e=a("../abstractdecoder.js"),f=a("pako/lib/inflate").inflate;d.prototype=Object.create(e.prototype),d.prototype.constructor=d,d.prototype.decodeBlock=function(a){return f(new Uint8Array(a)).buffer},b.exports=d},{"../abstractdecoder.js":13,"pako/lib/inflate":1}],15:[function(a,b,c){"use strict";function d(a,b,c){var d=b%8,e=Math.floor(b/8),f=8-d,g=b+c-8*(e+1),h=8*(e+2)-(b+c),i=8*(e+2)-b;if(h=Math.max(0,h),e>=a.length)return console.warn("ran off the end of the buffer before finding EOI_CODE (end on input code)"),k;var j=a[e]&Math.pow(2,8-d)-1;j<<=c-f;var l=j;if(e+1<a.length){var m=a[e+1]>>>h;m<<=Math.max(0,c-i),l+=m}if(g>8&&e+2<a.length){var n=8*(e+3)-(b+c);l+=a[e+2]>>>n}return l}function e(a,b){for(var c=b.length-1;c>=0;c--)a.push(b[c]);return a}function f(a){function b(){n=258,o=i}function c(a){var b=d(a,p,o);return p+=o,b}function f(a,b){return l[n]=b,h[n]=a,n++,n>=Math.pow(2,o)&&o++,n-1}function g(a){for(var b=[];4096!==a;)b.push(l[a]),a=h[a];return b}for(var h=new Uint16Array(4093),l=new Uint8Array(4093),m=0;m<=257;m++)h[m]=4096,l[m]=m;var n=258,o=i,p=0,q=[];b();for(var r,s=new Uint8Array(a),t=c(s);t!==k;){if(t===j){for(b(),t=c(s);t===j;)t=c(s);if(t>j)throw"corrupted code at scanline "+t;if(t===k)break;e(q,g(t)),r=t}else if(t<n){var u=g(t);e(q,u),f(r,u[u.length-1]),r=t}else{var v=g(r);if(!v)throw"Bogus entry. Not in dictionary, "+r+" / "+n+", position: "+p;e(q,v),q.push(v[v.length-1]),f(r,v[v.length-1]),r=t}n>=Math.pow(2,o)-1&&o++,t=c(s)}return new Uint8Array(q)}function g(){}var h=a("../abstractdecoder.js"),i=9,j=256,k=257;g.prototype=Object.create(h.prototype),g.prototype.constructor=g,g.prototype.decodeBlock=function(a){return f(a).buffer},b.exports=g},{"../abstractdecoder.js":13}],16:[function(a,b,c){"use strict";function d(){}var e=a("../abstractdecoder.js");d.prototype=Object.create(e.prototype),d.prototype.constructor=d,d.prototype.decodeBlock=function(a){var b,c,d=new DataView(a),e=[];for(b=0;b<a.byteLength;++b){var f=d.getInt8(b);if(f<0){var g=d.getUint8(b+1);for(f=-f,c=0;c<=f;++c)e.push(g);b+=1}else{for(c=0;c<=f;++c)e.push(d.getUint8(b+c+1));b+=f+1}}return new Uint8Array(e).buffer},b.exports=d},{"../abstractdecoder.js":13}],17:[function(a,b,c){"use strict";function d(){}var e=a("../abstractdecoder.js");d.prototype=Object.create(e.prototype),d.prototype.constructor=d,d.prototype.decodeBlock=function(a){return a},b.exports=d},{"../abstractdecoder.js":13}],18:[function(a,b,c){"use strict";function d(a,b){if(!(a instanceof b))throw new TypeError("Cannot call a class as a function")}var e=function(){function a(a,b){for(var c=0;c<b.length;c++){var d=b[c];d.enumerable=d.enumerable||!1,d.configurable=!0,"value"in d&&(d.writable=!0),Object.defineProperty(a,d.key,d)}}return function(b,c,d){return c&&a(b.prototype,c),d&&a(b,d),b}}(),f=function(){function a(b){d(this,a),this._dataView=new DataView(b)}return e(a,[{key:"getUint64",value:function(a,b){var c=this.getUint32(a,b),d=this.getUint32(a+4,b);return b?c<<32|d:d<<32|c}},{key:"getInt64",value:function(a,b){var c,d;return b?(c=this.getInt32(a,b),d=this.getUint32(a+4,b),c<<32|d):(c=this.getUint32(a,b),(d=this.getInt32(a+4,b))<<32|c)}},{key:"getUint8",value:function(a,b){return this._dataView.getUint8(a,b)}},{key:"getInt8",value:function(a,b){return this._dataView.getInt8(a,b)}},{key:"getUint16",value:function(a,b){return this._dataView.getUint16(a,b)}},{key:"getInt16",value:function(a,b){return this._dataView.getInt16(a,b)}},{key:"getUint32",value:function(a,b){return this._dataView.getUint32(a,b)}},{key:"getInt32",value:function(a,b){return this._dataView.getInt32(a,b)}},{key:"getFloat32",value:function(a,b){return this._dataView.getFloat32(a,b)}},{key:"getFloat64",value:function(a,b){return this._dataView.getFloat64(a,b)}},{key:"buffer",get:function(){return this._dataView.buffer}}]),a}();b.exports=f},{}],19:[function(a,b,c){"use strict";function d(a,b){this.dataView=new g(a),b=b||{},this.cache=b.cache||!1;var c=this.dataView.getUint16(0,0);if(18761===c)this.littleEndian=!0;else{if(19789!==c)throw new TypeError("Invalid byte order value.");this.littleEndian=!1}var d=this.dataView.getUint16(2,this.littleEndian);if(42===this.dataView.getUint16(2,this.littleEndian))this.bigTiff=!1;else{if(43!==d)throw new TypeError("Invalid magic number.");this.bigTiff=!0;if(8!==this.dataView.getUint16(4,this.littleEndian))throw new Error("Unsupported offset byte-size.")}this.fileDirectories=this.parseFileDirectories(this.getOffset(this.bigTiff?8:4))}var e=a("./globals.js"),f=a("./geotiffimage.js"),g=a("./dataview64.js"),h=e.fieldTypes,i=e.fieldTagNames,j=e.arrayFields,k=e.geoKeyNames;d.prototype={getOffset:function(a){return this.bigTiff?this.dataView.getUint64(a,this.littleEndian):this.dataView.getUint32(a,this.littleEndian)},getFieldTypeLength:function(a){switch(a){case h.BYTE:case h.ASCII:case h.SBYTE:case h.UNDEFINED:return 1;case h.SHORT:case h.SSHORT:return 2;case h.LONG:case h.SLONG:case h.FLOAT:return 4;case h.RATIONAL:case h.SRATIONAL:case h.DOUBLE:case h.LONG8:case h.SLONG8:case h.IFD8:return 8;default:throw new RangeError("Invalid field type: "+a)}},getValues:function(a,b,c){var d,e=null,f=null,g=this.getFieldTypeLength(a);switch(a){case h.BYTE:case h.ASCII:case h.UNDEFINED:e=new Uint8Array(b),f=this.dataView.getUint8;break;case h.SBYTE:e=new Int8Array(b),f=this.dataView.getInt8;break;case h.SHORT:e=new Uint16Array(b),f=this.dataView.getUint16;break;case h.SSHORT:e=new Int16Array(b),f=this.dataView.getInt16;break;case h.LONG:e=new Uint32Array(b),f=this.dataView.getUint32;break;case h.SLONG:e=new Int32Array(b),f=this.dataView.getInt32;break;case h.LONG8:case h.IFD8:e=new Array(b),f=this.dataView.getUint64;break;case h.SLONG8:e=new Array(b),f=this.dataView.getInt64;break;case h.RATIONAL:e=new Uint32Array(2*b),f=this.dataView.getUint32;break;case h.SRATIONAL:e=new Int32Array(2*b),f=this.dataView.getInt32;break;case h.FLOAT:e=new Float32Array(b),f=this.dataView.getFloat32;break;case h.DOUBLE:e=new Float64Array(b),f=this.dataView.getFloat64;break;default:throw new RangeError("Invalid field type: "+a)}if(a!==h.RATIONAL&&a!==h.SRATIONAL)for(d=0;d<b;++d)e[d]=f.call(this.dataView,c+d*g,this.littleEndian);else for(d=0;d<b;d+=2)e[d]=f.call(this.dataView,c+d*g,this.littleEndian),e[d+1]=f.call(this.dataView,c+(d*g+4),this.littleEndian);return a===h.ASCII?String.fromCharCode.apply(null,e):e},getFieldValues:function(a,b,c,d){var e;if(this.getFieldTypeLength(b)*c<=(this.bigTiff?8:4))e=this.getValues(b,c,d);else{var f=this.getOffset(d);e=this.getValues(b,c,f)}return 1===c&&-1===j.indexOf(a)&&b!==h.RATIONAL&&b!==h.SRATIONAL?e[0]:e},parseGeoKeyDirectory:function(a){var b=a.GeoKeyDirectory;if(!b)return null;for(var c={},d=4;d<=4*b[3];d+=4){var e=k[b[d]],f=b[d+1]?i[b[d+1]]:null,g=b[d+2],h=b[d+3],j=null;if(f){if(void 0===(j=a[f])||null===j)throw new Error("Could not get value of geoKey '"+e+"'.");"string"==typeof j?j=j.substring(h,h+g-1):j.subarray&&(j=j.subarray(h,h+g-1))}else j=h;c[e]=j}return c},parseFileDirectories:function(a){for(var b=a,c=[];0!==b;){for(var d=this.bigTiff?this.dataView.getUint64(b,this.littleEndian):this.dataView.getUint16(b,this.littleEndian),e={},f=b+(this.bigTiff?8:2),g=0;g<d;f+=this.bigTiff?20:12,++g){var h=this.dataView.getUint16(f,this.littleEndian),j=this.dataView.getUint16(f+2,this.littleEndian),k=this.bigTiff?this.dataView.getUint64(f+4,this.littleEndian):this.dataView.getUint32(f+4,this.littleEndian);e[i[h]]=this.getFieldValues(h,j,k,f+(this.bigTiff?12:8))}c.push([e,this.parseGeoKeyDirectory(e)]),b=this.getOffset(f)}return c},getImage:function(a){a=a||0;var b=this.fileDirectories[a];if(!b)throw new RangeError("Invalid image index");return new f(b[0],b[1],this.dataView,this.littleEndian,this.cache)},getImageCount:function(){return this.fileDirectories.length}},b.exports=d},{"./dataview64.js":18,"./geotiffimage.js":20,"./globals.js":21}],20:[function(a,b,c){"use strict";function d(a,b,c,d,e){this.fileDirectory=a,this.geoKeys=b,this.dataView=c,this.littleEndian=d,this.tiles=e?{}:null,this.isTiled=!a.StripOffsets;var f=a.PlanarConfiguration;if(this.planarConfiguration=void 0===f?1:f,1!==this.planarConfiguration&&2!==this.planarConfiguration)throw new Error("Invalid planar configuration.");switch(this.fileDirectory.Compression){case void 0:case 1:this.decoder=new g;break;case 5:this.decoder=new h;break;case 6:throw new Error("JPEG compression not supported.");case 8:this.decoder=new i;break;case 32773:this.decoder=new j;break;default:throw new Error("Unknown compresseion method identifier: "+this.fileDirectory.Compression)}}var e=a("./globals.js"),f=a("./rgb.js"),g=a("./compression/raw.js"),h=a("./compression/lzw.js"),i=a("./compression/deflate.js"),j=a("./compression/packbits.js"),k=a("./predictor.js").applyPredictor,l=function(a,b,c){for(var d=0,e=b;e<c;++e)d+=a[e];return d},m=function(a,b,c){switch(a){case 1:switch(b){case 8:return new Uint8Array(c);case 16:return new Uint16Array(c);case 32:return new Uint32Array(c)}break;case 2:switch(b){case 8:return new Int8Array(c);case 16:return new Int16Array(c);case 32:
return new Int32Array(c)}break;case 3:switch(b){case 32:return new Float32Array(c);case 64:return new Float64Array(c)}}throw Error("Unsupported data format/bitsPerSample")};d.prototype={getFileDirectory:function(){return this.fileDirectory},getGeoKeys:function(){return this.geoKeys},getWidth:function(){return this.fileDirectory.ImageWidth},getHeight:function(){return this.fileDirectory.ImageLength},getSamplesPerPixel:function(){return this.fileDirectory.SamplesPerPixel},getTileWidth:function(){return this.isTiled?this.fileDirectory.TileWidth:this.getWidth()},getTileHeight:function(){return this.isTiled?this.fileDirectory.TileLength:this.fileDirectory.RowsPerStrip},getBytesPerPixel:function(){for(var a=0,b=0;b<this.fileDirectory.BitsPerSample.length;++b){var c=this.fileDirectory.BitsPerSample[b];if(c%8!=0)throw new Error("Sample bit-width of "+c+" is not supported.");if(c!==this.fileDirectory.BitsPerSample[0])throw new Error("Differing size of samples in a pixel are not supported.");a+=c}return a/8},getSampleByteSize:function(a){if(a>=this.fileDirectory.BitsPerSample.length)throw new RangeError("Sample index "+a+" is out of range.");var b=this.fileDirectory.BitsPerSample[a];if(b%8!=0)throw new Error("Sample bit-width of "+b+" is not supported.");return b/8},getReaderForSample:function(a){var b=this.fileDirectory.SampleFormat?this.fileDirectory.SampleFormat[a]:1,c=this.fileDirectory.BitsPerSample[a];switch(b){case 1:switch(c){case 8:return DataView.prototype.getUint8;case 16:return DataView.prototype.getUint16;case 32:return DataView.prototype.getUint32}break;case 2:switch(c){case 8:return DataView.prototype.getInt8;case 16:return DataView.prototype.getInt16;case 32:return DataView.prototype.getInt32}break;case 3:switch(c){case 32:return DataView.prototype.getFloat32;case 64:return DataView.prototype.getFloat64}}},getArrayForSample:function(a,b){var c=this.fileDirectory.SampleFormat?this.fileDirectory.SampleFormat[a]:1,d=this.fileDirectory.BitsPerSample[a];return m(c,d,b)},getDecoder:function(){return this.decoder},getTileOrStrip:function(a,b,c,d){var e,f=Math.ceil(this.getWidth()/this.getTileWidth()),g=Math.ceil(this.getHeight()/this.getTileHeight()),h=this.tiles;if(1===this.planarConfiguration?e=b*f+a:2===this.planarConfiguration&&(e=c*f*g+b*f+a),null!==h&&e in h)return d?d(null,{x:a,y:b,sample:c,data:h[e]}):h[e];var i,j;this.isTiled?(i=this.fileDirectory.TileOffsets[e],j=this.fileDirectory.TileByteCounts[e]):(i=this.fileDirectory.StripOffsets[e],j=this.fileDirectory.StripByteCounts[e]);var k=this.dataView.buffer.slice(i,i+j);if(d)return this.getDecoder().decodeBlockAsync(k,function(f,g){f||null===h||(h[e]=g),d(f,{x:a,y:b,sample:c,data:g})});var l=this.getDecoder().decodeBlock(k);return null!==h&&(h[e]=l),l},_readRasterAsync:function(a,b,c,d,e,f){function g(){x&&0===y&&(A?f(A):e(c))}function h(e,f){if(e)A=e;else{var h=f.data;1!==s&&(h=k(h,s,i,j,t));for(var l=new DataView(h),m=f.y*j,n=f.x*i,o=(f.y+1)*j,p=(f.x+1)*i,w=f.sample,x=Math.max(0,a[1]-m);x<Math.min(j,j-(o-a[3]));++x)for(var B=Math.max(0,a[0]-n);B<Math.min(i,i-(p-a[2]));++B){var C,D=(x*i+B)*r,E=v[w].call(l,D+u[w],z);d?(C=(x+m-a[1])*q*b.length+(B+n-a[0])*b.length+w,c[C]=E):(C=(x+m-a[1])*q+B+n-a[0],c[w][C]=E)}}y-=1,g()}for(var i=this.getTileWidth(),j=this.getTileHeight(),m=Math.floor(a[0]/i),n=Math.ceil(a[2]/i),o=Math.floor(a[1]/j),p=Math.ceil(a[3]/j),q=(Math.ceil(this.getWidth()/i),a[2]-a[0]),r=(a[3],a[1],this.getBytesPerPixel()),s=(this.getWidth(),this.fileDirectory.Predictor||1),t=this.fileDirectory.BitsPerSample,u=[],v=[],w=0;w<b.length;++w)1===this.planarConfiguration?u.push(l(this.fileDirectory.BitsPerSample,0,b[w])/8):u.push(0),v.push(this.getReaderForSample(b[w]));for(var x=!1,y=0,z=this.littleEndian,A=null,B=o;B<=p;++B)for(var C=m;C<=n;++C)for(var D=0;D<b.length;++D){var E=b[D];2===this.planarConfiguration&&(r=this.getSampleByteSize(E));y+=1,this.getTileOrStrip(C,B,E,h)}x=!0,g()},_readRaster:function(a,b,c,d,e,f){try{for(var g=this.getTileWidth(),h=this.getTileHeight(),i=Math.floor(a[0]/g),j=Math.ceil(a[2]/g),m=Math.floor(a[1]/h),n=Math.ceil(a[3]/h),o=(Math.ceil(this.getWidth()/g),a[2]-a[0]),p=(a[3],a[1],this.getBytesPerPixel()),q=(this.getWidth(),this.fileDirectory.Predictor||1),r=[],s=[],t=0;t<b.length;++t)1===this.planarConfiguration?r.push(l(this.fileDirectory.BitsPerSample,0,b[t])/8):r.push(0),s.push(this.getReaderForSample(b[t]));for(var u=m;u<n;++u)for(var v=i;v<j;++v)for(var w=u*h,x=v*g,y=(u+1)*h,z=(v+1)*g,A=0;A<b.length;++A){var B=b[A];2===this.planarConfiguration&&(p=this.getSampleByteSize(B));var C=this.getTileOrStrip(v,u,B);1!==q&&(C=k(C,q,g,h,this.fileDirectory.BitsPerSample));var D=new DataView(C),E=s[A],F=Math.min(h,h-(y-a[3])),G=Math.min(g,g-(z-a[2])),H=(F*g+G)*p,I=new Uint8Array(D.buffer).length;2*I!==H&&this._debugMessages&&console.warn("dimension mismatch",I,H);for(var J=Math.max(0,a[1]-w);J<F;++J)for(var K=Math.max(0,a[0]-x);K<G;++K){var L=(J*g+K)*p,M=0;L<I-1&&(M=E.call(D,L+r[A],this.littleEndian));var N;d?(N=(J+w-a[1])*o*b.length+(K+x-a[0])*b.length+A,c[N]=M):(N=(J+w-a[1])*o+K+x-a[0],c[A][N]=M)}}return e(c),c}catch(a){return f(a)}},readRasters:function(){var a,b,c;switch(arguments.length){case 0:break;case 1:"function"==typeof arguments[0]?b=arguments[0]:a=arguments[0];break;case 2:"function"==typeof arguments[0]?(b=arguments[0],c=arguments[1]):(a=arguments[0],b=arguments[1]);break;case 3:a=arguments[0],b=arguments[1],c=arguments[2];break;default:throw new Error("Invalid number of arguments passed.")}a=a||{},c=c||function(a){console.error(a)};var d=a.window||[0,0,this.getWidth(),this.getHeight()],e=a.samples,f=a.interleave;if(d[0]<0||d[1]<0||d[2]>this.getWidth()||d[3]>this.getHeight())throw new Error("Select window is out of image bounds.");if(d[0]>d[2]||d[1]>d[3])throw new Error("Invalid subsets");var g,h=d[2]-d[0],i=d[3]-d[1],j=h*i;if(e){for(g=0;g<e.length;++g)if(e[g]>=this.fileDirectory.SamplesPerPixel)throw new RangeError("Invalid sample index '"+e[g]+"'.")}else for(e=[],g=0;g<this.fileDirectory.SamplesPerPixel;++g)e.push(g);var k;if(f){var l=this.fileDirectory.SampleFormat?Math.max.apply(null,this.fileDirectory.SampleFormat):1,n=Math.max.apply(null,this.fileDirectory.BitsPerSample);k=m(l,n,j*e.length)}else for(k=[],g=0;g<e.length;++g)k.push(this.getArrayForSample(e[g],j));if(this.getDecoder().isAsync()){if(!b)throw new Error("No callback specified for asynchronous raster reading.");return this._readRasterAsync(d,e,k,f,b,c)}return b=b||function(){},this._readRaster(d,e,k,f,b,c)},readRGB:function(){var a=null,b=null,c=null;switch(arguments.length){case 0:break;case 1:"function"==typeof arguments[0]?b=arguments[0]:a=arguments[0];break;case 2:"function"==typeof arguments[0]?(b=arguments[0],c=arguments[1]):(a=arguments[0],b=arguments[1]);break;case 3:a=arguments[0],b=arguments[1],c=arguments[2];break;default:throw new Error("Invalid number of arguments passed.")}a=a||{},c=c||function(a){console.error(a)};var d=a.window||[0,0,this.getWidth(),this.getHeight()];if(d[0]<0||d[1]<0||d[2]>this.getWidth()||d[3]>this.getHeight())throw new Error("Select window is out of image bounds.");if(d[0]>d[2]||d[1]>d[3])throw new Error("Invalid subsets");var g=d[2]-d[0],h=d[3]-d[1],i=this.fileDirectory.PhotometricInterpretation,j=this.fileDirectory.BitsPerSample[0],k=Math.pow(2,j);if(i===e.photometricInterpretations.RGB)return this.readRasters({window:a.window,interleave:!0},b,c);var l;switch(i){case e.photometricInterpretations.WhiteIsZero:case e.photometricInterpretations.BlackIsZero:case e.photometricInterpretations.Palette:l=[0];break;case e.photometricInterpretations.CMYK:l=[0,1,2,3];break;case e.photometricInterpretations.YCbCr:case e.photometricInterpretations.CIELab:l=[0,1,2];break;default:throw new Error("Invalid or unsupported photometric interpretation.")}var m={window:a.window,interleave:!0,samples:l},n=this.fileDirectory;return this.readRasters(m,function(a){switch(i){case e.photometricInterpretations.WhiteIsZero:return b(f.fromWhiteIsZero(a,k,g,h));case e.photometricInterpretations.BlackIsZero:return b(f.fromBlackIsZero(a,k,g,h));case e.photometricInterpretations.Palette:return b(f.fromPalette(a,n.ColorMap,g,h));case e.photometricInterpretations.CMYK:return b(f.fromCMYK(a,g,h));case e.photometricInterpretations.YCbCr:return b(f.fromYCbCr(a,g,h));case e.photometricInterpretations.CIELab:return b(f.fromCIELab(a,g,h))}},c)},getTiePoints:function(){if(!this.fileDirectory.ModelTiepoint)return[];for(var a=[],b=0;b<this.fileDirectory.ModelTiepoint.length;b+=6)a.push({i:this.fileDirectory.ModelTiepoint[b],j:this.fileDirectory.ModelTiepoint[b+1],k:this.fileDirectory.ModelTiepoint[b+2],x:this.fileDirectory.ModelTiepoint[b+3],y:this.fileDirectory.ModelTiepoint[b+4],z:this.fileDirectory.ModelTiepoint[b+5]});return a},getGDALMetadata:function(){var a={};if(!this.fileDirectory.GDAL_METADATA)return null;for(var b=this.fileDirectory.GDAL_METADATA,c=e.parseXml(b.substring(0,b.length-1)),d=c.evaluate("GDALMetadata/Item",c,null,XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,null),f=0;f<d.snapshotLength;++f){var g=d.snapshotItem(f);a[g.getAttribute("name")]=g.textContent}return a},getOrigin:function(){var a=this.fileDirectory.ModelTiepoint,b=this.fileDirectory.ModelTransformation;if(a&&6===a.length)return[a[3],a[4],a[5]];if(b)return[b[3],b[7],b[11]];throw new Error("The image does not have an affine transformation.")},getResolution:function(){var a=this.fileDirectory.ModelPixelScale,b=this.fileDirectory.ModelTransformation;if(a)return[a[0],a[1],a[2]];if(b)return[b[0],b[5],b[10]];throw new Error("The image does not have an affine transformation.")},pixelIsArea:function(){return 1===this.geoKeys.GTRasterTypeGeoKey},getBoundingBox:function(){var a=this.getOrigin(),b=this.getResolution(),c=a[0],d=a[1],e=c+b[0]*this.getWidth(),f=d+b[1]*this.getHeight();return[Math.min(c,e),Math.min(d,f),Math.max(c,e),Math.max(d,f)]}},b.exports=d},{"./compression/deflate.js":14,"./compression/lzw.js":15,"./compression/packbits.js":16,"./compression/raw.js":17,"./globals.js":21,"./predictor.js":23,"./rgb.js":24}],21:[function(a,b,c){"use strict";var d,e={315:"Artist",258:"BitsPerSample",265:"CellLength",264:"CellWidth",320:"ColorMap",259:"Compression",33432:"Copyright",306:"DateTime",338:"ExtraSamples",266:"FillOrder",289:"FreeByteCounts",288:"FreeOffsets",291:"GrayResponseCurve",290:"GrayResponseUnit",316:"HostComputer",270:"ImageDescription",257:"ImageLength",256:"ImageWidth",271:"Make",281:"MaxSampleValue",280:"MinSampleValue",272:"Model",254:"NewSubfileType",274:"Orientation",262:"PhotometricInterpretation",284:"PlanarConfiguration",296:"ResolutionUnit",278:"RowsPerStrip",277:"SamplesPerPixel",305:"Software",279:"StripByteCounts",273:"StripOffsets",255:"SubfileType",263:"Threshholding",282:"XResolution",283:"YResolution",326:"BadFaxLines",327:"CleanFaxData",343:"ClipPath",328:"ConsecutiveBadFaxLines",433:"Decode",434:"DefaultImageColor",269:"DocumentName",336:"DotRange",321:"HalftoneHints",346:"Indexed",347:"JPEGTables",285:"PageName",297:"PageNumber",317:"Predictor",319:"PrimaryChromaticities",532:"ReferenceBlackWhite",339:"SampleFormat",340:"SMinSampleValue",341:"SMaxSampleValue",559:"StripRowCounts",330:"SubIFDs",292:"T4Options",293:"T6Options",325:"TileByteCounts",323:"TileLength",324:"TileOffsets",322:"TileWidth",301:"TransferFunction",318:"WhitePoint",344:"XClipPathUnits",286:"XPosition",529:"YCbCrCoefficients",531:"YCbCrPositioning",530:"YCbCrSubSampling",345:"YClipPathUnits",287:"YPosition",37378:"ApertureValue",40961:"ColorSpace",36868:"DateTimeDigitized",36867:"DateTimeOriginal",34665:"Exif IFD",36864:"ExifVersion",33434:"ExposureTime",41728:"FileSource",37385:"Flash",40960:"FlashpixVersion",33437:"FNumber",42016:"ImageUniqueID",37384:"LightSource",37500:"MakerNote",37377:"ShutterSpeedValue",37510:"UserComment",33723:"IPTC",34675:"ICC Profile",700:"XMP",42112:"GDAL_METADATA",42113:"GDAL_NODATA",34377:"Photoshop",33550:"ModelPixelScale",33922:"ModelTiepoint",34264:"ModelTransformation",34735:"GeoKeyDirectory",34736:"GeoDoubleParams",34737:"GeoAsciiParams"},f={};for(d in e)f[e[d]]=parseInt(d);var g=[f.BitsPerSample,f.ExtraSamples,f.SampleFormat,f.StripByteCounts,f.StripOffsets,f.StripRowCounts,f.TileByteCounts,f.TileOffsets],h={1:"BYTE",2:"ASCII",3:"SHORT",4:"LONG",5:"RATIONAL",6:"SBYTE",7:"UNDEFINED",8:"SSHORT",9:"SLONG",10:"SRATIONAL",11:"FLOAT",12:"DOUBLE",16:"LONG8",17:"SLONG8",18:"IFD8"},i={};for(d in h)i[h[d]]=parseInt(d);var j={WhiteIsZero:0,BlackIsZero:1,RGB:2,Palette:3,TransparencyMask:4,CMYK:5,YCbCr:6,CIELab:8,ICCLab:9},k={1024:"GTModelTypeGeoKey",1025:"GTRasterTypeGeoKey",1026:"GTCitationGeoKey",2048:"GeographicTypeGeoKey",2049:"GeogCitationGeoKey",2050:"GeogGeodeticDatumGeoKey",2051:"GeogPrimeMeridianGeoKey",2052:"GeogLinearUnitsGeoKey",2053:"GeogLinearUnitSizeGeoKey",2054:"GeogAngularUnitsGeoKey",2055:"GeogAngularUnitSizeGeoKey",2056:"GeogEllipsoidGeoKey",2057:"GeogSemiMajorAxisGeoKey",2058:"GeogSemiMinorAxisGeoKey",2059:"GeogInvFlatteningGeoKey",2060:"GeogAzimuthUnitsGeoKey",2061:"GeogPrimeMeridianLongGeoKey",2062:"GeogTOWGS84GeoKey",3072:"ProjectedCSTypeGeoKey",3073:"PCSCitationGeoKey",3074:"ProjectionGeoKey",3075:"ProjCoordTransGeoKey",3076:"ProjLinearUnitsGeoKey",3077:"ProjLinearUnitSizeGeoKey",3078:"ProjStdParallel1GeoKey",3079:"ProjStdParallel2GeoKey",3080:"ProjNatOriginLongGeoKey",3081:"ProjNatOriginLatGeoKey",3082:"ProjFalseEastingGeoKey",3083:"ProjFalseNorthingGeoKey",3084:"ProjFalseOriginLongGeoKey",3085:"ProjFalseOriginLatGeoKey",3086:"ProjFalseOriginEastingGeoKey",3087:"ProjFalseOriginNorthingGeoKey",3088:"ProjCenterLongGeoKey",3089:"ProjCenterLatGeoKey",3090:"ProjCenterEastingGeoKey",3091:"ProjCenterNorthingGeoKey",3092:"ProjScaleAtNatOriginGeoKey",3093:"ProjScaleAtCenterGeoKey",3094:"ProjAzimuthAngleGeoKey",3095:"ProjStraightVertPoleLongGeoKey",3096:"ProjRectifiedGridAngleGeoKey",4096:"VerticalCSTypeGeoKey",4097:"VerticalCitationGeoKey",4098:"VerticalDatumGeoKey",4099:"VerticalUnitsGeoKey"},l={};for(d in k)l[k[d]]=parseInt(d);var m;"undefined"==typeof window?m=function(b){return(new(0,a("xmldom").DOMParser)).parseFromString(b,"text/xml")}:void 0!==window.DOMParser?m=function(a){return(new window.DOMParser).parseFromString(a,"text/xml")}:void 0!==window.ActiveXObject&&new window.ActiveXObject("Microsoft.XMLDOM")&&(m=function(a){var b=new window.ActiveXObject("Microsoft.XMLDOM");return b.async="false",b.loadXML(a),b}),b.exports={fieldTags:f,fieldTagNames:e,arrayFields:g,fieldTypes:i,fieldTypeNames:h,photometricInterpretations:j,geoKeys:l,geoKeyNames:k,parseXml:m}},{xmldom:"xmldom"}],22:[function(a,b,c){"use strict";var d=a("./geotiff.js"),e=function(a,b){var c,e,f,g;if("string"==typeof a||a instanceof String)for(c=new ArrayBuffer(2*a.length),g=new Uint16Array(c),e=0,f=a.length;e<f;++e)g[e]=a.charCodeAt(e);else{if(!(a instanceof ArrayBuffer))throw new Error("Invalid input data given.");c=a}return new d(c,b)};void 0!==b&&void 0!==b.exports&&(b.exports.parse=e),"undefined"!=typeof window?window.GeoTIFF={parse:e}:"undefined"!=typeof self&&(self.GeoTIFF={parse:e})},{"./geotiff.js":19}],23:[function(a,b,c){"use strict";function d(a,b,c){var d=a.length;d-=b;var e=0;do{for(var f=b;f>0;f--)a[e+b]+=a[e],e++;d-=b}while(d>0)}function e(a,b,c){for(var d,e=0,f=a.length,g=f/c;f>b;){for(d=b;d>0;--d)a[e+b]+=a[e],++e;f-=b}var h=a.slice();for(d=0;d<g;++d)for(var i=0;i<c;++i)a[c*d+i]=h[(c-i-1)*g+d]}b.exports={applyPredictor:function(a,b,c,f,g){var h,i;if(!b||1===b)return a;for(h=0;h<g.length;++h){if(g[h]%8!=0)throw new Error("When decoding with predictor, only multiple of 8 bits are supported.");if(g[h]!==g[0])throw new Error("When decoding with predictor, all samples must have the same size.")}var j=g[0]/8,k=g.length;for(h=0;h<f;++h)if(2===b){switch(g[0]){case 8:i=new Uint8Array(a,h*k*c*j,k*c*j);break;case 16:i=new Uint16Array(a,h*k*c*j,k*c*j/2);break;case 32:i=new Uint32Array(a,h*k*c*j,k*c*j/4);break;default:throw new Error("Predictor 2 not allowed with "+g[0]+" bits per sample.")}d(i,k,j)}else 3===b&&(i=new Uint8Array(a,h*k*c*j,c*j),e(i,k,j));return a}}},{}],24:[function(a,b,c){"use strict";function d(a,b,c,d){for(var e,f=new Uint8Array(c*d*3),g=0,h=0;g<a.length;++g,h+=3)e=256-a[g]/b*256,f[h]=e,f[h+1]=e,f[h+2]=e;return f}function e(a,b,c,d){for(var e,f=new Uint8Array(c*d*3),g=0,h=0;g<a.length;++g,h+=3)e=a[g]/b*256,f[h]=e,f[h+1]=e,f[h+2]=e;return f}function f(a,b,c,d){for(var e=new Uint8Array(c*d*3),f=b.length/3,g=b.length/3*2,h=0,i=0;h<a.length;++h,i+=3){var j=a[h];e[i]=b[j]/65536*256,e[i+1]=b[j+f]/65536*256,e[i+2]=b[j+g]/65536*256}return e}function g(a,b,c){for(var d,e,f,g,h=new Uint8Array(b*c*3),i=0,j=0;i<a.length;i+=4,j+=3)d=a[i],e=a[i+1],f=a[i+2],g=a[i+3],h[j]=(255-d)/256*255*((255-g)/256),h[j+1]=(255-e)/256*255*((255-g)/256),h[j+2]=(255-f)/256*255*((255-g)/256);return h}function h(a,b,c){for(var d,e,f,g=new Uint8Array(b*c*3),h=0,i=0;h<a.length;h+=3,i+=3)d=a[h],e=a[h+1],f=a[h+2],g[i]=d+1.402*(f-128),g[i+1]=d-.34414*(e-128)-.71414*(f-128),g[i+2]=d+1.772*(e-128);return g}function i(a,b,c){for(var d=new Uint8Array(b*c*3),e=0,f=0;e<a.length;e+=3,f+=3){var g,h,i,m=a[e+0],n=a[e+1]<<24>>24,o=a[e+2]<<24>>24,p=(m+16)/116,q=n/500+p,r=p-o/200;q=j*(q*q*q>.008856?q*q*q:(q-16/116)/7.787),p=k*(p*p*p>.008856?p*p*p:(p-16/116)/7.787),r=l*(r*r*r>.008856?r*r*r:(r-16/116)/7.787),g=3.2406*q+-1.5372*p+-.4986*r,h=-.9689*q+1.8758*p+.0415*r,i=.0557*q+-.204*p+1.057*r,g=g>.0031308?1.055*Math.pow(g,1/2.4)-.055:12.92*g,h=h>.0031308?1.055*Math.pow(h,1/2.4)-.055:12.92*h,i=i>.0031308?1.055*Math.pow(i,1/2.4)-.055:12.92*i,d[f]=255*Math.max(0,Math.min(1,g)),d[f+1]=255*Math.max(0,Math.min(1,h)),d[f+2]=255*Math.max(0,Math.min(1,i))}return d}var j=.95047,k=1,l=1.08883;b.exports={fromWhiteIsZero:d,fromBlackIsZero:e,fromPalette:f,fromCMYK:g,fromYCbCr:h,fromCIELab:i}},{}]},{},[22]);

    let parse_data = (data, debug) => {

    try {

        if (debug) console.log("starting parse_data with", data);
        if (debug) console.log("\tGeoTIFF:", typeof GeoTIFF);


        //console.log("parser:", parser);

        let result = {};

        let height, no_data_value, width;

        if (data.raster_type === "object") {
            result.values = data.data;
            result.height = height = data.metadata.height || result.values[0].length;
            result.width = width = data.metadata.width || result.values[0][0].length;
            result.pixelHeight = data.metadata.pixelHeight;
            result.pixelWidth = data.metadata.pixelWidth;
            result.projection = data.metadata.projection;
            result.xmin = data.metadata.xmin;
            result.ymax = data.metadata.ymax;
            result.no_data_value = no_data_value = data.metadata.no_data_value;
            result.number_of_rasters = result.values.length;
            result.xmax = result.xmin + result.width * result.pixelWidth;
            result.ymin = result.ymax - result.height * result.pixelHeight;
            result._data = null;
        } else if (data.raster_type === "geotiff") {
            result._data = data.data;
            
            let parser = typeof GeoTIFF !== "undefined" ? GeoTIFF : typeof window !== "undefined" ? window.GeoTIFF : typeof self !== "undefined" ? self.GeoTIFF : null;

            if (debug) console.log("data.raster_type is geotiff");
            let geotiff = parser.parse(data.data);
            if (debug) console.log("geotiff:", geotiff);

            let image = geotiff.getImage();
            if (debug) console.log("image:", image);

            let fileDirectory = image.fileDirectory;

            let geoKeys = image.getGeoKeys();

            if (debug) console.log("geoKeys:", geoKeys);
            result.projection = geoKeys.GeographicTypeGeoKey;
            if (debug) console.log("projection:", result.projection);

            result.height = height = image.getHeight();
            if (debug) console.log("result.height:", result.height);
            result.width = width = image.getWidth();
            if (debug) console.log("result.width:", result.width);            

            let [resolutionX, resolutionY, resolutionZ] = image.getResolution();
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);

            let [originX, originY, originZ ] = image.getOrigin();
            result.xmin = originX;
            result.xmax = result.xmin + width * result.pixelWidth;
            result.ymax = originY;
            result.ymin = result.ymax - height * result.pixelHeight;

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            //console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters().map(values_in_one_dimension => {
                let values_in_two_dimensions = [];
                for (let y = 0; y < height; y++) {
                    let start = y * width;
                    let end = start + width;
                    values_in_two_dimensions.push(values_in_one_dimension.slice(start, end));
                }
                return values_in_two_dimensions;
            });
        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        let max; let min;

        //console.log("starting to get min, max and ranges");
        for (let raster_index = 0; raster_index < result.number_of_rasters; raster_index++) {

            let rows = result.values[raster_index];
            if (debug) console.log("[georaster] rows:", rows);

            for (let row_index = 0; row_index < height; row_index++) {

                let row = rows[row_index];

                for (let column_index = 0; column_index < width; column_index++) {

                    let value = row[column_index];
                    if (value != no_data_value) {
                        if (typeof min === "undefined" || value < min) min = value;
                        else if (typeof max === "undefined" || value > max) max = value;
                    }
                }
            }

            result.maxs.push(max);
            result.mins.push(min);
            result.ranges.push(max - min);
        }

        return result;

    } catch (error) {

        console.error("[georaster] error parsing georaster:", error);

    }

}


    onmessage = e => {
        //console.error("inside worker on message started with", e); 
        let data = e.data;
        let result = parse_data(data);
        console.log("posting from web wroker:", result);
        if (result._data instanceof ArrayBuffer) {
            postMessage(result, [result._data]);
        } else {
            postMessage(result);
        }
        close();
    }
`;

class GeoRaster {

    constructor(data, metadata, debug) {
        
        if (debug) console.log("starting GeoRaster.constructor with", data, metadata);

        this._web_worker_is_available = typeof window !== "undefined" && window.Worker !== "undefined";
        this._blob_is_available = typeof Blob !== "undefined";
        this._url_is_available = typeof URL !== "undefined";

        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            this._data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            this.raster_type = "geotiff";
        } else if (data instanceof ArrayBuffer) {
            this._data = data;
            this.raster_type = "geotiff";
        } else if (Array.isArray(data) && metadata) {
            this._data = data;
            this.raster_type = "object";
            this._metadata = metadata;
        }
        
        if (debug) console.log("this after construction:", this);
    }


    initialize(debug) {
        return new Promise((resolve, reject) => {
            if (debug) console.log("starting GeoRaster.initialize");
            if (this.raster_type === "object" || this.raster_type === "geotiff" || this.raster_type === "tiff") {
                if (this._web_worker_is_available) {
                    let url;
                    if (this._blob_is_available) {
                        let blob = new Blob([web_worker_script], {type: 'application/javascript'});
                        //console.log("blob:", blob);
                        if (this._url_is_available) {
                            url = URL.createObjectURL(blob);
                            //console.log("url:", url);
                        }
                    }
                    var worker = new Worker(url);
                    //console.log("worker:", worker);
                    worker.onmessage = (e) => {
                        console.log("main thread received message:", e);
                        let data = e.data;
                        for (let key in data) {
                            this[key] = data[key];
                        }
                        resolve(this);
                    };
                    if (debug) console.log("about to postMessage");
                    if (this._data instanceof ArrayBuffer) {
                        worker.postMessage({
                            data: this._data,
                            raster_type: this.raster_type,
                            metadata: this._metadata
                        }, [this._data]);
                    } else {
                        worker.postMessage({
                            data: this._data,
                            raster_type: this.raster_type,
                            metadata: this._metadata
                        });
                    }
                } else {
                    if (debug) console.log("web worker is not available");
                    let result = parse_data({
                        data: this._data,
                        raster_type: this.raster_type,
                        metadata: this._metadata
                    });
                    if (debug) console.log("result:", result);
                    resolve(result);
                }
            } else {
                reject("couldn't find a way to parse");
            }
        });
    }

}

var parse_georaster = (input, metadata, debug) => {

    if (debug) console.log("starting parse_georaster with ", input, metadata);

    if (input === undefined) {
        let error_message = "[Georaster.parse_georaster] Error. You passed in undefined to parse_georaster. We can't make a raster out of nothing!";
        throw Error(error_message);
    }

    return new GeoRaster(input, metadata, debug).initialize(debug);
}

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = parse_georaster;
}

/*
    The following code allows you to use GeoRaster without requiring
*/
if (typeof window !== "undefined") {
    window["parse_georaster"] = parse_georaster;
} else if (typeof self !== "undefined") {
    self["parse_georaster"] = parse_georaster; // jshint ignore:line
}
